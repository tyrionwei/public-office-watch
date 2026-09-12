BEGIN;
-- Explicit regular-term calendar. End dates are exclusive; all civil dates use Asia/Taipei.
CREATE TABLE public.office_term_calendar (
 office_family text NOT NULL CHECK (office_family IN ('president','legislator','local')),
 starts_on date NOT NULL,
 ends_on date NOT NULL CHECK (ends_on > starts_on),
 source_url text NOT NULL,
 PRIMARY KEY (office_family, starts_on)
);
ALTER TABLE public.office_term_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY office_calendar_read ON public.office_term_calendar FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON public.office_term_calendar FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.office_term_calendar TO anon, authenticated;
GRANT ALL ON public.office_term_calendar TO service_role;
INSERT INTO public.office_term_calendar
SELECT 'president',make_date(y,5,20),make_date(y+4,5,20),'https://www.president.gov.tw/Page/87'
FROM generate_series(1996,2028,4) y;
INSERT INTO public.office_term_calendar
SELECT 'legislator',make_date(y,2,1),make_date(y+CASE WHEN y<2008 THEN 3 ELSE 4 END,2,1),'https://aam.ly.gov.tw/P016001_01.do'
FROM unnest(ARRAY[1993,1996,1999,2002,2005,2008,2012,2016,2020,2024,2028]) y;
INSERT INTO public.office_term_calendar
SELECT 'local',make_date(y,12,25),make_date(y+4,12,25),'https://www.moi.gov.tw/News_Content.aspx?n=2&s=260703'
FROM generate_series(2014,2030,4) y;
-- Explicit exceptions take precedence over regular terms; never infer a by-election tenure.
CREATE TABLE public.race_office_term_overrides (
 race_id uuid PRIMARY KEY REFERENCES public.races(id),
 starts_on date NOT NULL,
 ends_on date NOT NULL CHECK(ends_on > starts_on),
 source_url text NOT NULL,
 reason text NOT NULL
);
CREATE TABLE public.candidate_office_tenures (
 candidate_id uuid PRIMARY KEY REFERENCES public.candidates(id),
 starts_on date NOT NULL,
 ends_on date NOT NULL CHECK(ends_on > starts_on),
 source_url text NOT NULL,
 reason text NOT NULL
);
ALTER TABLE public.race_office_term_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_office_tenures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.race_office_term_overrides,public.candidate_office_tenures FROM anon,authenticated;
GRANT ALL ON public.race_office_term_overrides,public.candidate_office_tenures TO service_role;

CREATE FUNCTION public.office_family_for_race(p_type text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN p_type IN ('president','vice_president') THEN 'president'
 WHEN p_type IN ('legislator','legislative_district','indigenous','party_list_legislator') THEN 'legislator'
 WHEN p_type IN ('local_chief','municipality_mayor','county_mayor','city_councilor','county_councilor','councilor_district','township_mayor','township_representative','township_representative_district','village_chief') THEN 'local' END;
$$;

CREATE FUNCTION public.race_office_term(p_race_id uuid)
RETURNS TABLE(starts_on date,ends_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(override.starts_on,regular.starts_on),COALESCE(override.ends_on,regular.ends_on)
 FROM public.races race JOIN public.elections election ON election.id=race.election_id
 LEFT JOIN public.race_office_term_overrides override ON override.race_id=race.id
 LEFT JOIN LATERAL (
  SELECT calendar.starts_on,calendar.ends_on FROM public.office_term_calendar calendar
  WHERE calendar.office_family=public.office_family_for_race(race.race_type)
   AND calendar.starts_on >= COALESCE(race.voting_date,election.voting_date)
   AND calendar.starts_on < (COALESCE(race.voting_date,election.voting_date)+INTERVAL '1 year')::date
   AND election.election_type <> 'by_election'
   AND (election.name || ' ' || race.title) !~ '補選|遞補'
  ORDER BY calendar.starts_on LIMIT 1
 ) regular ON true
 WHERE race.id=p_race_id AND race.is_public AND election.is_public;
$$;

CREATE FUNCTION public.candidate_office_term(p_candidate_id uuid)
RETURNS TABLE(starts_on date,ends_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(tenure.starts_on,term.starts_on),COALESCE(tenure.ends_on,term.ends_on)
 FROM public.candidates candidate
 LEFT JOIN public.candidate_office_tenures tenure ON tenure.candidate_id=candidate.id
 LEFT JOIN LATERAL public.race_office_term(candidate.race_id) term ON true
 WHERE candidate.id=p_candidate_id AND candidate.is_public;
$$;

CREATE FUNCTION public.candidate_holds_office(p_candidate_id uuid,p_on date DEFAULT (now() AT TIME ZONE 'Asia/Taipei')::date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (
 SELECT 1 FROM public.candidates candidate
 JOIN public.races race ON race.id=candidate.race_id
 JOIN public.elections election ON election.id=race.election_id
 CROSS JOIN LATERAL public.candidate_office_term(candidate.id) term
 WHERE candidate.id=p_candidate_id AND candidate.is_public AND race.is_public AND election.is_public AND candidate.election_result='elected'
 AND p_on >= term.starts_on AND p_on < term.ends_on
 AND NOT EXISTS (
  SELECT 1 FROM public.current_office_exclusions exclusion
  JOIN public.person_canonical_map a ON a.person_id=exclusion.person_id
  JOIN public.person_canonical_map b ON b.person_id=candidate.person_id AND b.canonical_person_id=a.canonical_person_id
  WHERE exclusion.election_year=election.year AND exclusion.race_type=race.race_type
   AND (exclusion.ended_at IS NULL OR exclusion.ended_at<=p_on)
 ));
$$;
REVOKE ALL ON FUNCTION public.race_office_term(uuid),public.candidate_office_term(uuid),public.candidate_holds_office(uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.race_office_term(uuid),public.candidate_office_term(uuid),public.candidate_holds_office(uuid,date) TO anon,authenticated,service_role;

-- Canonical voting rules; used by the release generator.
CREATE OR REPLACE FUNCTION published.platform_fulfillment_results(
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
    WITH raw_items AS (
        SELECT
            'person'::TEXT AS target_kind,
            public.platform_fulfillment_vote_claim_id(p_claim_id) AS vote_target_id,
            derived.item_key,
            derived.display_order,
            derived.promise_text,
            election.results_announced_on,
            (term.starts_on + INTERVAL '1 year')::DATE AS voting_opens_on,
            TRUE AS voting_eligible,
            COALESCE(
                (now() AT TIME ZONE 'Asia/Taipei')::date >= (term.starts_on + INTERVAL '1 year')::DATE,
                FALSE
            ) AS voting_is_open
        FROM public.person_claims AS claim
        JOIN public.candidates AS candidate ON candidate.id = claim.candidate_id
        JOIN public.races AS race ON race.id = candidate.race_id
        JOIN public.elections AS election ON election.id = race.election_id
        LEFT JOIN LATERAL public.candidate_office_term(candidate.id) AS term ON true
        CROSS JOIN LATERAL (
            SELECT
                pg_catalog.encode(
                    extensions.digest(pg_catalog.btrim(item.value), 'sha256'),
                    'hex'
                ) AS item_key,
                item.ordinality::INTEGER AS display_order,
                pg_catalog.btrim(item.value) AS promise_text
            FROM pg_catalog.jsonb_array_elements_text(CASE WHEN pg_catalog.jsonb_typeof(claim.claim_json -> 'items') = 'array' THEN claim.claim_json -> 'items' ELSE '[]'::jsonb END)
                WITH ORDINALITY AS item(value, ordinality)
            WHERE pg_catalog.btrim(item.value) <> ''
        ) AS derived
        WHERE claim.id = p_claim_id
          AND claim.claim_type = 'platform'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
          AND claim.claim_json #>> '{contentSplit,reviewStatus}' IN ('auto_approved', 'reviewed')
          AND candidate.person_id = claim.person_id
          AND candidate.election_result = 'elected'
          AND pg_catalog.jsonb_typeof(claim.claim_json -> 'items') = 'array'
        UNION ALL

        SELECT
            'party'::TEXT AS target_kind,
            result.result_id AS vote_target_id,
            derived.item_key,
            derived.display_order,
            derived.promise_text,
            election.results_announced_on,
            (term.starts_on + INTERVAL '1 year')::DATE AS voting_opens_on,
            result.allocated_seats > 0 AS voting_eligible,
            COALESCE(
                (now() AT TIME ZONE 'Asia/Taipei')::date >= (term.starts_on + INTERVAL '1 year')::DATE
                    AND result.allocated_seats > 0,
                FALSE
            ) AS voting_is_open
        FROM public.party_list_race_results AS result
        JOIN public.races AS race ON race.id = result.race_id
        JOIN public.elections AS election ON election.id = race.election_id
        LEFT JOIN LATERAL public.race_office_term(race.id) AS term ON true
        CROSS JOIN LATERAL (
            SELECT
                pg_catalog.encode(
                    extensions.digest(pg_catalog.btrim(item.value), 'sha256'),
                    'hex'
                ) AS item_key,
                item.ordinality::INTEGER AS display_order,
                pg_catalog.btrim(item.value) AS promise_text
            FROM pg_catalog.jsonb_array_elements_text(CASE WHEN pg_catalog.jsonb_typeof(result.platform_items) = 'array' THEN result.platform_items ELSE '[]'::jsonb END)
                WITH ORDINALITY AS item(value, ordinality)
            WHERE pg_catalog.btrim(item.value) <> ''
        ) AS derived
        WHERE result.result_id = p_claim_id
          AND result.is_public = TRUE
          AND result.platform_items_reviewed_at IS NOT NULL
          AND race.race_type = 'party_list_legislator'
          AND pg_catalog.jsonb_typeof(result.platform_items) = 'array'
    ),
    current_items AS (
        SELECT DISTINCT ON (item.target_kind, item.item_key) item.*
        FROM raw_items AS item
        ORDER BY item.target_kind, item.item_key, item.display_order
    ),
    all_votes AS (
        SELECT
            'person'::TEXT AS target_kind,
            vote.claim_id AS vote_target_id,
            vote.item_key,
            vote.vote_status,
            vote.id
        FROM public.platform_fulfillment_votes AS vote
        UNION ALL
        SELECT
            'party'::TEXT,
            vote.party_result_id,
            vote.item_key,
            vote.vote_status,
            vote.id
        FROM public.party_platform_fulfillment_votes AS vote
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
    LEFT JOIN all_votes AS vote
      ON item.voting_eligible
     AND vote.target_kind = item.target_kind
     AND vote.vote_target_id = item.vote_target_id
     AND vote.item_key = item.item_key
    GROUP BY
        item.item_key,
        item.display_order,
        item.promise_text,
        item.results_announced_on,
        item.voting_opens_on,
        item.voting_is_open
    ORDER BY item.display_order;
$function$;


-- Batch path for whole-site refreshes; avoids one function/database lookup per candidate.
CREATE VIEW public.current_elected_offices AS
WITH person_map AS MATERIALIZED (SELECT * FROM public.person_canonical_map),
ended AS MATERIALIZED (SELECT m.canonical_person_id,e.election_year,e.race_type FROM public.current_office_exclusions e JOIN person_map m ON m.person_id=e.person_id WHERE e.ended_at IS NULL OR e.ended_at <= (now() AT TIME ZONE 'Asia/Taipei')::date)
SELECT candidate.id AS candidate_id
FROM public.candidates candidate
JOIN person_map m ON m.person_id=candidate.person_id
JOIN public.races race ON race.id=candidate.race_id AND race.is_public
JOIN public.elections election ON election.id=race.election_id AND election.is_public
LEFT JOIN public.race_office_term_overrides override ON override.race_id=race.id
LEFT JOIN public.candidate_office_tenures tenure ON tenure.candidate_id=candidate.id
LEFT JOIN public.office_term_calendar calendar
 ON calendar.office_family=public.office_family_for_race(race.race_type)
 AND calendar.starts_on>=COALESCE(race.voting_date,election.voting_date)
 AND calendar.starts_on<(COALESCE(race.voting_date,election.voting_date)+INTERVAL '1 year')::date
 AND election.election_type<>'by_election'
 AND (election.name || ' ' || race.title) !~ '補選|遞補'
WHERE candidate.is_public AND candidate.election_result='elected'
 AND (now() AT TIME ZONE 'Asia/Taipei')::date >= COALESCE(tenure.starts_on,override.starts_on,calendar.starts_on)
 AND (now() AT TIME ZONE 'Asia/Taipei')::date < COALESCE(tenure.ends_on,override.ends_on,calendar.ends_on)
 AND NOT EXISTS (SELECT 1 FROM ended WHERE ended.canonical_person_id=m.canonical_person_id AND ended.election_year=election.year AND ended.race_type=race.race_type);
REVOKE ALL ON public.current_elected_offices FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.current_elected_offices TO service_role;

DO $views$
DECLARE definition text; old_predicate text := $old$          WHERE (candidate_offices.registration_status = 'elected'::text OR candidate_offices.is_elected = true) AND NOT (EXISTS ( SELECT 1
                   FROM ended_current_offices ended
                  WHERE ended.canonical_person_id = candidate_offices.canonical_person_id AND ended.election_year = candidate_offices.election_year AND ended.race_type = candidate_offices.race_type)) AND (candidate_offices.election_year IS NULL OR COALESCE(candidate_offices.race_title, ''::text) ~ '(總統|副總統|立法委員|立委|不分區)'::text AND candidate_offices.election_year >= 2024 OR COALESCE(candidate_offices.race_title, ''::text) ~ '(市長|縣長|區長|議員|鄉長|鎮長|市民代表|鄉民代表|鎮民代表|村長|里長|代表)'::text AND candidate_offices.election_year >= 2022 OR COALESCE(candidate_offices.race_title, ''::text) !~ '(總統|副總統|立法委員|立委|不分區|市長|縣長|區長|議員|鄉長|鎮長|市民代表|鄉民代表|鎮民代表|村長|里長|代表)'::text AND candidate_offices.election_year >= 2024)$old$;
BEGIN
 SELECT pg_get_viewdef('public.public_people'::regclass,true) INTO definition;
 IF strpos(definition,old_predicate)=0 THEN RAISE EXCEPTION 'Unexpected public_people current-office predicate'; END IF;
 definition:=replace(definition,old_predicate,'          WHERE candidate_offices.candidate_id IN (SELECT candidate_id FROM public.current_elected_offices)');
 IF strpos(definition,$needle$source_person.source_type = 'official_officeholder'::text$needle$)=0 THEN RAISE EXCEPTION 'Unexpected official office source predicate'; END IF;
 definition:=replace(definition,$needle$source_person.source_type = 'official_officeholder'::text$needle$,$new$source_person.source_type = 'official_officeholder'::text AND (source_person."position" !~ '(總統|立法委員|立委|市長|縣長|議員|鄉長|鎮長|村長|里長|代表)' OR source_person."position" ~ '(副市長|副縣長)' OR EXISTS (SELECT 1 FROM public.office_term_calendar calendar WHERE calendar.office_family=CASE WHEN source_person."position" ~ '總統' THEN 'president' WHEN source_person."position" ~ '(立法委員|立委)' THEN 'legislator' ELSE 'local' END AND extract(year FROM calendar.starts_on)=source_person.election_year AND (now() AT TIME ZONE 'Asia/Taipei')::date >= calendar.starts_on AND (now() AT TIME ZONE 'Asia/Taipei')::date < calendar.ends_on))$new$);
 EXECUTE 'CREATE OR REPLACE VIEW public.public_people AS '||definition;
END;
$views$;

CREATE OR REPLACE VIEW public.public_candidates AS
 WITH canonical_candidates AS (
         SELECT DISTINCT ON (pm.canonical_person_id, rm.canonical_race_id, (COALESCE(c_1.candidate_no, ''::text))) c_1.id,
            c_1.person_id,
            c_1.race_id,
            c_1.party,
            c_1.candidate_no,
            c_1.registration_status,
            c_1.source_name,
            c_1.source_url,
            c_1.is_public,
            c_1.created_at,
            c_1.updated_at,
            c_1.external_id,
            c_1.vote_count,
            c_1.vote_rate,
            c_1.is_elected,
            c_1.is_incumbent,
            c_1.candidacy_status,
            c_1.election_result,
            c_1.status_updated_at,
            pm.canonical_person_id,
            rm.canonical_race_id
           FROM candidates c_1
             JOIN person_canonical_map pm ON pm.person_id = c_1.person_id
             JOIN race_canonical_map rm ON rm.race_id = c_1.race_id
             JOIN races canonical_race ON canonical_race.id = rm.canonical_race_id AND canonical_race.is_public = true
             JOIN election_canonical_map em ON em.election_id = canonical_race.election_id AND em.canonical_election_id = canonical_race.election_id
          WHERE c_1.is_public = true
          ORDER BY pm.canonical_person_id, rm.canonical_race_id, (COALESCE(c_1.candidate_no, ''::text)), (
                CASE
                    WHEN c_1.vote_count IS NOT NULL THEN 0
                    ELSE 1
                END), (
                CASE
                    WHEN c_1.vote_rate IS NOT NULL THEN 0
                    ELSE 1
                END), (
                CASE
                    WHEN c_1.is_elected IS NOT NULL THEN 0
                    ELSE 1
                END), (
                CASE
                    WHEN c_1.external_id ~~ 'cec-%'::text THEN 0
                    WHEN c_1.external_id ~~ 'votetw-%'::text THEN 1
                    ELSE 2
                END), c_1.updated_at DESC, c_1.external_id, c_1.id
        )
 SELECT c.id AS candidate_id,
    p.id AS person_id,
    p.name AS person_name,
    p.party AS person_party,
    p."position" AS person_position,
    r.id AS race_id,
    r.title AS race_title,
    e.id AS election_id,
    e.name AS election_name,
    rg.id AS region_id,
    rg.name AS region_name,
    c.party,
    c.candidate_no,
    c.registration_status,
    c.vote_count,
    c.vote_rate,
    c.is_elected,
    c.is_incumbent,
    c.source_name,
    c.source_url,
    ph.photo_url AS primary_photo_url,
    ph.thumbnail_url AS primary_photo_thumbnail_url,
    ph.attribution AS photo_attribution,
    ph.license_type AS photo_license_type,
    e.year AS election_year,
    c.candidacy_status,
    c.election_result,
    c.status_updated_at,
    c.updated_at AS candidate_updated_at,
    public.candidate_holds_office(c.id) AS office_is_current
   FROM canonical_candidates c
     JOIN people p ON p.id = c.canonical_person_id AND p.is_public = true
     JOIN races r ON r.id = c.canonical_race_id AND r.is_public = true
     JOIN elections e ON e.id = r.election_id AND e.is_public = true
     LEFT JOIN regions rg ON rg.id = r.region_id
     LEFT JOIN public_person_primary_photos ph ON ph.person_id = p.id
  WHERE r.region_id IS NULL OR rg.is_public = true;


CREATE OR REPLACE VIEW published.candidates AS
 SELECT facts.candidate_id,
    facts.person_id,
    facts.person_name,
    facts.person_party,
    facts.person_position,
    facts.race_id,
    facts.race_title,
    facts.election_id,
    facts.election_name,
    facts.region_id,
    facts.region_name,
    facts.party,
    facts.candidate_no,
    facts.registration_status,
    facts.vote_count,
    facts.vote_rate,
    facts.is_elected,
    facts.is_incumbent,
    facts.election_year,
    facts.candidacy_status,
    facts.election_result,
    facts.status_updated_at,
    facts.candidate_updated_at,
    core.source_name,
    core.source_url,
    photo.photo_url AS primary_photo_url,
    photo.thumbnail_url AS primary_photo_thumbnail_url,
    photo.attribution AS photo_attribution,
    photo.license_type AS photo_license_type,
    office.office_at_election,
    public.candidate_holds_office(facts.candidate_id) AS office_is_current
   FROM published.candidate_facts facts
     LEFT JOIN candidates core ON core.id = facts.candidate_id
     LEFT JOIN public_person_primary_photos photo ON photo.person_id = facts.person_id
     LEFT JOIN published.candidate_election_offices office ON office.candidate_id = facts.candidate_id;


DO $payloads$
DECLARE fn regprocedure; definition text;
BEGIN
 FOR fn IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='published' AND p.proname IN ('person_profiles_for','race_page_for') LOOP
  SELECT pg_get_functiondef(fn) INTO definition;
  IF strpos(definition,'candidate.office_at_election,')>0 THEN
   definition:=replace(definition,'candidate.office_at_election,','candidate.office_at_election, public.candidate_holds_office(candidate.candidate_id) AS office_is_current,');
   EXECUTE definition;
  END IF;
 END LOOP;
END;
$payloads$;
DO $assignments$
DECLARE definition text;
BEGIN
 SELECT pg_get_viewdef('public.public_people_list'::regclass,true) INTO definition;
 IF strpos(definition,'assignment.is_current = true')=0 THEN RAISE EXCEPTION 'Unexpected current assignment predicate'; END IF;
 definition:=replace(definition,'assignment.is_current = true', $predicate$assignment.is_current = true AND (assignment.role_key <> 'legislator' OR EXISTS (SELECT 1 FROM public.office_term_calendar calendar WHERE calendar.office_family='legislator' AND assignment.observed_at>=calendar.starts_on AND assignment.observed_at<calendar.ends_on AND (now() AT TIME ZONE 'Asia/Taipei')::date>=calendar.starts_on AND (now() AT TIME ZONE 'Asia/Taipei')::date<calendar.ends_on))$predicate$);
 EXECUTE 'CREATE OR REPLACE VIEW public.public_people_list AS '||definition;
END;
$assignments$;
-- Refresh only the approved public people projection; never call published.promote.
-- UTC 16:05 is 00:05 Asia/Taipei. Existing candidates.is_incumbent remains historical.
SELECT public.refresh_public_people_list_cached();
SELECT cron.schedule('refresh-office-term-status','5 16 * * *','SELECT public.refresh_public_people_list_cached();');
NOTIFY pgrst, 'reload schema';
COMMIT;
