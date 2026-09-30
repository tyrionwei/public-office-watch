-- 定點身分修正：保留原始人物、參選、來源與舊審核證據。
-- 不把不確定內容移至另一人；正式執行另行授權。
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='10min';
SELECT pg_advisory_xact_lock(hashtextextended('pow:person-identity-audit',0));
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM public.person_merge_decisions WHERE id='363a4dd2-9de5-48f9-b3da-4b3e2eea1013'
 AND (duplicate_person_id<>'23d0ca10-ef18-45f9-b942-c370c7e37684' OR canonical_person_id<>'0f2525a9-8484-4885-a0b6-156a4b4880ea')) THEN RAISE EXCEPTION 'merge baseline drift'; END IF;
 IF EXISTS(SELECT 1 FROM public.candidates WHERE id='072505a7-8cf7-5204-bde5-413bb1dc3ae0'
 AND (person_id IS DISTINCT FROM '0f2525a9-8484-4885-a0b6-156a4b4880ea'::uuid OR candidate_name NOT IN ('江聰明 Ishahavut﹒Salizan','江聰明'))) THEN RAISE EXCEPTION 'candidate baseline drift'; END IF;
END $guard$;

UPDATE public.person_merge_decisions SET status='archived',reason='VoteTW page 131556 is attached to Yilan 2022 evidence and was reused on the Taitung 2018 person; shared source attribution is not independent person identity evidence.',reviewed_by='official-identity-review-20260928',reviewed_at=now(),
 evidence_json=COALESCE(evidence_json,'{}')||jsonb_build_object('identityAudit',jsonb_build_object('version','person-identity-audit-20260928-v2','status','invalid_merge_evidence','previousStatus',status,'previousReason',reason,'reason','VoteTW page 131556 is attached to Yilan 2022 evidence and was reused on the Taitung 2018 person; shared source attribution is not independent person identity evidence.'))
WHERE id='363a4dd2-9de5-48f9-b3da-4b3e2eea1013' AND status='verified';

UPDATE public.person_claims SET review_status='archived',visibility='private',is_public=false,
 claim_json=COALESCE(claim_json,'{}')||jsonb_build_object('identityAudit',jsonb_build_object('version','person-identity-audit-20260928-v2','status','quarantined','reason','VoteTW page 131556 is attached to Yilan 2022 evidence and was reused on the Taitung 2018 person; shared source attribution is not independent person identity evidence.','previousReviewStatus',review_status,'previousVisibility',visibility,'previousIsPublic',is_public))
WHERE id IN ('1a043a17-60af-463c-bf75-ba6990e23da7'::uuid,'1b4fa507-8f62-41df-b3a3-2ecd40dd4771'::uuid,'1fa35c26-6b0d-4976-a500-c1770e61caad'::uuid,'25a00aeb-4632-488c-bc5c-6c970525f2f5'::uuid,'30e1e2ba-32c0-4a97-a882-b83540499a46'::uuid,'92bf5876-c834-4ffe-9035-1960e1225d23'::uuid) AND person_id='0f2525a9-8484-4885-a0b6-156a4b4880ea'
 AND claim_json->'identityAudit'->>'version' IS DISTINCT FROM 'person-identity-audit-20260928-v2';

UPDATE public.person_identity_matches SET match_status='possible_match',score=0,
 match_reason='撤下循環證明：宜蘭歷年參選與生日線索來自無效合併及錯掛 VoteTW。需獨立跨年官方身分證據。',
 evidence_json=COALESCE(evidence_json,'{}')||jsonb_build_object('identityAudit',jsonb_build_object('version','person-identity-audit-20260928-v2','status','pending','previousStatus',match_status,'previousReason',match_reason)),
 reviewed_by='official-identity-review-20260928',reviewed_at=now()
WHERE id='2fccf7bf-b15f-4834-a13b-ded72e187442' AND evidence_json->'identityAudit'->>'version' IS DISTINCT FROM 'person-identity-audit-20260928-v2';

UPDATE public.person_claims SET review_status='pending',visibility='review_only',is_public=false,
 claim_json=COALESCE(claim_json,'{}')||jsonb_build_object('identityAudit',jsonb_build_object('version','person-identity-audit-20260928-v2','status','pending','candidateId','072505a7-8cf7-5204-bde5-413bb1dc3ae0','candidateExternalId','pow-cec-registration-2026-e9c509844b6f4e11effd01bbb0bbca9f','reason','Existing higher-level identity unresolved after invalid merge evidence was withdrawn. Do not relink from name alone.','previousReviewStatus',review_status))
WHERE id='aed98fd1-a1d3-4231-a245-b1079f2d3d3f' AND claim_json->'identityAudit'->>'version' IS DISTINCT FROM 'person-identity-audit-20260928-v2';

-- The candidate keeps the original person_id for review, but is no longer adopted publicly.
UPDATE public.candidates SET candidate_name='江聰明',is_public=false
WHERE id='072505a7-8cf7-5204-bde5-413bb1dc3ae0' AND (candidate_name IS DISTINCT FROM '江聰明' OR is_public);
UPDATE public.candidate_lifecycle_events SET is_public=false WHERE candidate_id='072505a7-8cf7-5204-bde5-413bb1dc3ae0' AND is_public;
DELETE FROM published.candidate_facts WHERE candidate_id='072505a7-8cf7-5204-bde5-413bb1dc3ae0';

-- Reverse only derived associations with an exact original source/person mapping.
UPDATE public.person_party_affiliations a SET person_id=c.person_id
FROM public.person_claims c WHERE a.source_claim_key=c.claim_key AND c.id='78e668e3-708a-4e06-8015-a2693888353e' AND a.person_id='0f2525a9-8484-4885-a0b6-156a4b4880ea';
UPDATE public.person_party_affiliations SET person_id='23d0ca10-ef18-45f9-b942-c370c7e37684'
WHERE source_person_id='48513319-e739-4175-ae0c-d1ec745fd610' AND affiliation_key LIKE 'party-affiliation:23d0ca10-%' AND person_id='0f2525a9-8484-4885-a0b6-156a4b4880ea';
UPDATE public.person_party_affiliations a SET review_status='archived',is_public=false,
 source_payload=COALESCE(source_payload,'{}')||jsonb_build_object('identityAudit',jsonb_build_object('version','person-identity-audit-20260928-v2','status','quarantined','reason','VoteTW page 131556 is attached to Yilan 2022 evidence and was reused on the Taitung 2018 person; shared source attribution is not independent person identity evidence.'))
FROM public.person_claims c WHERE a.source_claim_key=c.claim_key AND c.id='25a00aeb-4632-488c-bc5c-6c970525f2f5' AND a.is_public;
UPDATE published.candidate_facts f SET person_id='23d0ca10-ef18-45f9-b942-c370c7e37684',person_name='江聰明',person_party=p.party,person_position=p.position
FROM public.people p WHERE p.id='23d0ca10-ef18-45f9-b942-c370c7e37684' AND f.candidate_id='57596ad7-aeb5-426c-a38a-d3847bbf6e75'
 AND f.person_id='0f2525a9-8484-4885-a0b6-156a4b4880ea';

INSERT INTO public.person_merge_decisions(id,duplicate_person_id,canonical_person_id,status,confidence_level,reason,evidence_json,reviewed_by,reviewed_at)
SELECT '46e989d2-14b8-5e18-90c7-02c1ce4a508f'::uuid,'0bdf6d74-e2b2-41ef-8e07-1d2461876731'::uuid,'6fbed1cc-d8b6-4be7-9860-e002016c8cb0'::uuid,'rejected','B','官方公報完整生日不同，確認為不同李明哲。','{"version": "person-identity-audit-20260928-v2", "result": "different_people", "method": "official_full_birth_dates_visually_verified", "sources": [{"id": "7c660869-4298-4aac-9c58-29d369173a1b", "personId": "6fbed1cc-d8b6-4be7-9860-e002016c8cb0", "value": "1968-10-31", "sourceUrl": "https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/06%E7%B8%A3%E5%B8%82%E8%AD%B0%E5%93%A1/111%E5%B9%B4/11%E9%9B%B2%E6%9E%97%E7%B8%A3/%E9%9B%B2%E6%9E%97%E7%B8%A3%E7%AC%AC04%E9%81%B8%E5%8D%80.pdf", "sha256": "1e7d987b6abe14912e587829a8617216eca9bb864fee809076c5f8b456f7f5b7", "page": 2, "candidateNo": 7, "review": "visual comparison of original official bulletin; full birth date and candidate identity verified"}, {"id": "b9b2113c-f79a-4920-aa3e-4eb3228f22c2", "personId": "0bdf6d74-e2b2-41ef-8e07-1d2461876731", "value": "1966-10-07", "sourceUrl": "https://eebulletin.cec.gov.tw/111/15%E5%AE%9C%E8%98%AD%E7%B8%A3/03%E9%84%89%E9%8E%AE%E5%B8%82%E9%95%B7/%E8%98%87%E6%BE%B3%E9%8E%AE%E9%8E%AE%E9%95%B7%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/%E8%98%87%E6%BE%B3%E9%8E%AE%E9%8E%AE%E9%95%B7%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1.pdf", "sha256": "2bf5527a4a6a69c54d04d6fd4c919af1792a48bb49cea7ed5d06f5714c766459", "page": 1, "candidateNo": 2, "review": "visual comparison of original official bulletin; full birth date and candidate identity verified"}], "reason": "Official 2022 bulletins identify different candidates with incompatible full birth dates. Same name does not identify the same person."}'::jsonb,'official-identity-review-20260928',now()
WHERE EXISTS(SELECT 1 FROM public.people WHERE id='0bdf6d74-e2b2-41ef-8e07-1d2461876731') AND EXISTS(SELECT 1 FROM public.people WHERE id='6fbed1cc-d8b6-4be7-9860-e002016c8cb0')
 AND NOT EXISTS(SELECT 1 FROM public.person_merge_decisions WHERE least(duplicate_person_id,canonical_person_id)=least('0bdf6d74-e2b2-41ef-8e07-1d2461876731'::uuid,'6fbed1cc-d8b6-4be7-9860-e002016c8cb0'::uuid) AND greatest(duplicate_person_id,canonical_person_id)=greatest('0bdf6d74-e2b2-41ef-8e07-1d2461876731'::uuid,'6fbed1cc-d8b6-4be7-9860-e002016c8cb0'::uuid) AND status='rejected')
ON CONFLICT(id) DO NOTHING;

-- A normal import cannot erase a specific reviewed identity quarantine.
CREATE OR REPLACE FUNCTION public.guard_reviewed_identity_claim()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $f$
BEGIN
 IF current_user NOT IN ('postgres','supabase_admin') AND OLD.claim_json->'identityAudit'->>'status' IN ('pending','quarantined') THEN
  RETURN OLD; -- Keep the reviewed evidence and its candidate binding intact during import.
 END IF;
 RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION public.guard_reviewed_identity_claim() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS guard_reviewed_identity_claim ON public.person_claims;
CREATE TRIGGER guard_reviewed_identity_claim BEFORE UPDATE ON public.person_claims FOR EACH ROW EXECUTE FUNCTION public.guard_reviewed_identity_claim();
CREATE INDEX IF NOT EXISTS person_claims_pending_identity_candidate_idx ON public.person_claims ((claim_json->>'candidateExternalId')) WHERE claim_json->'identityAudit'->>'status'='pending';
CREATE OR REPLACE FUNCTION public.guard_pending_candidate_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $f$
BEGIN
 IF EXISTS(SELECT 1 FROM public.person_claims c WHERE c.claim_json->'identityAudit'->>'status'='pending' AND (c.claim_json->'identityAudit'->>'candidateId'=NEW.id::text OR c.claim_json->>'candidateExternalId'=NEW.external_id)) THEN
  NEW.is_public:=false;
  IF TG_OP='UPDATE' THEN NEW.person_id:=OLD.person_id; NEW.external_id:=OLD.external_id; NEW.candidate_name:=OLD.candidate_name; END IF;
 END IF;
 RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION public.guard_pending_candidate_identity() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS guard_pending_candidate_identity ON public.candidates;
CREATE TRIGGER guard_pending_candidate_identity BEFORE INSERT OR UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.guard_pending_candidate_identity();
-- Publishing can rebuild derived facts, but pending private candidates must not reappear.
CREATE OR REPLACE FUNCTION published.guard_candidate_fact_visibility()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $f$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.candidates c WHERE c.id=NEW.candidate_id AND c.is_public) THEN RETURN NULL; END IF;
 RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION published.guard_candidate_fact_visibility() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS guard_candidate_fact_visibility ON published.candidate_facts;
CREATE TRIGGER guard_candidate_fact_visibility BEFORE INSERT OR UPDATE ON published.candidate_facts FOR EACH ROW EXECUTE FUNCTION published.guard_candidate_fact_visibility();

-- Preserve reviewed negative/quarantined decisions when ordinary import repeats an old proposal.
CREATE OR REPLACE FUNCTION public.guard_existing_identity_decision()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $f$
BEGIN
 IF current_user IN ('postgres','supabase_admin') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.evidence_json->'identityAudit'->>'version'='person-identity-audit-20260928-v2' THEN RETURN OLD; END IF;
 IF TG_TABLE_NAME='person_merge_decisions' AND TG_OP='INSERT' THEN
  IF EXISTS(SELECT 1 FROM public.person_merge_decisions d WHERE d.status IN ('rejected','archived')
   AND least(d.duplicate_person_id,d.canonical_person_id)=least(NEW.duplicate_person_id,NEW.canonical_person_id)
   AND greatest(d.duplicate_person_id,d.canonical_person_id)=greatest(NEW.duplicate_person_id,NEW.canonical_person_id)) THEN RETURN NULL; END IF;
 END IF;
 RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION public.guard_existing_identity_decision() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS guard_existing_identity_decision ON public.person_identity_matches;
CREATE TRIGGER guard_existing_identity_decision BEFORE INSERT OR UPDATE ON public.person_identity_matches FOR EACH ROW EXECUTE FUNCTION public.guard_existing_identity_decision();
DROP TRIGGER IF EXISTS guard_existing_identity_decision ON public.person_merge_decisions;
CREATE TRIGGER guard_existing_identity_decision BEFORE INSERT OR UPDATE ON public.person_merge_decisions FOR EACH ROW EXECUTE FUNCTION public.guard_existing_identity_decision();

REFRESH MATERIALIZED VIEW published.person_candidate_summaries;
SELECT public.refresh_public_people_list_cached();
REFRESH MATERIALIZED VIEW published.people_directory_snapshot;
NOTIFY pgrst,'reload schema';
COMMIT;
