SET statement_timeout = 0;

-- Resolve the highest-priority remaining official officeholders through their
-- 2022 current-term election records. A matching 2026 candidacy is supporting
-- evidence. Older election history is deliberately not considered here.
--
-- Current official party labels may differ from the 2022 ballot (party change,
-- caucus label or source correction). When exact name, office, county/city and
-- election district identify one canonical person, keep that party difference
-- in the evidence instead of treating it as a second identity.
CREATE TEMP TABLE _recent_official_context_targets ON COMMIT DROP AS
WITH source_context AS MATERIALIZED (
    SELECT
        queue.source_person_id,
        source.source_person_key,
        source.source_name,
        source.raw_name,
        source.party AS source_party,
        source.position AS source_position,
        source.district AS source_district,
        CASE
            WHEN BTRIM(COALESCE(source.party, '')) = '' THEN NULL
            WHEN regexp_replace(
                replace(source.party, '臺', '台'), E'\\s+', '', 'g'
            ) IN ('無', '無黨', '無黨籍') THEN '無黨籍'
            ELSE regexp_replace(
                replace(source.party, '臺', '台'), E'\\s+', '', 'g'
            )
        END AS normalized_party,
        CASE
            WHEN source.position LIKE '%總統%' THEN 'president'
            WHEN source.position LIKE '%立法委員%' THEN 'legislator'
            WHEN source.position LIKE '%縣市長%'
              OR source.position LIKE '%市長%'
              OR source.position LIKE '%縣長%'
              OR source.position LIKE '%鄉長%'
              OR source.position LIKE '%鎮長%' THEN 'mayor'
            WHEN source.position LIKE '%議員%'
              OR source.position LIKE '%議會議長%'
              OR source.position LIKE '%議會副議長%' THEN 'councilor'
            ELSE 'other'
        END AS normalized_role,
        COALESCE(
            substring(
                replace(source.district, '臺', '台')
                FROM '^(.+?[縣市])'
            ),
            substring(
                replace(source.position, '臺', '台')
                FROM '^(.+?[縣市])'
            )
        ) AS normalized_region,
        substring(
            public.normalize_election_district_label(
                COALESCE(source.district, source.position)
            )
            FROM '第[[:space:]]*([0-9]+)[[:space:]]*(?:選舉區|選區|區)'
        )::INTEGER AS district_number,
        CASE
            WHEN COALESCE(source.district, '') || COALESCE(source.position, '')
                 LIKE '%平地原住民%' THEN 'plain_indigenous'
            WHEN COALESCE(source.district, '') || COALESCE(source.position, '')
                 LIKE '%山地原住民%' THEN 'mountain_indigenous'
            ELSE NULL
        END AS indigenous_type
    FROM identity_unmatched_source_people queue
    JOIN source_people source ON source.id = queue.source_person_id
    WHERE queue.review_status = 'unmatched'
      AND source.source_type = 'official_officeholder'
),
recent_context_pairs AS MATERIALIZED (
    SELECT DISTINCT
        source.source_person_id,
        source.source_person_key,
        source.source_name,
        source.raw_name,
        source.source_party,
        source.source_position,
        source.source_district,
        canonical.canonical_person_id AS person_id,
        election.year AS election_year,
        source.normalized_party IS NULL
        OR source.normalized_party = CASE
            WHEN regexp_replace(
                replace(COALESCE(candidate.party, ''), '臺', '台'),
                E'\\s+', '', 'g'
            ) IN ('無', '無黨', '無黨籍') THEN '無黨籍'
            ELSE regexp_replace(
                replace(COALESCE(candidate.party, ''), '臺', '台'),
                E'\\s+', '', 'g'
            )
        END AS party_match
    FROM source_context source
    JOIN people candidate_person ON candidate_person.name = source.raw_name
    JOIN person_canonical_map canonical
      ON canonical.person_id = candidate_person.id
    JOIN people target ON target.id = canonical.canonical_person_id
    JOIN candidates candidate ON candidate.person_id = candidate_person.id
    JOIN races race ON race.id = candidate.race_id
    JOIN elections election ON election.id = race.election_id
    LEFT JOIN regions region ON region.id = race.region_id
    WHERE election.year IN (2022, 2026)
      AND target.is_public = TRUE
      AND source.normalized_role <> 'other'
      AND source.normalized_role = CASE
          WHEN race.race_type IN ('president', 'vice_president') THEN 'president'
          WHEN race.race_type IN (
              'legislator', 'party_list_legislator', 'legislative_district'
          ) THEN 'legislator'
          WHEN race.race_type IN (
              'municipality_mayor', 'county_mayor', 'local_chief',
              'township_mayor'
          ) THEN 'mayor'
          WHEN race.race_type IN (
              'city_councilor', 'county_councilor', 'councilor_district',
              'indigenous'
          ) THEN 'councilor'
          ELSE 'other'
      END
      AND (
          source.normalized_region IS NULL
          OR source.normalized_region = COALESCE(
              substring(
                  replace(region.name, '臺', '台')
                  FROM '^(.+?[縣市])'
              ),
              substring(
                  replace(race.title, '臺', '台')
                  FROM '^(.+?[縣市])'
              )
          )
      )
      AND (
          source.district_number IS NULL
          OR source.district_number = substring(
              public.normalize_election_district_label(race.title)
              FROM '第[[:space:]]*([0-9]+)[[:space:]]*(?:選舉區|選區|區)'
          )::INTEGER
      )
      AND (
          source.indigenous_type IS NULL
          OR (
              source.indigenous_type = 'plain_indigenous'
              AND race.title LIKE '%平地原住民%'
          )
          OR (
              source.indigenous_type = 'mountain_indigenous'
              AND race.title LIKE '%山地原住民%'
          )
      )
      AND NOT EXISTS (
          SELECT 1
          FROM person_identity_matches rejected
          JOIN person_canonical_map rejected_canonical
            ON rejected_canonical.person_id = rejected.person_id
          WHERE rejected.source_person_id = source.source_person_id
            AND rejected.match_status = 'rejected_match'
            AND rejected_canonical.canonical_person_id =
                canonical.canonical_person_id
      )
),
person_context AS (
    SELECT
        pair.source_person_id,
        pair.person_id,
        MIN(pair.source_person_key) AS source_person_key,
        MIN(pair.source_name) AS source_name,
        MIN(pair.raw_name) AS raw_name,
        MIN(pair.source_party) AS source_party,
        MIN(pair.source_position) AS source_position,
        MIN(pair.source_district) AS source_district,
        ARRAY_AGG(DISTINCT pair.election_year ORDER BY pair.election_year)
            AS matched_election_years,
        BOOL_OR(pair.party_match) AS has_matching_party
    FROM recent_context_pairs pair
    GROUP BY pair.source_person_id, pair.person_id
),
source_counts AS (
    SELECT
        source_person_id,
        COUNT(DISTINCT person_id) AS person_count
    FROM person_context
    GROUP BY source_person_id
),
current_eligible AS (
    SELECT
        context.source_person_id,
        context.person_id,
        context.source_person_key,
        context.source_name,
        context.raw_name,
        context.source_party,
        context.source_position,
        context.source_district,
        context.matched_election_years,
        context.has_matching_party,
        jsonb_build_object(
            'version', 'official-officeholder-recent-election-context-v1',
            'strategy', CASE
                WHEN context.has_matching_party
                    THEN 'unique_2022_current_term_context'
                ELSE 'unique_2022_context_with_party_difference'
            END,
            'sourcePersonKey', context.source_person_key,
            'sourceName', context.source_name,
            'sourceNameValue', context.raw_name,
            'canonicalPersonId', context.person_id,
            'matchedElectionYears', to_jsonb(context.matched_election_years),
            'partyContextMatches', context.has_matching_party,
            'sourceParty', context.source_party,
            'matchedSignals', jsonb_build_array(
                'exact_name', '2022_current_term', 'role', 'region',
                'district_when_available'
            )
        ) AS desired_evidence_json
    FROM person_context context
    JOIN source_counts counts USING (source_person_id)
    WHERE counts.person_count = 1
      AND 2022 = ANY(context.matched_election_years)
),
already_processed AS (
    SELECT
        identity_match.source_person_id,
        identity_match.person_id,
        identity_match.evidence_json->>'sourcePersonKey' AS source_person_key,
        identity_match.evidence_json->>'sourceName' AS source_name,
        identity_match.evidence_json->>'sourceNameValue' AS raw_name,
        source.party AS source_party,
        source.position AS source_position,
        source.district AS source_district,
        ARRAY(
            SELECT value::INTEGER
            FROM jsonb_array_elements_text(
                identity_match.evidence_json->'matchedElectionYears'
            ) value
            ORDER BY value::INTEGER
        ) AS matched_election_years,
        COALESCE(
            (identity_match.evidence_json->>'partyContextMatches')::BOOLEAN,
            TRUE
        ) AS has_matching_party,
        identity_match.evidence_json AS desired_evidence_json
    FROM person_identity_matches identity_match
    JOIN source_people source ON source.id = identity_match.source_person_id
    WHERE identity_match.match_status = 'auto_matched'
      AND identity_match.match_method =
          'official_officeholder_recent_election_context_v1'
      AND identity_match.reviewed_by =
          'system:official-officeholder-recent-election-context-v1'
)
SELECT * FROM current_eligible
UNION ALL
SELECT processed.*
FROM already_processed processed
WHERE NOT EXISTS (
    SELECT 1
    FROM current_eligible current_row
    WHERE current_row.source_person_id = processed.source_person_id
);

ALTER TABLE _recent_official_context_targets
    ADD PRIMARY KEY (source_person_id);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _recent_official_context_targets) <> 285
       OR (
           SELECT COUNT(*)
           FROM _recent_official_context_targets
           WHERE 2026 = ANY(matched_election_years)
       ) <> 43
       OR (
           SELECT COUNT(*)
           FROM _recent_official_context_targets
           WHERE has_matching_party = FALSE
       ) <> 14
       OR (
           SELECT COUNT(*)
           FROM person_claims claim
           JOIN _recent_official_context_targets target
             ON target.source_person_id = claim.source_person_id
       ) <> 1159
       OR EXISTS (
           SELECT 1
           FROM _recent_official_context_targets target
           JOIN source_people source ON source.id = target.source_person_id
           JOIN people person ON person.id = target.person_id
           JOIN person_canonical_map canonical ON canonical.person_id = person.id
           WHERE source.source_type <> 'official_officeholder'
              OR person.is_public <> TRUE
              OR canonical.canonical_person_id <> person.id
              OR NOT EXISTS (
                  SELECT 1
                  FROM people alias
                  JOIN person_canonical_map alias_canonical
                    ON alias_canonical.person_id = alias.id
                  WHERE alias.name = source.raw_name
                    AND alias_canonical.canonical_person_id = target.person_id
              )
       )
       OR EXISTS (
           SELECT 1
           FROM person_claims claim
           JOIN _recent_official_context_targets target
             ON target.source_person_id = claim.source_person_id
           LEFT JOIN person_canonical_map canonical
             ON canonical.person_id = claim.person_id
           WHERE claim.review_status <> 'verified'
              OR claim.visibility <> 'public'
              OR claim.is_public <> TRUE
              OR (
                  claim.person_id IS NOT NULL
                  AND canonical.canonical_person_id IS DISTINCT FROM target.person_id
              )
       ) THEN
        RAISE EXCEPTION 'Recent official election context boundary drifted';
    END IF;
END;
$$;

INSERT INTO person_identity_matches (
    source_person_id,
    person_id,
    match_status,
    score,
    match_method,
    match_reason,
    evidence_json,
    reviewed_by,
    reviewed_at,
    updated_at
)
SELECT
    target.source_person_id,
    target.person_id,
    'auto_matched',
    CASE WHEN target.has_matching_party THEN 99 ELSE 97 END,
    'official_officeholder_recent_election_context_v1',
    CASE
        WHEN target.has_matching_party THEN
            'auto-approved: one canonical person matches the official current officeholder by exact name and 2022 office, county/city, district and available party context'
        ELSE
            'auto-approved: one canonical person matches the official current officeholder by exact name and 2022 office, county/city and district; the current official party label differs from the 2022 ballot and is retained as evidence'
    END,
    target.desired_evidence_json,
    'system:official-officeholder-recent-election-context-v1',
    NOW(),
    NOW()
FROM _recent_official_context_targets target
ON CONFLICT (source_person_id, person_id) DO UPDATE
SET
    match_status = EXCLUDED.match_status,
    score = EXCLUDED.score,
    match_method = EXCLUDED.match_method,
    match_reason = EXCLUDED.match_reason,
    evidence_json = EXCLUDED.evidence_json,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = EXCLUDED.updated_at
WHERE person_identity_matches.match_status IS DISTINCT FROM EXCLUDED.match_status
   OR person_identity_matches.score IS DISTINCT FROM EXCLUDED.score
   OR person_identity_matches.match_method IS DISTINCT FROM EXCLUDED.match_method
   OR person_identity_matches.match_reason IS DISTINCT FROM EXCLUDED.match_reason
   OR person_identity_matches.evidence_json IS DISTINCT FROM EXCLUDED.evidence_json
   OR person_identity_matches.reviewed_by IS DISTINCT FROM EXCLUDED.reviewed_by;

UPDATE person_claims claim
SET
    person_id = target.person_id,
    updated_at = NOW()
FROM _recent_official_context_targets target
WHERE claim.source_person_id = target.source_person_id
  AND claim.person_id IS DISTINCT FROM target.person_id
  AND (
      claim.person_id IS NULL
      OR EXISTS (
          SELECT 1
          FROM person_canonical_map canonical
          WHERE canonical.person_id = claim.person_id
            AND canonical.canonical_person_id = target.person_id
      )
  );

UPDATE source_people source
SET
    is_public = TRUE,
    updated_at = NOW()
FROM _recent_official_context_targets target
WHERE source.id = target.source_person_id
  AND source.is_public = FALSE;

SELECT published.promote(NULL);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _recent_official_context_targets target
        LEFT JOIN person_identity_matches identity_match
          ON identity_match.source_person_id = target.source_person_id
         AND identity_match.person_id = target.person_id
        WHERE identity_match.match_status IS DISTINCT FROM 'auto_matched'
           OR identity_match.match_method IS DISTINCT FROM
              'official_officeholder_recent_election_context_v1'
    )
       OR EXISTS (
           SELECT 1
           FROM person_claims claim
           JOIN _recent_official_context_targets target
             ON target.source_person_id = claim.source_person_id
           WHERE claim.person_id IS DISTINCT FROM target.person_id
              OR claim.review_status <> 'verified'
              OR claim.visibility <> 'public'
              OR claim.is_public <> TRUE
       )
       OR (
           SELECT COUNT(*)
           FROM identity_unmatched_source_people
           WHERE review_status = 'unmatched'
             AND source_type = 'official_officeholder'
       ) <> 4 THEN
        RAISE EXCEPTION 'Recent official election identities were not reconciled';
    END IF;
END;
$$;

RESET statement_timeout;
