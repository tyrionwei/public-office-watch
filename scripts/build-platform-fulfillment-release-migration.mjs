import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { classifyPlatformFulfillmentRelease, releaseQualityVersion } from './platform-fulfillment-release-quality.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
const expectedTargetCount = 991;
const missingClaimIds = new Set([
  '35c0b7d5-9925-4300-a87f-fde402e81011',
  '50bc9a00-7af7-4ac5-9e33-e17e2d7d59a9',
  '714806f6-6a43-4f3d-8edc-c40ff6271e06',
  'c06ae890-97d0-40cd-a46f-e456c16bb85f',
  'c129f52d-e1cb-4971-a26b-a372efbbdeae',
  'c9ac4321-1713-47a0-8834-2e6e3e334dd8',
  'ee058f16-75c8-4f8b-a91c-0aeff23e4731',
]);
const claimColumns = [
  ['id', 'uuid'],
  ['claim_key', 'text'],
  ['person_id', 'uuid'],
  ['source_person_id', 'uuid'],
  ['claim_type', 'text'],
  ['claim_value', 'text'],
  ['claim_json', 'jsonb'],
  ['confidence_level', 'text'],
  ['review_status', 'text'],
  ['visibility', 'text'],
  ['source_name', 'text'],
  ['source_url', 'text'],
  ['observed_at', 'timestamptz'],
  ['is_public', 'boolean'],
  ['created_at', 'timestamptz'],
  ['updated_at', 'timestamptz'],
  ['review_score', 'numeric'],
  ['scoring_version', 'text'],
  ['scoring_reasons', 'jsonb'],
  ['auto_reviewed_at', 'timestamptz'],
  ['candidate_id', 'uuid'],
];

function readEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim().replace(/^['"]|['"]$/gu, ''),
        ];
      }),
  );
}

function parseArgs(argv) {
  let outputPath = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--output') outputPath = path.resolve(argv[++index] ?? '');
    else throw new Error('Unsupported argument: ' + argv[index]);
  }
  if (!outputPath) {
    throw new Error('Usage: node scripts/build-platform-fulfillment-release-migration.mjs --output <migration.sql>');
  }
  return { outputPath };
}

function chunks(values, size = 40) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function headers(key) {
  return {
    apikey: key,
    authorization: 'Bearer ' + key,
    accept: 'application/json',
    'content-type': 'application/json',
    'accept-profile': 'public',
  };
}

async function responseJson(response, label) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(label + ': ' + (body?.message ?? response.statusText));
  return body;
}

async function fetchAll(config, table, select, filters = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = new URL(config.url + '/rest/v1/' + table);
    url.searchParams.set('select', select);
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', String(offset));
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const page = await responseJson(await fetch(url, {
      headers: headers(config.key),
      signal: AbortSignal.timeout(30000),
    }), 'Fetch ' + table);
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function fetchByValues(config, table, select, column, values, filters = {}) {
  const rows = [];
  for (const batch of chunks(Array.from(new Set(values)).filter(Boolean))) {
    rows.push(...await fetchAll(config, table, select, {
      ...filters,
      [column]: 'in.(' + batch.join(',') + ')',
    }));
  }
  return rows;
}

function isElected(candidate) {
  return candidate.is_elected === true || candidate.election_result === 'elected';
}

function releaseContentSplit(claim, decision) {
  const contentSplit = { ...(claim.claim_json?.contentSplit ?? {}) };
  if (!decision.releaseable) {
    return {
      ...contentSplit,
      reviewStatus: 'needs_review',
      releaseQuality: {
        version: releaseQualityVersion,
        reasonCodes: decision.reasonCodes,
      },
    };
  }
  if (decision.excludedItemCount > 0) {
    return {
      ...contentSplit,
      releaseQuality: {
        version: releaseQualityVersion,
        excludedItemCount: decision.excludedItemCount,
        reasonCodes: decision.excludedReasonCodes,
      },
    };
  }
  return contentSplit;
}

function releasedClaimJson(entry) {
  const claimJson = { ...(entry.claim.claim_json ?? {}) };
  if (entry.releaseable) claimJson.items = entry.items;
  else delete claimJson.items;
  claimJson.contentSplit = entry.contentSplit;
  return claimJson;
}

function validateClaims(claims) {
  if (claims.length !== expectedTargetCount) {
    throw new Error(`Expected ${expectedTargetCount} eligible platform claims, found ${claims.length}`);
  }
  const uniqueIds = new Set(claims.map((claim) => claim.id));
  if (uniqueIds.size !== claims.length) throw new Error('Duplicate platform claim IDs in release scope');

  for (const claim of claims) {
    if (
      claim.claim_type !== 'platform'
      || claim.review_status !== 'verified'
      || claim.visibility !== 'public'
      || claim.is_public !== true
      || !claim.candidate_id
      || !claim.person_id
    ) {
      throw new Error('Platform claim is outside the reviewed public boundary: ' + claim.id);
    }
  }

  const entries = claims.map((claim) => {
    const decision = classifyPlatformFulfillmentRelease(claim);
    return {
      claim,
      ...decision,
      contentSplit: releaseContentSplit(claim, decision),
    };
  });
  const approved = entries.filter((entry) => entry.releaseable);
  const withheld = entries.filter((entry) => !entry.releaseable);
  if (approved.length + withheld.length !== expectedTargetCount) {
    throw new Error('Platform release decisions do not cover the full target scope');
  }

  const missingClaims = entries.filter((entry) => missingClaimIds.has(entry.claim.id));
  if (missingClaims.length !== missingClaimIds.size) {
    throw new Error('The seven production-missing claims must be present in the release scope');
  }
  return { approved, withheld, missingClaims };
}

const resultsFunctionSql = `CREATE OR REPLACE FUNCTION published.platform_fulfillment_results(
    p_claim_id UUID
)
RETURNS TABLE (
    item_key TEXT,
    display_order INTEGER,
    promise_text TEXT,
    fulfilled_count BIGINT,
    in_progress_count BIGINT,
    not_fulfilled_count BIGINT,
    insufficient_information_count BIGINT,
    total_count BIGINT,
    results_announced_on DATE,
    voting_opens_on DATE,
    voting_is_open BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    WITH target AS (
        SELECT public.platform_fulfillment_vote_claim_id(p_claim_id) AS vote_claim_id
    ),
    current_items AS (
        SELECT DISTINCT ON (derived.item_key)
            derived.item_key,
            derived.display_order,
            derived.promise_text,
            election.results_announced_on,
            (election.results_announced_on + INTERVAL '1 year')::DATE AS voting_opens_on,
            COALESCE(
                CURRENT_DATE >= (election.results_announced_on + INTERVAL '1 year')::DATE,
                FALSE
            ) AS voting_is_open
        FROM public.person_claims AS claim
        JOIN public.candidates AS candidate ON candidate.id = claim.candidate_id
        JOIN public.races AS race ON race.id = candidate.race_id
        JOIN public.elections AS election ON election.id = race.election_id
        CROSS JOIN LATERAL (
            SELECT
                pg_catalog.encode(
                    extensions.digest(pg_catalog.btrim(item.value), 'sha256'),
                    'hex'
                ) AS item_key,
                item.ordinality::INTEGER AS display_order,
                pg_catalog.btrim(item.value) AS promise_text
            FROM pg_catalog.jsonb_array_elements_text(claim.claim_json -> 'items')
                WITH ORDINALITY AS item(value, ordinality)
            WHERE pg_catalog.btrim(item.value) <> ''
        ) AS derived
        WHERE claim.id = p_claim_id
          AND claim.claim_type = 'platform'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
          AND claim.claim_json #>> '{contentSplit,reviewStatus}'
                IN ('auto_approved', 'reviewed')
          AND candidate.election_result = 'elected'
          AND (
              (
                  election.year = 2024
                  AND race.race_type IN (
                      'president',
                      'legislative_district',
                      'legislator',
                      'party_list_legislator',
                      'indigenous'
                  )
              )
              OR (
                  election.year = 2022
                  AND race.race_type IN (
                      'councilor_district',
                      'city_councilor',
                      'county_councilor'
                  )
              )
          )
          AND pg_catalog.jsonb_typeof(claim.claim_json -> 'items') = 'array'
        ORDER BY derived.item_key, derived.display_order
    )
    SELECT
        item.item_key,
        item.display_order,
        item.promise_text,
        pg_catalog.count(*) FILTER (WHERE vote.vote_status = 'fulfilled') AS fulfilled_count,
        pg_catalog.count(*) FILTER (WHERE vote.vote_status = 'in_progress') AS in_progress_count,
        pg_catalog.count(*) FILTER (WHERE vote.vote_status = 'not_fulfilled') AS not_fulfilled_count,
        pg_catalog.count(*) FILTER (WHERE vote.vote_status = 'insufficient_information') AS insufficient_information_count,
        pg_catalog.count(vote.id) AS total_count,
        item.results_announced_on,
        item.voting_opens_on,
        item.voting_is_open
    FROM current_items AS item
    CROSS JOIN target
    LEFT JOIN public.platform_fulfillment_votes AS vote
      ON vote.claim_id = target.vote_claim_id
     AND vote.item_key = item.item_key
    GROUP BY
        item.item_key,
        item.display_order,
        item.promise_text,
        item.results_announced_on,
        item.voting_opens_on,
        item.voting_is_open
    ORDER BY item.display_order;
$function$;`;

function buildMigration(claims) {
  const { approved, withheld, missingClaims } = validateClaims(claims);
  const itemRows = approved.toSorted((left, right) => left.claim.id.localeCompare(right.claim.id)).map((entry) => ({
    claim_id: entry.claim.id,
    items: entry.items,
    content_split: entry.contentSplit,
  }));
  const withheldRows = withheld.toSorted((left, right) => left.claim.id.localeCompare(right.claim.id)).map((entry) => ({
    claim_id: entry.claim.id,
    content_split: entry.contentSplit,
  }));
  const missingRows = missingClaims.toSorted((left, right) => left.claim.id.localeCompare(right.claim.id)).map((entry) => Object.fromEntries(
    claimColumns.map(([column]) => [
      column,
      column === 'claim_json' ? releasedClaimJson(entry) : entry.claim[column],
    ]),
  ));
  const itemJson = JSON.stringify(itemRows);
  const withheldJson = JSON.stringify(withheldRows);
  const missingJson = JSON.stringify(missingRows);
  if (
    itemJson.includes('$platform_items$')
    || withheldJson.includes('$withheld_items$')
    || missingJson.includes('$missing_claims$')
  ) {
    throw new Error('Platform release payload conflicts with SQL dollar tags');
  }
  const claimColumnNames = claimColumns.map(([name]) => name).join(', ');
  const claimColumnDefinitions = claimColumns
    .map(([name, type]) => '    ' + name + ' ' + type)
    .join(',\n');

  return `BEGIN;

-- Generated from the reviewed full-local platform snapshot.
-- Only auto_approved/reviewed non-empty splits are released for voting.
CREATE TEMP TABLE _platform_release_items ON COMMIT DROP AS
SELECT *
FROM pg_catalog.jsonb_to_recordset($platform_items$${itemJson}$platform_items$::JSONB) AS release(
    claim_id UUID,
    items JSONB,
    content_split JSONB
);

CREATE TEMP TABLE _platform_release_withheld_items ON COMMIT DROP AS
SELECT *
FROM pg_catalog.jsonb_to_recordset($withheld_items$${withheldJson}$withheld_items$::JSONB) AS release(
    claim_id UUID,
    content_split JSONB
);

CREATE TEMP TABLE _platform_release_missing_claims ON COMMIT DROP AS
SELECT *
FROM pg_catalog.jsonb_to_recordset($missing_claims$${missingJson}$missing_claims$::JSONB) AS release(
${claimColumnDefinitions}
);

DO $checks$
BEGIN
    IF (SELECT pg_catalog.count(*) FROM _platform_release_items) <> ${approved.length} THEN
        RAISE EXCEPTION 'Expected ${approved.length} approved non-empty platform item payloads';
    END IF;

    IF (SELECT pg_catalog.count(*) FROM _platform_release_withheld_items) <> ${withheld.length} THEN
        RAISE EXCEPTION 'Expected ${withheld.length} withheld platform item payloads';
    END IF;

    IF (
        (SELECT pg_catalog.count(*) FROM _platform_release_items)
        + (SELECT pg_catalog.count(*) FROM _platform_release_withheld_items)
    ) <> ${expectedTargetCount} THEN
        RAISE EXCEPTION 'Platform release decisions do not cover all ${expectedTargetCount} target claims';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _platform_release_items AS approved
        JOIN _platform_release_withheld_items AS withheld
          ON withheld.claim_id = approved.claim_id
    ) THEN
        RAISE EXCEPTION 'A platform claim cannot be both approved and withheld';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _platform_release_items AS release
        WHERE pg_catalog.jsonb_typeof(release.items) <> 'array'
           OR pg_catalog.jsonb_array_length(release.items) = 0
           OR release.content_split ->> 'reviewStatus'
                NOT IN ('auto_approved', 'reviewed')
    ) THEN
        RAISE EXCEPTION 'Platform item release contains an unapproved or empty split';
    END IF;

    IF (SELECT pg_catalog.count(*) FROM _platform_release_missing_claims) <> ${missingClaimIds.size} THEN
        RAISE EXCEPTION 'Expected ${missingClaimIds.size} production-missing platform claims';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _platform_release_missing_claims AS release
        LEFT JOIN public.people AS person ON person.id = release.person_id
        LEFT JOIN public.candidates AS candidate ON candidate.id = release.candidate_id
        WHERE person.id IS NULL
           OR candidate.id IS NULL
           OR release.claim_type <> 'platform'
           OR release.review_status <> 'verified'
           OR release.visibility <> 'public'
           OR release.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'Missing platform claim identity or publication boundary is invalid: %', (
            SELECT pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                    'claimId', release.id,
                    'personExists', person.id IS NOT NULL,
                    'candidateExists', candidate.id IS NOT NULL,
                    'candidatePersonId', candidate.person_id,
                    'claimPersonId', release.person_id,
                    'reviewStatus', release.review_status,
                    'visibility', release.visibility,
                    'isPublic', release.is_public
                )
            )
            FROM _platform_release_missing_claims AS release
            LEFT JOIN public.people AS person ON person.id = release.person_id
            LEFT JOIN public.candidates AS candidate ON candidate.id = release.candidate_id
            WHERE person.id IS NULL
               OR candidate.id IS NULL
               OR release.claim_type <> 'platform'
               OR release.review_status <> 'verified'
               OR release.visibility <> 'public'
               OR release.is_public IS DISTINCT FROM TRUE
        );
    END IF;
END
$checks$;

DO $identity_verify$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _platform_release_missing_claims AS release
        JOIN public.candidates AS candidate ON candidate.id = release.candidate_id
        JOIN public.person_canonical_map AS candidate_map
          ON candidate_map.person_id = candidate.person_id
        JOIN public.person_canonical_map AS claim_map
          ON claim_map.person_id = release.person_id
        WHERE candidate_map.canonical_person_id <> claim_map.canonical_person_id
    ) THEN
        RAISE EXCEPTION 'Released platform claim is not linked to the canonical candidate person';
    END IF;
END
$identity_verify$;

INSERT INTO public.person_claims (${claimColumnNames})
SELECT ${claimColumnNames}
FROM _platform_release_missing_claims
ON CONFLICT (id) DO NOTHING;

DO $insert_verify$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _platform_release_missing_claims AS release
        LEFT JOIN public.person_claims AS claim ON claim.id = release.id
        WHERE claim.id IS NULL
           OR claim.claim_key IS DISTINCT FROM release.claim_key
           OR claim.person_id IS DISTINCT FROM release.person_id
           OR claim.candidate_id IS DISTINCT FROM release.candidate_id
           OR claim.claim_type IS DISTINCT FROM release.claim_type
           OR claim.review_status IS DISTINCT FROM release.review_status
           OR claim.visibility IS DISTINCT FROM release.visibility
           OR claim.is_public IS DISTINCT FROM release.is_public
    ) THEN
        RAISE EXCEPTION 'Inserted platform claim conflicts with the reviewed release row';
    END IF;
END
$insert_verify$;

CREATE TEMP TABLE _platform_release_withheld_claims (
    claim_id UUID PRIMARY KEY
) ON COMMIT DROP;

WITH updated AS (
    UPDATE public.person_claims AS claim
    SET
        claim_json = pg_catalog.jsonb_set(
            COALESCE(claim.claim_json, '{}'::JSONB) - 'items',
            '{contentSplit}',
            release.content_split,
            TRUE
        ),
        updated_at = pg_catalog.now()
    FROM _platform_release_withheld_items AS release
    WHERE claim.id = release.claim_id
      AND claim.claim_type = 'platform'
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public = TRUE
    RETURNING claim.id
)
INSERT INTO _platform_release_withheld_claims (claim_id)
SELECT id
FROM updated;

CREATE TEMP TABLE _platform_release_updated_claims (
    claim_id UUID PRIMARY KEY
) ON COMMIT DROP;

WITH updated AS (
    UPDATE public.person_claims AS claim
    SET
        claim_json = pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
                COALESCE(claim.claim_json, '{}'::JSONB),
                '{items}',
                release.items,
                TRUE
            ),
            '{contentSplit}',
            release.content_split,
            TRUE
        ),
        updated_at = pg_catalog.now()
    FROM _platform_release_items AS release
    WHERE claim.id = release.claim_id
      AND claim.claim_type = 'platform'
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public = TRUE
    RETURNING claim.id
)
INSERT INTO _platform_release_updated_claims (claim_id)
SELECT id
FROM updated;

DO $verify$
BEGIN
    IF (SELECT pg_catalog.count(*) FROM _platform_release_updated_claims)
        <> ${approved.length} THEN
        RAISE EXCEPTION 'Approved platform items were not fully released';
    END IF;

    IF (SELECT pg_catalog.count(*) FROM _platform_release_withheld_claims)
        <> ${withheld.length} THEN
        RAISE EXCEPTION 'Withheld platform claims were not fully updated';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _platform_release_withheld_items AS release
        JOIN public.person_claims AS claim ON claim.id = release.claim_id
        WHERE claim.claim_json ? 'items'
           OR claim.claim_json -> 'contentSplit' IS DISTINCT FROM release.content_split
           OR claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'needs_review'
    ) THEN
        RAISE EXCEPTION 'Withheld platform claim payload does not match the release decision';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _platform_release_items AS release
        JOIN public.person_claims AS claim ON claim.id = release.claim_id
        WHERE claim.claim_json -> 'items' IS DISTINCT FROM release.items
           OR claim.claim_json -> 'contentSplit' IS DISTINCT FROM release.content_split
           OR claim.claim_json #>> '{contentSplit,reviewStatus}'
                NOT IN ('auto_approved', 'reviewed')
    ) THEN
        RAISE EXCEPTION 'Released platform item payload does not match the reviewed snapshot';
    END IF;
END
$verify$;

${resultsFunctionSql}

NOTIFY pgrst, 'reload schema';

COMMIT;
`;
}

async function loadLocalClaims() {
  const env = readEnv();
  const config = {
    url: String(process.env.SUPABASE_URL ?? env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '').replace(/\/$/u, ''),
    key: String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? ''),
  };
  if (!config.url || !config.key) throw new Error('Local Supabase URL and service-role key are required');
  if (!localHosts.has(new URL(config.url).hostname)) {
    throw new Error('Refused non-local Supabase host');
  }

  const elections = await fetchAll(config, 'elections', 'id,year', { year: 'in.(2022,2024)' });
  const electionById = new Map(elections.map((election) => [election.id, election]));
  const races = (await fetchByValues(
    config,
    'races',
    'id,election_id,race_type',
    'election_id',
    elections.map((election) => election.id),
  )).filter((race) => {
    const year = Number(electionById.get(race.election_id)?.year);
    return (year === 2022 && race.race_type === 'councilor_district')
      || (year === 2024 && ['legislative_district', 'indigenous', 'president'].includes(race.race_type));
  });
  const candidates = (await fetchByValues(
    config,
    'candidates',
    'id,person_id,race_id,is_elected,election_result',
    'race_id',
    races.map((race) => race.id),
  )).filter(isElected);
  const select = claimColumns.map(([name]) => name).join(',');
  return fetchByValues(
    config,
    'person_claims',
    select,
    'candidate_id',
    candidates.map((candidate) => candidate.id),
    {
      claim_type: 'eq.platform',
      review_status: 'eq.verified',
      visibility: 'eq.public',
      is_public: 'eq.true',
    },
  );
}

async function main() {
  const { outputPath } = parseArgs(process.argv.slice(2));
  const claims = await loadLocalClaims();
  const summary = validateClaims(claims);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buildMigration(claims));
  console.log(JSON.stringify({
    outputPath,
    targetClaims: claims.length,
    approvedItemClaims: summary.approved.length,
    withheldNeedsReviewClaims: summary.withheld.length,
    missingClaimsIncluded: missingClaimIds.size,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export {
  buildMigration,
  parseArgs,
  validateClaims,
};
