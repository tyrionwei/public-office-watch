"""Offline ballot-only proposals. No network, SQL, approval or publication writes."""
import argparse
import collections
import copy
import hashlib
import json
import pathlib
import re
import zipfile
from urllib.parse import urlsplit

OFFICES = {'議員': {'city_councilor', 'county_councilor'}, '市議員': {'city_councilor', 'county_councilor'}, '縣議員': {'county_councilor'},
           '市長': {'municipality_mayor', 'county_mayor'}, '縣長': {'county_mayor'}}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def number(value):
    if isinstance(value, bool) or not re.fullmatch(r'[1-9][0-9]{0,19}', str(value)):
        raise ValueError('ballot number must be a positive integer without suffixes')
    return str(value)

def scope_matches(source, target):
    race, election, region = target['race'], target['election'], target.get('region') or {}
    if (target['before'].get('race_id') != race.get('id')
            or race.get('election_id') != election.get('id')
            or race.get('region_id') != region.get('id')):
        return False
    if source['election_year'] != 2026 or election['year'] != 2026:
        return False
    if race['race_type'] not in OFFICES.get(source['office'], set()):
        return False
    if region.get('name') != source['county']:
        return False
    if '議員' in source['office']:
        a = re.fullmatch(re.escape(source['county']) + r'第([0-9]+|[一二三四五六七八九十]+)選(?:舉)?區', source['district'])
        b = re.fullmatch(re.escape(source['county']) + r'第([0-9]+)選舉區(?:平地原住民|山地原住民)?議員選舉', race['title'])
        chinese = dict(zip(('一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十'), range(1,21)))
        token = a[1] if a else ''
        district_no = int(token) if token.isascii() and token.isdigit() else chinese.get(token)
        return bool(b and district_no == int(b[1]))
    return race['title'] == source['county'] + source['office'] + '選舉'

def assert_unique_canonical_ballots(rows):
    # A canonical race identifies the office; source district/office spellings
    # are evidence labels, never uniqueness keys after mapping.
    seen = set()
    for row in rows:
        if row['classification'] == 'unresolved':
            continue
        key = (row['election_id'], row['race_id'], row['proposed_candidate_no'])
        if key in seen:
            raise ValueError('duplicate ballot number in canonical election/race')
        seen.add(key)

def plan(records, baseline):
    output, seen_source, seen_subject = [], set(), set()
    for index, source in enumerate(records):
        no = number(source['ballot_number'])
        if number(source['candidate_no']) != no:
            raise ValueError('inconsistent ballot number')
        office_family = 'councilor' if '議員' in source['office'] else 'chief'
        key = (source['election_year'], source['county'], office_family, source['district'], no)
        if key in seen_source:
            raise ValueError('duplicate ballot number in source race')
        seen_source.add(key)
        row = {'source_index': index, 'source': source, 'classification': 'unresolved',
               'approved_for_publication': False, 'executable': False}
        matches = []
        for group in ('candidates', 'roster'):
            for target in baseline[group]:
                before = target['before']
                name = before.get('candidate_name') or target.get('person_name') if group == 'candidates' else before['display_name']
                external = before.get('external_id') if group == 'candidates' else before['candidate_external_id']
                # Exact full name is combined with election, county, office, district
                # and an existing official-registration key; never invent a person ID.
                url = urlsplit(before.get('source_url') or '')
                official = url.scheme == 'https' and (url.hostname == 'cec.gov.tw' or (url.hostname or '').endswith('.cec.gov.tw'))
                if (source['candidate_name'].strip() and name == source['candidate_name'] and scope_matches(source, target)
                        and external and official):
                    matches.append((group, target, external))
        # The existing published candidate replaces only the same official roster key.
        replaced = {ext for group, t, ext in matches if group == 'candidates' and t['before']['is_public']}
        matches = [m for m in matches if not (m[0] == 'roster' and m[2] in replaced)]
        if len(matches) != 1:
            row['reason'] = 'missing_source_name' if not source['candidate_name'].strip() else 'no_exact_match' if not matches else 'ambiguous_exact_matches'
            row['matching_subject_ids'] = [t['before']['id'] for _, t, _ in matches]
            output.append(row)
            continue
        group, target, external = matches[0]
        before = target['before']
        subject = (group, before['id'])
        if subject in seen_subject:
            raise ValueError('multiple source rows resolve to one subject')
        seen_subject.add(subject)
        old = before.get('candidate_no')
        classification = 'new' if old is None else 'same' if str(old) == no else 'conflict'
        occupied = [x['before']['id'] for g in ('candidates','roster') for x in baseline[g]
                    if x['before']['race_id'] == before['race_id'] and x['before']['id'] != before['id']
                    and str(x['before'].get('candidate_no')) == no]
        if occupied:
            classification = 'conflict'
        row.update({'classification': classification, 'subject_type': 'candidate' if group == 'candidates' else 'registration_name',
                    'subject_id': before['id'], 'candidate_external_id': external,
                    'race_id': before['race_id'], 'election_id': target['election']['id'],
                    'person_id': before.get('person_id'), 'before': copy.deepcopy(before),
                    'mapping_basis': 'exact full name + year + county + office + explicit district number (retaining raw label) + existing external_id and official CEC registration source; proposal only, no new person link',
                    'scope_evidence': copy.deepcopy({k:target[k] for k in ('race','election','region')}),
                    'old_candidate_no': old, 'proposed_candidate_no': no})
        if group == 'candidates' and classification == 'new':
            after = copy.deepcopy(before); after['candidate_no'] = no
            row['after'] = after
            row['protected_fields'] = sorted(set(before) - {'candidate_no'})
            row['rollback_guard'] = 'entire exact after-image; restore entire saved before-image only after guard'
        else:
            row['after'] = copy.deepcopy(before)
        row['blockers'] = []
        if group == 'roster':
            row['blockers'].append('roster ballot storage/projection and local schema prerequisites not installed')
        if classification == 'conflict':
            row['blockers'].append('official correction evidence required; existing number preserved')
        if occupied:
            row['occupied_by_subject_ids'] = occupied
            row['blockers'].append('number already assigned to another subject in this race')
        row['blockers'].append('source fetched_at requires retained source-index reconciliation; no executable event yet')
        row['event_proposal'] = {
            'external_id': 'pow-ballot-2026-' + sha(json.dumps([subject,source['source_sha256'],no],ensure_ascii=False).encode())[:32],
            'candidate_id': before['id'] if group == 'candidates' else None,
            'registration_name_id': before['id'] if group == 'roster' else None,
            'event_type': 'ballot_number_assigned', 'occurred_on': source.get('draw_date'),
            'source_published_on': source.get('source_date'), 'source_url': source['announcement_url'],
            'source_hash': source['source_sha256'], 'evidence_url': source['evidence_url'],
            'source_page': source['source_page'], 'candidateNo': no, 'is_public': False,
        }
        # Events already present must be reviewed rather than duplicated.
        existing = [e for e in baseline.get('events',[]) if e.get('candidate_id') == before['id'] or e.get('registration_name_id') == before['id']]
        if existing:
            row['existing_events'] = existing
            row['blockers'].append('existing event reconciliation required')
        output.append(row)
    assert_unique_canonical_ballots(output)
    return output

def run(package, baseline_path, destination):
    raw = pathlib.Path(package).read_bytes()
    with zipfile.ZipFile(package) as z:
        manifest = json.loads(z.read('PACKAGE-CHECKSUMS.json'))
        for entry in manifest:
            data = z.read(entry['path'])
            if len(data) != entry['bytes'] or sha(data) != entry['sha256']:
                raise ValueError('package member checksum mismatch: ' + entry['path'])
        records = json.loads(z.read('ballot-number-candidates.json'))
        digests = {sha(z.read(n)) for n in z.namelist() if not n.endswith('/')}
        for row in records:
            if row['source_sha256'] not in digests:
                raise ValueError('source evidence bytes missing from package')
        baseline_bytes = pathlib.Path(baseline_path).read_bytes()
        rows = plan(records, json.loads(baseline_bytes))
    summary = {'mode':'offline_draft_only','total':len(rows),
               'counts': dict(collections.Counter(r['classification'] for r in rows)),
               'subjects':dict(collections.Counter(r.get('subject_type','unresolved') for r in rows)),
               'package_bytes':len(raw),'package_sha256':sha(raw),'verified_package_members':len(manifest),
               'baseline_sha256':sha(baseline_bytes),'published':0,'database_writes':0}
    dest=pathlib.Path(destination); dest.mkdir(parents=True,exist_ok=True)
    for name,value in [('summary.json',summary),('diff.json',rows)]:
        with (dest/name).open('x',encoding='utf8') as f:
            json.dump(value,f,ensure_ascii=False,indent=2)
    print(json.dumps(summary,ensure_ascii=False))

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package',required=True);parser.add_argument('--baseline',required=True);parser.add_argument('--output',required=True)
    args=parser.parse_args();run(args.package,args.baseline,args.output)
