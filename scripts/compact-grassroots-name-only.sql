-- Full local transaction only: supports both directory storage shapes.
-- NOT a production low-capacity procedure; do not execute directly on production.
-- Caller must verify the full backup/archive and run in a single transaction.
SET LOCAL statement_timeout = '15min';
SET LOCAL work_mem = '64MB';
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(hashtextextended('public-office-watch:published-promote', 0));
LOCK TABLE public.people, public.candidates, public.races, public.person_merge_decisions IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE _grassroots_members ON COMMIT DROP AS
SELECT m.person_id, m.canonical_person_id
FROM public.person_canonical_map m
JOIN (
    SELECT map.canonical_person_id
    FROM public.candidates c
    JOIN public.races r ON r.id = c.race_id
    JOIN public.person_canonical_map map ON map.person_id = c.person_id
    GROUP BY map.canonical_person_id
    HAVING BOOL_AND(r.race_type IN ('village_chief','township_representative','township_representative_district'))
) eligible USING (canonical_person_id)
WHERE EXISTS (SELECT 1 FROM public.candidates c WHERE c.person_id = m.person_id);
CREATE UNIQUE INDEX ON _grassroots_members(person_id);
-- 不可變更回報歷程保留其私人外鍵人物；候選仍全部解除人物連結。
CREATE TEMP TABLE _grassroots_retained_audit ON COMMIT DROP AS
SELECT g.person_id FROM _grassroots_members g
WHERE g.canonical_person_id IN (
 SELECT member.canonical_person_id FROM _grassroots_members member
 JOIN public.person_feedback_submissions f USING(person_id)
 JOIN public.person_feedback_history h ON h.feedback_id = f.id
);
CREATE TEMP TABLE _grassroots_feedback_before ON COMMIT DROP AS
SELECT to_jsonb(f) row FROM public.person_feedback_submissions f;
CREATE TEMP TABLE _grassroots_history_before ON COMMIT DROP AS
SELECT to_jsonb(h) row FROM public.person_feedback_history h;
CREATE TEMP TABLE _grassroots_map_before ON COMMIT DROP AS SELECT * FROM public.person_canonical_map;
CREATE TEMP TABLE _grassroots_public_before ON COMMIT DROP AS SELECT candidate_id, person_id, person_name, race_id FROM public.public_candidates;
CREATE UNIQUE INDEX ON _grassroots_public_before(candidate_id);
CREATE TEMP TABLE _grassroots_facts_before ON COMMIT DROP AS SELECT * FROM published.candidate_facts;
CREATE TEMP TABLE _grassroots_candidates_before ON COMMIT DROP AS SELECT * FROM public.candidates;
CREATE TEMP TABLE _grassroots_directory_before ON COMMIT DROP AS SELECT person_id FROM published.people_directory;
-- 既有目錄可能留下已合併別名；只允許移除已有公開 canonical 的陳舊項目。
CREATE TEMP TABLE _grassroots_stale_aliases ON COMMIT DROP AS
SELECT d.person_id, m.canonical_person_id
FROM _grassroots_directory_before d
JOIN public.person_canonical_map m USING(person_id)
WHERE m.person_id <> m.canonical_person_id
AND NOT EXISTS (SELECT 1 FROM published.people p WHERE p.person_id=d.person_id)
AND EXISTS (SELECT 1 FROM published.people p WHERE p.person_id=m.canonical_person_id)
AND EXISTS (SELECT 1 FROM _grassroots_directory_before p WHERE p.person_id=m.canonical_person_id)
AND NOT EXISTS (SELECT 1 FROM _grassroots_members g WHERE g.person_id=m.person_id OR g.person_id=m.canonical_person_id);
CREATE TEMP TABLE _grassroots_regions_before ON COMMIT DROP AS SELECT to_jsonb(r) row FROM published.regions r;
CREATE TEMP TABLE _grassroots_races_before ON COMMIT DROP AS SELECT to_jsonb(r) row FROM published.races r;
-- A protected higher-level person and all its aliases are excluded as one identity group.
DO $$
DECLARE dependency regclass; has_dependency boolean;
BEGIN
 IF EXISTS (SELECT 1 FROM _grassroots_stale_aliases WHERE person_id <> '26f9b23d-f8be-4b3c-a20b-20e107610515'::uuid OR canonical_person_id <> '0db62d14-a37b-4ab4-91d0-bfb3321728ab'::uuid)
 OR (SELECT count(*) FROM _grassroots_stale_aliases)>1 THEN RAISE EXCEPTION 'Unreviewed stale directory alias'; END IF;
 IF NOT EXISTS (SELECT 1 FROM _grassroots_members) THEN RAISE EXCEPTION 'No eligible grassroots identities'; END IF;
 -- 部分本機現任審核表尚未發布；不存在就無資料可刪，存在仍嚴格檢查。
 FOR dependency IN SELECT to_regclass(name) FROM unnest(ARRAY[
  'public.current_office_assignments','public.reviewed_office_profiles',
  'public.person_identity_research_holds','public.person_media',
  'public.person_company_relations','public.person_office_status_cache']) name
 LOOP
  IF dependency IS NOT NULL THEN
   EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s a JOIN _grassroots_members g USING(person_id))',dependency) INTO has_dependency;
   IF has_dependency THEN RAISE EXCEPTION 'Additional person data requires archive/dependency review: %',dependency; END IF;
  END IF;
 END LOOP;
 IF EXISTS (
  (SELECT candidate_id, person_name, race_id FROM _grassroots_public_before
   EXCEPT SELECT candidate_id, person_name, race_id FROM _grassroots_facts_before)
  UNION ALL
  (SELECT candidate_id, person_name, race_id FROM _grassroots_facts_before
   EXCEPT SELECT candidate_id, person_name, race_id FROM _grassroots_public_before)
 ) THEN RAISE EXCEPTION 'Public candidate selection/name differs from core; review before compacting'; END IF;
 IF EXISTS (
 SELECT 1 FROM _grassroots_facts_before f
 JOIN _grassroots_public_before v USING(candidate_id)
 JOIN _grassroots_candidates_before c ON c.id=f.candidate_id
 JOIN _grassroots_members g ON g.person_id=c.person_id
 WHERE f.person_id IS DISTINCT FROM v.person_id
 ) THEN RAISE EXCEPTION 'Target published identity differs from core'; END IF;
END;
$$;
-- Freeze the existing public selection before losing person canonical deduplication.
-- All candidate rows, votes, statuses, races and provenance remain in the core table.
UPDATE public.candidates c
SET candidate_name = COALESCE((SELECT visible.person_name FROM _grassroots_public_before visible WHERE visible.candidate_id = c.id), canonical.name, original.name),
    is_public = EXISTS (SELECT 1 FROM _grassroots_public_before visible WHERE visible.candidate_id = c.id),
    person_id = NULL
FROM _grassroots_members g
JOIN public.people original ON original.id = g.person_id
JOIN public.people canonical ON canonical.id = g.canonical_person_id
WHERE c.person_id = g.person_id;
UPDATE public.people p SET is_public = FALSE
FROM _grassroots_retained_audit a WHERE p.id = a.person_id;
DELETE FROM public.people p USING _grassroots_members g
WHERE p.id = g.person_id AND NOT EXISTS (SELECT 1 FROM _grassroots_retained_audit a WHERE a.person_id = p.id);
DELETE FROM published.person_demographics d USING _grassroots_members g WHERE d.person_id = g.person_id;
-- 只改本次候選快照的移除人物連結，不重新發布其他核心資料。
UPDATE published.candidate_facts f
SET person_id = NULL, person_party = NULL, person_position = NULL
WHERE f.candidate_id IN (
 SELECT old.id FROM _grassroots_candidates_before old JOIN _grassroots_members g ON g.person_id = old.person_id
);
REFRESH MATERIALIZED VIEW public.public_people_list_cached;
REFRESH MATERIALIZED VIEW published.person_candidate_summaries;
-- 正式為目錄本身的 materialized view，本機可能是既有 snapshot + view。
DO $$
DECLARE directory_target regclass;
BEGIN
 SELECT c.oid::regclass INTO directory_target FROM pg_class c
 WHERE c.oid=COALESCE(to_regclass('published.people_directory_snapshot'),to_regclass('published.people_directory')) AND c.relkind='m';
 IF directory_target IS NULL THEN RAISE EXCEPTION 'Unexpected people directory storage'; END IF;
 EXECUTE format('REFRESH MATERIALIZED VIEW %s',directory_target);
END;
$$;
REFRESH MATERIALIZED VIEW published.search_results;
REFRESH MATERIALIZED VIEW published.home_ticker;
REFRESH MATERIALIZED VIEW published.home_region_summary;
REFRESH MATERIALIZED VIEW published.election_race_summaries;
REFRESH MATERIALIZED VIEW published.election_race_facets;
REFRESH MATERIALIZED VIEW published.event_summaries;
REFRESH MATERIALIZED VIEW published.party_officers;
REFRESH MATERIALIZED VIEW published.region_issue_results;
REFRESH MATERIALIZED VIEW published.candidate_election_office_facts;
CREATE TEMP TABLE _grassroots_public_after ON COMMIT DROP AS SELECT candidate_id,person_name,race_id,person_id FROM public.public_candidates;
CREATE UNIQUE INDEX ON _grassroots_public_after(candidate_id);
DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM _grassroots_map_before old
  LEFT JOIN public.person_canonical_map current ON current.person_id = old.person_id
  WHERE EXISTS (SELECT 1 FROM public.people p WHERE p.id = old.person_id)
  AND old.canonical_person_id IS DISTINCT FROM current.canonical_person_id
 ) THEN RAISE EXCEPTION 'Retained identity mapping changed'; END IF;
 IF EXISTS (SELECT 1 FROM public.people p JOIN _grassroots_members g ON g.person_id=p.id WHERE p.id NOT IN (SELECT person_id FROM _grassroots_retained_audit))
 OR EXISTS (SELECT 1 FROM published.people_directory p JOIN _grassroots_members g USING(person_id))
 THEN RAISE EXCEPTION 'Grassroots people remain'; END IF;
 IF EXISTS (SELECT 1 FROM public.people p JOIN _grassroots_retained_audit a ON a.person_id=p.id WHERE p.is_public IS DISTINCT FROM FALSE) THEN RAISE EXCEPTION 'Audit-only person is public'; END IF;
 IF EXISTS ((SELECT row FROM _grassroots_feedback_before EXCEPT SELECT to_jsonb(f) FROM public.person_feedback_submissions f)
 UNION ALL (SELECT to_jsonb(f) FROM public.person_feedback_submissions f EXCEPT SELECT row FROM _grassroots_feedback_before))
 OR EXISTS ((SELECT row FROM _grassroots_history_before EXCEPT SELECT to_jsonb(h) FROM public.person_feedback_history h)
 UNION ALL (SELECT to_jsonb(h) FROM public.person_feedback_history h EXCEPT SELECT row FROM _grassroots_history_before))
 THEN RAISE EXCEPTION 'Feedback or immutable history changed'; END IF;
 IF EXISTS (
  SELECT 1 FROM _grassroots_candidates_before old
  FULL JOIN public.candidates c USING(id)
  WHERE old.id IS NULL OR c.id IS NULL
  OR (to_jsonb(old)-'person_id'-'candidate_name'-'is_public') IS DISTINCT FROM (to_jsonb(c)-'person_id'-'candidate_name'-'is_public')
  OR (old.person_id NOT IN (SELECT person_id FROM _grassroots_members) AND to_jsonb(old) IS DISTINCT FROM to_jsonb(c))
  OR (old.person_id IN (SELECT person_id FROM _grassroots_members) AND (c.person_id IS NOT NULL OR NULLIF(BTRIM(c.candidate_name),'') IS NULL))
 ) THEN RAISE EXCEPTION 'Candidate history/name/retained identity invariant failed'; END IF;
 IF EXISTS (
 (SELECT candidate_id,person_name,race_id FROM _grassroots_public_before
 EXCEPT SELECT candidate_id,person_name,race_id FROM _grassroots_public_after)
 UNION ALL
 (SELECT candidate_id,person_name,race_id FROM _grassroots_public_after
 EXCEPT SELECT candidate_id,person_name,race_id FROM _grassroots_public_before)
 ) OR EXISTS (
 SELECT 1 FROM _grassroots_public_after now
 JOIN _grassroots_public_before old USING(candidate_id)
 JOIN _grassroots_candidates_before c ON c.id=now.candidate_id
 WHERE now.person_id IS DISTINCT FROM CASE WHEN c.person_id IN(SELECT person_id FROM _grassroots_members) THEN NULL::uuid ELSE old.person_id END
 ) THEN RAISE EXCEPTION 'Core public candidate selection/identity changed unexpectedly'; END IF;
 IF EXISTS (
 SELECT 1 FROM _grassroots_facts_before old JOIN published.candidate_facts f USING(candidate_id)
 WHERE old.candidate_id NOT IN (SELECT c.id FROM _grassroots_candidates_before c JOIN _grassroots_members g ON g.person_id=c.person_id)
 AND to_jsonb(old) IS DISTINCT FROM to_jsonb(f)
 ) THEN RAISE EXCEPTION 'Unrelated published candidate changed'; END IF;
 IF EXISTS (
  (SELECT candidate_id,person_name,race_id,election_id,vote_count,vote_rate,candidacy_status,election_result FROM _grassroots_facts_before
  EXCEPT SELECT candidate_id,person_name,race_id,election_id,vote_count,vote_rate,candidacy_status,election_result FROM published.candidate_facts)
  UNION ALL
  (SELECT candidate_id,person_name,race_id,election_id,vote_count,vote_rate,candidacy_status,election_result FROM published.candidate_facts
  EXCEPT SELECT candidate_id,person_name,race_id,election_id,vote_count,vote_rate,candidacy_status,election_result FROM _grassroots_facts_before)
 ) THEN RAISE EXCEPTION 'Published candidate selection/name/history changed'; END IF;
 IF EXISTS (
  (SELECT person_id FROM _grassroots_directory_before WHERE person_id NOT IN (SELECT person_id FROM _grassroots_members) AND person_id NOT IN (SELECT person_id FROM _grassroots_stale_aliases)
   EXCEPT SELECT person_id FROM published.people_directory)
  UNION ALL
  (SELECT person_id FROM published.people_directory
   EXCEPT SELECT person_id FROM _grassroots_directory_before WHERE person_id NOT IN (SELECT person_id FROM _grassroots_members) AND person_id NOT IN (SELECT person_id FROM _grassroots_stale_aliases))
 ) THEN RAISE EXCEPTION 'Retained person publication changed'; END IF;
 IF EXISTS (SELECT 1 FROM _grassroots_stale_aliases a WHERE NOT EXISTS (SELECT 1 FROM published.people p WHERE p.person_id=a.canonical_person_id) OR NOT EXISTS (SELECT 1 FROM published.people_directory p WHERE p.person_id=a.canonical_person_id)) THEN RAISE EXCEPTION 'Stale alias canonical publication lost'; END IF;
 IF EXISTS ((SELECT row FROM _grassroots_regions_before EXCEPT SELECT to_jsonb(r) FROM published.regions r)
 UNION ALL (SELECT to_jsonb(r) FROM published.regions r EXCEPT SELECT row FROM _grassroots_regions_before))
 OR EXISTS ((SELECT row FROM _grassroots_races_before EXCEPT SELECT to_jsonb(r) FROM published.races r)
 UNION ALL (SELECT to_jsonb(r) FROM published.races r EXCEPT SELECT row FROM _grassroots_races_before))
 THEN RAISE EXCEPTION 'Voting region/race data changed'; END IF;
END;
$$;
UPDATE published.release_state SET
 release_id = gen_random_uuid(), promoted_at = now(), published_at = now(), source_sync_run_id = NULL,
 schema_version = '20260926-grassroots-name-only',
 validated_row_counts = validated_row_counts || jsonb_build_object(
  'people',(SELECT count(*) FROM published.people),
  'peopleDirectory',(SELECT count(*) FROM published.people_directory),
  'candidates',(SELECT count(*) FROM published.candidates),
  'searchDocuments',(SELECT count(*) FROM published.search_documents),
  'searchResults',(SELECT count(*) FROM published.search_results))
WHERE state_key='current';
SELECT jsonb_build_object('removed_people',(SELECT count(*) FROM _grassroots_members)-(SELECT count(*) FROM _grassroots_retained_audit),
 'removed_preexisting_stale_directory_aliases',(SELECT count(*) FROM _grassroots_stale_aliases),
 'retained_private_audit_people',(SELECT count(*) FROM _grassroots_retained_audit),
 'remaining_people',(SELECT count(*) FROM public.people),
 'name_only_candidates',(SELECT count(*) FROM public.candidates WHERE person_id IS NULL),
 'published_name_only_candidates',(SELECT count(*) FROM published.candidate_facts WHERE person_id IS NULL),
 'candidate_history_and_publication_invariants','passed') AS validation;
