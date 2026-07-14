CREATE OR REPLACE VIEW public_people_list AS
WITH candidate_summary AS (
    SELECT
        person_id,
        TRUE AS has_candidate_history,
        BOOL_OR(
            COALESCE(person_position, '') ~ '(村里|村長|里長|代表)'
            OR COALESCE(race_title, '') ~ '(村里|村長|里長|代表)'
        ) AS has_grassroots_history
    FROM public_candidates
    GROUP BY person_id
),
classified AS (
    SELECT
        people.*,
        COALESCE(
            people.current_office_label,
            people.upcoming_candidate_label,
            people.position,
            ''
        ) AS list_position,
        COALESCE(candidate_summary.has_candidate_history, FALSE) AS has_candidate_history,
        (
            COALESCE(
                people.current_office_label,
                people.upcoming_candidate_label,
                people.position,
                ''
            ) ~ '(村里|村長|里長|代表)'
            OR COALESCE(candidate_summary.has_grassroots_history, FALSE)
        ) AS list_is_grassroots
    FROM public_people people
    LEFT JOIN candidate_summary ON candidate_summary.person_id = people.person_id
),
role_classified AS (
    SELECT
        classified.*,
        CASE
            WHEN list_position LIKE '%副總統%' THEN 'vice_president'
            WHEN list_position LIKE '%總統%' THEN 'president'
            WHEN list_position ~ '(立法委員|立委)' THEN 'legislator'
            WHEN list_position LIKE '%議員%' THEN 'councilor'
            WHEN list_position ~ '(副市長|副縣長|副縣市長)' THEN 'local_deputy'
            WHEN list_position ~ '(市長|縣長)' THEN 'local_chief'
            WHEN list_position ~ '(局長|處長|主任委員)' THEN 'agency_head'
            WHEN list_position ~ '(黨主席|主席|秘書長)' THEN 'party_officer'
            WHEN list_position LIKE '%候選人%' THEN 'candidate'
            ELSE 'other'
        END AS list_role
    FROM classified
),
status_classified AS (
    SELECT
        role_classified.*,
        CASE
            WHEN current_office_label IS NOT NULL THEN 'current'
            WHEN upcoming_candidate_label IS NOT NULL THEN 'candidate'
            WHEN has_candidate_history THEN 'former'
            WHEN list_role <> 'other' THEN 'current'
            ELSE 'other'
        END AS list_status
    FROM role_classified
)
SELECT
    person_id,
    name,
    alias,
    party,
    position,
    election_year,
    district,
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
    current_office_label,
    upcoming_candidate_label,
    list_role,
    list_status,
    list_is_grassroots,
    CASE list_status
        WHEN 'current' THEN 0
        WHEN 'candidate' THEN 1
        WHEN 'former' THEN 2
        ELSE 3
    END AS list_status_order,
    CASE list_role
        WHEN 'president' THEN 0
        WHEN 'vice_president' THEN 1
        WHEN 'legislator' THEN 2
        WHEN 'local_chief' THEN 3
        WHEN 'local_deputy' THEN 4
        WHEN 'councilor' THEN 5
        WHEN 'party_officer' THEN 6
        WHEN 'agency_head' THEN 6
        WHEN 'candidate' THEN 7
        ELSE 8
    END AS list_role_order
FROM status_classified;

REVOKE ALL ON public_people_list FROM PUBLIC;
GRANT SELECT ON public_people_list TO anon, authenticated;

COMMENT ON VIEW public_people_list IS
    'Public person list projection with stable scope, status, role, and pagination sort metadata.';
