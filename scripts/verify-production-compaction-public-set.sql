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

DO $$
DECLARE
    missing_total BIGINT;
BEGIN
    SELECT COALESCE(SUM(missing_from_compacted), 0)
    INTO missing_total
    FROM _public_set_comparison;

    IF missing_total <> 0 THEN
        RAISE EXCEPTION 'compaction removed % stable public entities', missing_total;
    END IF;

    IF (SELECT COUNT(*) FROM public.public_people_list_cached)
        <> (SELECT COUNT(*) FROM published.people) THEN
        RAISE EXCEPTION 'public people cache does not match published people';
    END IF;

    IF (SELECT COUNT(*) FROM published.release_state WHERE state_key = 'current') <> 1 THEN
        RAISE EXCEPTION 'published release state is not current';
    END IF;
END
$$;

SELECT entity_type || '|missing=' || missing_from_compacted || '|added=' || added_by_pending_migrations
FROM _public_set_comparison
ORDER BY entity_type;

COMMIT;

DROP EXTENSION dblink;
