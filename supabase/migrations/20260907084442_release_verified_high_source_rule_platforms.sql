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
                ('54cf673e-03be-4b8c-a58c-737121e48d66'::UUID, 'df1c38fd-2041-4c67-8404-ad8f094dc4d7'::UUID, '18e79806-7ea9-478d-b77e-3a7a0e80fdbe'::UUID, 'cec-platform:2022:votetw-candidate-0a4cb139174c41b2'::TEXT, 'd035637e19aad5aff7b505496c448742'::TEXT, 113, 'eab63721318bac0b3b2f0ea2e9c15d20'::TEXT, 'official_bulletin_visual_section_repair'::TEXT, $items$["積極傾聽民意，爭取地方建設。","關懷弱勢團體，協助爭取補助。","推動長照政策，健全樂齡服務。","推動婦幼政策，生產教育補貼。","強化農業政策，改善灌溉溝渠。","保障警消人員值勤安全權益。","監督縣政不分黨派。"]$items$::JSONB),
                ('59c3da7a-1574-4766-aad7-4ed114cc2db7'::UUID, '795997f6-b580-4db1-a266-f476e3433834'::UUID, '4e092b10-376a-4267-bd18-eaafa14ddea4'::UUID, 'cec-platform:2022:votetw-candidate-4d9141b3398fe352'::TEXT, '8d8be8fa9c5fe3ebe5a91fcd9bda013c'::TEXT, 157, 'c374e3358a82fb5700bbc46a9575392e'::TEXT, 'official_bulletin_visual_complete_list_repair'::TEXT, $items$["教育資源需求提升（幼兒～高中職）","醫療量能修正及救災救護效率提升","照護需求智能數位服務化量能升級","爭取親子與社區共讀共融新鎮立圖書館","爭取改善放寬嬰幼童與老人津貼發放條件","現有道路規劃重視與強化學童安全步道","以科技協助治安有效性改善","強化公園綠地環境與安全","弱勢團體協助與輔導","地方經濟產業升級"]$items$::JSONB),
                ('82d849f6-38ee-4101-aac1-ec41b4065ca3'::UUID, '7dda3f82-9377-4ecc-a9aa-74b7397533c4'::UUID, '274223f8-51a3-40f2-9f87-0b7406402e23'::UUID, 'cec-platform:2022:votetw-candidate-ea841953beff2f9d'::TEXT, '24e420c5be4ce438c68df1f39fb7d796'::TEXT, 540, 'e148a8149f1f5d8784cd0f26e2751d85'::TEXT, 'official_bulletin_exclude_explicit_completed_achievements'::TEXT, $items$["建設：監督圖書館及第二座納骨塔興建之施工品質。","建設：持續美化綠化環境成為適宜居住之鄉鎮。","建設：重建行政大樓（已呈報內政部）。","建設：爭取仙吉市場以及烏龍市場改建為多功能的市集暨室內運動場所。","建設：南龍重劃區規劃公有地增設多功能集會暨運動場所，如風雨球場。","建設：協助爭取戶政事務所新園辦事處及新園分駐所之重建。","經濟：積極向縣府爭取已陸續建設中的鹽埔漁港內增設多功能遊具設施及推展新園農漁特產與美食專區，結合花旗木與綠蔭步道為觀光景點，帶動地方的觀光與繁榮。","經濟：配合縣府積極發展新園產業園區，增加就業機會，帶動地方發展。","福利：建構銀髮健身俱樂部。","福利：視鄉政財源補助關懷據點長輩與學校學童營養午餐之費用。","藝文活動：持續推展藝文活動，提升鄉的文化素質，如美展、藝文比賽、音樂會、邀請知名的表演團體及講座。","藝文活動：舉辦各類運動賽事及長者文康聯誼等活動。"]$items$::JSONB),
                ('98d9b65f-0482-4980-b7b8-4d77501fe6f2'::UUID, '7d7d856d-a5de-40ae-800d-07dcb320bf8a'::UUID, '2b5fbaef-abc7-43be-bc66-da5230459af6'::UUID, 'cec-platform:2022:votetw-candidate-ef605dc738f24485'::TEXT, '78db942df7ecd95c5b7b99af0067ab7f'::TEXT, 48, '9ebc04a5f4d7e1af77f5076d9457578d'::TEXT, 'official_bulletin_visual_complete_list_repair'::TEXT, $items$["健全社會福利。","建立農業新典範，發展農業特色。","均衡農工商發展。","改善行政效能。"]$items$::JSONB),
                ('a0d81e50-375f-4c03-84df-bc0a051f6c80'::UUID, 'c9b60512-33d1-47fe-98fa-4cbf90b5964b'::UUID, '1a0445f3-33e3-4116-9d62-4ceeb8972e22'::UUID, 'cec-platform:2022:votetw-candidate-6083ce0ee0258566'::TEXT, 'd15ae4107f6781547757f4a1e93b00a8'::TEXT, 68, '2ce685468481ba2db5a11badb135d805'::TEXT, 'official_bulletin_visual_section_repair'::TEXT, $items$["嚴格監督：縣政府各項政策透明。","嚴格監督：給人民有知的權利。","嚴格監督：配合政府施政建設。","熱情服務：服務縣民。","熱情服務：爭取福利。","熱情服務：為弱勢代言。"]$items$::JSONB),
                ('a2fa74d7-4170-4ae0-ab07-d405c367fb0e'::UUID, '990fcf7b-07bf-4cf3-82bc-27c708161222'::UUID, 'bc61dd6f-2ca2-4353-a554-19e5292ef3b9'::UUID, 'cec-platform:2022:votetw-candidate-7e72849fe2353f7b'::TEXT, '3a77989c219e916ca08b3c81d22a22ec'::TEXT, 27, 'ff8c5cae042096210ab37510bf9b3493'::TEXT, 'official_bulletin_visual_complete_list_repair'::TEXT, $items$["監督市政","監督預算","反應民意","為民服務"]$items$::JSONB),
                ('d2a91c3a-e7d8-4091-b321-009dc211f4ba'::UUID, 'c3b948da-4ce2-4988-a0a7-9a7401943533'::UUID, '52c458c2-f254-4389-8d60-8b2eeed04ce1'::UUID, 'cec-platform:2022:votetw-candidate-bf80f7d1f54a340b'::TEXT, '3f5e8fd6462475c7db7f4bcd4dd74cf2'::TEXT, 20, '41dea6a35847c70dbac6803c0b805d0c'::TEXT, 'official_bulletin_visual_complete_list_repair'::TEXT, $items$["監督縣政","爭取建設","專業服務"]$items$::JSONB)
        ) AS reviews(claim_id, person_id, candidate_id, claim_key, expected_md5, expected_length, expected_source_md5, repair_method, repaired_items)
    LOOP
        UPDATE public.person_claims AS claim
        SET claim_json = pg_catalog.jsonb_set(
                pg_catalog.jsonb_set(
                    pg_catalog.jsonb_set(COALESCE(claim.claim_json, '{}'::JSONB), '{items}', review.repaired_items, TRUE),
                    '{contentSplit}',
                    COALESCE(claim.claim_json -> 'contentSplit', '{}'::JSONB) || pg_catalog.jsonb_build_object(
                        'reviewStatus', 'reviewed',
                        'releaseQuality', pg_catalog.jsonb_build_object(
                            'version', 'verified-platform-high-source-rule-20260907',
                            'reasonCodes', '[]'::JSONB
                        )
                    ),
                    TRUE
                ),
                '{platformQualityAudit}',
                COALESCE(claim.claim_json -> 'platformQualityAudit', '{}'::JSONB) || pg_catalog.jsonb_build_object(
                    'repairVersion', 'verified-platform-high-source-rule-20260907',
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
          AND claim.claim_json #>> '{platformQualityAudit,classification}' = 'requires_source_or_rule_review';

        GET DIAGNOSTICS affected_count = ROW_COUNT;
        IF affected_count <> 1 THEN
            RAISE EXCEPTION 'Expected to release high source/rule claim %, updated %', review.claim_id, affected_count;
        END IF;
        total_affected := total_affected + affected_count;

        IF EXISTS (
            SELECT 1 FROM public.person_claims AS claim
            WHERE claim.id = review.claim_id
              AND (
                  claim.claim_json #>> '{contentSplit,reviewStatus}' <> 'reviewed'
                  OR claim.claim_json #>> '{contentSplit,releaseQuality,version}' <> 'verified-platform-high-source-rule-20260907'
                  OR claim.claim_json #>> '{platformQualityAudit,classification}' <> 'verified_repair'
                  OR claim.claim_json #>> '{platformQualityAudit,repair}' <> review.repair_method
                  OR claim.claim_json -> 'items' IS DISTINCT FROM review.repaired_items
              )
        ) THEN
            RAISE EXCEPTION 'High source/rule platform review failed validation for claim %', review.claim_id;
        END IF;
    END LOOP;

    IF total_affected <> 7 THEN
        RAISE EXCEPTION 'Expected seven verified high source/rule platform reviews, updated %', total_affected;
    END IF;
END
$review$;

COMMIT;
