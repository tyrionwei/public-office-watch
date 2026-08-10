BEGIN;

-- These reviewed cross-year merges are supported by Legislative Yuan, CEC,
-- or county government records. Keep them aligned with the project rule that
-- official-source identity decisions may use confidence A.
UPDATE person_merge_decisions
SET
    confidence_level = 'A',
    evidence_json = COALESCE(evidence_json, '{}'::JSONB) || jsonb_build_object(
        'confidenceCorrectionVersion', 'person-risk-audit-v1',
        'confidenceCorrectionReason', 'official government identity evidence'
    ),
    updated_at = NOW()
WHERE reviewed_by = 'risk-audit:2026-08-10-cross-year-official-career'
  AND status = 'verified'
  AND confidence_level IS DISTINCT FROM 'A';

DO $verify$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM person_merge_decisions
        WHERE reviewed_by = 'risk-audit:2026-08-10-cross-year-official-career'
          AND status = 'verified'
          AND confidence_level IS DISTINCT FROM 'A'
    ) THEN
        RAISE EXCEPTION 'Official cross-year identity decisions are not confidence A';
    END IF;
END
$verify$;

COMMIT;
