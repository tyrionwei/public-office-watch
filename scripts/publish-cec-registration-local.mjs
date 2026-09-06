import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { canonicalPartyName } from './lib/party-name-normalization.mjs';

// Publish only the reviewed 2026-09-04 registration batch to the full local database.
const args = process.argv.slice(2);
assert(args.every((arg) => arg === '--apply-local'), 'Usage: node scripts/publish-cec-registration-local.mjs [--apply-local]');
const apply = args.includes('--apply-local');
const directory = path.resolve('tmp/cec-registration-final');
const read = (file) => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8').replace(/^\uFEFF/, ''));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const manifest = read('import-manifest.json');
const prepared = read('prepared-import.json');
const imported = read('import-rows.json');
const entries = new Map(prepared.records.map((entry) => [entry.record.candidateExternalId, entry]));
const candidates = new Map(imported.candidates.map((candidate) => [candidate.id, candidate]));
const sources = new Map();
const expected = manifest.filter((row) => row.candidateId).map((row) => {
  const entry = entries.get(row.candidateExternalId);
  assert(entry?.decision && row.disposition !== 'pending', 'Unreviewed identity in publication batch');
  assert.equal(entry.record.personName, row.name);
  assert.equal(entry.evidence.status, 'registered');
  const source = entry.evidence.source;
  assert.equal(new URL(source.url).hostname, 'web.cec.gov.tw');
  assert.equal(new URL(source.url).protocol, 'https:');
  assert.equal(new URL(source.article_url).hostname, 'web.cec.gov.tw');
  const file = path.resolve(directory, source.file);
  assert(file.startsWith(directory + path.sep), 'Source file must be inside the saved batch');
  if (!sources.has(file)) sources.set(file, sha256(fs.readFileSync(file)));
  assert.equal(sources.get(file), source.sha256, 'Official source archive hash mismatch: ' + source.file);
  const candidate = candidates.get(row.candidateId);
  assert.equal(candidate.person_id, row.personId);
  assert.equal(candidate.race_id, entry.race.id);
  return {
    candidate_id: row.candidateId, person_id: row.personId,
    canonical_person_id: entry.decision.personId ?? row.personId,
    race_id: entry.race.id, claim_id: row.claimId, source_id: row.sourcePersonId,
    name: row.name, county: row.county, source_url: source.url, source_hash: source.sha256,
    occurred_on: entry.evidence.registration_date ?? null,
    candidate_before: { ...candidate, party: candidate.party == null ? null : canonicalPartyName(candidate.party) },
  };
});
assert.equal(manifest.length, 18417);
assert.equal(expected.length, 16822);
assert.equal(new Set(expected.map((row) => row.candidate_id)).size, expected.length);
assert.equal(new Set(expected.map((row) => row.canonical_person_id)).size, expected.length);
assert(fs.readFileSync('supabase/config.toml', 'utf8').includes('project_id = "public-office-watch"'), 'Wrong local project');
const outputDirectory = path.resolve('tmp/cec-registration-publication');
fs.mkdirSync(outputDirectory, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.join(outputDirectory, `${stamp}-${apply ? 'apply' : 'dry-run'}.json`);
const sql = `BEGIN;
SET LOCAL application_name = 'cec-registration-publication-20260905';
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '180s';
SET LOCAL work_mem = '64MB';
SELECT pg_advisory_xact_lock(hashtextextended('public-office-watch:cec-registration-publication', 0));
CREATE TEMP TABLE expected AS SELECT * FROM jsonb_to_recordset(${quote(JSON.stringify(expected))}::jsonb) AS x(
 candidate_id uuid, person_id uuid, canonical_person_id uuid, race_id uuid, claim_id uuid, source_id uuid,
 name text, county text, source_url text, source_hash text, occurred_on date, candidate_before jsonb
);
CREATE TEMP TABLE all_sources AS SELECT * FROM jsonb_to_recordset(${quote(JSON.stringify(manifest.map((row) => ({ claim_id: row.claimId, source_id: row.sourcePersonId }))))}::jsonb) AS x(claim_id uuid,source_id uuid);
CREATE UNIQUE INDEX ON all_sources(claim_id);
CREATE UNIQUE INDEX ON all_sources(source_id);
ANALYZE all_sources;
CREATE UNIQUE INDEX ON expected(candidate_id);
CREATE INDEX ON expected(canonical_person_id);
ANALYZE expected;
CREATE TEMP TABLE race_before AS SELECT DISTINCT r.* FROM public.races r JOIN expected x ON x.race_id=r.id;
CREATE TEMP TABLE person_before AS SELECT DISTINCT p.* FROM public.people p JOIN expected x ON x.canonical_person_id=p.id;
CREATE TEMP TABLE candidate_before AS SELECT c.* FROM public.candidates c JOIN expected x ON x.candidate_id=c.id;
CREATE TEMP TABLE event_before AS SELECT ev.* FROM public.candidate_lifecycle_events ev JOIN expected x
 ON ev.external_id='cec-registration-2026:' || x.candidate_id;
CREATE TEMP TABLE untouched_candidates AS SELECT c.id, to_jsonb(c) data FROM public.candidates c
 JOIN public.races r ON r.id=c.race_id JOIN public.elections e ON e.id=r.election_id
 WHERE e.year=2026 AND NOT EXISTS (SELECT 1 FROM expected x WHERE x.candidate_id=c.id);
CREATE TEMP TABLE batch_claims_before AS SELECT id,to_jsonb(cl) data FROM public.person_claims cl
 WHERE cl.id IN (SELECT claim_id FROM all_sources);
CREATE TEMP TABLE batch_sources_before AS SELECT id,to_jsonb(s) data FROM public.source_people s
 WHERE s.id IN (SELECT source_id FROM all_sources);
ANALYZE person_before;
ANALYZE race_before;
DO $check$ BEGIN
 IF (SELECT count(*) FROM candidate_before)<>16822 OR (SELECT count(*) FROM person_before)<>16822
   OR (SELECT count(*) FROM event_before)<>16822 THEN RAISE EXCEPTION 'Incomplete reviewed batch'; END IF;
 IF EXISTS (SELECT 1 FROM expected x JOIN public.candidates c ON c.id=x.candidate_id
   WHERE NOT (to_jsonb(c) @> (x.candidate_before - ARRAY['is_public','updated_at','status_updated_at']))
      OR c.candidacy_status<>'registered' OR c.registration_status<>'registered'
      OR c.election_result<>'pending' OR c.candidate_no IS NOT NULL)
 THEN RAISE EXCEPTION 'Candidate changed since reviewed import, or registration implies qualification/ballot number'; END IF;
 IF EXISTS (SELECT 1 FROM expected x
   LEFT JOIN public.person_canonical_map pm ON pm.person_id=x.person_id
   LEFT JOIN public.race_canonical_map rm ON rm.race_id=x.race_id
   LEFT JOIN public.races r ON r.id=x.race_id
   LEFT JOIN public.elections e ON e.id=r.election_id
   LEFT JOIN public.regions region ON region.id=r.region_id
   WHERE pm.canonical_person_id IS DISTINCT FROM x.canonical_person_id OR rm.canonical_race_id IS DISTINCT FROM x.race_id
      OR e.year IS DISTINCT FROM 2026 OR NOT e.is_public OR NOT region.is_public)
 THEN RAISE EXCEPTION 'Canonical identity, race, election or region failed publication review'; END IF;
 IF EXISTS (SELECT 1 FROM expected x
   LEFT JOIN public.person_claims cl ON cl.id=x.claim_id
   LEFT JOIN public.source_people s ON s.id=x.source_id
   LEFT JOIN public.candidate_lifecycle_events ev ON ev.external_id='cec-registration-2026:' || x.candidate_id
   WHERE cl.review_status IS DISTINCT FROM 'verified' OR cl.person_id IS DISTINCT FROM x.person_id
      OR cl.source_person_id IS DISTINCT FROM x.source_id OR cl.source_url IS DISTINCT FROM x.source_url
      OR cl.claim_json->'targetRace'->>'id' IS DISTINCT FROM x.race_id::text
      OR cl.claim_json->'registrationEvidence'->'source'->>'sha256' IS DISTINCT FROM x.source_hash
      OR cl.claim_json->'registrationEvidence'->>'name' IS DISTINCT FROM x.name
      OR s.source_payload->'registrationEvidence' IS DISTINCT FROM cl.claim_json->'registrationEvidence'
      OR ev.candidate_id IS DISTINCT FROM x.candidate_id OR ev.event_type IS DISTINCT FROM 'registration_filed'
      OR ev.source_url IS DISTINCT FROM x.source_url OR ev.source_hash IS DISTINCT FROM x.source_hash
      OR ev.occurred_on IS DISTINCT FROM x.occurred_on)
 THEN RAISE EXCEPTION 'Official registration source, verified claim or event differs'; END IF;
 IF EXISTS (SELECT 1 FROM expected x WHERE (SELECT count(*) FROM public.person_identity_matches m
   WHERE m.source_person_id=x.source_id AND m.person_id=x.person_id AND m.match_status='auto_matched'
    AND m.reviewed_at IS NOT NULL)<>1)
 THEN RAISE EXCEPTION 'Reviewed identity match is missing or ambiguous'; END IF;
 IF EXISTS (SELECT 1 FROM expected x JOIN public.person_canonical_map pm ON pm.canonical_person_id=x.canonical_person_id
   JOIN public.candidates c ON c.person_id=pm.person_id AND c.id<>x.candidate_id
   JOIN public.races r ON r.id=c.race_id JOIN public.elections e ON e.id=r.election_id WHERE e.year=2026)
 THEN RAISE EXCEPTION 'Another 2026 candidacy exists for this canonical person'; END IF;
 IF EXISTS (SELECT 1 FROM race_before r WHERE NOT r.is_public AND
   (r.external_id NOT LIKE 'pow-cec-registration-2026-race-%' OR r.race_type<>'village_chief'
    OR NOT EXISTS (SELECT 1 FROM expected x WHERE x.race_id=r.id AND x.source_url=r.source_url)))
 THEN RAISE EXCEPTION 'Private race lacks this batch official village source'; END IF;
 IF EXISTS (SELECT 1 FROM person_before p WHERE NOT p.is_public AND
   (p.education IS NOT NULL OR p.experience IS NOT NULL OR p.alias IS NOT NULL))
 THEN RAISE EXCEPTION 'Private person has extra profile fields requiring separate review'; END IF;
 IF EXISTS (SELECT 1 FROM person_before p JOIN public.person_canonical_map pm ON pm.canonical_person_id=p.id
   JOIN public.candidates c ON c.person_id=pm.person_id WHERE NOT p.is_public AND c.is_public
   AND NOT EXISTS(SELECT 1 FROM expected x WHERE x.candidate_id=c.id))
 THEN RAISE EXCEPTION 'Publishing a person would expose another candidacy'; END IF;
 IF EXISTS (SELECT 1 FROM public.person_claims cl JOIN person_before p ON p.id=cl.person_id
   WHERE NOT p.is_public AND cl.is_public
   AND NOT (cl.review_status='verified' AND cl.visibility='public' AND cl.claim_type='candidacy'
     AND EXISTS (SELECT 1 FROM expected x WHERE x.canonical_person_id=p.id
       AND x.race_id::text=cl.claim_json->'targetRace'->>'id')))
 THEN RAISE EXCEPTION 'Publishing a person would expose additional unreviewed or unrelated claims'; END IF;
 IF (SELECT count(*) FROM batch_claims_before)<>18417 OR (SELECT count(*) FROM batch_sources_before)<>18417
 THEN RAISE EXCEPTION 'Private evidence batch is incomplete'; END IF;
 IF (SELECT count(*) FROM batch_claims_before WHERE data->>'review_status'='pending')<>1595
   OR EXISTS (SELECT 1 FROM batch_claims_before WHERE data->>'is_public'<>'false' OR data->>'visibility'<>'review_only')
   OR EXISTS (SELECT 1 FROM batch_sources_before WHERE data->>'is_public'<>'false')
 THEN RAISE EXCEPTION 'Private evidence visibility or pending count changed since review'; END IF;
END; $check$;
-- Keep source payloads and review claims private. Public events expose fixed fields and official links.
UPDATE public.races r SET is_public=TRUE,updated_at=now() FROM race_before b WHERE r.id=b.id AND NOT b.is_public;
-- Three existing private profiles have stale candidate job titles; derive current candidacy from the reviewed relation.
UPDATE public.people p SET position=NULL,district=r.title,source_url=x.source_url,election_year=2026
 FROM expected x, public.races r
 WHERE p.id=x.canonical_person_id AND r.id=x.race_id AND NOT p.is_public
 AND p.external_id NOT LIKE 'pow-cec-registration-person-2026-%';
UPDATE public.people p SET is_public=TRUE,updated_at=now() FROM person_before b WHERE p.id=b.id AND NOT b.is_public;
UPDATE public.candidates c SET is_public=TRUE,updated_at=now() FROM expected x WHERE c.id=x.candidate_id AND NOT c.is_public;
UPDATE public.candidate_lifecycle_events ev SET is_public=TRUE FROM expected x
 WHERE ev.external_id='cec-registration-2026:' || x.candidate_id AND NOT ev.is_public;
SELECT public.refresh_public_people_list_cached();
CREATE TEMP TABLE promoted AS SELECT published.promote(NULL) release_id;
DO $verify$ BEGIN
 IF (SELECT count(*) FROM expected x JOIN published.candidates c ON c.candidate_id=x.candidate_id
   AND c.person_id=x.canonical_person_id AND c.race_id=x.race_id
   AND c.candidacy_status='registered' AND c.registration_status='registered' AND c.election_result='pending')<>16822
 THEN RAISE EXCEPTION 'Published candidacy parity failed'; END IF;
 IF (SELECT count(*) FROM expected x JOIN published.people p ON p.person_id=x.canonical_person_id)<>16822
 THEN RAISE EXCEPTION 'Published person parity failed'; END IF;
 IF (SELECT count(*) FROM expected x CROSS JOIN LATERAL published.candidate_lifecycle_for(x.candidate_id) ev
   WHERE ev.event_type='registration_filed' AND ev.occurred_on IS NOT DISTINCT FROM x.occurred_on
    AND ev.source_url=x.source_url AND ev.candidate_no IS NULL)<>16822
 THEN RAISE EXCEPTION 'Public registration timeline parity failed'; END IF;
 IF EXISTS (SELECT 1 FROM untouched_candidates b LEFT JOIN public.candidates c ON c.id=b.id WHERE to_jsonb(c) IS DISTINCT FROM b.data)
 THEN RAISE EXCEPTION 'Unrelated candidate changed'; END IF;
 IF EXISTS (SELECT 1 FROM batch_claims_before b LEFT JOIN public.person_claims cl ON cl.id=b.id WHERE to_jsonb(cl) IS DISTINCT FROM b.data)
 OR EXISTS (SELECT 1 FROM batch_sources_before b LEFT JOIN public.source_people s ON s.id=b.id WHERE to_jsonb(s) IS DISTINCT FROM b.data)
 THEN RAISE EXCEPTION 'Private evidence or pending review changed'; END IF;
 IF EXISTS (SELECT 1 FROM expected x JOIN public.candidates c ON c.id=x.candidate_id
   WHERE NOT (to_jsonb(c) @> (x.candidate_before - ARRAY['is_public','updated_at','status_updated_at'])))
 THEN RAISE EXCEPTION 'Publication changed candidate facts'; END IF;
END; $verify$;
SELECT json_build_object(
 'mode',${quote(apply ? 'apply-local' : 'dry-run-rollback')},'release_id',(SELECT release_id FROM promoted),
 'registered_candidates',(SELECT count(*) FROM expected),'newly_public_candidates',(SELECT count(*) FROM candidate_before WHERE NOT is_public),
 'newly_public_people',(SELECT count(*) FROM person_before WHERE NOT is_public),
 'newly_public_races',(SELECT count(*) FROM race_before WHERE NOT is_public),
 'newly_public_events',(SELECT count(*) FROM event_before WHERE NOT is_public),
 'pending_claims',(SELECT count(*) FROM batch_claims_before WHERE data->>'review_status'='pending'),
 'unchanged_other_2026_candidates',(SELECT count(*) FROM untouched_candidates),
 'by_county',(SELECT json_object_agg(county,n) FROM (SELECT county,count(*) n FROM expected GROUP BY county) x),
 'before',json_build_object(
   'people',(SELECT json_agg(to_jsonb(p)) FROM person_before p WHERE NOT is_public),
   'races',(SELECT json_agg(to_jsonb(r)) FROM race_before r WHERE NOT is_public),
   'candidate_ids',(SELECT json_agg(id) FROM candidate_before WHERE NOT is_public),
   'event_ids',(SELECT json_agg(id) FROM event_before WHERE NOT is_public))
);
${apply ? 'COMMIT' : 'ROLLBACK'};`;
const result = spawnSync('docker', ['exec', '-i', 'supabase_db_public-office-watch', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], {
  input: sql, encoding: 'utf8', maxBuffer: 30e6,
});
if (result.status !== 0) {
  console.error(result.stderr.slice(-4000));
  process.exit(result.status ?? 1);
}
const report = JSON.parse(result.stdout.trim().split('\n').findLast((line) => line.startsWith('{')));
report.source_files_verified = sources.size;
report.manifest_sha256 = sha256(fs.readFileSync(path.join(directory, 'import-manifest.json')));
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
const { before, ...summary } = report;
console.log(JSON.stringify({ ...summary, report: path.relative(process.cwd(), reportPath) }, null, 2));
