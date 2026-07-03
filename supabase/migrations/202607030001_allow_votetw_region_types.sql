ALTER TABLE regions
    DROP CONSTRAINT IF EXISTS regions_region_type_check;

ALTER TABLE regions
    ADD CONSTRAINT regions_region_type_check CHECK (
        region_type IN (
            'country',
            'municipality',
            'county',
            'city',
            'district',
            'township',
            'village',
            'election_district',
            'special',
            'president',
            'legislative_district',
            'councilor_district',
            'local_chief',
            'township_representative_district',
            'village_chief',
            'indigenous'
        )
    );
