ALTER TABLE races
    DROP CONSTRAINT IF EXISTS races_race_type_check;

ALTER TABLE races
    ADD CONSTRAINT races_race_type_check CHECK (
        race_type IN (
            'president',
            'vice_president',
            'legislator',
            'party_list_legislator',
            'municipality_mayor',
            'county_mayor',
            'city_councilor',
            'county_councilor',
            'township_mayor',
            'township_representative',
            'village_chief',
            'recall',
            'referendum',
            'other',
            'legislative_district',
            'councilor_district',
            'local_chief',
            'township_representative_district',
            'indigenous'
        )
    );
