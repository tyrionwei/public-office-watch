-- Restore the exact pre-change directory view; do not edit migration history.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='20s';
DO $guard$
BEGIN
 IF encode(sha256(convert_to(pg_get_viewdef('public.public_people_list'::regclass),'UTF8')),'hex')
     IS DISTINCT FROM '73875e267b0bb05ff6c0a42d7bb9c5bc9a0e2c2b32249a066856eb21516c548a' THEN RAISE EXCEPTION 'Directory view has changed since optimization; stop'; END IF;
END
$guard$;
CREATE TEMP TABLE directory_view_meta_before ON COMMIT DROP AS
SELECT relowner,relacl,reloptions FROM pg_class WHERE oid='public.public_people_list'::regclass;
CREATE OR REPLACE VIEW public.public_people_list AS
WITH current_assignment AS (
         SELECT DISTINCT ON (assignment.person_id) assignment.person_id,
            assignment.office_label,
            assignment.region_name,
            assignment.role_key
           FROM public.current_office_assignments assignment
          WHERE (assignment.is_current = true)
          ORDER BY assignment.person_id,
                CASE assignment.role_key
                    WHEN 'legislator'::text THEN 0
                    WHEN 'local_deputy'::text THEN 1
                    WHEN 'agency_head'::text THEN 2
                    ELSE 9
                END, assignment.observed_at DESC, assignment.office_label
        ), candidate_summary AS (
         SELECT public_candidates.person_id,
            true AS has_candidate_history,
            bool_or(((public_candidates.election_year >= (EXTRACT(year FROM CURRENT_DATE))::integer) AND (public_candidates.candidacy_status = 'party_nominee'::text))) AS has_upcoming_candidate,
            (array_agg(public_candidates.race_title ORDER BY public_candidates.election_year DESC NULLS LAST, public_candidates.candidate_updated_at DESC NULLS LAST) FILTER (WHERE ((public_candidates.election_year >= (EXTRACT(year FROM CURRENT_DATE))::integer) AND (public_candidates.candidacy_status = 'party_nominee'::text))))[1] AS upcoming_candidate_race_title,
            bool_or(((COALESCE(public_candidates.person_position, ''::text) ~ '(村里|村長|里長|代表)'::text) OR (COALESCE(public_candidates.race_title, ''::text) ~ '(村里|村長|里長|代表)'::text))) AS has_grassroots_history
           FROM public.public_candidates
          GROUP BY public_candidates.person_id
        ), classified AS (
         SELECT people.person_id,
            people.name,
            people.alias,
            people.party,
            people."position",
            people.election_year,
            people.district,
            people.updated_at,
            people.primary_photo_url,
            people.primary_photo_thumbnail_url,
            people.photo_source_name,
            people.photo_source_url,
            people.photo_license_type,
            people.photo_license_url,
            people.photo_attribution,
            people.gender,
            people.education,
            people.experience,
            people.current_office_label,
            people.upcoming_candidate_label,
            current_assignment.office_label AS assignment_office_label,
            current_assignment.region_name AS assignment_region_name,
            COALESCE(current_assignment.office_label, people.current_office_label, people.upcoming_candidate_label, candidate_summary.upcoming_candidate_race_title, people."position", ''::text) AS list_position,
            COALESCE(candidate_summary.has_candidate_history, false) AS has_candidate_history,
            COALESCE(candidate_summary.has_upcoming_candidate, false) AS has_upcoming_candidate,
            ((COALESCE(current_assignment.office_label, people.current_office_label, people.upcoming_candidate_label, candidate_summary.upcoming_candidate_race_title, people."position", ''::text) ~ '(村里|村長|里長|代表)'::text) OR COALESCE(candidate_summary.has_grassroots_history, false)) AS list_is_grassroots
           FROM ((public.public_people people
             LEFT JOIN current_assignment ON ((current_assignment.person_id = people.person_id)))
             LEFT JOIN candidate_summary ON ((candidate_summary.person_id = people.person_id)))
        ), role_classified AS (
         SELECT classified.person_id,
            classified.name,
            classified.alias,
            classified.party,
            classified."position",
            classified.election_year,
            classified.district,
            classified.updated_at,
            classified.primary_photo_url,
            classified.primary_photo_thumbnail_url,
            classified.photo_source_name,
            classified.photo_source_url,
            classified.photo_license_type,
            classified.photo_license_url,
            classified.photo_attribution,
            classified.gender,
            classified.education,
            classified.experience,
            classified.current_office_label,
            classified.upcoming_candidate_label,
            classified.assignment_office_label,
            classified.assignment_region_name,
            classified.list_position,
            classified.has_candidate_history,
            classified.has_upcoming_candidate,
            classified.list_is_grassroots,
                CASE
                    WHEN (classified.list_position ~~ '%副總統%'::text) THEN 'vice_president'::text
                    WHEN (classified.list_position ~~ '%總統%'::text) THEN 'president'::text
                    WHEN (classified.list_position ~ '(立法委員|立委)'::text) THEN 'legislator'::text
                    WHEN (classified.list_position ~~ '%議員%'::text) THEN 'councilor'::text
                    WHEN (public.people_directory_chief_role(classified.list_position, COALESCE(classified.assignment_region_name, classified.district)) = 'local_deputy'::text) THEN 'local_deputy'::text
                    WHEN (public.people_directory_chief_role(classified.list_position, COALESCE(classified.assignment_region_name, classified.district)) = 'local_chief'::text) THEN 'local_chief'::text
                    WHEN (classified.list_position ~ '(局長|處長|主任委員)'::text) THEN 'agency_head'::text
                    WHEN (classified.list_position ~ '(黨主席|主席|秘書長)'::text) THEN 'party_officer'::text
                    WHEN (classified.list_position ~~ '%候選人%'::text) THEN 'candidate'::text
                    ELSE
                    CASE
                        WHEN ((classified.person_id = '5d623ab5-a2a2-4c40-a094-6b3712d648e5'::uuid) AND (EXISTS ( SELECT 1
                           FROM (public.public_candidates historical_candidate
                             JOIN public.public_races historical_race ON ((historical_race.race_id = historical_candidate.race_id)))
                          WHERE ((historical_candidate.person_id = '5d623ab5-a2a2-4c40-a094-6b3712d648e5'::uuid) AND (((historical_candidate.candidate_id = 'ed53467b-6bb9-4bdf-b338-092f4b96b9ff'::uuid) AND (historical_candidate.election_year = 2016)) OR ((historical_candidate.candidate_id = '1c9caa82-01a1-49be-9a9a-22f3764c6979'::uuid) AND (historical_candidate.election_year = 2020))) AND (historical_candidate.person_name = '蔡英文'::text) AND (historical_candidate.election_result = 'elected'::text) AND (historical_candidate.is_elected IS TRUE) AND (historical_race.race_type = 'president'::text))))) THEN 'president'::text
                        ELSE 'other'::text
                    END
                END AS list_role
           FROM classified
        ), status_classified AS (
         SELECT role_classified.person_id,
            role_classified.name,
            role_classified.alias,
            role_classified.party,
            role_classified."position",
            role_classified.election_year,
            role_classified.district,
            role_classified.updated_at,
            role_classified.primary_photo_url,
            role_classified.primary_photo_thumbnail_url,
            role_classified.photo_source_name,
            role_classified.photo_source_url,
            role_classified.photo_license_type,
            role_classified.photo_license_url,
            role_classified.photo_attribution,
            role_classified.gender,
            role_classified.education,
            role_classified.experience,
            role_classified.current_office_label,
            role_classified.upcoming_candidate_label,
            role_classified.assignment_office_label,
            role_classified.assignment_region_name,
            role_classified.list_position,
            role_classified.has_candidate_history,
            role_classified.has_upcoming_candidate,
            role_classified.list_is_grassroots,
            role_classified.list_role,
                CASE
                    WHEN ((role_classified.assignment_office_label IS NOT NULL) OR (role_classified.current_office_label IS NOT NULL)) THEN 'current'::text
                    WHEN ((role_classified.upcoming_candidate_label IS NOT NULL) OR role_classified.has_upcoming_candidate) THEN 'candidate'::text
                    WHEN role_classified.has_candidate_history THEN 'former'::text
                    ELSE 'other'::text
                END AS list_status
           FROM role_classified
        )
 SELECT person_id,
    name,
    alias,
    party,
    "position",
    election_year,
    COALESCE(assignment_region_name, district) AS district,
    updated_at,
    primary_photo_url,
    primary_photo_thumbnail_url,
    photo_source_name,
    photo_source_url,
    photo_license_type,
    photo_license_url,
    photo_attribution,
    gender,
    education,
    experience,
    COALESCE(assignment_office_label, current_office_label) AS current_office_label,
    upcoming_candidate_label,
    list_role,
    list_status,
    list_is_grassroots,
        CASE list_status
            WHEN 'current'::text THEN 0
            WHEN 'candidate'::text THEN 1
            WHEN 'former'::text THEN 2
            ELSE 3
        END AS list_status_order,
        CASE list_role
            WHEN 'president'::text THEN 0
            WHEN 'vice_president'::text THEN 1
            WHEN 'legislator'::text THEN 2
            WHEN 'local_chief'::text THEN 3
            WHEN 'local_deputy'::text THEN 4
            WHEN 'councilor'::text THEN 5
            WHEN 'party_officer'::text THEN 6
            WHEN 'agency_head'::text THEN 6
            WHEN 'candidate'::text THEN 7
            ELSE 8
        END AS list_role_order
   FROM status_classified;
DO $guard$
BEGIN
 IF EXISTS (SELECT relowner,relacl,reloptions FROM pg_class WHERE oid='public.public_people_list'::regclass
 EXCEPT SELECT relowner,relacl,reloptions FROM pg_temp.directory_view_meta_before)
 THEN RAISE EXCEPTION 'Directory view security metadata changed'; END IF;
END
$guard$;
DO $guard$
BEGIN
 IF encode(sha256(convert_to(pg_get_viewdef('public.public_people_list'::regclass),'UTF8')),'hex')
     IS DISTINCT FROM 'e3efd1605b74b610b58da913fb0b6d4a4d6087743e224690ac49fdb9df22fad7' THEN RAISE EXCEPTION 'Directory view rollback hash differs'; END IF;
END
$guard$;
COMMIT;
