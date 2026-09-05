import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { taiwanDistrictsByCountyCode } from '../apps/web/src/data/generated/taiwanDistrictDirectory.ts';
import { taiwanVillagesByDistrictCode } from '../apps/web/src/data/generated/taiwanVillageDirectory.ts';
import { parseNeighborhoods, validatePollingAssignments } from './polling-place-normalization.mjs';
const read = (file) => JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const registry=read('data-sources/2026-polling-places.json');
const source=registry.counties.find((row)=>row.adapter==='new-taipei-2026');
const directory='tmp/polling-places-2026';
const odsFile=directory+'/new-taipei.ods';
if (!fs.existsSync(odsFile)) {
  fs.mkdirSync(directory, {recursive:true});
  const response=await fetch(source.file_url);
  if(!response.ok) throw new Error('Official ODS download failed: '+response.status);
  fs.writeFileSync(odsFile,Buffer.from(await response.arrayBuffer()));
}
const hash=createHash('sha256').update(fs.readFileSync(odsFile)).digest('hex');
if(hash!==source.source_hash) throw new Error('Official ODS changed; review the source manifest before importing');
execFileSync('python3',['scripts/extract-polling-places-ods.py',odsFile,directory+'/new-taipei.rows.json']);
const sheets=read(directory+'/new-taipei.rows.json');
if(sheets.length!==1 || !sheets[0].rows[0][0].includes('115年地方公職人員選舉')) throw new Error('Unexpected official workbook');
const normalizeName=(name)=>name.replace(/[\[\]]/g,'');
// Reviewed name variants within the same official district, never fuzzy matching.
const aliases={'坪林區:石𥕢里':'石曹里','瑞芳區:濓洞里':'濂洞里','瑞芳區:濓新里':'濂新里'};
const sourceId=hash.slice(0,32);
const places=sheets[0].rows.slice(2).map((row,index)=>{
 const match=/^新北市(.+?區)第(\d+)投開票所$/.exec(row[0]);
 if(!match) throw new Error('Unexpected station label at row '+(index+3));
 const district=taiwanDistrictsByCountyCode['65000'].find(x=>x.name===match[1]);
 const villageName=aliases[match[1]+':'+row[3]]??row[3];
 const matches=(taiwanVillagesByDistrictCode[district?.code]??[]).filter(x=>normalizeName(x.name)===villageName);
 if(matches.length!==1 || !row[1].trim() || !row[2].trim()) throw new Error('Unresolved station at row '+(index+3));
 const village=matches[0];
 return {id:createHash('sha256').update(hash+':'+match[2]+':'+village.code).digest('hex').slice(0,32),
   source_id:sourceId,district_code:district.code,village_code:village.code,village_name:row[3],
   station_no:match[2],station_name:row[1],address:row[2],raw_neighborhoods:row[4],
   ...parseNeighborhoods(row[4]),source_row:index+3};
});
validatePollingAssignments(places);
const summary={source_rows:places.length,villages:new Set(places.map(x=>x.village_code)).size,
 neighborhood_assignments:places.reduce((sum,x)=>sum+x.neighborhoods.length,0),
 ambiguous:places.filter(x=>x.coverage_kind==='ambiguous').map(x=>({station:x.station_no,village:x.village_name,raw:x.raw_neighborhoods})),
 whole_village:places.filter(x=>x.coverage_kind==='whole_village').length};
fs.writeFileSync(directory+'/normalized.json',JSON.stringify({source,places},null,2));
fs.writeFileSync(directory+'/validation.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
if(!fs.readFileSync('supabase/config.toml','utf8').includes('project_id = "public-office-watch"')) throw new Error('Unexpected local project');
const q=value=>"'"+String(value).replaceAll("'","''")+"'";
const sql=String.raw`BEGIN;
DO $check$ BEGIN
 IF EXISTS (SELECT 1 FROM public.polling_place_sources WHERE event_key=${q(registry.event_key)}
  AND county_code='65000' AND is_current AND published_on > ${q(source.published_on)}::date)
 THEN RAISE EXCEPTION 'Refusing to replace a newer official source'; END IF;
END; $check$;
UPDATE public.polling_place_sources SET is_current=FALSE
 WHERE event_key=${q(registry.event_key)} AND county_code='65000' AND is_current AND id<>${q(sourceId)}::uuid;
INSERT INTO public.polling_place_sources(id,event_key,voting_date,county_code,source_name,source_url,published_on,fetched_at,source_hash,format,is_public,is_current)
 VALUES (${q(sourceId)},${q(registry.event_key)},${q(registry.voting_date)},'65000',
 ${q(source.source_name)},${q(source.source_url)},${q(source.published_on)},${q(fs.statSync(odsFile).mtime.toISOString())},${q(hash)},'ods',TRUE,TRUE)
 ON CONFLICT (id) DO UPDATE SET is_current=TRUE;
CREATE TEMP TABLE input AS SELECT * FROM jsonb_to_recordset(${q(JSON.stringify(places))}::jsonb) AS x(
 id uuid,source_id uuid,district_code text,village_code text,village_name text,station_no text,station_name text,address text,
 coverage_kind text,raw_neighborhoods text,source_row integer,neighborhoods jsonb
);
INSERT INTO public.polling_places(id,source_id,district_code,village_code,village_name,station_no,station_name,address,coverage_kind,raw_neighborhoods,source_row)
 SELECT id,source_id,district_code,village_code,village_name,station_no,station_name,address,coverage_kind,raw_neighborhoods,source_row FROM input
 ON CONFLICT (id) DO NOTHING;
INSERT INTO public.polling_place_neighborhoods(polling_place_id,neighborhood_no)
 SELECT i.id,n.value::smallint FROM input i CROSS JOIN LATERAL jsonb_array_elements_text(i.neighborhoods) n
 ON CONFLICT DO NOTHING;
SELECT count(*) AS places FROM public.polling_places WHERE source_id=${q(sourceId)}::uuid;
${process.argv.includes('--apply-local')?'COMMIT':'ROLLBACK'};`;
console.log(execFileSync('docker',['exec','-i','supabase_db_public-office-watch','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:sql,encoding:'utf8'}));
