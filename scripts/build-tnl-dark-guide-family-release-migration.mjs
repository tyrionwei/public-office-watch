import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultPreviewPath = path.join(repoRoot, 'local-data', 'tnl-dark-guide-family-release-preview.json');
const defaultOutputPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '202608010035_publish_tnl_dark_guide_family_claims.sql',
);
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);
const claimKeyPrefix = 'research:tnl-dark-guide-family:';
const expected = { claims: 98, confidenceA: 19, confidenceB: 79 };

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim().replace(/^["']|["']$/g, ''),
        ];
      }),
  );
}

function parseArgs(argv) {
  const options = { previewPath: defaultPreviewPath, outputPath: defaultOutputPath };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--preview') options.previewPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  return options;
}

export function assertLocalSupabase(supabaseUrl) {
  if (!localHostnames.has(new URL(supabaseUrl).hostname)) {
    throw new Error('This migration generator only reads local Supabase');
  }
}

function quotePostgrestValue(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function restUrl(config, tableName) {
  return new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`);
}

async function fetchClaimsByKeys(config, claimKeys) {
  const rows = [];
  for (let index = 0; index < claimKeys.length; index += 80) {
    const url = restUrl(config, 'person_claims');
    url.searchParams.set('select', 'claim_key,person_id,claim_type,claim_value,claim_json,confidence_level,review_score,review_status,visibility,is_public,source_name,source_url,observed_at,scoring_version,scoring_reasons,auto_reviewed_at,updated_at');
    url.searchParams.set('claim_key', `in.(${claimKeys.slice(index, index + 80).map(quotePostgrestValue).join(',')})`);
    const response = await fetch(url, {
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Failed to fetch person_claims: ${body?.message ?? response.statusText}`);
    rows.push(...body);
  }
  return rows;
}

export function buildFamilyReleaseRows(preview, claims) {
  if (preview?.summary?.eligibleClaims !== expected.claims || preview?.summary?.blockedClaims !== 0) {
    throw new Error('Family release preview count drift');
  }
  if (
    preview.summary.confidenceA !== expected.confidenceA
    || preview.summary.confidenceB !== expected.confidenceB
  ) throw new Error('Family release preview confidence drift');

  const eligibleByKey = new Map(preview.eligibleClaims.map((claim) => [claim.claimKey, claim]));
  if (eligibleByKey.size !== expected.claims || claims.length !== expected.claims) {
    throw new Error('Family release claim count drift');
  }
  const rows = claims.map((claim) => {
    const eligible = eligibleByKey.get(claim.claim_key);
    if (!eligible) throw new Error(`Claim is not in release preview: ${claim.claim_key}`);
    if (
      !claim.claim_key.startsWith(claimKeyPrefix)
      || claim.person_id !== eligible.personId
      || claim.claim_type !== 'family_relation'
      || claim.claim_value !== eligible.claimValue
      || claim.confidence_level !== eligible.confidenceLevel
      || Number(claim.review_score) !== eligible.reviewScore
      || claim.review_status !== 'verified'
      || claim.visibility !== 'review_only'
      || claim.is_public !== false
      || claim.source_name !== eligible.sourceName
      || claim.source_url !== eligible.sourceUrl
    ) throw new Error(`Claim drifted after release preview: ${claim.claim_key}`);
    return {
      ...claim,
      review_score: Number(claim.review_score),
      visibility: 'public',
      is_public: true,
    };
  }).sort((left, right) => left.claim_key.localeCompare(right.claim_key));
  if (new Set(rows.map((row) => row.claim_key)).size !== expected.claims) {
    throw new Error('Family release contains duplicate claim keys');
  }
  return rows;
}

function sqlJson(value) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::JSONB`;
}

export function buildMigration(rows) {
  if (rows.length !== expected.claims) throw new Error('Family release migration count drift');
  return `BEGIN;

CREATE TEMP TABLE _tnl_family_release (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    claim_type TEXT NOT NULL,
    claim_value TEXT NOT NULL,
    claim_json JSONB NOT NULL,
    confidence_level TEXT NOT NULL,
    review_score NUMERIC NOT NULL,
    review_status TEXT NOT NULL,
    visibility TEXT NOT NULL,
    is_public BOOLEAN NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    observed_at TIMESTAMPTZ,
    scoring_version TEXT,
    scoring_reasons JSONB NOT NULL,
    auto_reviewed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL
) ON COMMIT DROP;

INSERT INTO _tnl_family_release
SELECT *
FROM jsonb_to_recordset(${sqlJson(rows)}) AS item(
    claim_key TEXT,
    person_id UUID,
    claim_type TEXT,
    claim_value TEXT,
    claim_json JSONB,
    confidence_level TEXT,
    review_score NUMERIC,
    review_status TEXT,
    visibility TEXT,
    is_public BOOLEAN,
    source_name TEXT,
    source_url TEXT,
    observed_at TIMESTAMPTZ,
    scoring_version TEXT,
    scoring_reasons JSONB,
    auto_reviewed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

DO $$
DECLARE
    missing_people INTEGER;
    missing_cached_people INTEGER;
BEGIN
    IF (SELECT COUNT(*) FROM _tnl_family_release) <> ${expected.claims}
       OR (SELECT COUNT(*) FROM _tnl_family_release WHERE confidence_level = 'A') <> ${expected.confidenceA}
       OR (SELECT COUNT(*) FROM _tnl_family_release WHERE confidence_level = 'B') <> ${expected.confidenceB} THEN
        RAISE EXCEPTION 'TNL family release count or confidence drift';
    END IF;

    IF EXISTS (
        SELECT 1 FROM _tnl_family_release
        WHERE claim_type <> 'family_relation'
           OR review_status <> 'verified'
           OR visibility <> 'public'
           OR is_public IS DISTINCT FROM TRUE
           OR review_score < 70
           OR source_url !~ '^https://'
           OR claim_json->>'relativePersonId' IS NULL
           OR claim_json->>'relationType' IS NULL
    ) THEN
        RAISE EXCEPTION 'TNL family release contains an invalid public claim';
    END IF;

    SELECT COUNT(*) INTO missing_people
    FROM (
        SELECT person_id AS id FROM _tnl_family_release
        UNION
        SELECT (claim_json->>'relativePersonId')::UUID FROM _tnl_family_release
    ) required
    WHERE NOT EXISTS (SELECT 1 FROM people person WHERE person.id = required.id AND person.is_public = TRUE);
    IF missing_people > 0 THEN
        RAISE EXCEPTION 'TNL family release is missing % public people', missing_people;
    END IF;

    SELECT COUNT(*) INTO missing_cached_people
    FROM (SELECT DISTINCT person_id FROM _tnl_family_release) required
    WHERE NOT EXISTS (
        SELECT 1 FROM public_people_list_cached cached WHERE cached.person_id = required.person_id
    );
    IF missing_cached_people > 0 THEN
        RAISE EXCEPTION 'TNL family release is missing % people from the public profile cache', missing_cached_people;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_claims existing
        JOIN _tnl_family_release incoming USING (claim_key)
        WHERE existing.person_id IS DISTINCT FROM incoming.person_id
           OR existing.claim_type IS DISTINCT FROM incoming.claim_type
    ) THEN
        RAISE EXCEPTION 'TNL family release claim-key identity conflict';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_claims existing
        JOIN _tnl_family_release incoming
          ON incoming.person_id = existing.person_id
         AND existing.claim_key <> incoming.claim_key
         AND existing.review_status = 'verified'
         AND existing.visibility = 'public'
         AND existing.is_public = TRUE
         AND (
             regexp_replace(existing.claim_value, '\\s+', '', 'g') = regexp_replace(incoming.claim_value, '\\s+', '', 'g')
             OR (
                 existing.claim_json->>'relationType' = incoming.claim_json->>'relationType'
                 AND existing.claim_json->>'relativePersonId' = incoming.claim_json->>'relativePersonId'
             )
         )
    ) THEN
        RAISE EXCEPTION 'TNL family release duplicates an existing public relationship';
    END IF;
END
$$;

INSERT INTO person_claims (
    claim_key,
    person_id,
    claim_type,
    claim_value,
    claim_json,
    confidence_level,
    review_score,
    review_status,
    visibility,
    is_public,
    source_name,
    source_url,
    observed_at,
    scoring_version,
    scoring_reasons,
    auto_reviewed_at,
    updated_at
)
SELECT
    claim_key,
    person_id,
    claim_type,
    claim_value,
    claim_json,
    confidence_level,
    review_score,
    review_status,
    visibility,
    is_public,
    source_name,
    source_url,
    observed_at,
    scoring_version,
    scoring_reasons,
    auto_reviewed_at,
    updated_at
FROM _tnl_family_release
ON CONFLICT (claim_key) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    claim_type = EXCLUDED.claim_type,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_score = EXCLUDED.review_score,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    is_public = EXCLUDED.is_public,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    auto_reviewed_at = EXCLUDED.auto_reviewed_at,
    updated_at = EXCLUDED.updated_at;

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM person_claims claim JOIN _tnl_family_release release USING (claim_key)
        WHERE claim.review_status = 'verified' AND claim.visibility = 'public' AND claim.is_public = TRUE) <> ${expected.claims}
       OR (SELECT COUNT(*) FROM public_person_claims public_claim JOIN person_claims claim ON claim.id = public_claim.claim_id JOIN _tnl_family_release release USING (claim_key)) <> ${expected.claims} THEN
        RAISE EXCEPTION 'TNL family release final public verification failed';
    END IF;
END
$$;

COMMIT;
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const preview = JSON.parse(fs.readFileSync(options.previewPath, 'utf8'));
  const localEnv = readLocalEnv();
  const config = {
    supabaseUrl: process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  assertLocalSupabase(config.supabaseUrl);
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  const claims = await fetchClaimsByKeys(config, preview.eligibleClaims.map((claim) => claim.claimKey));
  const rows = buildFamilyReleaseRows(preview, claims);
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, buildMigration(rows));
  console.log(JSON.stringify({
    status: 'ok',
    output: path.relative(repoRoot, options.outputPath),
    claimCount: rows.length,
    confidenceA: rows.filter((row) => row.confidence_level === 'A').length,
    confidenceB: rows.filter((row) => row.confidence_level === 'B').length,
    distinctPeople: new Set(rows.map((row) => row.person_id)).size,
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { expected };
