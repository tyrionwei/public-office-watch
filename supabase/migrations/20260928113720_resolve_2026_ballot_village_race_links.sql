-- 2026 官田區里長選區補正；不改人物、候選人或歷屆選區。
-- 臺南市選委會 2026-08-20 公告，第9頁：東庄里、西庄里各1席。
-- https://web.cec.gov.tw/api/file/02718011-9a4b-4665-b71d-f7790a49a550.pdf
-- 既有行政碼：67000100017 / 67000100018。
-- 水林10009200021僅補前端字形別名，不更新DB：2026官方登記表本來就使用「瓊埔」。
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  PERFORM 1 FROM public.races WHERE id='58f65fad-3dee-4352-91f9-a45c317ee73d' FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.elections WHERE id='6d807b31-ddb1-4ff4-9786-fc1388d298ae')
    OR NOT EXISTS (SELECT 1 FROM public.regions WHERE id='042cf107-62f0-426b-bcdc-44900eb1e6ca' AND slug='tainan-city') THEN
    RAISE EXCEPTION 'Unexpected election or Tainan identity';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.races WHERE id='58f65fad-3dee-4352-91f9-a45c317ee73d'
    AND election_id='6d807b31-ddb1-4ff4-9786-fc1388d298ae' AND race_type='village_chief'
    AND title='臺南市官田區東西庄里里長選舉' AND voting_date='2026-11-28'
    AND region_id='45774a50-3ffa-463c-ab32-97ca0e910577') THEN
    RAISE EXCEPTION 'Old combined race identity changed; review before applying';
  END IF;
  IF EXISTS (SELECT 1 FROM public.candidates WHERE race_id='58f65fad-3dee-4352-91f9-a45c317ee73d') THEN
    RAISE EXCEPTION 'Old combined race has candidates; do not hide or move them automatically';
  END IF;
END $$;

INSERT INTO public.regions (id,name,slug,region_type,parent_region_id,official_code,external_id,is_public)
VALUES
 ('8fc9a72b-baec-4d03-8587-15811cf51551','臺南市官田區東庄里','cec-2026-village-67000100017','village','042cf107-62f0-426b-bcdc-44900eb1e6ca','67000100017','cec-2026-village-67000100017',true),
 ('50317fde-6018-4434-a18b-54e27eed7d78','臺南市官田區西庄里','cec-2026-village-67000100018','village','042cf107-62f0-426b-bcdc-44900eb1e6ca','67000100018','cec-2026-village-67000100018',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.races (id,election_id,region_id,race_type,title,voting_date,status,source_name,source_url,is_public,external_id,district_scope,seat_count)
VALUES
 ('50d51085-f950-4ea6-982b-9166a51f791f','6d807b31-ddb1-4ff4-9786-fc1388d298ae','8fc9a72b-baec-4d03-8587-15811cf51551','village_chief','臺南市官田區東庄里里長選舉','2026-11-28','announced','臺南市選舉委員會2026年里長選舉區公告','https://web.cec.gov.tw/api/file/02718011-9a4b-4665-b71d-f7790a49a550.pdf',true,'cec-2026-village-chief-67000100017','臺南市官田區東庄里',1),
 ('fe21df5e-f078-4658-b850-d43900202afe','6d807b31-ddb1-4ff4-9786-fc1388d298ae','50317fde-6018-4434-a18b-54e27eed7d78','village_chief','臺南市官田區西庄里里長選舉','2026-11-28','announced','臺南市選舉委員會2026年里長選舉區公告','https://web.cec.gov.tw/api/file/02718011-9a4b-4665-b71d-f7790a49a550.pdf',true,'cec-2026-village-chief-67000100018','臺南市官田區西庄里',1)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.races r JOIN public.regions g ON g.id=r.region_id
    WHERE (r.id,r.title,g.id,g.official_code,g.slug) IN (
      ('50d51085-f950-4ea6-982b-9166a51f791f'::uuid,'臺南市官田區東庄里里長選舉','8fc9a72b-baec-4d03-8587-15811cf51551'::uuid,'67000100017','cec-2026-village-67000100017'),
      ('fe21df5e-f078-4658-b850-d43900202afe'::uuid,'臺南市官田區西庄里里長選舉','50317fde-6018-4434-a18b-54e27eed7d78'::uuid,'67000100018','cec-2026-village-67000100018'))
      AND r.election_id='6d807b31-ddb1-4ff4-9786-fc1388d298ae' AND r.race_type='village_chief'
      AND r.voting_date='2026-11-28' AND r.seat_count=1 AND r.is_public AND g.is_public
      AND g.parent_region_id='042cf107-62f0-426b-bcdc-44900eb1e6ca'
      AND r.title=g.name || '里長選舉' AND g.region_type='village'
      AND g.external_id='cec-2026-village-' || g.official_code
      AND r.external_id='cec-2026-village-chief-' || g.official_code
      AND r.status='announced' AND r.district_scope=g.name
      AND r.source_name='臺南市選舉委員會2026年里長選舉區公告'
      AND r.source_url='https://web.cec.gov.tw/api/file/02718011-9a4b-4665-b71d-f7790a49a550.pdf') <> 2 THEN
    RAISE EXCEPTION 'New village race identity collision';
  END IF;
END $$;

-- Preserve the obsolete row and all historical elections; stop exposing only this 2026 combined race.
UPDATE public.races SET is_public=false,updated_at=now()
WHERE id='58f65fad-3dee-4352-91f9-a45c317ee73d' AND is_public;
COMMIT;
