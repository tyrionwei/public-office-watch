import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const referenceContainer = process.env.REFERENCE_CONTAINER || 'supabase_db_public-office-watch';
const rehearsalContainer = process.env.REHEARSAL_CONTAINER || 'public-office-watch-compaction-rehearsal';
const outputPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '202608110015_align_production_public_identity_merges.sql',
);
const additionalSourceKeys = [
  // Required to collapse the VoteTW and CEC records for the reviewed
  // Taichung plain-indigenous candidate after rejecting a stale namesake merge.
  'votetw-person-f11fb725bb090f9e',
];

function runDocker(args, options = {}) {
  const result = spawnSync('docker', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `docker ${args[0]} failed`);
  }
  return result.stdout;
}

function containerPassword(container) {
  const env = runDocker(['inspect', '--format', '{{range .Config.Env}}{{println .}}{{end}}', container]);
  const password = env.split(/\r?\n/).find((line) => line.startsWith('POSTGRES_PASSWORD='))?.slice(18);
  if (!password) throw new Error(`POSTGRES_PASSWORD is unavailable for ${container}`);
  return password;
}

const referenceConnection = [
  `host=${referenceContainer}`,
  'port=5432',
  'dbname=postgres',
  'user=postgres',
  `password=${containerPassword(referenceContainer)}`,
].join(' ');

const comparisonSql = String.raw`
CREATE EXTENSION IF NOT EXISTS dblink;

CREATE TEMP TABLE _reference_people_map AS
SELECT * FROM dblink(
  :'reference_connection',
  $remote$
    SELECT
      COALESCE(person.external_id, person.id::text),
      COALESCE(canonical.external_id, canonical.id::text),
      decision.confidence_level,
      decision.reason,
      decision.evidence_json::text,
      decision.reviewed_by,
      decision.reviewed_at::text
    FROM public.people person
    JOIN public.person_canonical_map map ON map.person_id = person.id
    JOIN public.people canonical ON canonical.id = map.canonical_person_id
    JOIN LATERAL (
      SELECT active.confidence_level,
             active.reason,
             active.evidence_json,
             active.reviewed_by,
             active.reviewed_at
      FROM public.person_merge_decisions active
      WHERE active.duplicate_person_id = person.id
        AND active.status IN ('suggested', 'verified')
      ORDER BY active.updated_at DESC, active.id
      LIMIT 1
    ) decision ON TRUE
    WHERE person.id <> map.canonical_person_id
  $remote$
) AS item(
  source_key text,
  target_key text,
  confidence_level text,
  reason text,
  evidence_json_text text,
  reviewed_by text,
  reviewed_at_text text
);

CREATE TEMP TABLE _reference_published_people AS
SELECT stable_key
FROM dblink(
  :'reference_connection',
  $remote$
    SELECT COALESCE(core.external_id, item.person_id::text)
    FROM published.people item
    JOIN public.people core ON core.id = item.person_id
  $remote$
) AS item(stable_key text);

WITH added_people AS (
  SELECT DISTINCT COALESCE(core.external_id, core.id::text) AS source_key
  FROM published.people item
  JOIN public.people core ON core.id = item.person_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM _reference_published_people published
    WHERE published.stable_key = COALESCE(core.external_id, core.id::text)
  )
), required_people AS (
  SELECT source_key FROM added_people
  UNION
  SELECT value FROM unnest(ARRAY[${additionalSourceKeys.map((value) => `'${value}'`).join(', ')}]::text[]) AS value
), payload AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'source_key', reference.source_key,
      'target_key', reference.target_key,
      'confidence_level', reference.confidence_level,
      'reason', reference.reason,
      'evidence_json', reference.evidence_json_text::jsonb,
      'reviewed_by', reference.reviewed_by,
      'reviewed_at', reference.reviewed_at_text
    ) ORDER BY reference.source_key
  ) AS value
  FROM required_people required
  JOIN _reference_people_map reference ON reference.source_key = required.source_key
)
SELECT value::text FROM payload;

DROP EXTENSION dblink;
`;

const payloadText = runDocker([
  'exec', '-i', rehearsalContainer,
  'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
  '-v', `reference_connection=${referenceConnection}`,
  '-U', 'postgres', '-d', 'postgres',
], { input: comparisonSql }).trim();

const currentLinks = JSON.parse(payloadText || '[]');
const previousMigration = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
const previousPayload = previousMigration.match(
  /\$identity_merge_release\$(\[[\s\S]*?\])\$identity_merge_release\$::jsonb/,
);
const previousLinks = previousPayload ? JSON.parse(previousPayload[1]) : [];
const links = [...new Map(
  [...previousLinks, ...currentLinks].map((link) => [link.source_key, link]),
).values()].sort((left, right) => left.source_key.localeCompare(right.source_key));
if (links.length !== 196) {
  throw new Error(`Production identity alignment expected 196 links, found ${links.length}`);
}
if (links.some((link) => !link.source_key || !link.target_key || !link.confidence_level)) {
  throw new Error('Production identity alignment contains an incomplete reviewed link');
}

const migration = `-- Generated by scripts/build-production-identity-alignment.mjs from the reviewed Local Supabase canonical map.
BEGIN;

CREATE TEMP TABLE _identity_merge_links ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset($identity_merge_release$${JSON.stringify(links)}$identity_merge_release$::jsonb) AS row(
    source_key text,
    target_key text,
    confidence_level text,
    reason text,
    evidence_json jsonb,
    reviewed_by text,
    reviewed_at timestamptz
);

CREATE TEMP TABLE _resolved_identity_merges ON COMMIT DROP AS
SELECT
    source.id AS duplicate_person_id,
    target.id AS canonical_person_id,
    link.confidence_level,
    link.reason,
    link.evidence_json,
    link.reviewed_by,
    link.reviewed_at
FROM _identity_merge_links link
JOIN public.people source
  ON COALESCE(source.external_id, source.id::text) = link.source_key
JOIN public.people target
  ON COALESCE(target.external_id, target.id::text) = link.target_key;

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _identity_merge_links) <> 196
       OR (SELECT COUNT(*) FROM _resolved_identity_merges) <> 196
       OR EXISTS (
            SELECT 1 FROM _resolved_identity_merges
            WHERE duplicate_person_id = canonical_person_id
       ) THEN
        RAISE EXCEPTION 'Production identity merge payload drift';
    END IF;
END
$$;

UPDATE public.person_merge_decisions existing
SET
    canonical_person_id = incoming.canonical_person_id,
    status = 'verified',
    confidence_level = incoming.confidence_level,
    reason = incoming.reason,
    evidence_json = incoming.evidence_json || jsonb_build_object(
        'productionAlignmentVersion', '202608110015'
    ),
    reviewed_by = incoming.reviewed_by,
    reviewed_at = incoming.reviewed_at,
    updated_at = NOW()
FROM _resolved_identity_merges incoming
WHERE existing.duplicate_person_id = incoming.duplicate_person_id
  AND existing.status IN ('suggested', 'verified');

INSERT INTO public.person_merge_decisions (
    duplicate_person_id,
    canonical_person_id,
    status,
    confidence_level,
    reason,
    evidence_json,
    reviewed_by,
    reviewed_at,
    created_at,
    updated_at
)
SELECT
    incoming.duplicate_person_id,
    incoming.canonical_person_id,
    'verified',
    incoming.confidence_level,
    incoming.reason,
    incoming.evidence_json || jsonb_build_object(
        'productionAlignmentVersion', '202608110015'
    ),
    incoming.reviewed_by,
    incoming.reviewed_at,
    NOW(),
    NOW()
FROM _resolved_identity_merges incoming
WHERE NOT EXISTS (
    SELECT 1
    FROM public.person_merge_decisions existing
    WHERE existing.duplicate_person_id = incoming.duplicate_person_id
      AND existing.status IN ('suggested', 'verified')
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _resolved_identity_merges expected
        LEFT JOIN public.person_canonical_map actual
          ON actual.person_id = expected.duplicate_person_id
        WHERE actual.canonical_person_id IS DISTINCT FROM expected.canonical_person_id
    ) THEN
        RAISE EXCEPTION 'Production identity merge canonical-map verification failed';
    END IF;
END
$$;

SELECT public.refresh_public_people_list_cached();
SELECT published.promote(NULL);

COMMIT;
`;

fs.writeFileSync(outputPath, migration);
console.log(JSON.stringify({
  output: path.relative(repoRoot, outputPath),
  identityMerges: links.length,
}, null, 2));
