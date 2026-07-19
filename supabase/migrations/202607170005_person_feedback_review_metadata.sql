ALTER TABLE person_feedback_submissions
    ADD COLUMN review_note TEXT,
    ADD COLUMN reviewed_by TEXT,
    ADD COLUMN reviewed_at TIMESTAMPTZ,
    ADD CONSTRAINT person_feedback_review_note_length
        CHECK (review_note IS NULL OR CHAR_LENGTH(review_note) <= 1000),
    ADD CONSTRAINT person_feedback_reviewed_by_length
        CHECK (reviewed_by IS NULL OR CHAR_LENGTH(reviewed_by) <= 120);

COMMENT ON COLUMN person_feedback_submissions.review_note IS
    'Private reviewer note. Never returned by public feedback RPCs.';

COMMENT ON COLUMN person_feedback_submissions.reviewed_by IS
    'Internal reviewer identifier. Never returned by public feedback RPCs.';
