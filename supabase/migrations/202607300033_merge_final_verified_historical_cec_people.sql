-- Resolve the four remaining historical CEC identity clusters after automated matching converged.

CREATE TEMP TABLE _final_historical_cec_person_merges_20260730 (
    duplicate_person_id UUID PRIMARY KEY,
    canonical_person_id UUID NOT NULL,
    confidence_level TEXT NOT NULL,
    reason TEXT NOT NULL,
    evidence_json JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO _final_historical_cec_person_merges_20260730 (
    duplicate_person_id,
    canonical_person_id,
    confidence_level,
    reason,
    evidence_json
) VALUES
    (
        '0682ff2b-3cea-4a84-98cd-46f1eb8a9009',
        'a14805bb-dbb0-44d6-b7bf-77479658a7e0',
        'A',
        'same officeholder; name punctuation variants, party, indigenous constituency, election history, and 2020 candidate number align',
        '{"rule":"manual_remaining_identity_review","person":"鄭天財 Sra Kacaw","evidence":["same 2020 election candidate number 1","same Chinese Nationalist Party affiliation","same plain indigenous constituency","continuous 2012-2024 legislative election history"]}'
    ),
    (
        '395b7acc-40e6-4962-b80e-8faf9c435330',
        '7c5ebbd2-91e6-4af0-b890-36ac7e5d556c',
        'A',
        'same officeholder; name, party, Penghu constituency, election history, and 2020 candidate number align',
        '{"rule":"manual_remaining_identity_review","person":"楊曜","evidence":["same 2020 election candidate number 3","same Democratic Progressive Party affiliation","same Penghu constituency","continuous legislative election history"]}'
    ),
    (
        'a74c7ba4-32fc-4f26-b7bb-1ad29f3eb676',
        '5d623ab5-a2a2-4c40-a094-6b3712d648e5',
        'A',
        'same presidential candidate; historical source row duplicates the official 2012 CEC identity',
        '{"rule":"manual_remaining_identity_review","person":"蔡英文","evidence":["same 2012 presidential election","same Democratic Progressive Party affiliation","same national constituency","same vote total 6093578"]}'
    ),
    (
        'd750f82c-8bff-40ea-b764-83af99a2c8f8',
        '5d623ab5-a2a2-4c40-a094-6b3712d648e5',
        'A',
        'same presidential candidate across 2012 and 2016 elections',
        '{"rule":"manual_remaining_identity_review","person":"蔡英文","evidence":["same name","same Democratic Progressive Party affiliation","same presidential office","continuous presidential election history"]}'
    ),
    (
        '58cd7f37-341e-4077-b0de-cc5b1721252d',
        '5d623ab5-a2a2-4c40-a094-6b3712d648e5',
        'A',
        'same presidential candidate across 2012 and 2020 elections',
        '{"rule":"manual_remaining_identity_review","person":"蔡英文","evidence":["same name","same Democratic Progressive Party affiliation","same presidential office","continuous presidential election history"]}'
    ),
    (
        '62899aef-5784-42f4-9b4d-c8854aa28a89',
        'd202716e-11ab-4ea5-a481-6134b1674686',
        'A',
        'same officeholder; name, party, mountain indigenous constituency, and election history align',
        '{"rule":"manual_remaining_identity_review","person":"孔文吉","evidence":["same Chinese Nationalist Party affiliation","same mountain indigenous constituency","continuous legislative election history","same 2020 candidate number 10"]}'
    ),
    (
        '5cb4eaa0-d260-41ba-b87d-5828373ee13c',
        'd202716e-11ab-4ea5-a481-6134b1674686',
        'A',
        'same officeholder; historical 2020 source row matches the established mountain indigenous legislative identity',
        '{"rule":"manual_remaining_identity_review","person":"孔文吉","evidence":["same 2020 election candidate number 10","same Chinese Nationalist Party affiliation","same mountain indigenous constituency","same election result"]}'
    );

DO $verify$
BEGIN
    IF (SELECT COUNT(*) FROM _final_historical_cec_person_merges_20260730) <> 7 THEN
        RAISE EXCEPTION 'Final historical CEC person merge input count mismatch';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _final_historical_cec_person_merges_20260730 input
        LEFT JOIN people duplicate ON duplicate.id = input.duplicate_person_id
        LEFT JOIN people canonical ON canonical.id = input.canonical_person_id
        WHERE duplicate.id IS NULL
           OR canonical.id IS NULL
           OR input.duplicate_person_id = input.canonical_person_id
           OR canonical.is_public IS NOT TRUE
    ) THEN
        RAISE EXCEPTION 'Final historical CEC person merge input identity mismatch';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _final_historical_cec_person_merges_20260730 input
        JOIN person_merge_decisions existing
          ON existing.duplicate_person_id = input.duplicate_person_id
         AND existing.status IN ('suggested', 'verified')
        WHERE existing.canonical_person_id <> input.canonical_person_id
    ) THEN
        RAISE EXCEPTION 'Final historical CEC person merge gained a conflicting active decision';
    END IF;
END
$verify$;

INSERT INTO person_merge_decisions (
    duplicate_person_id,
    canonical_person_id,
    status,
    confidence_level,
    reason,
    evidence_json,
    reviewed_by,
    reviewed_at,
    updated_at
)
SELECT
    input.duplicate_person_id,
    input.canonical_person_id,
    'verified',
    input.confidence_level,
    input.reason,
    input.evidence_json,
    'system:manual-final-historical-cec-identity-review',
    NOW(),
    NOW()
FROM _final_historical_cec_person_merges_20260730 input
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = input.duplicate_person_id
      AND existing.status IN ('suggested', 'verified')
);

DO $verify$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _final_historical_cec_person_merges_20260730 input
        JOIN person_merge_decisions decision
          ON decision.duplicate_person_id = input.duplicate_person_id
         AND decision.canonical_person_id = input.canonical_person_id
         AND decision.status = 'verified'
    ) <> 7 THEN
        RAISE EXCEPTION 'Final historical CEC person merge result mismatch';
    END IF;
END
$verify$;

SELECT published.promote(NULL);
