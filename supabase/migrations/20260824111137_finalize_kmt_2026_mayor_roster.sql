-- Publish the six incumbent KMT mayor nominees announced on 2026-07-22 and
-- retire the earlier Chiayi City nominee superseded by the joint primary.
BEGIN;

CREATE TEMP TABLE _kmt_2026_incumbent_mayors (
  candidate_id UUID PRIMARY KEY,
  candidate_external_id TEXT NOT NULL UNIQUE,
  person_id UUID NOT NULL,
  person_name TEXT NOT NULL,
  race_id UUID NOT NULL,
  source_person_key TEXT NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO _kmt_2026_incumbent_mayors (
  candidate_id,
  candidate_external_id,
  person_id,
  person_name,
  race_id,
  source_person_key
) VALUES
  ('09970a08-8f4f-415d-add0-9862067b3ca1', 'party-candidate:kmt-2026-mayor-63000-934f5be8b4e7', 'a4a44dff-efa9-45cc-8371-cbaa4cf6772d', '蔣萬安', '1ddcde35-f1ed-4e38-8652-ceb5e616f91a', 'party-candidate:kmt-2026-mayor-63000-934f5be8b4e7'),
  ('bf8175cb-e025-4a5e-bff0-e25487dbcc64', 'party-candidate:kmt-2026-mayor-68000-76e386902347', 'c30e7ac5-0838-407c-9fb7-20a750a1388f', '張善政', '3162f89f-8194-4754-ba4d-d1e8f7f697db', 'party-candidate:kmt-2026-mayor-68000-76e386902347'),
  ('427da226-dbaa-468f-b768-3fa804165fc7', 'party-candidate:kmt-2026-mayor-10017-85a08e16c4d6', '889ac819-8f59-409b-aa0a-d3339ac713b4', '謝國樑', '1b370880-53f6-45cf-9804-e2ab02c27b53', 'party-candidate:kmt-2026-mayor-10017-85a08e16c4d6'),
  ('c46ebc2f-244a-4f48-8ebb-16fe9923b1cc', 'party-candidate:kmt-2026-mayor-10008-a7497262ed2e', '9c21c186-06fa-4616-858e-79f24c8d11fb', '許淑華', 'c6cbd2c5-4082-4311-96bd-f5629c971710', 'party-candidate:kmt-2026-mayor-10008-a7497262ed2e'),
  ('0d3575cc-8d8b-4b47-9a40-2f57f35f15a7', 'party-candidate:kmt-2026-mayor-10005-46f5402f21fb', '84e77ee0-ab1f-4c49-8e91-0b93758a01af', '鍾東錦', '4c007293-da48-42cb-91ee-2ea79a0d4f69', 'party-candidate:kmt-2026-mayor-10005-46f5402f21fb'),
  ('7bf65953-662c-4498-ae9a-d4f61cf0b90c', 'party-candidate:kmt-2026-mayor-09007-0fec374990d2', 'e98d6971-8a74-4ad8-b1b0-01b55518a112', '王忠銘', 'e42da5ba-9480-4b32-9cf7-84cb8863492e', 'party-candidate:kmt-2026-mayor-09007-0fec374990d2');

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM _kmt_2026_incumbent_mayors) <> 6 THEN
    RAISE EXCEPTION 'KMT incumbent mayor release count drift';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM _kmt_2026_incumbent_mayors release
    LEFT JOIN public.people person ON person.id = release.person_id
    WHERE person.id IS NULL OR person.name <> release.person_name
  ) THEN
    RAISE EXCEPTION 'KMT incumbent mayor person prerequisite mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM _kmt_2026_incumbent_mayors release
    LEFT JOIN public.races race ON race.id = release.race_id
    WHERE race.id IS NULL OR race.is_public IS DISTINCT FROM TRUE
  ) THEN
    RAISE EXCEPTION 'KMT incumbent mayor race prerequisite mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.candidates existing
    JOIN _kmt_2026_incumbent_mayors incoming
      ON existing.person_id = incoming.person_id
     AND existing.race_id = incoming.race_id
    WHERE existing.external_id <> incoming.candidate_external_id
  ) THEN
    RAISE EXCEPTION 'KMT incumbent mayor candidate identifier conflict';
  END IF;
END
$$;

INSERT INTO public.candidates (
  id,
  person_id,
  race_id,
  party,
  candidate_no,
  registration_status,
  source_name,
  source_url,
  is_public,
  created_at,
  updated_at,
  external_id,
  vote_count,
  vote_rate,
  is_elected,
  is_incumbent,
  candidacy_status,
  election_result,
  status_updated_at
)
SELECT
  release.candidate_id,
  release.person_id,
  release.race_id,
  '中國國民黨',
  NULL,
  'unknown',
  '中國國民黨 2026 縣市長正式提名公告',
  'https://www.kmt.org.tw/2026/07/725_01955410286.html',
  TRUE,
  TIMESTAMPTZ '2026-08-24 11:09:29+00',
  TIMESTAMPTZ '2026-08-24 11:09:29+00',
  release.candidate_external_id,
  NULL,
  NULL,
  NULL,
  TRUE,
  'party_nominee',
  'pending',
  TIMESTAMPTZ '2026-08-24 11:09:29+00'
FROM _kmt_2026_incumbent_mayors release
ON CONFLICT (external_id) DO UPDATE SET
  person_id = EXCLUDED.person_id,
  race_id = EXCLUDED.race_id,
  party = EXCLUDED.party,
  candidate_no = EXCLUDED.candidate_no,
  registration_status = EXCLUDED.registration_status,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  is_public = EXCLUDED.is_public,
  updated_at = EXCLUDED.updated_at,
  vote_count = EXCLUDED.vote_count,
  vote_rate = EXCLUDED.vote_rate,
  is_elected = EXCLUDED.is_elected,
  is_incumbent = EXCLUDED.is_incumbent,
  candidacy_status = EXCLUDED.candidacy_status,
  election_result = EXCLUDED.election_result,
  status_updated_at = EXCLUDED.status_updated_at;

UPDATE public.people person
SET is_public = TRUE,
    updated_at = TIMESTAMPTZ '2026-08-24 11:09:29+00'
FROM _kmt_2026_incumbent_mayors release
WHERE person.id = release.person_id;

UPDATE public.source_people source
SET is_public = TRUE,
    updated_at = TIMESTAMPTZ '2026-08-24 11:09:29+00'
FROM _kmt_2026_incumbent_mayors release
WHERE source.source_person_key = release.source_person_key;

UPDATE public.person_claims claim
SET review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    updated_at = TIMESTAMPTZ '2026-08-24 11:09:29+00'
FROM public.source_people source
JOIN _kmt_2026_incumbent_mayors release
  ON release.source_person_key = source.source_person_key
WHERE claim.source_person_id = source.id
  AND claim.claim_type = 'candidacy';

UPDATE public.candidates
SET is_public = FALSE,
    updated_at = TIMESTAMPTZ '2026-08-24 11:09:29+00',
    status_updated_at = TIMESTAMPTZ '2026-08-24 11:09:29+00'
WHERE external_id = 'party-candidate:kmt-2026-mayor-10020-b5895d44e691';

UPDATE public.source_people
SET is_public = FALSE,
    source_payload = JSONB_SET(
      COALESCE(source_payload, '{}'::JSONB),
      '{publicationReview}',
      JSONB_BUILD_OBJECT(
        'status', 'superseded',
        'reason', '2026-04-07 國民黨與民眾黨嘉義市長初選民調結果由張啓楷勝出',
        'sourceUrl', 'https://www.kmt.org.tw/2026/04/blog-post_42.html',
        'reviewedAt', '2026-08-24T19:09:29+08:00'
      ),
      TRUE
    ),
    updated_at = TIMESTAMPTZ '2026-08-24 11:09:29+00'
WHERE source_person_key = 'party-candidate:kmt-2026-mayor-10020-b5895d44e691';

UPDATE public.person_claims
SET review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'party-candidate-superseded-v1',
    scoring_reasons = JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
      'reason', '國民黨與民眾黨嘉義市長初選民調於 2026-04-07 由張啓楷勝出',
      'sourceUrl', 'https://www.kmt.org.tw/2026/04/blog-post_42.html',
      'reviewedAt', '2026-08-24T19:09:29+08:00'
    )),
    updated_at = TIMESTAMPTZ '2026-08-24 11:09:29+00'
WHERE claim_key = 'party-candidacy:kmt-2026-mayor-10020-b5895d44e691';

SELECT published.promote(NULL);

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.candidates candidate
    JOIN _kmt_2026_incumbent_mayors release
      ON release.candidate_external_id = candidate.external_id
    WHERE candidate.is_public = TRUE
      AND candidate.is_incumbent = TRUE
      AND candidate.candidacy_status = 'party_nominee'
      AND candidate.registration_status = 'unknown'
      AND candidate.election_result = 'pending'
  ) <> 6 THEN
    RAISE EXCEPTION 'KMT incumbent mayor candidate publication failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM published.candidate_facts candidate
    WHERE candidate.candidate_id = (
      SELECT id FROM public.candidates
      WHERE external_id = 'party-candidate:kmt-2026-mayor-10020-b5895d44e691'
    )
  ) THEN
    RAISE EXCEPTION 'Superseded KMT Chiayi City nominee remains published';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM published.candidate_facts candidate
    JOIN public.candidates stored ON stored.id = candidate.candidate_id
    JOIN _kmt_2026_incumbent_mayors release
      ON release.candidate_external_id = stored.external_id
    WHERE candidate.is_incumbent = TRUE
  ) <> 6 THEN
    RAISE EXCEPTION 'Published KMT incumbent mayor verification failed';
  END IF;
END
$$;

COMMIT;
