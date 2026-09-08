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
                ('7d18f839-e0be-450c-b5fc-011cb2a36af6'::UUID, '0d33c1ca-17f5-4ad3-bf5b-832d6eebe3ff'::UUID, 'ef7c9721-212c-4c59-b4c3-f03aaedbb695'::UUID, 'official-profile:taichung-city-council-current-councilors:86987d20656b:0d33c1ca-17f5-4ad3-bf5b-832d6eebe3ff:platform'::TEXT, '2f1b90d071c7bfc3d7771e34398ad21f'::TEXT, 503, 'bed766cc037952644591072fd243ce99'::TEXT, 'official_council_page_section_repair'::TEXT, $items$["青年友善政策：落實居住正義，推動社宅四年8000戶，建立多元空間共享計畫。","青年友善政策：建立青年友善城市，推動成立青年事務局，整合資源孕育青創力。","青年友善政策：支持青年創業，成立青年創業基金，打造優質創業環境。","教育優先尊重文化：強化學校各項硬體設施，打造優質教學環境，提升教學品質。","教育優先尊重文化：實踐學校特色教學，創造學童多元學習環境。","教育優先尊重文化：推動國際、校際交流活動，開創學童視野與國際觀。","教育優先尊重文化：落實古蹟空間再利用，連結歷史及文化資產區域，再現土地與人民的歷史。","教育優先尊重文化：推動文化資產導覽系統，達成文化資產推廣及教育的功能。","重視環保與生態：因應環境氣候變遷，推動減塑政策。","重視環保與生態：持續要求減碳，嚴查空污，保護地球生存環境。","重視環保與生態：重視水土保持，推動成立國家自然公園。","推動建設繁榮經濟：推動在地特色大型共融公園，打造具有多元刺激、互動、有趣且舒適的遊戲環境。","推動建設繁榮經濟：海線雙捷運，捷運藍線四年內動工，捷運橘線通過可行性評估。","推動建設繁榮經濟：以輕軌連結海線沿途觀光景點，串連台中三井outlet、高美濕地、梧棲觀光漁港等景點，創造觀光產值。","開創優質政治：清廉參選、重視民意，積極服務。","開創優質政治：拒絕貪汙、利益勾結。"]$items$::JSONB),
                ('00679afa-4cc7-42ac-9404-9fe38c15b9f8'::UUID, 'd2d3c2cb-c307-40e1-a7c9-c4c39617810d'::UUID, '4ec9a23c-331c-4326-a79b-f21c36397bd6'::UUID, 'official-profile:hsinchu-city-council-current-councilors:2152917a766a:d2d3c2cb-c307-40e1-a7c9-c4c39617810d:platform'::TEXT, 'ecb5a91a765e5b0c2b417a41526a0388'::TEXT, 816, '6d97712f06b25532f95ed4db538d17ac'::TEXT, 'official_council_page_section_and_footer_repair'::TEXT, $items$["觀光要盈：規劃市集推廣在地農產品：海山漁港規劃販賣區外設置假日市集、原住民特色市集。","觀光要盈：優化海山漁港自行車道：強化導覽功能與旅遊深度。","觀光要盈：海山漁港週邊導入藝術展演空間：提升在地觀光量能與就業機會。","香民要盈：婚後孕前健康檢查補助，創造更友善父母的環境。","香民要盈：好孕專車加強2.0版：孕期補助產檢外，更延伸到產後帶寶寶回診的健兒門診。","香民要盈：爭取大湖里市民活動中心：設置關懷據點、共餐食堂，照顧長輩。","香民要盈：香山建設預算倍增：香山區面積超過本市一半，力推香山區公所工程預算倍增，有效提升鄉親生活品質。","交通要盈：運輸載具官方媒合平臺：導入預約服務，將社區關懷據點結合幸福小黃，建立更有彈性與安全的公共運輸。","交通要盈：Youbike新設站點：鹽水圖書館、內湖國小周邊增設新站點，將站點延伸至內湖國中、中隘、南隘等，讓Youbike發揮在地通勤、山海串聯的觀光移動功能。","交通要盈：友善車友：中華路沿線（特別是五段至六段）規畫自行車道及導覽說明。","交通要盈：高使用率人行步道優先重新舖設：例如：中華路沿線、香山國小至公道三間，以及中華路進入元培街之人行步道等學校、商圈周邊。","教育要盈：落實科技教育：香山區中小學建立完整科技教育課程與教學推動計畫，包含程式設計與運算思維等，培養學生學習興趣。","教育要盈：設置通勤專車：面臨公車減班次及路線，設置通勤專車保障學生通勤便利。","教育要盈：續推華德福教育：目前已招收幼兒園與國中小，其校舍將於今年完竣啟用，後續規劃高中部設置。","教育要盈：完成富禮國中射箭館：全力協助學校，盡快完成富禮國中射箭館。","教育要盈：規劃香山體育園區、香山圖書館：推動都市計畫檢討，規劃設置體育或文教設施，如香山體育園區、香山圖書館等。","教育要盈：培育射箭人才：推廣射箭運勤，增聘射箭教練、國中、小學扎根培育射箭人才。"]$items$::JSONB),
                ('884d41e3-68e1-4ae2-9faa-549f1994426f'::UUID, '35118713-e1d7-4b70-85d6-8edfa094aa47'::UUID, '521c5920-f5c9-46e8-b055-6c47fc356c8a'::UUID, 'official-profile:tainan-city-council-current-councilors:aff972cb12c1:35118713-e1d7-4b70-85d6-8edfa094aa47:platform'::TEXT, 'c9eeac6d9d0a70d25e31bd21e471a932'::TEXT, 366, '5241fce956e4f5ac65773627320a94e6'::TEXT, 'official_council_page_cross_checked_no_text_change'::TEXT, NULL::JSONB),
                ('d5435035-0f80-4952-9816-b7aede1eefee'::UUID, 'fe9e8dfe-eb13-48da-8797-fbdfc4504172'::UUID, 'a27ecf7e-8b97-41bd-8c07-1b0cea9dcd6f'::UUID, 'cec-platform:2022:votetw-candidate-647d01b42270fcd2'::TEXT, '528e69cf13422093ae41cab7437ea205'::TEXT, 127, 'ff8c5cae042096210ab37510bf9b3493'::TEXT, 'official_bulletin_visual_cross_check_no_text_change'::TEXT, NULL::JSONB),
                ('938b21a3-ff01-4edb-9d42-731507e17691'::UUID, 'e794fd0c-d492-4ded-bea8-393c5a87ec3e'::UUID, 'b9b8b1c4-da30-43f4-9be6-8eb3cefe422c'::UUID, 'cec-platform:2022:votetw-candidate-0dfc67a57b00cf9a'::TEXT, 'a4a62849956ac12dea7a4a77168209b1'::TEXT, 602, '06b543c370e814825b2c4b8f536bc949'::TEXT, 'official_bulletin_visual_cross_check_no_text_change'::TEXT, NULL::JSONB),
                ('9644c26a-ddd5-4cc4-98ca-6ad1d2ae7969'::UUID, '80082cee-85ef-40a3-bb95-0e427771edbd'::UUID, '80e29c35-168f-4a70-97f1-15557bb06491'::UUID, 'cec-platform:2022:votetw-candidate-16668e746656a0aa'::TEXT, '027e1ef959256d8ff58dc6edb9005b3f'::TEXT, 256, 'df1f0b76891dd385731b486cf402e128'::TEXT, 'official_bulletin_visual_cross_check_no_text_change'::TEXT, NULL::JSONB),
                ('72c762be-1e05-4ff9-9b66-f492d5f4befb'::UUID, '1f5373e1-707c-41a1-8f5b-4712a9e371ab'::UUID, 'f4b35f5a-d695-4fb6-ac1f-b1404daf718a'::UUID, 'cec-platform:2024:votetw-candidate-ace2593e330616df'::TEXT, 'b8eb51a70ca007ab2af503bf83632486'::TEXT, 247, '0bafdac51732855b2aaed3a6f0403409'::TEXT, 'official_bulletin_visual_cross_check_no_text_change'::TEXT, NULL::JSONB)
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
                                'version', 'verified-high-omission-platforms-01-20260907',
                                'reasonCodes', '[]'::JSONB
                            )
                        ),
                    TRUE
                ),
                '{platformQualityAudit}',
                COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB)
                    || pg_catalog.jsonb_build_object(
                        'repairVersion', 'verified-high-omission-platforms-01-20260907',
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
                  OR claim.claim_json #>> '{contentSplit,releaseQuality,version}' <> 'verified-high-omission-platforms-01-20260907'
                  OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
                  OR claim.claim_json #>> '{platformQualityAudit,repair}' <> review.repair_method
                  OR (review.repaired_items IS NOT NULL AND claim.claim_json -> 'items' IS DISTINCT FROM review.repaired_items)
              )
        ) THEN
            RAISE EXCEPTION 'Verified high-omission review failed validation for claim %', review.claim_id;
        END IF;
    END LOOP;

    IF total_affected <> 7 THEN
        RAISE EXCEPTION 'Expected seven verified high-omission platform reviews, updated %', total_affected;
    END IF;
END
$review$;

COMMIT;
