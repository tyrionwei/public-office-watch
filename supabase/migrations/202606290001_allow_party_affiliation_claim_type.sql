ALTER TABLE person_claims
    DROP CONSTRAINT IF EXISTS person_claims_claim_type_check;

ALTER TABLE person_claims
    ADD CONSTRAINT person_claims_claim_type_check CHECK (
        claim_type IN (
            'name',
            'alias',
            'gender',
            'birth_date',
            'party',
            'party_affiliation',
            'position',
            'office',
            'candidacy',
            'district',
            'education',
            'experience',
            'platform',
            'finance_summary',
            'legal_case',
            'family_relation',
            'media',
            'external_id',
            'other'
        )
    );
