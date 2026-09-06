import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const directory = process.argv.find((arg) => arg.startsWith('--directory='))?.slice(12) ?? 'tmp/cec-registration-final';
const apply = process.argv.includes('--apply-local');
const read = (file) => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8').replace(/^\uFEFF/, ''));
const manifest = read('import-manifest.json');
const prepared = read('prepared-import.json');
const sources = read('sources.json');
const records = new Map(prepared.records.map((item) => [item.record.candidateExternalId, item]));
const publishedDates = new Map(sources.regions.flatMap((region) => region.articles ?? []).map((article) => {
  const raw = article.published_at_raw ?? '';
  return [article.url, /^\d{14}$/.test(raw) ? raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6,8) : null];
}));
const events = manifest.filter((row) => row.candidateId && row.disposition !== 'pending').map((row) => {
  const { evidence } = records.get(row.candidateExternalId);
  return {
    external_id: 'cec-registration-2026:' + row.candidateId,
    candidate_id: row.candidateId, claim_id: row.claimId,
    occurred_on: evidence.registration_date ?? null,
    source_published_on: publishedDates.get(evidence.source.article_url) ?? null,
    source_name: evidence.county + '選舉委員會｜' + evidence.source.name,
    source_url: evidence.source.url, source_hash: evidence.source.sha256,
    fetched_at: sources.retrieved_at,
  };
});
if (new Set(events.map((row) => row.external_id)).size !== events.length) throw new Error('Duplicate candidate event');
if (!fs.readFileSync('supabase/config.toml','utf8').includes('project_id = "public-office-watch"')) throw new Error('Unexpected local project');
const json = JSON.stringify(events).replaceAll("'", "''");
const sql = String.raw`BEGIN;
CREATE TEMP TABLE input AS
SELECT * FROM jsonb_to_recordset('${json}'::jsonb) AS x(
 external_id text, candidate_id uuid, claim_id uuid, occurred_on date,
 source_published_on date, source_name text, source_url text, source_hash text, fetched_at timestamptz
);
DO $check$
BEGIN
 IF EXISTS (
   SELECT 1 FROM input i
   LEFT JOIN public.candidates c ON c.id = i.candidate_id
   LEFT JOIN public.races r ON r.id = c.race_id
   LEFT JOIN public.elections e ON e.id = r.election_id
   LEFT JOIN public.person_claims claim ON claim.id = i.claim_id
   WHERE c.id IS NULL OR e.year IS DISTINCT FROM 2026
      OR claim.review_status IS DISTINCT FROM 'verified'
      OR claim.claim_json->'targetRace'->>'id' IS DISTINCT FROM c.race_id::text
      OR claim.claim_json->'registrationEvidence'->'source'->>'sha256' IS DISTINCT FROM i.source_hash
      OR claim.claim_json->'registrationEvidence'->>'registration_date' IS DISTINCT FROM i.occurred_on::text
 ) THEN RAISE EXCEPTION 'Registration evidence no longer matches reviewed local data'; END IF;
END;
$check$;
INSERT INTO public.candidate_lifecycle_events(
 external_id,candidate_id,event_type,occurred_on,source_published_on,source_name,source_url,source_hash,fetched_at,is_public)
SELECT i.external_id,i.candidate_id,'registration_filed',i.occurred_on,i.source_published_on,
 i.source_name,i.source_url,i.source_hash,i.fetched_at,c.is_public
FROM input i JOIN public.candidates c ON c.id=i.candidate_id
ON CONFLICT (external_id) DO NOTHING;
SELECT count(*) AS registered_events, count(*) FILTER (WHERE is_public) AS approved_events,
 count(*) FILTER (WHERE occurred_on IS NULL) AS event_date_unknown
FROM public.candidate_lifecycle_events WHERE external_id LIKE 'cec-registration-2026:%';
${apply ? 'COMMIT' : 'ROLLBACK'};`;
console.log(execFileSync('docker', ['exec','-i','supabase_db_public-office-watch','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'], {input:sql,encoding:'utf8'}));
