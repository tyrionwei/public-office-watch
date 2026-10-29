-- Manual exact inverse; stops on after-definition drift. No data changes.
BEGIN;
DO $inverse$
DECLARE metadata jsonb;
BEGIN
 IF md5(pg_get_viewdef('public.public_people'::regclass,true))<>'31f740e1fad6515121d76636c15ac340' THEN RAISE EXCEPTION 'Shared map after-definition drift'; END IF;
 SELECT jsonb_build_object('owner',relowner,'acl',relacl,'options',reloptions) INTO metadata FROM pg_class WHERE oid='public.public_people'::regclass;
 EXECUTE 'CREATE OR REPLACE VIEW public.public_people AS '||$original$ WITH mapped_people AS (
         SELECT canonical_map.canonical_person_id,
            person.id,
            person.name,
            person.alias,
            person.party,
            person."position",
            person.election_year,
            person.district,
            person.source_url,
            person.is_public,
            person.created_at,
            person.updated_at,
            person.external_id,
            person.gender,
            person.education,
            person.experience
           FROM people person
             JOIN person_canonical_map canonical_map ON canonical_map.person_id = person.id
          WHERE person.is_public = true
        ), canonical_people AS (
         SELECT person.id,
            person.name,
            person.alias,
            person.party,
            person."position",
            person.election_year,
            person.district,
            person.source_url,
            person.is_public,
            person.created_at,
            person.updated_at,
            person.external_id,
            person.gender,
            person.education,
            person.experience
           FROM people person
          WHERE person.is_public = true
        ), candidate_offices AS (
         SELECT person_map.canonical_person_id,
            candidate.id AS candidate_id,
            candidate.registration_status,
            candidate.candidacy_status,
            candidate.is_elected,
            candidate.updated_at,
            election.year AS election_year,
            race.race_type,
            NULLIF(btrim(regexp_replace(race.title, '候選人|選舉|全國'::text, ''::text, 'g'::text)), ''::text) AS race_label,
            NULLIF(btrim(regexp_replace(person."position", '候選人|選舉|全國'::text, ''::text, 'g'::text)), ''::text) AS person_position_label,
            race.title AS race_title,
            person."position" AS person_position
           FROM candidates candidate
             JOIN person_canonical_map person_map ON person_map.person_id = candidate.person_id
             JOIN race_canonical_map race_map ON race_map.race_id = candidate.race_id
             JOIN races race ON race.id = race_map.canonical_race_id AND race.is_public = true
             JOIN elections election ON election.id = race.election_id AND election.is_public = true
             JOIN people person ON person.id = person_map.canonical_person_id AND person.is_public = true
             LEFT JOIN regions region ON region.id = race.region_id
          WHERE candidate.is_public = true AND (race.region_id IS NULL OR region.is_public = true)
        ), ended_current_offices AS (
         SELECT person_map.canonical_person_id,
            exclusion.election_year,
            exclusion.race_type
           FROM current_office_exclusions exclusion
             JOIN person_canonical_map person_map ON person_map.person_id = exclusion.person_id
        ), current_offices AS (
         SELECT DISTINCT ON (candidate_offices.canonical_person_id) candidate_offices.canonical_person_id,
                CASE
                    WHEN candidate_offices.race_label ~~ '%總統%'::text AND candidate_offices.race_label ~~ '%副總統%'::text AND candidate_offices.person_position_label ~~ '%副總統%'::text THEN '副總統'::text
                    WHEN candidate_offices.race_label ~~ '%總統%'::text AND candidate_offices.race_label ~~ '%副總統%'::text AND candidate_offices.person_position_label ~~ '%總統%'::text THEN '總統'::text
                    WHEN candidate_offices.race_label ~~ '%總統%'::text AND candidate_offices.person_position_label ~~ '%副總統%'::text THEN candidate_offices.person_position_label
                    ELSE COALESCE(candidate_offices.race_label, candidate_offices.person_position_label)
                END AS current_office_label
           FROM candidate_offices
          WHERE (candidate_offices.registration_status = 'elected'::text OR candidate_offices.is_elected = true) AND NOT (EXISTS ( SELECT 1
                   FROM ended_current_offices ended
                  WHERE ended.canonical_person_id = candidate_offices.canonical_person_id AND ended.election_year = candidate_offices.election_year AND ended.race_type = candidate_offices.race_type)) AND (candidate_offices.election_year IS NULL OR COALESCE(candidate_offices.race_title, ''::text) ~ '(總統|副總統|立法委員|立委|不分區)'::text AND candidate_offices.election_year >= 2024 OR COALESCE(candidate_offices.race_title, ''::text) ~ '(市長|縣長|區長|議員|鄉長|鎮長|市民代表|鄉民代表|鎮民代表|村長|里長|代表)'::text AND candidate_offices.election_year >= 2022 OR COALESCE(candidate_offices.race_title, ''::text) !~ '(總統|副總統|立法委員|立委|不分區|市長|縣長|區長|議員|鄉長|鎮長|市民代表|鄉民代表|鎮民代表|村長|里長|代表)'::text AND candidate_offices.election_year >= 2024)
          ORDER BY candidate_offices.canonical_person_id, (
                CASE
                    WHEN COALESCE(candidate_offices.race_label, candidate_offices.person_position_label, ''::text) ~~ '%副總統%'::text THEN 1
                    WHEN COALESCE(candidate_offices.race_label, candidate_offices.person_position_label, ''::text) ~~ '%總統%'::text THEN 0
                    WHEN COALESCE(candidate_offices.race_label, candidate_offices.person_position_label, ''::text) ~ '(立法委員|立委)'::text THEN 2
                    WHEN COALESCE(candidate_offices.race_label, candidate_offices.person_position_label, ''::text) ~ '(市長|縣長)'::text THEN 3
                    WHEN COALESCE(candidate_offices.race_label, candidate_offices.person_position_label, ''::text) ~~ '%議員%'::text THEN 5
                    ELSE 8
                END), candidate_offices.election_year DESC NULLS LAST, candidate_offices.updated_at DESC
        ), official_current_offices AS (
         SELECT DISTINCT ON (person_map.canonical_person_id) person_map.canonical_person_id,
            source_person."position" AS current_office_label
           FROM source_people source_person
             JOIN person_identity_matches identity_match ON identity_match.source_person_id = source_person.id AND (identity_match.match_status = ANY (ARRAY['auto_matched'::text, 'probable_match'::text]))
             JOIN person_canonical_map person_map ON person_map.person_id = identity_match.person_id
          WHERE source_person.source_type = 'official_officeholder'::text AND source_person.is_public = true AND (source_person.source_payload ->> 'isCurrent'::text) = 'true'::text AND NULLIF(btrim(source_person."position"), ''::text) IS NOT NULL AND source_person."position" !~ '(候選人|參選|擬參選)'::text
          ORDER BY person_map.canonical_person_id, (
                CASE
                    WHEN source_person."position" ~~ '%立法院院長%'::text AND source_person."position" !~~ '%副院長%'::text THEN 0
                    WHEN source_person."position" ~~ '%立法院副院長%'::text THEN 1
                    WHEN source_person."position" ~~ '%立法委員%'::text THEN 2
                    ELSE 5
                END), source_person.election_year DESC NULLS LAST, source_person.updated_at DESC
        ), upcoming_candidates AS (
         SELECT DISTINCT ON (candidate_offices.canonical_person_id) candidate_offices.canonical_person_id,
                CASE
                    WHEN candidate_offices.race_label ~~ '%總統%'::text AND candidate_offices.race_label ~~ '%副總統%'::text AND candidate_offices.person_position_label ~~ '%副總統%'::text THEN '副總統'::text
                    WHEN candidate_offices.race_label ~~ '%總統%'::text AND candidate_offices.race_label ~~ '%副總統%'::text AND candidate_offices.person_position_label ~~ '%總統%'::text THEN '總統'::text
                    WHEN candidate_offices.race_label ~~ '%總統%'::text AND candidate_offices.person_position_label ~~ '%副總統%'::text THEN candidate_offices.person_position_label
                    ELSE COALESCE(candidate_offices.race_label, candidate_offices.person_position_label)
                END AS upcoming_candidate_label
           FROM candidate_offices
          WHERE ((candidate_offices.candidacy_status = ANY (ARRAY['party_nominee'::text, 'officially_announced'::text, 'registered'::text, 'qualified'::text])) OR (candidate_offices.registration_status = ANY (ARRAY['pending'::text, 'registered'::text, 'qualified'::text]))) AND candidate_offices.election_year >= EXTRACT(year FROM CURRENT_DATE)::integer
          ORDER BY candidate_offices.canonical_person_id, candidate_offices.election_year, (
                CASE
                    WHEN COALESCE(candidate_offices.race_label, candidate_offices.person_position_label, ''::text) ~~ '%副總統%'::text THEN 1
                    WHEN COALESCE(candidate_offices.race_label, candidate_offices.person_position_label, ''::text) ~~ '%總統%'::text THEN 0
                    WHEN COALESCE(candidate_offices.race_label, candidate_offices.person_position_label, ''::text) ~ '(立法委員|立委)'::text THEN 2
                    WHEN COALESCE(candidate_offices.race_label, candidate_offices.person_position_label, ''::text) ~ '(市長|縣長)'::text THEN 3
                    WHEN COALESCE(candidate_offices.race_label, candidate_offices.person_position_label, ''::text) ~~ '%議員%'::text THEN 5
                    ELSE 8
                END), candidate_offices.updated_at DESC
        )
 SELECT canonical.id AS person_id,
    canonical.name,
    COALESCE(canonical.alias, (array_remove(array_agg(mapped.alias ORDER BY mapped.updated_at DESC), NULL::text))[1]) AS alias,
    COALESCE(canonical.party, (array_remove(array_agg(mapped.party ORDER BY mapped.updated_at DESC), NULL::text))[1]) AS party,
    COALESCE(official_current_offices.current_office_label, current_offices.current_office_label,
        CASE
            WHEN canonical."position" !~ '(候選人|參選|擬參選)'::text THEN canonical."position"
            ELSE NULL::text
        END, (array_remove(array_agg(mapped."position" ORDER BY mapped.updated_at DESC) FILTER (WHERE mapped."position" !~ '(候選人|參選|擬參選)'::text), NULL::text))[1]) AS "position",
    COALESCE(canonical.election_year, (array_remove(array_agg(mapped.election_year ORDER BY mapped.updated_at DESC), NULL::integer))[1]) AS election_year,
    COALESCE(canonical.district, (array_remove(array_agg(mapped.district ORDER BY mapped.updated_at DESC), NULL::text))[1]) AS district,
    max(mapped.updated_at) AS updated_at,
    photo.photo_url AS primary_photo_url,
    photo.thumbnail_url AS primary_photo_thumbnail_url,
    photo.source_name AS photo_source_name,
    photo.source_url AS photo_source_url,
    photo.license_type AS photo_license_type,
    photo.license_url AS photo_license_url,
    photo.attribution AS photo_attribution,
    COALESCE(NULLIF(canonical.gender, 'unknown'::text), (array_remove(array_agg(NULLIF(mapped.gender, 'unknown'::text) ORDER BY mapped.updated_at DESC), NULL::text))[1], canonical.gender) AS gender,
    max(official_profile.education) AS education,
    max(official_profile.experience) AS experience,
    COALESCE(official_current_offices.current_office_label, current_offices.current_office_label) AS current_office_label,
    upcoming_candidates.upcoming_candidate_label
   FROM mapped_people mapped
     JOIN canonical_people canonical ON canonical.id = mapped.canonical_person_id
     LEFT JOIN official_profile_values official_profile ON official_profile.person_id = canonical.id
     LEFT JOIN public_person_primary_photos photo ON photo.person_id = canonical.id
     LEFT JOIN official_current_offices ON official_current_offices.canonical_person_id = canonical.id
     LEFT JOIN current_offices ON current_offices.canonical_person_id = canonical.id
     LEFT JOIN upcoming_candidates ON upcoming_candidates.canonical_person_id = canonical.id
  GROUP BY canonical.id, canonical.name, canonical.alias, canonical.party, canonical."position", canonical.election_year, canonical.district, canonical.gender, canonical.education, canonical.experience, photo.photo_url, photo.thumbnail_url, photo.source_name, photo.source_url, photo.license_type, photo.license_url, photo.attribution, official_current_offices.current_office_label, current_offices.current_office_label, upcoming_candidates.upcoming_candidate_label;$original$;
 IF md5(pg_get_viewdef('public.public_people'::regclass,true))<>'c3cb90853c4b78fd8dd44fdedfd21791' THEN RAISE EXCEPTION 'Public people inverse mismatch'; END IF;
 IF (SELECT jsonb_build_object('owner',relowner,'acl',relacl,'options',reloptions) FROM pg_class WHERE oid='public.public_people'::regclass) IS DISTINCT FROM metadata THEN RAISE EXCEPTION 'Public people inverse security metadata changed'; END IF;
END $inverse$;
COMMIT;
