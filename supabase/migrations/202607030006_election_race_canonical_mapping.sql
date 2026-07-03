CREATE TABLE IF NOT EXISTS election_merge_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    duplicate_election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    canonical_election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL DEFAULT 'same_election' CHECK (
        relation_type IN (
            'same_election',
            'aggregate_source_link'
        )
    ),
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (
        status IN (
            'suggested',
            'verified',
            'rejected',
            'archived'
        )
    ),
    confidence_level TEXT NOT NULL DEFAULT 'C' CHECK (confidence_level IN ('A', 'B', 'C', 'D')),
    reason TEXT,
    evidence_json JSONB NOT NULL DEFAULT '{}'::JSONB,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (duplicate_election_id <> canonical_election_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_election_merge_decisions_duplicate_active
    ON election_merge_decisions(duplicate_election_id)
    WHERE status IN ('suggested', 'verified');

CREATE INDEX IF NOT EXISTS idx_election_merge_decisions_canonical
    ON election_merge_decisions(canonical_election_id);

CREATE INDEX IF NOT EXISTS idx_election_merge_decisions_relation_status
    ON election_merge_decisions(relation_type, status, updated_at DESC);

ALTER TABLE election_merge_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_manage_election_merge_decisions
    ON election_merge_decisions
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE OR REPLACE VIEW election_canonical_map AS
SELECT
    e.id AS election_id,
    COALESCE(m.canonical_election_id, e.id) AS canonical_election_id,
    m.id AS merge_decision_id,
    m.status AS merge_status,
    m.confidence_level AS merge_confidence_level
FROM elections e
LEFT JOIN election_merge_decisions m
    ON m.duplicate_election_id = e.id
   AND m.status = 'verified'
   AND m.relation_type = 'same_election';

CREATE TABLE IF NOT EXISTS race_merge_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    duplicate_race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    canonical_race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL DEFAULT 'same_race' CHECK (relation_type IN ('same_race')),
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (
        status IN (
            'suggested',
            'verified',
            'rejected',
            'archived'
        )
    ),
    confidence_level TEXT NOT NULL DEFAULT 'C' CHECK (confidence_level IN ('A', 'B', 'C', 'D')),
    reason TEXT,
    evidence_json JSONB NOT NULL DEFAULT '{}'::JSONB,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (duplicate_race_id <> canonical_race_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_race_merge_decisions_duplicate_active
    ON race_merge_decisions(duplicate_race_id)
    WHERE status IN ('suggested', 'verified');

CREATE INDEX IF NOT EXISTS idx_race_merge_decisions_canonical
    ON race_merge_decisions(canonical_race_id);

CREATE INDEX IF NOT EXISTS idx_race_merge_decisions_relation_status
    ON race_merge_decisions(relation_type, status, updated_at DESC);

ALTER TABLE race_merge_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_manage_race_merge_decisions
    ON race_merge_decisions
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE OR REPLACE VIEW race_canonical_map AS
SELECT
    r.id AS race_id,
    COALESCE(m.canonical_race_id, r.id) AS canonical_race_id,
    m.id AS merge_decision_id,
    m.status AS merge_status,
    m.confidence_level AS merge_confidence_level
FROM races r
LEFT JOIN race_merge_decisions m
    ON m.duplicate_race_id = r.id
   AND m.status = 'verified'
   AND m.relation_type = 'same_race';
