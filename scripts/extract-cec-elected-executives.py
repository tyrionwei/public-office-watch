#!/usr/bin/env python3
import argparse
import csv
import io
import json
import pathlib
import zipfile
from datetime import datetime, timezone


SOURCE_ID = 'cec-election-database'
SOURCE_NAME = '中央選舉委員會選舉資料庫'
SOURCE_URL = 'https://data.gov.tw/dataset/13119'
RAW_SOURCE_URL = 'https://data.cec.gov.tw/選舉資料庫/votedata.zip'

TARGETS = {
    '1994直轄市長': ('1994-12-03', 'local_chief'),
    '1997縣市長': ('1997-11-29', 'local_chief'),
    '1998直轄市長': ('1998-12-05', 'local_chief'),
    '2001縣市長': ('2001-12-01', 'local_chief'),
    '2002直轄市長': ('2002-12-07', 'local_chief'),
    '2005縣市長': ('2005-12-03', 'local_chief'),
    '2006直轄市長': ('2006-12-09', 'local_chief'),
    '20091205-縣市長縣市議員及鄉鎮長/縣市長': ('2009-12-05', 'local_chief'),
    '20101127-五都市長議員及里長/市長': ('2010-11-27', 'local_chief'),
    '2014-103年地方公職人員選舉/直轄市市長': ('2014-11-29', 'local_chief'),
    '2014-103年地方公職人員選舉/縣市市長': ('2014-11-29', 'local_chief'),
    '9任總統': ('1996-03-23', 'presidential_ticket'),
    '2000年10任總統': ('2000-03-18', 'presidential_ticket'),
    '2004   11任總統': ('2004-03-20', 'presidential_ticket'),
    '20080322-總統': ('2008-03-22', 'presidential_ticket'),
    '20120114-總統及立委/總統': ('2012-01-14', 'presidential_ticket'),
}

CURRENT_REGION_NAMES = {
    '臺北縣': '新北市',
    '桃園縣': '桃園市',
    '臺中縣': '臺中市',
    '臺中市': '臺中市',
    '臺南縣': '臺南市',
    '臺南市': '臺南市',
    '高雄縣': '高雄市',
    '高雄市': '高雄市',
}


def decoded_name(name):
    return name.encode('cp437').decode('big5', 'replace')


def clean(value):
    return str(value or '').strip().lstrip("'").replace('台', '臺')


def csv_rows(archive, member):
    content = archive.read(member).decode('utf-8-sig')
    return list(csv.reader(io.StringIO(content)))


def roc_birth_date(value):
    text = clean(value)
    if not text.isdigit() or len(text) not in (3, 7):
        return None, None
    year = int(text[:3]) + 1911
    if len(text) == 3 or text[3:] == '0000':
        return f'{year:04d}', 'year'
    month = int(text[3:5])
    day = int(text[5:7])
    if not 1 <= month <= 12 or not 1 <= day <= 31:
        return f'{year:04d}', 'year'
    return f'{year:04d}-{month:02d}-{day:02d}', 'day'


def top_level_regions(rows):
    result = {}
    for row in rows:
        if len(row) < 6:
            continue
        values = [clean(value) for value in row[:5]]
        if values[2:] == ['00', '000', '0000']:
            result[(values[0], values[1])] = clean(row[5])
    return result


def parties(rows):
    return {clean(row[0]): clean(row[1]) for row in rows if len(row) >= 2}


def normalize_party(value):
    if value in ('無', '無黨籍及未經政黨推薦', '無黨籍及其他'):
        return '無黨籍'
    return value or None


def vote_totals(rows):
    totals = {}
    for row in rows:
        if len(row) < 10:
            continue
        values = [clean(value) for value in row]
        if values[3:6] != ['000', '0000', '0']:
            continue
        key = (values[0], values[1], values[6])
        totals[key] = {
            'voteCount': int(values[7]) if values[7].isdigit() else None,
            'voteRate': float(values[8]) if values[8] else None,
        }
    return totals


def office_name(region_name):
    suffix = '市長' if region_name.endswith('市') else '縣長'
    return f'{region_name}{suffix}'


def target_members(members, directory):
    prefix = f'votedata/votedata/voteData/{directory}/'
    return {
        kind: members.get(f'{prefix}{kind}.csv')
        for kind in ('elbase', 'elcand', 'elctks', 'elpaty')
    }


def extract_target(archive, directory, voting_date, election_kind, files):
    missing = [kind for kind, member in files.items() if member is None]
    if missing:
        raise RuntimeError(f'{directory}: missing {", ".join(missing)}')

    base_rows = csv_rows(archive, files['elbase'])
    candidate_rows = csv_rows(archive, files['elcand'])
    party_names = parties(csv_rows(archive, files['elpaty']))
    totals = vote_totals(csv_rows(archive, files['elctks']))
    regions = top_level_regions(base_rows)
    year = int(voting_date[:4])

    if election_kind == 'presidential_ticket':
        winning_numbers = {
            clean(row[5]) for row in candidate_rows
            if len(row) > 14 and clean(row[14]) == '*'
        }
        selected = [row for row in candidate_rows if clean(row[5]) in winning_numbers]
    else:
        selected = [row for row in candidate_rows if len(row) > 14 and clean(row[14]) == '*']

    records = []
    for row in selected:
        values = [clean(value) for value in row]
        candidate_no = values[5]
        historical_region = '全國' if election_kind == 'presidential_ticket' else regions.get((values[0], values[1]))
        if not historical_region:
            raise RuntimeError(f'{directory}: region not found for {values[0]}-{values[1]} {values[6]}')

        ticket_role = None
        current_region = None
        if election_kind == 'presidential_ticket':
            ticket_role = 'vice_president' if len(values) > 15 and values[15] == 'Y' else 'president'
            role_name = '副總統' if ticket_role == 'vice_president' else '總統'
        else:
            role_name = office_name(historical_region)
            current_region = CURRENT_REGION_NAMES.get(historical_region, historical_region)

        birth_date, birth_precision = roc_birth_date(values[9])
        vote = totals.get((values[0], values[1], candidate_no), {})
        records.append({
            'electionYear': year,
            'votingDate': voting_date,
            'electionType': 'president' if election_kind == 'presidential_ticket' else 'local_chief',
            'officeRole': ticket_role or 'local_chief',
            'officeName': role_name,
            'historicalRegionName': historical_region,
            'canonicalRegionName': current_region,
            'name': values[6].strip(),
            'party': normalize_party(party_names.get(values[7], values[7])),
            'candidateNo': candidate_no,
            'gender': {'1': 'male', '2': 'female'}.get(values[8], 'unknown'),
            'birthDate': birth_date,
            'birthDatePrecision': birth_precision,
            'educationLevel': values[12] or None,
            'wasIncumbentAtElection': values[13] == 'Y',
            'voteCount': vote.get('voteCount'),
            'voteRate': vote.get('voteRate'),
            'isElected': True,
            'sourceId': SOURCE_ID,
            'sourceName': SOURCE_NAME,
            'sourceUrl': SOURCE_URL,
            'rawSourceUrl': RAW_SOURCE_URL,
            'sourceArchivePath': decoded_name(files['elcand']),
        })
    return records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('archive')
    parser.add_argument('--output')
    args = parser.parse_args()

    with zipfile.ZipFile(args.archive) as archive:
        members = {decoded_name(name): name for name in archive.namelist()}
        records = []
        for directory, (voting_date, election_kind) in TARGETS.items():
            records.extend(extract_target(
                archive,
                directory,
                voting_date,
                election_kind,
                target_members(members, directory),
            ))

    records.sort(key=lambda row: (
        row['electionYear'],
        row['historicalRegionName'],
        row['officeRole'],
        row['name'],
    ))
    output = {
        'schemaVersion': 1,
        'name': 'cec-elected-executives-1994-2014',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'scope': 'Directly elected presidents, vice presidents, and county/city chiefs from 1994 through 2014.',
        'source': {
            'id': SOURCE_ID,
            'name': SOURCE_NAME,
            'url': SOURCE_URL,
            'rawUrl': RAW_SOURCE_URL,
        },
        'summary': {
            'recordCount': len(records),
            'personCount': len({row['name'] for row in records}),
            'presidentCount': len([row for row in records if row['officeRole'] == 'president']),
            'vicePresidentCount': len([row for row in records if row['officeRole'] == 'vice_president']),
            'localChiefCount': len([row for row in records if row['officeRole'] == 'local_chief']),
        },
        'records': records,
    }
    text = json.dumps(output, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        pathlib.Path(args.output).write_text(text, encoding='utf-8')
    else:
        print(text, end='')
    print(json.dumps(output['summary'], ensure_ascii=False))


if __name__ == '__main__':
    main()
