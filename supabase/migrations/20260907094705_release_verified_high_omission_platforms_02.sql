BEGIN;

DO $review$
DECLARE
    review RECORD;
    affected_count INTEGER;
    total_affected INTEGER := 0;
BEGIN
    FOR review IN
        SELECT *
        FROM (
            VALUES
                ('5091ab61-a4d7-489c-bc6a-6cc1b46295f7'::UUID, 'f7ea43ec-7460-4c71-9a3a-ad97b7ecd5cb'::UUID, 'df197a76-ee9e-43d2-8188-b629562d5382'::UUID, 'cec-platform:2022:votetw-candidate-257b7ce94dc27292'::TEXT, '838e2981049ecc18d82f33ab4f846bb8'::TEXT, 408, '2396d8bb560fb107ae788e568d5a2f9f'::TEXT, 'official_bulletin_visual_two_column_reconstruction'::TEXT, $items$["定期報告議會工作成果及助理名單。","爭取地方及中央補助，建設東方美人茶或椪柑為主的觀光產業博物館。","推動在地觀光農場，促進地方青年回鄉就業。","廣設社區長照站及辦理共餐活動。","改善北埔、峨眉往返竹科的交通路段，提升路燈夜間照明設備。","檢視交通事故頻率較高之道路，評估改善道路品質以降低交通事故。","提高社福預算給身障、單親、中低收入戶和貧困弱勢家庭。","爭取老人醫療安養照顧，持續老人假牙補助。","媒合大型醫院的醫療巡迴車定時駐點接送，服務偏遠鄉村。","增加警消設備預算，確保治安及人民生活安全無虞。","關懷勞工朋友之工作環境及工時問題，保障勞工相關權益。","爭取提高新竹縣民平安保險補貼。","增設公立幼兒園、平價托嬰中心、結合社區保母制度。","提高生、養嬰幼兒津貼及老人照護措施和福利，減輕青年成家的經濟負擔。","推行各社區協會發展、客家文化傳承。"]$items$::JSONB),
                ('cc03cdf1-b263-4a07-ba63-c6ed2863c637'::UUID, '27268e9a-f252-4f2d-8443-b4d7eab0cfbc'::UUID, 'd2229293-7ef9-407c-aef4-ee1588edb5b5'::UUID, 'cec-platform:2022:votetw-candidate-540d3f17c656effd'::TEXT, '49191581678c386a587b4c399b8c72f6'::TEXT, 443, '4fe0ebde25981aaad9106feb666fda9d'::TEXT, 'official_bulletin_visual_section_boundary_repair'::TEXT, $items$["監督長照資源妥善運用，長輩晚年安心健康、有尊嚴","爭取設置苗南聯合服務中心、持續協助法律諮詢及陳情，推動縣政治理及服務進步","推動海線人文、藝術生態產業發展及整體計畫，打造進步、永續的深度觀光","監督環境污染稽查、環保犯罪查辦，守護家園環境，民眾日常生活安心","爭取設置苑裡休閒農業區，推動通苑農漁業冷鏈系統","爭取海線鐵路雙軌化，推動通苑公共運輸量能進步"]$items$::JSONB),
                ('ef3620c0-7d3c-4c29-8c55-6f3688123fb5'::UUID, '620b889e-f625-4061-ba93-bf7dda9de6f8'::UUID, '710ec475-7d3f-4f79-bb36-b330dea32b1d'::UUID, 'cec-platform:2022:votetw-candidate-7e3396d73e98841d'::TEXT, '21f001de94966937c4d3cb9060b69c19'::TEXT, 36, '3980f90b019d100c4caaeaad6a78e803'::TEXT, 'official_bulletin_visual_cross_check_no_text_change'::TEXT, NULL::JSONB)
        ) AS reviews(claim_id, person_id, candidate_id, claim_key, expected_md5, expected_length, expected_source_md5, repair_method, repaired_items)
    LOOP
        UPDATE public.person_claims AS claim
        SET claim_json = pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(
                        COALESCE(claim.claim_json, '{}'::JSONB),
                        '{items}',
                        COALESCE(review.repaired_items, claim.claim_json -> 'items'),
                        TRUE
                    ),
                    '{contentSplit}',
                    COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB)
                        || pg_catalog.jsonb_build_object(
                            'reviewStatus', 'reviewed',
                            'releaseQuality', pg_catalog.jsonb_build_object(
                                'version', 'verified-high-omission-platforms-02-20260907',
                                'reasonCodes', '[]'::JSONB
                            )
                        ),
                    TRUE
                ),
                '{platformQualityAudit}',
                COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'repairVersion', 'verified-high-omission-platforms-02-20260907',
                        'repair', review.repair_method,
                        'classification', 'verified_repair'
                    ),
                TRUE
            ),
            updated_at = pg_catalog.now()
        WHERE claim.id = review.claim_id
          AND claim.person_id = review.person_id
          AND claim.candidate_id = review.candidate_id
          AND claim.claim_key = review.claim_key
          AND claim.claim_type = 'platform'
          AND pg_catalog.md5(claim.source_url) = review.expected_source_md5
          AND pg_catalog.md5(claim.claim_value) = review.expected_md5
          AND pg_catalog.length(claim.claim_value) = review.expected_length
          AND claim.claim_json ->> 'platformText' = claim.claim_value
          AND claim.claim_json #>> '{contentSplit,reviewStatus}' = 'needs_review'
          AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'confirmed_content_or_split_issue'
          AND claim.claim_json #>> '{platformQualityAudit,repair}' = 'recovered_missing_item_from_stored_source';

        GET DIAGNOSTICS affected_count = ROW_COUNT;
        IF affected_count <> 1 THEN
            RAISE EXCEPTION 'Expected to release verified high-omission claim %, updated %', review.claim_id, affected_count;
        END IF;
        total_affected := total_affected + affected_count;

        IF EXISTS (
            SELECT 1
            FROM public.person_claims AS claim
            WHERE claim.id = review.claim_id
              AND (
                  claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
                  OR claim.claim_json #>> '{contentSplit,releaseQuality,version}' <> 'verified-high-omission-platforms-02-20260907'
                  OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
                  OR claim.claim_json #>> '{platformQualityAudit,repair}' <> review.repair_method
                  OR (review.repaired_items IS NOT NULL AND claim.claim_json -> 'items' IS DISTINCT FROM review.repaired_items)
              )
        ) THEN
            RAISE EXCEPTION 'Verified high-omission review failed validation for claim %', review.claim_id;
        END IF;
    END LOOP;

    IF total_affected <> 3 THEN
        RAISE EXCEPTION 'Expected three verified high-omission platform reviews, updated %', total_affected;
    END IF;
END
$review$;

COMMIT;
