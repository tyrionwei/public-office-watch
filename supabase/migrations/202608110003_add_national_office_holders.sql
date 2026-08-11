BEGIN;

CREATE TABLE public.national_office_assignments (
    institution_key TEXT NOT NULL,
    role_key TEXT NOT NULL,
    holder_name TEXT,
    holder_person_id UUID,
    party_name TEXT,
    tenure_status TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    observed_at DATE NOT NULL,
    display_order INTEGER NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT national_office_assignments_pkey PRIMARY KEY (institution_key, role_key),
    CONSTRAINT national_office_assignments_institution_check CHECK (
        institution_key IN (
            'presidency',
            'executive_yuan',
            'legislative_yuan',
            'judicial_yuan',
            'examination_yuan',
            'control_yuan'
        )
    ),
    CONSTRAINT national_office_assignments_role_check CHECK (role_key IN ('chief', 'deputy')),
    CONSTRAINT national_office_assignments_status_check CHECK (tenure_status IN ('current', 'acting', 'vacant')),
    CONSTRAINT national_office_assignments_holder_check CHECK (
        (tenure_status = 'vacant' AND holder_name IS NULL)
        OR (tenure_status <> 'vacant' AND NULLIF(BTRIM(holder_name), '') IS NOT NULL)
    )
);

ALTER TABLE public.national_office_assignments ENABLE ROW LEVEL SECURITY;

INSERT INTO public.national_office_assignments (
    institution_key,
    role_key,
    holder_name,
    holder_person_id,
    party_name,
    tenure_status,
    source_name,
    source_url,
    observed_at,
    display_order
)
VALUES
    ('presidency', 'chief', '賴清德', 'e333ae37-8821-4f98-8a90-54a4d217dbce', '民主進步黨', 'current', '中華民國總統府：賴清德總統', 'https://www.president.gov.tw/Page/694', DATE '2026-08-11', 10),
    ('presidency', 'deputy', '蕭美琴', '1d6d74ef-ea70-4503-bc59-6bf36d9f25cf', '民主進步黨', 'current', '中華民國總統府：蕭美琴副總統', 'https://www.president.gov.tw/Page/695', DATE '2026-08-11', 11),
    ('executive_yuan', 'chief', '卓榮泰', '42b61fbe-76e1-6cfe-a31b-f0981e74b6fc', NULL, 'current', '行政院全球資訊網：院長', 'https://www.ey.gov.tw/Page/275F4CE091E4EE08/2a94179a-cb82-4075-99d9-9eb26de37982', DATE '2026-08-11', 20),
    ('executive_yuan', 'deputy', '鄭麗君', NULL, NULL, 'current', '行政院全球資訊網：副院長', 'https://www.ey.gov.tw/Page/B0DDF0F69A75E8DB/8708343d-dd7c-47c0-a3a5-336577da50da', DATE '2026-08-11', 21),
    ('legislative_yuan', 'chief', '韓國瑜', '6eec8a91-e26f-4ee6-a177-fe44ddd554d9', '中國國民黨', 'current', '立法院全球資訊網：院長', 'https://www.ly.gov.tw/Pages/Detail.aspx?nodeid=120&pid=1', DATE '2026-08-11', 30),
    ('legislative_yuan', 'deputy', '江啟臣', '7a4d2370-42b0-4acf-9b41-545eb1905cec', '中國國民黨', 'current', '立法院全球資訊網：副院長', 'https://www.ly.gov.tw/Pages/Detail.aspx?nodeid=121&pid=2', DATE '2026-08-11', 31),
    ('judicial_yuan', 'chief', '謝銘洋', NULL, NULL, 'acting', '司法院全球資訊網：代理院長', 'https://www.judicial.gov.tw/tw/cp-23-1192096-12855-1.html', DATE '2026-08-11', 40),
    ('judicial_yuan', 'deputy', NULL, NULL, NULL, 'vacant', '司法院全球資訊網：代理院長', 'https://www.judicial.gov.tw/tw/cp-23-1192096-12855-1.html', DATE '2026-08-11', 41),
    ('examination_yuan', 'chief', '周弘憲', NULL, NULL, 'current', '考試院：第14屆團隊就職', 'https://www.exam.gov.tw/News_Content.aspx?n=3915&s=49453', DATE '2026-08-11', 50),
    ('examination_yuan', 'deputy', '許舒翔', NULL, NULL, 'current', '考試院：第14屆團隊就職', 'https://www.exam.gov.tw/News_Content.aspx?n=3915&s=49453', DATE '2026-08-11', 51),
    ('control_yuan', 'chief', NULL, NULL, NULL, 'vacant', '總統府：第7屆監察院被提名人', 'https://www.president.gov.tw/Page/777', DATE '2026-08-11', 60),
    ('control_yuan', 'deputy', NULL, NULL, NULL, 'vacant', '總統府：第7屆監察院被提名人', 'https://www.president.gov.tw/Page/777', DATE '2026-08-11', 61);

CREATE VIEW published.national_office_holders AS
SELECT
    assignment.institution_key,
    assignment.role_key,
    assignment.holder_name,
    assignment.holder_person_id,
    assignment.party_name,
    assignment.tenure_status,
    assignment.source_name,
    assignment.source_url,
    assignment.observed_at,
    assignment.display_order,
    assignment.updated_at
FROM public.national_office_assignments assignment;

CREATE VIEW published.current_legislator_party_summary AS
SELECT
    COALESCE(NULLIF(BTRIM(person.party), ''), '無黨籍') AS party_name,
    COUNT(*)::INTEGER AS legislator_count
FROM published.people_directory person
WHERE person.list_role = 'legislator'
  AND person.list_status = 'current'
GROUP BY COALESCE(NULLIF(BTRIM(person.party), ''), '無黨籍');

REVOKE ALL ON TABLE published.national_office_holders FROM PUBLIC;
GRANT SELECT ON TABLE published.national_office_holders TO anon, authenticated;
REVOKE ALL ON TABLE published.current_legislator_party_summary FROM PUBLIC;
GRANT SELECT ON TABLE published.current_legislator_party_summary TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
