CREATE EXTENSION IF NOT EXISTS dblink;

BEGIN;

CREATE TEMP TABLE _reference_public_keys (
    entity_type TEXT NOT NULL,
    stable_key TEXT NOT NULL,
    PRIMARY KEY (entity_type, stable_key)
) ON COMMIT DROP;

INSERT INTO _reference_public_keys (entity_type, stable_key)
SELECT entity_type, stable_key
FROM dblink(
    :'reference_connection',
    $remote$
        SELECT 'people', COALESCE(core.external_id, item.person_id::TEXT)
        FROM published.people item JOIN public.people core ON core.id = item.person_id
        UNION ALL
        SELECT 'elections', COALESCE(core.external_id, item.election_id::TEXT)
        FROM published.elections item JOIN public.elections core ON core.id = item.election_id
        UNION ALL
        SELECT 'races', COALESCE(core.external_id, item.race_id::TEXT)
        FROM published.races item JOIN public.races core ON core.id = item.race_id
        UNION ALL
        SELECT 'candidates', COALESCE(core.external_id, item.candidate_id::TEXT)
        FROM published.candidates item JOIN public.candidates core ON core.id = item.candidate_id
        UNION ALL
        SELECT 'candidate_facts', COALESCE(core.external_id, item.candidate_id::TEXT)
        FROM published.candidate_facts item JOIN public.candidates core ON core.id = item.candidate_id
        UNION ALL
        SELECT 'search_documents', 'person:' || COALESCE(core.external_id, item.entity_id::TEXT)
        FROM published.search_documents item JOIN public.people core ON core.id = item.entity_id
        WHERE item.entity_type = 'person'
        UNION ALL
        SELECT 'search_documents', 'election:' || COALESCE(core.external_id, item.entity_id::TEXT)
        FROM published.search_documents item JOIN public.elections core ON core.id = item.entity_id
        WHERE item.entity_type = 'election'
        UNION ALL
        SELECT 'search_documents', 'company:' || COALESCE(core.unified_business_no, item.entity_id::TEXT)
        FROM published.search_documents item JOIN public.companies core ON core.id = item.entity_id
        WHERE item.entity_type = 'company'
        UNION ALL
        SELECT 'search_documents', 'party:' || COALESCE(core.external_id, item.entity_id::TEXT)
        FROM published.search_documents item JOIN public.parties core ON core.id = item.entity_id
        WHERE item.entity_type = 'party'
        UNION ALL
        SELECT 'search_documents', 'region:' || COALESCE(core.external_id, core.slug, item.entity_id::TEXT)
        FROM published.search_documents item JOIN public.regions core ON core.id = item.entity_id
        WHERE item.entity_type = 'region'
    $remote$
) AS remote_keys(entity_type TEXT, stable_key TEXT);

CREATE TEMP TABLE _actual_public_keys (
    entity_type TEXT NOT NULL,
    stable_key TEXT NOT NULL,
    PRIMARY KEY (entity_type, stable_key)
) ON COMMIT DROP;

INSERT INTO _actual_public_keys (entity_type, stable_key)
SELECT 'people', COALESCE(core.external_id, item.person_id::TEXT)
FROM published.people item JOIN public.people core ON core.id = item.person_id
UNION ALL
SELECT 'elections', COALESCE(core.external_id, item.election_id::TEXT)
FROM published.elections item JOIN public.elections core ON core.id = item.election_id
UNION ALL
SELECT 'races', COALESCE(core.external_id, item.race_id::TEXT)
FROM published.races item JOIN public.races core ON core.id = item.race_id
UNION ALL
SELECT 'candidates', COALESCE(core.external_id, item.candidate_id::TEXT)
FROM published.candidates item JOIN public.candidates core ON core.id = item.candidate_id
UNION ALL
SELECT 'candidate_facts', COALESCE(core.external_id, item.candidate_id::TEXT)
FROM published.candidate_facts item JOIN public.candidates core ON core.id = item.candidate_id
UNION ALL
SELECT 'search_documents', 'person:' || COALESCE(core.external_id, item.entity_id::TEXT)
FROM published.search_documents item JOIN public.people core ON core.id = item.entity_id
WHERE item.entity_type = 'person'
UNION ALL
SELECT 'search_documents', 'election:' || COALESCE(core.external_id, item.entity_id::TEXT)
FROM published.search_documents item JOIN public.elections core ON core.id = item.entity_id
WHERE item.entity_type = 'election'
UNION ALL
SELECT 'search_documents', 'company:' || COALESCE(core.unified_business_no, item.entity_id::TEXT)
FROM published.search_documents item JOIN public.companies core ON core.id = item.entity_id
WHERE item.entity_type = 'company'
UNION ALL
SELECT 'search_documents', 'party:' || COALESCE(core.external_id, item.entity_id::TEXT)
FROM published.search_documents item JOIN public.parties core ON core.id = item.entity_id
WHERE item.entity_type = 'party'
UNION ALL
SELECT 'search_documents', 'region:' || COALESCE(core.external_id, core.slug, item.entity_id::TEXT)
FROM published.search_documents item JOIN public.regions core ON core.id = item.entity_id
WHERE item.entity_type = 'region';

CREATE TEMP TABLE _public_set_comparison ON COMMIT DROP AS
WITH entity_types AS (
    SELECT entity_type FROM _reference_public_keys
    UNION
    SELECT entity_type FROM _actual_public_keys
)
SELECT
    entity_type,
    (SELECT COUNT(*) FROM _reference_public_keys reference
     WHERE reference.entity_type = entity_types.entity_type
       AND NOT EXISTS (
           SELECT 1 FROM _actual_public_keys actual
           WHERE actual.entity_type = reference.entity_type
             AND actual.stable_key = reference.stable_key
       )) AS missing_from_compacted,
    (SELECT COUNT(*) FROM _actual_public_keys actual
     WHERE actual.entity_type = entity_types.entity_type
       AND NOT EXISTS (
           SELECT 1 FROM _reference_public_keys reference
           WHERE reference.entity_type = actual.entity_type
             AND reference.stable_key = actual.stable_key
       )) AS added_by_pending_migrations
FROM entity_types
ORDER BY entity_type;

SELECT 'missing|' || reference.entity_type || '|' || reference.stable_key
FROM _reference_public_keys reference
WHERE NOT EXISTS (
    SELECT 1
    FROM _actual_public_keys actual
    WHERE actual.entity_type = reference.entity_type
      AND actual.stable_key = reference.stable_key
)
ORDER BY reference.entity_type, reference.stable_key;

SELECT 'added|' || actual.entity_type || '|' || actual.stable_key
FROM _actual_public_keys actual
WHERE NOT EXISTS (
    SELECT 1
    FROM _reference_public_keys reference
    WHERE reference.entity_type = actual.entity_type
      AND reference.stable_key = actual.stable_key
)
ORDER BY actual.entity_type, actual.stable_key;

DO $$
DECLARE
    missing_total BIGINT;
    added_total BIGINT;
BEGIN
    SELECT COALESCE(SUM(missing_from_compacted), 0)
    INTO missing_total
    FROM _public_set_comparison;

    IF missing_total <> 0 THEN
        RAISE EXCEPTION 'compaction removed % stable public entities', missing_total;
    END IF;

    SELECT COALESCE(SUM(added_by_pending_migrations), 0)
    INTO added_total
    FROM _public_set_comparison;

    IF added_total <> 0 THEN
        RAISE EXCEPTION 'pending migrations added % unexpected stable public entities', added_total;
    END IF;

    IF (SELECT COUNT(*) FROM public.public_people_list_cached)
        <> (SELECT COUNT(*) FROM published.people) THEN
        RAISE EXCEPTION 'public people cache does not match published people';
    END IF;

    IF (SELECT COUNT(*) FROM published.release_state WHERE state_key = 'current') <> 1 THEN
        RAISE EXCEPTION 'published release state is not current';
    END IF;

    IF (SELECT COUNT(*) FROM published.people_directory
        WHERE list_role = 'legislator' AND list_status = 'current') <> 113 THEN
        RAISE EXCEPTION 'current legislator runtime snapshot does not contain 113 people';
    END IF;

    IF (SELECT COUNT(*) FROM published.people_directory
        WHERE list_role = 'local_deputy' AND list_status = 'current') = 0 THEN
        RAISE EXCEPTION 'current local deputy runtime snapshot is empty';
    END IF;

    IF (SELECT COUNT(*) FROM published.people_directory
        WHERE list_role = 'agency_head' AND list_status = 'current') = 0 THEN
        RAISE EXCEPTION 'current agency-head runtime snapshot is empty';
    END IF;

    IF (SELECT COUNT(*) FROM published.person_demographics) < 1000 THEN
        RAISE EXCEPTION 'published person demographic runtime snapshot is unexpectedly empty';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM published.party_people_statistics('民主進步黨') statistic
        WHERE statistic.dimension_key = 'age'
          AND statistic.bucket_key <> 'unknown'
          AND statistic.people_count > 0
    ) THEN
        RAISE EXCEPTION 'party age statistics contain no known age bucket';
    END IF;
END
$$;

SELECT entity_type || '|missing=' || missing_from_compacted || '|added=' || added_by_pending_migrations
FROM _public_set_comparison
ORDER BY entity_type;

COMMIT;

DROP EXTENSION dblink;
