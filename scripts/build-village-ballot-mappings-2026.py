#!/usr/bin/env python3
"""Extract explicitly named 2026 village-chief constituencies from local CEC PDF text.

Reads only the previously downloaded official PDFs and their text/OCR sidecars.
Unmatched or nonunique rows remain in the report; this script never fills gaps
from a previous election's race catalog.
"""

import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
import re
import subprocess
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
PDFS = ROOT / 'tmp/pdfs/cec-2026-grassroots'
CONFIG = ROOT / 'scripts/data/village-ballot-sources-2026.json'
VILLAGES = ROOT / 'apps/web/src/data/generated/taiwanVillageDirectory.ts'
DISTRICTS = ROOT / 'apps/web/src/data/generated/taiwanDistrictDirectory.ts'
REGIONS = ROOT / 'apps/web/src/data/taiwanRegions.ts'
RACES = ROOT / 'supabase/migrations'
RACE_OVERRIDES = ROOT / 'scripts/data/village-race-link-overrides-2026.json'
OUTPUT = ROOT / 'apps/web/src/data/villageBallotMappings2026.ts'
REPORT = ROOT / 'tmp/ballot-mapping/village-complete/coverage.json'
CHIEF_OUTPUT = ROOT / 'apps/web/src/data/localChiefBallotMappings2026.ts'
CHIEF_REPORT = ROOT / 'tmp/ballot-mapping/village-complete/local-chief-coverage.json'
RACE_TITLE_ALIASES = {
    # Same 10009200021 village: 2026 CEC registration p9 uses 瓊埔 and matches the existing race candidates.
    # https://web.cec.gov.tw/api/file/368345c1-7e14-45f7-a8ba-24c767ae02e9.pdf
    '雲林縣水林鄉欍埔村村長選舉': '雲林縣水林鄉瓊埔村村長選舉',
    # Official/current administrative code spelling differs from the imported race title.
    '新北市瑞芳區濂洞里里長選舉': '新北市瑞芳區濓洞里里長選舉',
    '新北市瑞芳區濂新里里長選舉': '新北市瑞芳區濓新里里長選舉',
    '新北市坪林區石曹里里長選舉': '新北市坪林區石\ue001里里長選舉',
    '臺南市龍崎區石曹里里長選舉': '臺南市龍崎區石\ue001里里長選舉',
    '臺南市新化區那拔里里長選舉': '臺南市新化區𦰡拔里里長選舉',
}


def norm(value: str) -> str:
    return unicodedata.normalize('NFKC', value).replace('臺', '台').replace('巿', '市')


def compact(value: str) -> str:
    return re.sub(r'\s+', '', norm(value))


def read_directory(path: Path, code_size: int) -> dict[str, list[tuple[str, str]]]:
    text = path.read_text()
    pattern = rf'"(\d{{{code_size}}})": \[(.*?)\n  \]'
    return {
        key: re.findall(rf'"code": "(\d{{{code_size + 3}}})",(?:\s*"legacyCode": "[^\"]+",)?\s*"name": "([^\"]+)"', body)
        for key, body in re.findall(pattern, text, re.S)
    }


def documents(commission: str, prefix: str) -> tuple[Path, str]:
    folder = PDFS / commission
    pdfs = list(folder.glob(prefix + '*.pdf'))
    if len(pdfs) != 1:
        raise ValueError(f'{commission}/{prefix}: expected exactly one PDF, found {len(pdfs)}')
    pdf = pdfs[0]
    sidecar = pdf.with_suffix('.txt')
    if sidecar.exists() and len(sidecar.read_text(errors='replace').strip('\f\n\r\t ')) > 100:
        return sidecar, 'text'
    ocr = PDFS / 'ocr' / commission / pdf.stem / 'document.ocr.txt'
    if ocr.exists():
        return ocr, 'ocr'
    raise ValueError(f'{pdf}: no usable text or OCR')


def numbered_pages(path: Path, kind: str) -> list[tuple[int, str]]:
    pages = path.read_text(errors='replace').split('\f')
    if kind == 'ocr':
        pdf = PDFS / path.parent.parent.name / (path.parent.name + '.pdf')
        details = subprocess.check_output(['pdfinfo', str(pdf)], text=True)
        count = int(re.search(r'^Pages:\s*(\d+)', details, re.M).group(1))
        if len(pages) in (count * 2, count * 2 + 1):
            pages = pages[::2][:count]
        elif len(pages) in (count, count + 1):
            pages = pages[:count]
        else:
            raise ValueError(f'OCR page count mismatch: {path}, {len(pages)} segments, {count} PDF pages')
    return list(enumerate(pages, 1))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='Compare generated files without writing')
    parser.add_argument('--chief-only', action='store_true', help='Build only township and indigenous district chiefs')
    args = parser.parse_args()
    if args.chief_only:
        build_chiefs(args.check)
        return
    config = json.loads(CONFIG.read_text())
    village_rows = read_directory(VILLAGES, 8)
    district_rows = read_directory(DISTRICTS, 5)
    county_names = dict(re.findall(r"code: '(\d{5})', name: '([^']+)'", REGIONS.read_text()))
    race_ids: dict[str, list[str]] = defaultdict(list)
    for path in sorted(RACES.glob('*load_2026_release_races*.sql')):
        for match in re.finditer(r'\$([A-Za-z_0-9]+)\$(\[.*?\])\$\1\$', path.read_text(), re.S):
            for race in json.loads(match[2]):
                if race['race_type'] == 'village_chief':
                    race_ids[race['title']].append(race['id'])
    overrides = json.loads(RACE_OVERRIDES.read_text())
    if overrides['eventKey'] != '2026-2026-11-28-local':
        raise ValueError('Unexpected race override event')
    for link in overrides['links']:
        prior = race_ids.get(link['title'], [])
        if prior and prior != [link['raceId']]:
            raise ValueError(f'Conflicting migration and published race ID: {link["title"]}')
        race_ids[link['title']] = [link['raceId']]
    mappings = []
    report = {'eventKey': '2026-2026-11-28-local', 'method': '2026 official village-chief table, named row and one-seat marker', 'counties': []}
    for source in config['sources']:
        county_code = source['countyCode']
        county_name = county_names[county_code]
        district_names = {code: name for code, name in district_rows[county_code]}
        entries = [(district_code, village_code, village_name)
                   for district_code, rows in village_rows.items()
                   if district_code in district_names
                   for village_code, village_name in rows]
        text_path, text_kind = documents(source['commission'], source['filePrefix'])
        pdf_id = text_path.stem if text_kind == 'text' else text_path.parent.name
        pdf_url = f'https://web.cec.gov.tw/api/file/{pdf_id}.pdf'
        pages = numbered_pages(text_path, text_kind)
        name_counts = Counter(norm(village_name) for _, _, village_name in entries)
        found = {}
        for page_number, page in pages:
            if page_number < source['firstVillagePage'] or not page.strip():
                continue
            current_district = None
            page_districts = [code for code, name in district_names.items() if norm(name) in norm(page)]
            for raw_line in page.splitlines():
                stripped = compact(raw_line)
                if not stripped:
                    continue
                for district_code, district_name in district_names.items():
                    if stripped.startswith(norm(district_name)):
                        current_district = district_code
                        break
                # A village-chief row has a constituency name and one seat.
                for district_code, village_code, village_name in entries:
                    token = norm(village_name)
                    if not re.search(re.escape(token) + r'1(?=[\d,， ]|$)', stripped):
                        continue
                    if name_counts[token] > 1:
                        if current_district != district_code and not (len(page_districts) == 1 and page_districts[0] == district_code):
                            continue
                    row = {'districtCode': district_code, 'villageCode': village_code,
                           'villageName': village_name, 'page': page_number,
                           'rawScope': raw_line.strip()}
                    found.setdefault(village_code, []).append(row)
        broad_scope = source.get('broadScope')
        broad_url = None
        if broad_scope:
            scope_path, scope_kind = documents(source['commission'], source.get('scopeFilePrefix', source['filePrefix']))
            scope_pdf_id = scope_path.stem if scope_path.suffix == '.txt' and scope_path.stem != 'document.ocr' else scope_path.parent.name
            broad_url = f'https://web.cec.gov.tw/api/file/{scope_pdf_id}.pdf'
            scope_pages = dict(numbered_pages(scope_path, scope_kind))
            scope_page = source['scopePage']
            if not source.get('visualReview') and compact(broad_scope) not in compact(scope_pages[scope_page]):
                raise ValueError(f'{county_name}: broad scope text not found on PDF page {scope_page}')
        missing = []
        conflicting = []
        for district_code, village_code, village_name in entries:
            hits = found.get(village_code, [])
            if not hits and not broad_scope:
                missing.append({'districtCode': district_code, 'villageCode': village_code, 'name': village_name})
                continue
            # Repeated rows on multiple pages or OCR collisions require review.
            unique = {(hit['page'], hit['rawScope']) for hit in hits}
            if len(unique) > 1 and not broad_scope:
                conflicting.append({'villageCode': village_code, 'name': village_name, 'hits': hits})
                continue
            exact_row = len(unique) == 1
            hit = hits[0] if exact_row else {'page': source['scopePage'], 'rawScope': broad_scope}
            race_title = county_name + district_names[district_code] + village_name + ('村長選舉' if village_name.endswith('村') else '里長選舉')
            normalized_title = race_title.replace('[', '').replace(']', '')
            links = race_ids.get(RACE_TITLE_ALIASES.get(normalized_title, normalized_title), [])
            if len(links) > 1:
                raise ValueError(f'duplicate 2026 race title: {race_title}')
            mapping = {
                'id': f'2026-villageChief-{village_code}',
                'eventKey': report['eventKey'], 'office': 'villageChief',
                'countyCode': county_code, 'districtCodes': [district_code],
                'villageCodes': [village_code], 'categories': ['general', 'lowland', 'highland'],
                'constituencyName': race_title.removesuffix('選舉'),
                'source': {'url': pdf_url if exact_row else broad_url, 'publishedOn': source.get('announcementDate', config['announcementDate']),
                           'rawScope': hit['rawScope'], 'page': hit['page'],
                           'method': 'announcement-row' if exact_row else 'administrative-boundary',
                           **({} if exact_row else {'legalBasis': 'https://law.cec.gov.tw/LawContent.aspx?id=GL000292'})},
            }
            if links:
                mapping['raceId'] = links[0]
            mappings.append(mapping)
        report['counties'].append({'countyCode': county_code, 'countyName': county_name,
                                   'sourceUrl': pdf_url, 'broadSourceUrl': broad_url, 'textKind': text_kind,
                                   'legalBasis': 'https://law.cec.gov.tw/LawContent.aspx?id=GL000292#law-article-36' if broad_scope else None,
                                   'broadScope': broad_scope, 'broadScopeVerifiedBy': 'visual review' if source.get('visualReview') else 'text match' if broad_scope else None,
                                   'broadScopeMapped': sum(1 for row in mappings if row['countyCode'] == county_code and row['source']['method'] == 'administrative-boundary'),
                                   'linked': sum(1 for row in mappings if row['countyCode'] == county_code and row.get('raceId')),
                                   'directoryVillages': len(entries), 'confirmed': len(entries) - len(missing) - len(conflicting),
                                   'missing': missing, 'conflicting': conflicting})
    mappings.sort(key=lambda row: row['id'])
    report['missingRaceLinks'] = [row['constituencyName'] for row in mappings if 'raceId' not in row]
    compact_rows = defaultdict(list)
    source_records = []
    source_indexes = {}
    for row in mappings:
        village_code = row['villageCodes'][0]
        village_name = row['constituencyName'].removeprefix(county_names[row['countyCode']])
        district_name = next(name for code, name in district_rows[row['countyCode']] if code == village_code[:8])
        village_name = village_name.removeprefix(district_name).removesuffix('村長').removesuffix('里長')
        source_key = json.dumps(row['source'], ensure_ascii=False, sort_keys=True)
        if source_key not in source_indexes:
            source_indexes[source_key] = len(source_records)
            source_records.append(row['source'])
        compact_rows[row['countyCode']].append([village_code, village_name, source_indexes[source_key], row.get('raceId')])
    body = '''// Generated by scripts/build-village-ballot-mappings-2026.py from 2026 official announcements.
// Announcement-row scopes are directly named in the PDF. Administrative-boundary scopes
// combine the 2026 election announcement with Electoral Law Article 36(1)(2).
import { taiwanDistrictsByCountyCode } from './generated/taiwanDistrictDirectory.ts';
import { taiwanRegions } from './taiwanRegions.ts';
import type { BallotMapping, BallotSource } from '../types/ballot.ts';

type CompactRow = readonly [villageCode: string, villageName: string, sourceIndex: number, raceId?: string | null];
const sources: readonly BallotSource[] =
'''
    body += '[\n' + ''.join('  ' + json.dumps(source, ensure_ascii=False, separators=(',', ':')) + ',\n' for source in source_records) + '];\n'
    body += 'const rowsByCounty: Readonly<Record<string, readonly CompactRow[]>> = {\n'
    body += ''.join('  ' + json.dumps(code) + ':' + json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + ',\n'
                    for code, rows in sorted(compact_rows.items()))
    body += '''};
const districtNames = new Map(Object.values(taiwanDistrictsByCountyCode).flat().map(({ code, name }) => [code, name]));
const countyNames = new Map(taiwanRegions.map(({ code, name }) => [code, name]));
export const villageBallotMappings2026: readonly BallotMapping[] = Object.entries(rowsByCounty).flatMap(([countyCode, rows]) => {
  const countyName = countyNames.get(countyCode);
  if (!countyName) throw new Error(`Missing county for ${countyCode}`);
  return rows.map(([villageCode, villageName, sourceIndex, raceId]): BallotMapping => {
    const districtCode = villageCode.slice(0, 8);
    const districtName = districtNames.get(districtCode);
    const source = sources[sourceIndex];
    if (!districtName || !source) throw new Error(`Missing district or source for ${villageCode}`);
    return {
      id: `2026-villageChief-${villageCode}`,
      eventKey: '2026-2026-11-28-local', office: 'villageChief', countyCode,
      districtCodes: [districtCode], villageCodes: [villageCode],
      categories: ['general', 'lowland', 'highland'],
      constituencyName: `${countyName}${districtName}${villageName}${villageName.endsWith('村') ? '村長' : '里長'}`,
      ...(raceId ? { raceId } : {}),
      source,
    };
  });
});
'''
    report_text = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.check:
        if OUTPUT.read_text() != body or REPORT.read_text() != report_text:
            raise SystemExit('Generated village mapping differs from checked-in output')
    else:
        OUTPUT.write_text(body)
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        REPORT.write_text(report_text)
    print('Confirmed', len(mappings), 'of', sum(c['directoryVillages'] for c in report['counties']))
    for county in report['counties']:
        print(county['countyName'], county['confirmed'], '/', county['directoryVillages'])


def build_chiefs(check: bool) -> None:
    config = json.loads(CONFIG.read_text())
    district_rows = read_directory(DISTRICTS, 5)
    county_names = dict(re.findall(r"code: '(\d{5})', name: '([^']+)'", REGIONS.read_text()))
    race_ids: dict[str, list[str]] = defaultdict(list)
    for path in sorted(RACES.glob('*load_2026_release_races*.sql')):
        for match in re.finditer(r'\$([A-Za-z_0-9]+)\$(\[.*?\])\$\1\$', path.read_text(), re.S):
            for race in json.loads(match[2]):
                if race['race_type'] == 'township_mayor':
                    race_ids[race['title']].append(race['id'])
    source_records = []
    rows_by_county = defaultdict(list)
    report = {'eventKey': '2026-2026-11-28-local', 'method': '2026 announcement plus Electoral Law Article 36 administrative area', 'counties': [], 'missingRaceLinks': []}
    seen_districts = set()
    for item in config['chiefSources']:
        county_code = item['countyCode']
        county_name = county_names[county_code]
        path, kind = documents(item['commission'], item['filePrefix'])
        page = dict(numbered_pages(path, kind))[item['page']]
        if not item.get('visualReview') and compact(item['rawScope']) not in compact(page):
            raise ValueError(f'{county_name}: chief scope text not found on PDF page {item["page"]}')
        pdf_id = path.stem if kind == 'text' else path.parent.name
        source = {'url': f'https://web.cec.gov.tw/api/file/{pdf_id}.pdf',
                  'publishedOn': config['announcementDate'], 'rawScope': item['rawScope'],
                  'page': item['page'], 'method': 'administrative-boundary',
                  'legalBasis': 'https://law.cec.gov.tw/LawContent.aspx?id=GL000292'}
        source_index = len(source_records)
        source_records.append(source)
        districts = [(code, name) for code, name in district_rows[county_code]
                     if 'districtNames' not in item or name in item['districtNames']]
        if item['office'] == 'townshipMayor' and not county_name.endswith('縣'):
            raise ValueError(f'Unexpected township office in {county_name}')
        if item.get('districtNames') and len(districts) != len(item['districtNames']):
            raise ValueError(f'Chief district mismatch in {county_name}')
        for district_code, district_name in districts:
            if district_code in seen_districts:
                raise ValueError(f'Duplicate chief district: {district_code}')
            seen_districts.add(district_code)
            title = county_name + district_name + district_name[-1] + '長選舉'
            links = race_ids.get(title, [])
            if len(links) > 1:
                raise ValueError(f'Duplicate 2026 chief race title: {title}')
            if not links:
                report['missingRaceLinks'].append(title)
            rows_by_county[county_code].append([district_code, source_index, 1 if item['office'] == 'indigenousDistrictMayor' else 0, links[0] if links else None])
        report['counties'].append({'countyCode': county_code, 'countyName': county_name,
                                   'office': item['office'], 'count': len(districts),
                                   'sourceUrl': source['url'], 'page': item['page'],
                                   'verifiedBy': 'visual review' if item.get('visualReview') else 'text match'})
    body = '''// Generated by scripts/build-village-ballot-mappings-2026.py from 2026 official chief announcements.
// Constituencies follow the administrative areas under Electoral Law Article 36(1)(2).
import { taiwanDistrictsByCountyCode } from './generated/taiwanDistrictDirectory.ts';
import { taiwanRegions } from './taiwanRegions.ts';
import type { BallotMapping, BallotSource } from '../types/ballot.ts';

type CompactRow = readonly [districtCode: string, sourceIndex: number, indigenous: 0 | 1, raceId?: string];
const sources: readonly BallotSource[] =
'''
    body += '[\n' + ''.join('  ' + json.dumps(source, ensure_ascii=False, separators=(',', ':')) + ',\n' for source in source_records) + '];\n'
    body += 'const rowsByCounty: Readonly<Record<string, readonly CompactRow[]>> = {\n'
    body += ''.join('  ' + json.dumps(code) + ':' + json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + ',\n'
                    for code, rows in sorted(rows_by_county.items()))
    body += '''};
const districtNames = new Map(Object.values(taiwanDistrictsByCountyCode).flat().map(({ code, name }) => [code, name]));
const countyNames = new Map(taiwanRegions.map(({ code, name }) => [code, name]));
export const localChiefBallotMappings2026: readonly BallotMapping[] = Object.entries(rowsByCounty).flatMap(([countyCode, rows]) => {
  const countyName = countyNames.get(countyCode);
  if (!countyName) throw new Error(`Missing county for ${countyCode}`);
  return rows.map(([districtCode, sourceIndex, indigenous, raceId]): BallotMapping => {
    const districtName = districtNames.get(districtCode);
    const source = sources[sourceIndex];
    if (!districtName || !source) throw new Error(`Missing district or source for ${districtCode}`);
    const office = indigenous ? 'indigenousDistrictMayor' : 'townshipMayor';
    return {
      id: `2026-${office}-${districtCode}`,
      eventKey: '2026-2026-11-28-local', office, countyCode, districtCodes: [districtCode],
      categories: ['general', 'lowland', 'highland'],
      constituencyName: `${countyName}${districtName}${districtName.slice(-1)}長`,
      ...(raceId ? { raceId } : {}), source,
    };
  });
});
'''
    report_text = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if check:
        if CHIEF_OUTPUT.read_text() != body or CHIEF_REPORT.read_text() != report_text:
            raise SystemExit('Generated chief mapping differs from checked-in output')
    else:
        CHIEF_OUTPUT.write_text(body)
        CHIEF_REPORT.parent.mkdir(parents=True, exist_ok=True)
        CHIEF_REPORT.write_text(report_text)
    print('Chief constituencies', sum(len(rows) for rows in rows_by_county.values()), 'missing links', len(report['missingRaceLinks']))


if __name__ == '__main__':
    main()
