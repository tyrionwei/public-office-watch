SELECT COUNT(*) FROM regions;
SELECT COUNT(*) FROM elections;
SELECT COUNT(*) FROM races;
SELECT COUNT(*) FROM candidates;

SELECT * FROM public_regions ORDER BY display_order NULLS LAST, name LIMIT 20;

SELECT * FROM public_home_election_ticker ORDER BY voting_date ASC LIMIT 20;

SELECT * FROM public_races ORDER BY voting_date ASC NULLS LAST LIMIT 20;

SELECT * FROM public_candidates LIMIT 20;
