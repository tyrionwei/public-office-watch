-- 保留既有公開人物投影（含職務覆寫），僅將即時官方履歷改為既有快取。
-- 在 migration 解析 view，以免覆蓋其他 migration 加入的 JSON 欄位或 office 規則。
DO $migration$
DECLARE
    original_search_path text := current_setting('search_path');
    definition text;
    projection text;
    old_source text := $old$        SELECT source.*
        FROM published.people source
        WHERE source.person_id = requested.person_id
        LIMIT 1$old$;
BEGIN
    PERFORM pg_catalog.set_config('search_path', '', true);
    definition := pg_catalog.pg_get_functiondef('published.person_profiles_for(uuid[])'::regprocedure);
    projection := pg_catalog.pg_get_viewdef('published.people'::regclass, true);
    projection := replace(projection, 'official_profile.education', 'person.education');
    projection := replace(projection, 'official_profile.experience', 'person.experience');
    projection := replace(projection,
        'LEFT JOIN public.official_profile_values official_profile ON official_profile.person_id = person.person_id', '');
    IF strpos(projection, 'official_profile') > 0
       OR strpos(projection, 'public.public_people_list_cached person') = 0
       OR strpos(definition, old_source) = 0
       OR (length(definition) - length(replace(definition, old_source, ''))) / length(old_source) <> 1 THEN
        RAISE EXCEPTION 'Unexpected person profile projection; inspect before applying';
    END IF;
    EXECUTE replace(definition, old_source,
        '        SELECT source.* FROM (' || rtrim(projection, E';\n ') || E'\n) source\n'
        || '        WHERE source.person_id = requested.person_id LIMIT 1');
    PERFORM pg_catalog.set_config('search_path', original_search_path, true);
END;
$migration$;

-- 只替換生日衝突計算，保留當前 claim JSON 隱私投影與其他公開規則。
DO $migration$
DECLARE
    definition text := pg_get_functiondef('published.person_claims_for(uuid[])'::regprocedure);
    old_boundary text := $old$    )
    SELECT
        claim.id,$old$;
    old_predicate text := $old$AND (claim.claim_type<>'birth_date' OR NOT EXISTS(SELECT 1 FROM public.official_profile_values profile WHERE profile.person_id=member.canonical_person_id AND profile.birth_conflict))$old$;
BEGIN
    IF strpos(definition, old_boundary) = 0 OR strpos(definition, old_predicate) = 0 THEN
        RAISE EXCEPTION 'Unexpected person_claims_for definition; inspect before applying';
    END IF;
    definition := replace(definition, old_boundary, $new$    ),
    -- Resolve only these members forward, matching person_canonical_map's
    -- depth limit and cycle handling even for a non-terminal requested ID.
    local_merge_walk(source_person_id, current_person_id, path, depth) AS (
        SELECT DISTINCT member.source_person_id, member.source_person_id,
            ARRAY[member.source_person_id], 0
        FROM member_ids member
        UNION ALL
        SELECT walk.source_person_id, decision.canonical_person_id,
            walk.path || decision.canonical_person_id, walk.depth + 1
        FROM local_merge_walk walk
        JOIN public.person_merge_decisions decision
          ON decision.duplicate_person_id = walk.current_person_id
         AND decision.status = 'verified'
        WHERE walk.depth < 20
          AND NOT decision.canonical_person_id = ANY(walk.path)
    ),
    local_canonical AS MATERIALIZED (
        SELECT DISTINCT ON (source_person_id) source_person_id, current_person_id
        FROM local_merge_walk
        ORDER BY source_person_id, depth DESC
    ),
    birth_dates AS MATERIALIZED (
        SELECT DISTINCT member.canonical_person_id,
            COALESCE(claim.claim_value, claim.claim_json->>'value') AS value
        FROM member_ids member
        JOIN local_canonical resolved
          ON resolved.source_person_id = member.source_person_id
         AND resolved.current_person_id = member.canonical_person_id
        JOIN public.person_claims claim ON claim.person_id = member.source_person_id
        WHERE claim.claim_type = 'birth_date'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public' AND claim.is_public
          AND public.official_profile_claim_allowed(
              claim.claim_type, claim.claim_value, claim.claim_json,
              claim.person_id, claim.source_url)
    ),
    birth_conflicts AS MATERIALIZED (
        SELECT DISTINCT a.canonical_person_id
        FROM birth_dates a
        JOIN birth_dates b ON b.canonical_person_id = a.canonical_person_id
        WHERE left(a.value, least(length(a.value), length(b.value)))
           <> left(b.value, least(length(a.value), length(b.value)))
    )
    SELECT
        claim.id,$new$);
    definition := replace(definition, old_predicate, $new$AND (claim.claim_type <> 'birth_date' OR NOT EXISTS (
          SELECT 1 FROM birth_conflicts conflict
          WHERE conflict.canonical_person_id = member.canonical_person_id
      ))$new$);
    EXECUTE definition;
END;
$migration$;

-- 額外餘裕；authenticated 及其他角色維持原值。
ALTER ROLE anon SET statement_timeout = '5s';
NOTIFY pgrst, 'reload config';
