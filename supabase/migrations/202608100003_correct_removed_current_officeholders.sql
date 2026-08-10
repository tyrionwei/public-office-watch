BEGIN;

WITH reviewed_exclusions (
    external_id,
    ended_at,
    source_name,
    source_url,
    source_payload
) AS (
    VALUES
    (
        'cec-2022-local-councilor-regional-person-cdf2e1a8266f',
        DATE '2023-04-26',
        '高雄市議會：陳致中議員聯絡資訊',
        'https://www.kcc.gov.tw/MemberInfo_New.aspx?msn=2219&n=76&sms=0',
        jsonb_build_object(
            'name', '陳致中',
            'office', '高雄市第4屆議員',
            'note', '高雄市議會官方頁面註記112.04.26解職'
        )
    ),
    (
        'cec-2022-local-councilor-regional-person-b6b8a6e48662',
        DATE '2026-06-24',
        '高雄市議會：黃紹庭議員聯絡資訊',
        'https://www.kcc.gov.tw/MemberInfo_New.aspx?msn=2210&n=76&sms=0',
        jsonb_build_object(
            'name', '黃紹庭',
            'office', '高雄市第4屆議員',
            'note', '高雄市議會官方頁面註記115.06.24解職'
        )
    )
)
INSERT INTO public.current_office_exclusions (
    person_id,
    election_year,
    race_type,
    end_reason,
    ended_at,
    source_name,
    source_url,
    source_observed_at,
    source_payload,
    updated_at
)
SELECT person.id,
       2022,
       'city_councilor',
       'removed',
       reviewed.ended_at,
       reviewed.source_name,
       reviewed.source_url,
       DATE '2026-08-10',
       reviewed.source_payload,
       NOW()
FROM reviewed_exclusions AS reviewed
JOIN public.people AS person ON person.external_id = reviewed.external_id
ON CONFLICT (person_id, election_year, race_type) DO UPDATE SET
    end_reason = EXCLUDED.end_reason,
    ended_at = EXCLUDED.ended_at,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    source_observed_at = EXCLUDED.source_observed_at,
    source_payload = EXCLUDED.source_payload,
    updated_at = EXCLUDED.updated_at;

SELECT public.refresh_public_people_list_cached();

COMMIT;
