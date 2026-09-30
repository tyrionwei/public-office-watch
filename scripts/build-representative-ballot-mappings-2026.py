#!/usr/bin/env python3
"""Build local-ballot representative mappings from reviewed CEC scope rows.

The checked-in JSON records the published wording and page for each row. This
script resolves only administrative codes and existing race UUIDs; it does not
infer a constituency from a race title or candidate list.
"""

import collections
import glob
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'scripts/data/representative-ballot-scopes-2026.json'
OUTPUT = ROOT / 'apps/web/src/data/representativeBallotMappings2026.ts'
EVENT = '2026-2026-11-28-local'
ALIASES = {
    '硘磘里': '硘[磘]里', '上館里': '上舘里', '嵵裡里': '[嵵]裡里',
    '山腳里': '山脚里', '焦埔里': '蕉埔里', '公館里': '公舘里',
    '雙湖村': '双湖村', '雙潭村': '双潭村', '豐稠村': '豊稠村',
    '下竂村': '下寮村', '里瓏里': '里壠里', '公館村': '公舘村',
    '崙峰里': '崙峯里', '溝壩里': '溝埧里', '瓦磘村': '瓦[磘]村',
    '箔子村': '[萡]子村', '箔東村': '[萡]東村', '檨埔村': '[欍]埔村',
    '南瑤里': '南瑶里', '磚磘里': '磚[磘]里', '大峰里': '大峯里',
    '廓子村': '廍子村', '舊館村': '舊舘村', '南館村': '南舘村',
    '新館村': '新舘村', '埤腳村': '埤脚村', '上豐村': '上豊村',
    '和豐村': '和豊村', '豐崙村': '豊崙村',
}


def read_directory(name):
    content = (ROOT / f'apps/web/src/data/generated/{name}.ts').read_text()
    match = re.search(r'Readonly<Record<.*?>> = (\{.*?\});', content, re.S)
    if not match:
        raise ValueError(f'Cannot read {name}')
    return json.loads(match.group(1))


districts = read_directory('taiwanDistrictDirectory')
villages = read_directory('taiwanVillageDirectory')
county_content = (ROOT / 'apps/web/src/data/taiwanRegions.ts').read_text()
counties = dict(re.findall(r"code: '([0-9]{5})', name: '([^']+)'", county_content))
county_codes = {name: code for code, name in counties.items()}

races = []
for path in glob.glob(str(ROOT / 'supabase/migrations/*load_2026_release_races*.sql')):
    content = Path(path).read_text()
    for match in re.finditer(r'\$([A-Za-z_0-9]+)\$(\[.*?\])\$\1\$', content, re.S):
        races.extend(json.loads(match.group(2)))
race_titles = collections.defaultdict(list)
for race in races:
    if race['race_type'] == 'township_representative_district':
        race_titles[race['title']].append(race['id'])

source_rows = json.loads(SOURCE.read_text())
special_categories = collections.defaultdict(set)
for row in source_rows:
    if row.get('category'):
        special_categories[(row['county'], row['town'])].add(row['category'])
output = []
missing_races = []
for row in source_rows:
    county = row['county']
    town = row['town']
    county_code = county_codes[county]
    matching_districts = [d for d in districts[county_code] if d['name'] == town]
    if len(matching_districts) != 1:
        raise ValueError(f'Unknown or duplicate district: {county}{town}')
    district_code = matching_districts[0]['code']
    number = row['number']
    prefix = f'{county}{town}' + (f'第{number}選舉區' if number else '選舉區')
    matched_races = [(title, ids[0]) for title, ids in race_titles.items() if title.startswith(prefix) and len(ids) == 1]
    race_id = matched_races[0][1] if len(matched_races) == 1 else None
    if race_id is None:
        missing_races.append(prefix)
    scope = row['rawScope']
    village_scope = scope.replace('之平地原住民', '').replace('之山地原住民', '')
    village_names = [] if '居住全' in village_scope or re.search(r'各[村里]$', village_scope) else [
        v.strip().removeprefix('居住') for v in village_scope.split('、') if v.strip().endswith(('村', '里'))
    ]
    village_by_name = {v['name']: v['code'] for v in villages[district_code]}
    village_codes = []
    for village_name in village_names:
        name = village_name if village_name in village_by_name else ALIASES.get(village_name, village_name)
        if name not in village_by_name:
            raise ValueError(f'Unknown village in {prefix}: {village_name}')
        village_codes.append(village_by_name[name])
    if len(village_codes) != len(set(village_codes)):
        raise ValueError(f'Duplicate villages within {prefix}')
    office = 'indigenousDistrictRepresentative' if town.endswith('區') else 'townshipRepresentative'
    if row.get('category'):
        categories = [row['category']]
    else:
        categories = [category for category in ('general', 'lowland', 'highland')
                      if category not in special_categories[(county, town)]]
    mapping = {
        'id': f'2026-{district_code}-representative-{number or 0}',
        'eventKey': EVENT,
        'office': office,
        'countyCode': county_code,
        'districtCodes': [district_code],
        'categories': categories,
        'constituencyName': f'{county}{town}' + (f'第{number}選舉區' if number else '選舉區'),
    }
    if village_codes:
        mapping['villageCodes'] = village_codes
    if race_id:
        mapping['raceId'] = race_id
    mapping['source'] = {
        'url': row['sourceUrl'],
        'publishedOn': row['publishedOn'],
        'rawScope': scope,
        'page': row['page'],
    }
    output.append(mapping)

by_town = collections.defaultdict(list)
for mapping in output:
    by_town[mapping['districtCodes'][0]].append(mapping)
if len(by_town) != 204:
    raise ValueError(f'Expected all 204 representative districts, found {len(by_town)}')
expected_race_ids = {race_id for ids in race_titles.values() for race_id in ids}
mapped_race_ids = [mapping.get('raceId') for mapping in output]
if set(mapped_race_ids) != expected_race_ids or len(mapped_race_ids) != len(expected_race_ids):
    raise ValueError('Representative mappings must match every existing release race exactly once')
for district_code, mappings in by_town.items():
    expected = {v['code'] for v in villages[district_code]}
    for category in ('general', 'lowland', 'highland'):
        actual = [code for mapping in mappings if category in mapping['categories']
                  for code in mapping.get('villageCodes', expected)]
        if set(actual) != expected or len(actual) != len(expected):
            raise ValueError(f'Incomplete or overlapping {category} village coverage for {district_code}: '
                             f'{len(actual)} mapped, {len(expected)} expected')

with OUTPUT.open('w') as stream:
    stream.write("import type { BallotMapping } from '../types/ballot';\n\n")
    stream.write('// 2026 local representative constituencies; published source and wording per row.\n')
    stream.write('export const representativeBallotMappings2026: readonly BallotMapping[] = [\n')
    for mapping in output:
        stream.write('  ' + json.dumps(mapping, ensure_ascii=False, separators=(',', ':')) + ',\n')
    stream.write('];\n')

print(f'Built {len(output)} representative mappings across {len(by_town)} districts')
print(f'Rows without a unique existing race: {len(missing_races)}')
for title in missing_races:
    print('  ' + title)
