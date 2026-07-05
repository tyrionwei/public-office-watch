ALTER TABLE source_people
    DROP CONSTRAINT IF EXISTS source_people_source_type_check;

ALTER TABLE source_people
    ADD CONSTRAINT source_people_source_type_check CHECK (
        source_type IN (
            'official_election',
            'official_officeholder',
            'official_party_finance',
            'government_open_data',
            'court_document',
            'media_guide',
            'wikipedia',
            'wikidata',
            'official_site',
            'social_media',
            'public_reference',
            'other'
        )
    );
