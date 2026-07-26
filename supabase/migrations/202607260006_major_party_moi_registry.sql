-- Major-party registry details verified against the Ministry of the Interior party portal on 2026-07-26.
CREATE TEMP TABLE _major_party_moi_registry (
    name TEXT PRIMARY KEY,
    registry_no TEXT NOT NULL,
    founded_date_text TEXT NOT NULL,
    filed_date_text TEXT NOT NULL,
    headquarters_address TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    source_url TEXT NOT NULL
);

INSERT INTO _major_party_moi_registry (
    name, registry_no, founded_date_text, filed_date_text,
    headquarters_address, contact_phone, source_url
)
VALUES
    (
        '中國國民黨', '1', '1894-11-24', '1989-02-10',
        '臺北市中山區八德路二段232號', '(02)8771-1234',
        'https://party.moi.gov.tw/PartyMainContent.aspx?n=16100&s=2&sms=13073'
    ),
    (
        '民主進步黨', '16', '1986-09-28', '1989-05-05',
        '臺北市中正區北平東路30號10樓', '(02)2392-9989',
        'https://party.moi.gov.tw/PartyMainContent.aspx?n=16100&s=31&sms=13073'
    ),
    (
        '台灣民眾黨', '350', '2019-08-06', '2019-08-23',
        '臺北市松山區南京東路三段261號3樓（B1區）', '(02)2752-0806',
        'https://party.moi.gov.tw/PartyMainContent.aspx?n=16100&sms=13073&s=409'
    );

UPDATE parties party
SET
    registry_no = registry.registry_no,
    founded_date_text = registry.founded_date_text,
    filed_date_text = registry.filed_date_text,
    headquarters_address = registry.headquarters_address,
    contact_phone = registry.contact_phone,
    source_name = '內政部政黨資訊網',
    source_url = registry.source_url,
    updated_at = NOW()
FROM _major_party_moi_registry registry
WHERE REPLACE(party.name, '臺', '台') = REPLACE(registry.name, '臺', '台');
