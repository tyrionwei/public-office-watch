UPDATE candidates
SET is_elected = CASE election_result
    WHEN 'elected' THEN TRUE
    WHEN 'not_elected' THEN FALSE
    ELSE is_elected
END
WHERE is_elected IS NULL
  AND election_result IN ('elected', 'not_elected');
