ALTER TABLE elections
    DROP CONSTRAINT IF EXISTS elections_election_type_check;

ALTER TABLE elections
    ADD CONSTRAINT elections_election_type_check CHECK (
        election_type IN (
            'presidential',
            'legislative',
            'local',
            'recall',
            'referendum',
            'by_election',
            'other',
            'president',
            'legislator',
            'councilor',
            'local_chief',
            'township_representative',
            'village_chief'
        )
    );
