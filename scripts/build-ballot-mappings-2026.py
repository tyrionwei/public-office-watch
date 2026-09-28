"""Rebuild council/mayor mappings from reviewed CEC scope text and existing IDs.
Run from repository root. No network or database access. Scope input preserves
2026-08-20 announcement text; PDF URL and verification notes: docs/ballot-mapping.md.
"""
import collections
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
def directory(file):
    text = (ROOT / 'apps/web/src/data/generated' / file).read_text()
    return json.loads(text[text.index('= {', text.index('export const'))+2:text.rindex('};')+1])
districts = directory('taiwanDistrictDirectory.ts')
villages = directory('taiwanVillageDirectory.ts')
county_text = (ROOT / 'apps/web/src/data/taiwanRegions.ts').read_text()
counties = dict(re.findall(r"code: '([^']+)', name: '([^']+)'", county_text))
races = collections.defaultdict(list)
for path in (ROOT / 'supabase/migrations').glob('*load_2026_release_races*.sql'):
    for match in re.finditer(r'\$([A-Za-z_0-9]+)\$(\[.*?\])\$\1\$', path.read_text(), re.S):
        for r in json.loads(match[2]): races[(r['race_type'], r['title'])].append(r['id'])
links = json.loads((ROOT / 'scripts/data/ballot-race-link-overrides-2026.json').read_text())
rows = []
scopes = json.loads((ROOT / 'scripts/data/ballot-mapping-scopes-2026.json').read_text())
for source in scopes:
    code, office, n, raw = source['countyCode'], source['office'], source['number'], source['rawScope']
    county = counties[code]
    category = 'lowland' if '平地原住民' in raw else 'highland' if '山地原住民' in raw else 'general'
    row = dict(id=f'2026-{code}-{office}' + (f'-{n}' if n else ''), eventKey='2026-2026-11-28-local',office=office,countyCode=code,
               categories=['general','lowland','highland'] if office=='mayor' else [category],
               constituencyName=county if office=='mayor' else f'{county}第{n}選舉區',
               source=dict(url='https://web.cec.gov.tw/api/file/45d8e965-f63a-46d5-b636-7d81e47cf4d1.pdf', publishedOn='2026-08-20',rawScope=raw,page=source['page']))
    if office == 'councilor' and category == 'general':
        # A category without a reserved constituency votes in the territorial
        # constituency. Check the entire published county announcement, never
        # infer absence from an incomplete geographic match. Evidence in docs.
        for identity, wording in [('lowland', '平地原住民'), ('highland', '山地原住民')]:
            if not any(s['countyCode'] == code and s['office'] == office and wording in s['rawScope'] for s in scopes):
                row['categories'].append(identity)
    if office == 'mayor':
        race_type = 'municipality_mayor' if code in ['63000','65000','68000','66000','67000','64000'] else 'county_mayor'
        title = county + county[-1] + '長選舉'
    else:
        race_type = 'city_councilor' if county.endswith('市') else 'county_councilor'
        title = f'{county}第{n}選舉區' + {'general':'','lowland':'平地原住民','highland':'山地原住民'}[category] + '議員選舉'
        scope = raw.replace('之平地原住民','').replace('之山地原住民','')
        names = re.split('[、及]',scope)
        ds = [d for d in districts[code] if d['name'] in names]
        if code=='10004' and n in [1,2]: ds = [d for d in districts[code] if d['name']=='竹北市']
        vs_names = [name.replace('竹北市','') for name in names if name.endswith(('村','里'))]
        vs = [v for d in (ds or districts[code]) for v in villages[d['code']] if v['name'] in vs_names]
        if vs_names: assert len(vs) == len(vs_names), (code,n,vs_names)
        if vs and not ds: ds = [d for d in districts[code] if any(v['code'].startswith(d['code']) for v in vs)]
        if ds: row['districtCodes'] = [d['code'] for d in ds]
        if vs:
            # If the official list includes the entire administrative district,
            # no village setting is needed. Keep the original list as provenance.
            full = {v['code'] for d in ds for v in villages[d['code']]}
            if {v['code'] for v in vs} != full: row['villageCodes'] = [v['code'] for v in vs]
        assert category != 'general' or ds, (code,n,raw)
    ids = races[(race_type,title)]
    assert len(ids) <= 1, title
    if ids: row['raceId'] = ids[0]
    else:
        link = next((link for link in links if link['office'] == office and link['countyCode'] == code and link['number'] == n and link['raceTitle'] == title), None)
        if link: row['raceId'] = link['raceId']
    rows.append(row)
output = ROOT / 'apps/web/src/data/ballotMappings2026.ts'
output.write_text("// Generated from reviewed 2026 CEC scope text; see docs/ballot-mapping.md.\nimport type { BallotMapping } from '../types/ballot.ts';\n\nexport const ballotMappings2026: readonly BallotMapping[] = [\n"+'\n'.join('  '+json.dumps(r,ensure_ascii=False,separators=(',',':'))+',' for r in rows)+'\n];\n')
print(json.dumps({'rows':len(rows),'missingRaceLinks':[r['constituencyName'] for r in rows if 'raceId' not in r]},ensure_ascii=False))
