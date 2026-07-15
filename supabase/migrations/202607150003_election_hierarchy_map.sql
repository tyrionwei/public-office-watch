CREATE OR REPLACE VIEW election_hierarchy_map
WITH (security_invoker = TRUE)
AS
SELECT
    decision.id AS relationship_id,
    decision.canonical_election_id AS parent_election_id,
    decision.duplicate_election_id AS child_election_id,
    decision.relation_type,
    decision.confidence_level,
    decision.reason,
    decision.reviewed_at,
    decision.updated_at
FROM election_merge_decisions decision
WHERE decision.status = 'verified'
  AND decision.relation_type = 'aggregate_source_link';

COMMENT ON VIEW election_hierarchy_map IS
    'Verified parent/child election relationships. These rows are not same-election canonical merges.';
