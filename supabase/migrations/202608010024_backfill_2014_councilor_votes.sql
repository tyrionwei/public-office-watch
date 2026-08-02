SET statement_timeout = 0;

-- Generated existing-person historical CEC candidate migration.

CREATE TEMP TABLE _historical_cec_existing_candidate_input_20260730 (
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update')),
    source_person_id UUID PRIMARY KEY,
    source_person_key TEXT NOT NULL UNIQUE,
    person_id UUID NOT NULL,
    race_id UUID NOT NULL,
    candidate_id UUID,
    candidate_external_id TEXT,
    original_is_public BOOLEAN,
    party TEXT,
    candidate_no TEXT,
    vote_count INT,
    vote_rate NUMERIC,
    is_elected BOOLEAN,
    candidacy_status TEXT,
    election_result TEXT,
    registration_status TEXT,
    election_year INT NOT NULL,
    race_context_key TEXT NOT NULL,
    set_party BOOLEAN NOT NULL,
    set_candidate_no BOOLEAN NOT NULL,
    set_vote_count BOOLEAN NOT NULL,
    set_vote_rate BOOLEAN NOT NULL,
    set_is_elected BOOLEAN NOT NULL,
    set_candidacy_status BOOLEAN NOT NULL,
    set_election_result BOOLEAN NOT NULL,
    set_registration_status BOOLEAN NOT NULL,
    CHECK (
      (operation = 'create' AND candidate_id IS NULL AND candidate_external_id IS NOT NULL
       AND original_is_public IS NULL AND is_elected IS NOT NULL
       AND candidacy_status IS NOT NULL AND election_result IS NOT NULL AND registration_status IS NOT NULL)
      OR
      (operation = 'update' AND candidate_id IS NOT NULL AND original_is_public IS NOT NULL)
    )
);

INSERT INTO _historical_cec_existing_candidate_input_20260730 (
    operation, source_person_id, source_person_key, person_id, race_id,
    candidate_id, candidate_external_id, original_is_public, party, candidate_no,
    vote_count, vote_rate, is_elected, candidacy_status, election_result,
    registration_status, election_year, race_context_key,
    set_party, set_candidate_no, set_vote_count, set_vote_rate,
    set_is_elected, set_candidacy_status, set_election_result, set_registration_status
) VALUES
    ('update', '00917fcb-6ffc-449e-ae7e-75d37593bab5', 'cec-historical:f4807d1c63ec', '14955918-e5cc-4b2e-9c9e-991a4bedfd71', '777765ee-a9b8-439b-929f-dbe0fea3abb0', 'da29eaa9-3b8f-413a-817a-71db0e7d28bc', 'cec-historical-candidate-c0033e9349eb5e66', TRUE, '無黨籍', '4', 617, 34.31, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '01fe12e6-1655-447a-a166-eb7cd0560772', 'cec-historical:5daf4ed237c6', '69dcf51d-3ccc-b9e6-614d-51fda0a41bc6', '4d32c2db-46bc-42af-8706-6e68f302a736', '2d29953d-3cfb-46ce-aa0d-b532d888b35a', 'cec-historical-candidate-9baaf027b9b945ca', TRUE, '民主進步黨', '1', 1303, 24.56, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|新北市|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '034d3686-9f10-4c84-8b1d-82907d6d3a58', 'cec-historical:ff378603dcbe', '5874d779-8e03-480e-982f-eb30249f0a85', '999ed2bc-0d34-4256-822c-fdee58fd5ff0', '4374110e-19c1-46a0-b2ba-9254889bbcb9', 'cec-historical-candidate-5d72df2fb03c1608', TRUE, '台灣第一民族黨', '3', 3643, 47.55, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '04864131-0109-49fb-b4ce-4c2a08be4ce5', 'cec-historical:a4808d6f99af', 'fe0d3a93-a95c-40c4-bd45-02e01830545d', '0517007c-1f7d-4c85-a4de-c130ba30d16b', 'c68b8c94-795e-40cf-ba34-c2d32b544564', 'cec-historical-candidate-a76153fa75c7303f', TRUE, '中國國民黨', '3', 1280, 35.66, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|花蓮縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '08e4f1da-37a4-4000-be85-7f5e0c12d656', 'cec-historical:d72fcb49a7cd', 'c90904a1-808b-4ac2-83ad-abc88d0228bf', '21b804bf-c05d-4be0-a6eb-0c892e85e9ec', 'b657a0ce-e3cd-4074-b40d-5070421e4929', 'cec-historical-candidate-5500762046bc7920', TRUE, '無黨籍', '2', 1073, 29.89, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|花蓮縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '0b25f468-3848-4811-9af0-27b70c0da71d', 'cec-historical:624c3909b61b', '74184be8-ea85-4bc3-b4c0-17140eb1a8dc', '031ac058-35e2-419c-9ff3-f840209f4ce3', '7744105c-a87b-4305-882d-a9dd9766213b', 'cec-historical-candidate-4241144213204a44', TRUE, '中國國民黨', '7', 2159, 17.73, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|桃園市|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '0ccb8012-fc09-4369-a55e-20c5044dc64f', 'cec-historical:9dfcc6e02da1', '0f44c475-2990-4453-a2c0-0a985cfa97d9', '35054462-7b85-42ed-a6e3-583c4290bea8', '308a56f5-7c2b-433d-8878-add1c20144fb', 'cec-historical-candidate-b0cdbd070a804606', TRUE, '民主進步黨', '3', 779, 21.07, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|新竹縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '0fd445d4-99b9-4a6a-9d74-e4243cb5d1a6', 'cec-historical:7aa8465c7884', '9668a7ab-718e-4322-b041-bf2d0b02ca20', 'c0242b12-361d-4f3e-a0ee-0ef2d6eda645', 'b06dafae-4372-4d71-b4b5-b16750273b1f', 'cec-historical-candidate-26de4a4027c98a78', TRUE, '無黨籍', '1', 1381, 22.85, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|花蓮縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '106435c6-8a32-4df1-b66b-b884456e3366', 'cec-historical:b9f015fe7ba7', 'e229abe1-130a-8828-e0ea-b8248b3ca243', '30b12af4-5f25-4d37-b2a1-6702fb635632', 'd9ee126e-fec5-4b8f-afd5-afb1107967c3', 'cec-historical-candidate-859e309e29c39f5a', TRUE, '無黨籍', '5', 916, 15.16, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '1179c020-c4d8-4458-ae5b-d5c0374ddcbd', 'cec-historical:97da54a9cf6c', 'eae59dfa-2337-4682-9b73-5425c0f6f2d7', 'ff3a393e-4cbf-4ca4-b1c7-6701266ec187', '6ffd436b-5c0b-467e-b16b-c5557e126e1d', 'cec-historical-candidate-f2c3cbea25936116', TRUE, '無黨籍', '1', 183, 20.49, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|新竹縣|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '11b62e57-496a-4d67-bcaf-0141a264445a', 'cec-historical:3508c5ed9a8e', '03f66137-332d-4340-8165-52fb0cb16873', 'fc4169ca-4d7e-4028-b9b3-48b30a64e830', '656d6967-86f6-4706-a30e-962db304947b', 'cec-historical-candidate-d0f60d6655d10f84', TRUE, '中國國民黨', '1', 1381, 22.85, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '13edf036-f09b-4623-b5c9-e24c92527d66', 'cec-historical:170a369d3b3b', '34129b39-8e0e-4582-b430-8711c711639f', 'c18cbf79-1b87-4309-8373-2f78cd481dc2', 'fd0988a4-96b6-4b19-ad5a-af7072526614', 'cec-historical-candidate-c3b4ec2901de8758', TRUE, '台灣第一民族黨', '4', 200, 25.9, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|南投縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '16c214fb-eb0c-4bea-a8d9-da84c5bbdbd2', 'cec-historical:a2c36848597b', 'ea0d5c7a-1fc6-4e2f-84f7-6ec7b4743d9d', 'aed194a6-1227-4ec2-b54d-329039f93325', '2197ed72-d92e-4832-85c8-9a47e109cfbb', 'cec-historical-candidate-68f70153efd566ed', TRUE, '無黨籍', '2', 1184, 46.32, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|屏東縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '19b2e985-155a-49e1-b326-2f65d6c8a19d', 'cec-historical:1c648659e6a9', '2bde9b8f-6092-450d-93f0-bf6e9e108f4e', 'dd5963d1-8243-4aeb-b498-66940ccf8033', 'faec2629-c1f4-45af-9fa1-9a02c07b5305', 'cec-historical-candidate-1d3ab861e3377fc5', TRUE, '中國國民黨', '2', 3884, 46.14, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|南投縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1a051d59-d2cc-4532-af96-b236b944ab46', 'cec-historical:8b0ac455fadc', 'c79f219f-6909-65d7-92c5-f2a01355cb34', '8e7a5c46-de5f-4a0c-b3a6-7cd081cbcd7b', '69da7e8d-87f7-4a44-81f5-3ef120cc60dc', 'cec-historical-candidate-903784c4bd947b46', TRUE, '中國國民黨', '1', 1372, 53.67, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|屏東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1a21002a-0a43-4221-a847-148c075b0f65', 'cec-historical:15c66246412c', '969c6e3f-178b-4d2b-9081-7271f3e451f4', 'c18cbf79-1b87-4309-8373-2f78cd481dc2', '48270d14-6803-4204-b334-29a4c713fefc', 'cec-historical-candidate-8a6992b72dfbdfbe', TRUE, '中華統一促進黨', '3', 23, 2.97, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|南投縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1a3af6fa-5afa-4794-8fab-421906435ea1', 'cec-historical:229a571404a3', 'd78a7da6-179e-4ae1-b122-5fc0ff9c1482', '0fd95fd7-1f8d-44ea-946f-e214510830e5', 'c960524b-3e19-4d2a-88fe-7a0d0ee0f61c', 'cec-historical-candidate-7ccec89d935c51b5', TRUE, '無黨籍', '1', 1372, 53.67, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|屏東縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1f055202-c783-4e9f-9390-4f06eb4b0695', 'cec-historical:6ab8dbd22542', 'a0fe3431-5983-a86b-e4cc-ba3d26bd390c', '8e9a18e0-6bdf-454e-8287-7231a7730329', 'a3951d0d-2e53-4910-ae74-4fdc03f7c7c2', 'cec-historical-candidate-7b9efb06a5ac01ac', TRUE, '中國國民黨', '2', 1184, 46.32, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|屏東縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '200976ed-0bb8-4e6a-8d8f-cb6da6db2d3e', 'cec-historical:529e78d6db52', '4f5d675f-5685-f327-9535-936a5a2f3f5b', '777765ee-a9b8-439b-929f-dbe0fea3abb0', '5f42d371-e11a-4f7a-92ba-b3c0f0061ed5', 'cec-historical-candidate-7b20decd1a934ff4', TRUE, '中國國民黨', '3', 384, 21.35, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '218f1c49-e12e-41be-93f3-2af6a3a1b24e', 'cec-historical:022790b068b7', '8f42e04f-0587-42e3-84e4-5a3348f20970', 'a7afe489-c8cc-473c-8fb1-eeaaa206bf2f', '851ba2ff-7443-4a9c-9689-146c9d147545', 'cec-historical-candidate-d91784c8fc8bcdd9', TRUE, '中國國民黨', '1', 509, 28.3, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺東縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '239b74a6-b653-4ba0-b7ff-97ce96bb28b1', 'cec-historical:3e978b2df223', '1124d201-b42f-2346-9889-05704e5f3576', 'fc4169ca-4d7e-4028-b9b3-48b30a64e830', 'e54d80b8-a055-4fac-a443-f28c9e1d9fd1', 'cec-historical-candidate-640409a58e3703e7', TRUE, '無黨籍', '2', 1571, 26, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '26d9789a-28fd-4a9e-b8e8-fedc7958775c', 'cec-historical:d092c3b321e5', 'f83d9c4e-769e-4040-8cc2-e77241f8b843', '0fd95fd7-1f8d-44ea-946f-e214510830e5', '418f8cc6-60ea-4d38-9c63-1fe8fcae326d', 'cec-historical-candidate-50eb6d80d1fe7674', TRUE, '中國國民黨', '2', 1184, 46.32, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|屏東縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2857cf9c-240e-48fb-bec4-9f980ba6159e', 'cec-historical:54b8a40a27c0', '61979ec4-b837-4a82-abf9-df29df38a6eb', 'b8373af6-55c6-4494-87a5-d712b31199cf', 'c3ec9492-bf5f-4815-b737-3b11d13d8138', 'cec-historical-candidate-c53a07089584e542', TRUE, '親民黨', '6', 1457, 32.32, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺中市|district-15|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '28deebf7-7fa8-464b-b5a2-68e2778535f9', 'cec-historical:fb654d541162', 'dbf675c3-560d-6226-8688-ff5006a5633d', 'a7afe489-c8cc-473c-8fb1-eeaaa206bf2f', '6c9fb489-b864-4744-8d06-cb5886047d8b', 'cec-historical-candidate-8639004641be62a0', TRUE, '無黨籍', '3', 384, 21.35, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺東縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '290abb82-538e-4996-8518-482f587fffa9', 'cec-historical:50ac2c63d865', 'de0c0000-7208-4d01-b0a9-1b9f3674ab7c', 'e9920b51-196b-4fcd-9b95-354c5f6ed231', '593c04e9-3529-4ca4-9ea8-7d54d1aa3a81', 'cec-historical-candidate-67c904b522963c28', TRUE, '中國國民黨', '1', 1608, 49.73, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|高雄市|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2c9f5579-12d4-4164-8942-6a285efe31e6', 'cec-historical:c4f23b3c6940', '6608dbe6-07e7-4e27-8af0-3286dfbf7aab', '0517007c-1f7d-4c85-a4de-c130ba30d16b', '2feafb2c-dbb2-4275-8241-a03c360feefd', 'cec-historical-candidate-4eade2acefa64506', TRUE, '中國國民黨', '2', 1073, 29.89, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|花蓮縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2cd46717-d4b5-40cf-ab26-ca8f238f4659', 'cec-historical:a4e300c73d5c', '2a5eaaa5-418b-42d3-a22e-75a1e18ed296', 'ccd15c0f-8cd6-4b57-84a4-23136b4f04bd', '36f415bb-5eab-42df-ab5b-f60b015308e0', 'cec-historical-candidate-a69b4f6bc2713232', TRUE, '親民黨', '2', 121, 4.73, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺北市|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2f6a53d2-b5d3-4670-bf1b-1df9f334f7c9', 'cec-historical:60aa30a8a587', '8bba49d9-0af1-1744-d5d5-6b94c3cb6eba', 'b8373af6-55c6-4494-87a5-d712b31199cf', '923f3591-efd8-4117-905c-8b32dd872e1a', 'cec-historical-candidate-4367fbee2447abe9', TRUE, '無黨籍', '4', 272, 6.03, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺中市|district-15|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '314d7779-bf43-4447-baeb-9a919e9f133a', 'cec-historical:e5fbb5fec2f4', '6c60e008-6459-af01-a8dd-c04333ae4108', 'fba6b852-2e2d-4018-8293-910a62898a64', '1f793515-d991-488c-bc6f-dc385e035c53', 'cec-historical-candidate-248d1325956284b6', TRUE, '無黨籍', '1', 1608, 49.73, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|高雄市|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '31b9ae75-45c1-4f4c-b2a1-0b277ff08c58', 'cec-historical:77fb594e8bee', '718dc798-d659-44a6-b794-1e1466a376bf', '21d967d6-edc9-4296-8db8-02b6d9a15d83', '608b84f1-ae24-4e7d-8289-f1af45224ed9', 'cec-historical-candidate-59a7c7b73885c090', TRUE, '無黨籍', '2', 1184, 46.32, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|屏東縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '325d7b45-4353-4b0b-9ef8-3253316b71dd', 'cec-historical:b5be6b01784b', 'a63fdd15-dc3d-4f92-ab70-8f58d1a20b5e', 'fb4548ec-6a6e-48d1-b233-95d669e31611', '1516ba0d-6e67-4c2e-a3d1-691934438a84', 'cec-historical-candidate-e05116a349bbf0a3', TRUE, '無黨籍', '1', 2951, 41.82, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺中市|district-16|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3476d661-da76-4376-8e5f-7d1d2c32f319', 'cec-historical:a1908beb7267', 'eae779d2-a218-5b80-feac-4982256f277f', '3ab1c86b-6ff4-48de-89c9-718120111bb1', '6c991a38-7052-4b9d-a690-49719d805608', 'cec-historical-candidate-1f0dcb5cab10ee3a', TRUE, '無黨籍', '1', 1372, 53.67, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|屏東縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3b34ac29-4fbb-4048-901c-5b1bc0257687', 'cec-historical:a7648405a8f4', 'ba1f6eba-e719-4141-b706-91f782fa1cd2', '7fe5c5a8-0702-4a45-88b6-7ff5ea610acd', '26fc79d8-f648-48ae-8703-09fd89841eee', 'cec-historical-candidate-d0d380273e39fcda', TRUE, '中國國民黨', '6', 1656, 13.62, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3b35ef64-21f4-4092-98a4-d9944aaab66e', 'cec-historical:0b827d99cc03', '75eae506-a75f-4bda-8aca-35568dbacd86', 'b4428b85-e848-4044-9d81-d7c2724a68e8', '5eae6b52-64d6-4348-8d5c-457561b7d29f', 'cec-historical-candidate-cac10b860b498b82', TRUE, '無黨籍', '1', 1886, 18.11, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|桃園市|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3d025c05-ce66-4f36-9ffc-8876b437eed6', 'cec-historical:d953629d1c61', '9c7f5ebd-dd70-e476-0d8f-17f252de211e', '13a4334e-dcaf-4085-b7f5-4e2e56160a30', 'aa38d523-4c2a-4346-a09c-548060e17278', 'cec-historical-candidate-d67f324947edcd76', TRUE, '中國國民黨', '2', 1067, 33.03, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|基隆市|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3dae4f3e-fbf7-4fed-93f2-ddb4e7b33f31', 'cec-historical:266d32c9df66', '4cf28ef7-e745-4523-bfa7-ef14f02a9734', 'b8373af6-55c6-4494-87a5-d712b31199cf', 'd3fc13a2-4f7d-41af-9abe-908c91190e6c', 'cec-historical-candidate-0eb819ff99eedef3', TRUE, '中國國民黨', '2', 1050, 23.29, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺中市|district-15|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3e1c6784-c6a2-4f27-9ac7-58e5e89d50bb', 'cec-historical:dd5ec723e372', '67357da7-6677-4ab0-876b-104b74fafc78', '30b12af4-5f25-4d37-b2a1-6702fb635632', '824fcd0f-a8d1-44e5-aaee-ac17c4248c40', 'cec-historical-candidate-b1121cf8cb273dc8', TRUE, '中國國民黨', '4', 1660, 27.47, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '3e614f49-c872-4f6a-b63b-2804f2df3c52', 'cec-historical:5f7600b541c0', '6033dad8-2d58-af66-3ba2-3eb42bfe243b', '69aea440-a0c8-449c-9b74-68ece46519b1', '89828efe-3666-48d8-ae14-9101d1c19b4d', 'cec-historical-candidate-e3a4e94f6e6dad3b', TRUE, '台灣第一民族黨', '2', 288, 16.01, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺東縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3e90bef7-e878-4cf3-9f1f-ee5dfab3614c', 'cec-historical:acf55a688fbc', '0dd443d1-4322-4f76-9e64-6337d8271c94', '21b804bf-c05d-4be0-a6eb-0c892e85e9ec', '63d4ce0a-777c-4baa-8e7b-9d3fa4c68899', 'cec-historical-candidate-bf5012617aec65fa', TRUE, '無黨籍', '3', 1280, 35.66, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|花蓮縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '4197e5ad-27b9-48b6-9bae-1144f0c8f2c8', 'cec-historical:5ccc4ce57a95', '6a3c16c2-4c4d-46e9-9002-256ca317463f', '0517007c-1f7d-4c85-a4de-c130ba30d16b', '36a1dc56-0db9-418d-9ea8-8bcefa107e6e', 'cec-historical-candidate-6db82ddd9be0d920', TRUE, '中國國民黨', '1', 209, 5.82, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|花蓮縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '454898a4-7098-4b92-b684-fa65b85f3ec4', 'cec-historical:492c8d69c2cf', '03ca5328-bba4-4bda-a3da-fa9bf16db991', '999ed2bc-0d34-4256-822c-fdee58fd5ff0', 'e17a1459-8601-442e-8c54-0f1a770ad534', 'cec-historical-candidate-40bffe3ffda0dd1f', TRUE, '台灣團結聯盟', '6', 832, 10, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '46c579d7-c94c-4dcf-8be9-4331f03b31ec', 'cec-historical:8feeda9d06a0', '0b2ed37d-e60c-447e-91ad-41eb7392442b', '7fe5c5a8-0702-4a45-88b6-7ff5ea610acd', '1ee786b4-fe62-498c-91c5-586dab8dce5b', 'cec-historical-candidate-8fb432549a802028', TRUE, '中國國民黨', '5', 1358, 11.16, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '47334793-601a-4151-a4d7-b829b5c7a0fa', 'cec-historical:53936a55a706', '78bd3c8c-5e3e-4be4-916c-fb6331bbf2d4', '06780b4c-e6b0-42ec-93f2-c80aa135a81d', '7a76b284-93be-47ba-8a96-ee4362fb8180', 'cec-historical-candidate-6a71978962fca4fd', TRUE, '中國國民黨', '2', 279, 22.83, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺南市|district-17|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '484e700e-bef6-4e21-b93e-48d90d93b7b7', 'cec-historical:d84773c07b9b', 'f5e857d7-cbc3-4f85-9875-9074ec3958be', '031ac058-35e2-419c-9ff3-f840209f4ce3', 'f92e1e06-e473-4261-b26f-1c418a4d3d6f', 'cec-historical-candidate-0164b97fff1bdded', TRUE, '無黨籍', '5', 533, 4.37, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|桃園市|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '485088af-eaee-406b-a592-cf72b5b83fac', 'cec-historical:2a706e722b45', '6dcdc191-ba49-4684-848c-543b138a2fd0', 'e9920b51-196b-4fcd-9b95-354c5f6ed231', '58e2f74a-67a3-4d22-abb5-581e663a7a01', 'cec-historical-candidate-5fac396a8f725752', TRUE, '無黨籍', '2', 1625, 50.26, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|高雄市|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4a38d6dd-a759-4319-8503-3a13c4ce4b56', 'cec-historical:c81b924fedc2', '9b13cf4a-6828-40c4-bb74-d4f932274820', '7c4a10f6-30dc-495e-97d6-dfb45966a940', '42a0137f-7d0c-4965-8f03-04ed67355d79', 'cec-historical-candidate-1f7b1091bacb7e06', TRUE, '中國國民黨', '1', 4018, 52.44, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺東縣|district-10|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4a7ee814-1e0d-4625-b376-456272bcd0c3', 'cec-historical:95361399dccd', '1f332863-a14a-4dcc-9cc6-67aacab2b39a', '9726da83-cede-4ce7-b5ef-c5c91f3c512e', 'a81eb81a-57d8-4e39-8bf1-c30eb12f3982', 'cec-historical-candidate-1c6900186edd80ee', TRUE, '中國國民黨', '2', 2937, 79.57, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺北市|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4b5c92c2-e298-491c-8518-7cf9ef3d33ea', 'cec-historical:da2711e47977', '64595adb-36f5-4765-bd89-056e2b5d32d6', 'e8341872-9a6e-46f0-9fc4-5be52e525f56', 'bb849b22-edff-46ba-874f-0df6c7a6ec02', 'cec-historical-candidate-c0bbd3a85ee30531', TRUE, '無黨籍', '3', 953, 36.12, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|嘉義縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4c4b4ff1-f9e1-4743-883b-71c24b1500b7', 'cec-historical:b23da4ae08fe', '4411c235-0ef7-9be3-7e7f-1e964a85edda', 'c60f3510-383e-4c67-a31d-098cac5c8591', '6c378d76-37a7-4509-b069-a97570314f0b', 'cec-historical-candidate-cb7ce3f15487b056', TRUE, '中國國民黨', '1', 509, 28.3, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺東縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '4c99bc7b-8f28-4de2-8d62-65351583c28a', 'cec-historical:e43cce8860db', '883176d1-c103-4803-820e-df11558de13e', '999ed2bc-0d34-4256-822c-fdee58fd5ff0', '72ef1520-4e67-40e0-a2f9-5df2f8655b1c', 'cec-historical-candidate-57c307fd5ff4d8d2', TRUE, '中國國民黨', '2', 2661, 33.91, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4d1497d4-ebe8-4ad2-9a83-f534ee18fe97', 'cec-historical:2c8fb15a20f9', 'a2f52d96-4367-4c8c-a160-8e599131a791', 'b8373af6-55c6-4494-87a5-d712b31199cf', 'cecab0f2-5efb-4ba1-8f64-aa1f686115bc', 'cec-historical-candidate-1db759e0c0c4f594', TRUE, '無黨籍', '3', 216, 4.79, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺中市|district-15|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4ef4a925-ed0d-411a-9025-13ad61f09e32', 'cec-historical:d7fb54f78e87', 'c8c51937-8496-d62d-77b2-5062971ebe93', '35054462-7b85-42ed-a6e3-583c4290bea8', '94446497-e7cb-4fb8-8e6f-b5e57dd2f19a', 'cec-historical-candidate-6b70f830377490bd', TRUE, '中國國民黨', '1', 1478, 39.97, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|新竹縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4fb41589-d3dd-49e5-9301-c9481d8dcdf2', 'cec-historical:1e4dbed69cf1', 'b1c79e9f-a6ec-4cf4-9015-89f51b724909', '999ed2bc-0d34-4256-822c-fdee58fd5ff0', '1a21f25a-bfb2-482c-b319-8dd444564d60', 'cec-historical-candidate-4f3e392d539914f3', TRUE, '中國國民黨', '1', 4018, 52.44, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '50311df0-ceae-4deb-99f8-38f1394b4389', 'cec-historical:464c13282180', 'ab54d7c1-605f-4b1f-a36b-dedd93a1ad63', '031ac058-35e2-419c-9ff3-f840209f4ce3', 'b07222e4-2261-44b0-aff0-b16b379cadda', 'cec-historical-candidate-43bb47963b326ae3', TRUE, '中國國民黨', '2', 1589, 13.05, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|桃園市|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '545ff9df-7d62-4546-a784-54939837a1f7', 'cec-historical:17aa4bb2e0e0', 'a9a8aaa9-6d44-449e-aad6-e340dbfadd84', '30b12af4-5f25-4d37-b2a1-6702fb635632', 'fad1a67e-6577-4706-8c28-b71483a12572', 'cec-historical-candidate-4e4dbd87762d5653', TRUE, '中國國民黨', '2', 1571, 26, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '55d9ee50-f470-475c-8a25-4f6b1819b400', 'cec-historical:d120407dcbfc', '25d67cd0-ede5-423d-9287-4671ff289ded', 'f3b90a27-bb14-48ec-bc86-3f16b664cb6c', '975ad777-65ba-4f93-ba58-e9a08e419f10', 'cec-historical-candidate-1d2f1f57947f88be', TRUE, '中國國民黨', '4', 1996, 40.37, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|新竹縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '56699449-7c95-4326-ad95-1c278172d8ad', 'cec-historical:24c91f0869ad', '758de43d-8a28-4047-a22f-d59c9545441c', '4216580a-32e2-4703-8e5d-ea2484247bb9', 'daef6604-e6b9-40fd-941c-0c83f1fb66be', 'cec-historical-candidate-d95c969e64c4ffd1', TRUE, '中國國民黨', '2', 1732, 40.07, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|高雄市|district-12|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '5fb78ec1-d837-4aa0-a167-e4551e4bd563', 'cec-historical:da0fbe4a3b9d', 'd40a2c14-20b7-490b-aa5c-4acba7038940', 'f3b90a27-bb14-48ec-bc86-3f16b664cb6c', '2c09c6f1-3cf1-4444-b03e-22d3b442e3c3', 'cec-historical-candidate-a58e470eb6b6ae98', TRUE, '中國國民黨', '1', 1478, 39.97, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|新竹縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '619279f2-3249-4082-bc5b-e13236eeb2ab', 'cec-historical:02e08de74582', '3057fbeb-4a0c-25df-8d6c-43a23f467ad5', '7fe5c5a8-0702-4a45-88b6-7ff5ea610acd', 'ab889bdd-7fb1-47a3-af5e-266c0687f482', 'cec-historical-candidate-7374cdeb5b6852a5', TRUE, '民主進步黨', '2', 2407, 19.79, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '62f93cc0-0368-4f55-8acb-00fb89398591', 'cec-historical:1d2e9a2b6ac9', '55ca2f68-72ff-47cf-b774-7c1346b1451c', '2832ada4-c4a1-49f4-86e0-58af0707b681', 'ff535304-bf55-47f1-a60b-3c43aa4db70f', 'cec-historical-candidate-affd508d131ef231', TRUE, '中國國民黨', '3', 329, 56.14, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|新竹市|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '635b0beb-421b-4e81-880d-7b084a401a0d', 'cec-historical:b245f19fdc42', '0a91bde1-a758-4e22-9766-45149418f6ee', '88d33581-29e9-442d-9a45-4176fa53ceec', '910f7910-fbc5-48d4-8340-83f1fe822ab9', 'cec-historical-candidate-074c6e1d07dfdc8a', TRUE, '中國國民黨', '2', 1625, 50.26, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|高雄市|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '654a55ed-a7ee-4106-a507-0023e9a0bcdf', 'cec-historical:0814939f25eb', '1ded0dcc-7dfa-4b81-99ef-cae0fac2b159', 'c18cbf79-1b87-4309-8373-2f78cd481dc2', '2629e0e0-c0cf-4311-9f29-5d5dd9c42f27', 'cec-historical-candidate-da8f99c4f81907ab', TRUE, '無黨籍', '1', 161, 20.85, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|南投縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '674c98cf-7d44-4668-baef-803b427424dd', 'cec-historical:e8a039043fd2', '0c501325-8f45-4962-9b10-3e84ddbabc09', '13a4334e-dcaf-4085-b7f5-4e2e56160a30', '7be18525-1eea-491e-b969-da6acd59f9ae', 'cec-historical-candidate-5161974862662f5d', TRUE, '無黨籍', '1', 1947, 60.27, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|基隆市|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '67b442ba-a4dc-4a0b-b92f-e179ddfd8e87', 'cec-historical:8781e5eda6dc', '2c0af3a2-2686-4845-ad11-ba64d371ff35', '999ed2bc-0d34-4256-822c-fdee58fd5ff0', 'a2659c81-d0ea-4d81-8945-bf6229126b1a', 'cec-historical-candidate-8ff3b7d3ece5de26', TRUE, '中國國民黨', '4', 2679, 32.19, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6977b88a-524a-41d6-a52b-11b978ad3eec', 'cec-historical:6c43e558a775', '958a3993-860a-9e04-4204-abec67d46462', '7fe5c5a8-0702-4a45-88b6-7ff5ea610acd', '51b3b787-dc47-42f9-94f7-76588f818297', 'cec-historical-candidate-0e0e685bc07dc430', TRUE, '中國國民黨', '1', 3065, 25.2, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6c02e914-fe7d-4430-87d2-4a86507c1e7e', 'cec-historical:98a477f3c633', '5a764dd1-e443-7b4d-4a2d-146341f4ac8c', '3ab1c86b-6ff4-48de-89c9-718120111bb1', 'c4d136e3-d89b-4a64-9002-2ece249a2048', 'cec-historical-candidate-6778cccf32b2deaa', TRUE, '中國國民黨', '2', 1184, 46.32, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|屏東縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6c40fb22-5581-4088-ba62-921e2eb61741', 'cec-historical:182fd594495a', '571417fd-9887-4fc0-93d8-b7094ffa0279', '69aea440-a0c8-449c-9b74-68ece46519b1', 'ae1fc432-8ed7-4b2c-b760-78a626759519', 'cec-historical-candidate-910c770fef5c0013', TRUE, '中國國民黨', '1', 509, 28.3, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺東縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '6dd0a930-d27c-4986-8865-c16dcf9b67ff', 'cec-historical:7c5762550d47', '05cea7c9-b430-4d3c-8d9f-a88725a2073c', 'c571ec15-7612-4561-9813-3fced2053dd1', 'e35418f2-4992-4128-981a-6b4ebe2b1ded', 'cec-historical-candidate-79071a329305f5e1', TRUE, '無黨籍', '1', 509, 28.3, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '721ba13d-4d39-4ba5-8915-9e6d6924ebe5', 'cec-historical:e5875dff48ea', '30d22f2f-5165-4b6c-901d-97c5902216e0', '777765ee-a9b8-439b-929f-dbe0fea3abb0', '30de5523-42f5-4912-9131-45aa7d210f73', 'cec-historical-candidate-07209f539523eec5', TRUE, '中國國民黨', '1', 509, 28.3, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '73c09f77-f540-47ee-909b-d24e7e3b5e8a', 'cec-historical:2d9833d406f4', 'f8b04311-c754-a406-184a-6055163541f5', '98c1bf8d-4b9f-4f94-9d47-3f6c82d18420', '91c82ea3-4f12-48a1-8857-1a0af9e5e02e', 'cec-historical-candidate-db532e3239452aa8', TRUE, '中國國民黨', '1', 4018, 52.44, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺東縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '7596a2d2-24f1-47f2-aabd-5da140bf9995', 'cec-historical:b9931eb26a98', 'ac644af9-6b6e-42bb-9333-c5b9e35a31be', '8741773a-6a8c-4f0b-bc19-67365772281a', '608c2608-ac60-46f6-bfd9-29fcb77a4124', 'cec-historical-candidate-746d82c54c3bc440', TRUE, '無黨籍', '3', 133, 13.31, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|宜蘭縣|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '7645798b-30ba-4a57-bdda-8e2e521935e9', 'cec-historical:1680885cca7b', 'c079abf2-0e34-4f8e-a9b7-2dd1a69b59f6', '2832ada4-c4a1-49f4-86e0-58af0707b681', 'a4306a49-189e-416a-b8ed-c4f5ca03d335', 'cec-historical-candidate-45d4db5339c24bd2', TRUE, '無黨籍', '1', 181, 30.88, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|新竹市|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '76a5e0b3-4cfc-496c-a1cf-6978ba79ad7d', 'cec-historical:4c3ab3c388f1', '9ab5856c-f4c8-4e35-be8d-f318e42c3a71', '30b12af4-5f25-4d37-b2a1-6702fb635632', '05776746-96e3-49e8-820d-6f8abd1bd03c', 'cec-historical-candidate-dbcadfc567ca2a77', TRUE, '無黨籍', '3', 514, 8.5, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '783434b2-7b3c-46c4-9e98-837818e5086d', 'cec-historical:0130fa32e26b', '04fdf83e-f8f4-46de-a6a7-6e9a2796881a', '4d32c2db-46bc-42af-8706-6e68f302a736', '7abf9d3d-d1e4-4642-b160-7121a52981f5', 'cec-historical-candidate-4dbafb94dcdf59f8', TRUE, '中國國民黨', '2', 2045, 38.54, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|新北市|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '79b2363b-1407-4b3a-8427-cac47ca7103d', 'cec-historical:a646340ef0e9', 'a5d7463c-9b77-4bef-9d4a-da989dd1f6e1', '30b12af4-5f25-4d37-b2a1-6702fb635632', '9293c625-94cf-448f-8f37-83dd8600640b', 'cec-historical-candidate-e9f13f3e22363710', TRUE, '中國國民黨', '1', 1381, 22.85, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '7a6ab980-c793-474c-9c16-d557d2816c4a', 'cec-historical:e9bc17d0f772', 'fbd2f5c0-4e63-48b3-8090-3f121e4d6a54', '2832ada4-c4a1-49f4-86e0-58af0707b681', '2fea107d-65ff-419a-89e5-012235b84f3e', 'cec-historical-candidate-fa46a9f8065b8c10', TRUE, '無黨籍', '2', 76, 12.96, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|新竹市|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '7dcf52a5-4c4d-4c21-aeeb-2e621f09c5ad', 'cec-historical:74c9a1bc7ede', '9cea98b4-aac3-4e2d-9b16-86609c3f284d', '12e1b856-5774-446d-9758-4e0a778c98d5', 'db5ea8eb-9ed2-4db5-bedc-675507d184de', 'cec-historical-candidate-ca6634f723c9bd41', TRUE, '無黨籍', '2', 187, 16.36, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|彰化縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '80a786cc-6046-49d0-a6f0-184f64637de8', 'cec-historical:c0d88f228f3e', 'c5a1926c-d407-fe47-3f37-1b551f0f46b3', '8741773a-6a8c-4f0b-bc19-67365772281a', 'c6b738aa-79f1-4f28-b1cc-aa8107c72170', 'cec-historical-candidate-7ed2dc46e6e07779', TRUE, '無黨籍', '1', 485, 48.54, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|宜蘭縣|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '825061e9-1246-48e5-a10a-f855f0e906ca', 'cec-historical:144a33347840', 'dba49d3b-75ba-4c8a-b3f3-52252c77b03e', 'aed194a6-1227-4ec2-b54d-329039f93325', 'ae4c7932-e24d-4b22-924a-79e2a4272a30', 'cec-historical-candidate-fcd617445d277096', TRUE, '中國國民黨', '1', 1372, 53.67, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|屏東縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '842a9830-0aa1-42ec-be15-c3cdfc43ef06', 'cec-historical:0023b146bb3c', 'b790710a-4e1b-412e-bbba-c98488a9e6ac', 'fba6b852-2e2d-4018-8293-910a62898a64', 'e97db629-31d3-4c12-a683-677d129f3c19', 'cec-historical-candidate-8d3a085c804a8eff', TRUE, '中國國民黨', '2', 1625, 50.26, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|高雄市|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '84441915-712b-4484-b4f0-ae8b8d393eb0', 'cec-historical:a2be0c3d6f84', '18066428-62f0-493b-9ecf-fa1d1c9cfeda', '8741773a-6a8c-4f0b-bc19-67365772281a', '1b5d9a38-15bf-4361-b3e2-7a23bfc96fb6', 'cec-historical-candidate-897f7d89f8fc62ed', TRUE, '無黨籍', '4', 101, 10.11, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|宜蘭縣|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '855a8044-a070-49cb-88b2-ae1dc378dd49', 'cec-historical:1dd220e95df9', '47d67c55-33c1-4d53-9602-e47803164c42', 'fc4169ca-4d7e-4028-b9b3-48b30a64e830', '86008aa9-0875-4c0e-a1b2-8b22da032f07', 'cec-historical-candidate-3a6219d24fc5fd17', TRUE, '無黨籍', '4', 1660, 27.47, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '85cb3999-ec75-46e4-a09a-46c80d63ebf9', 'cec-historical:561fa0c003a0', 'a5f31fda-d87f-49e6-a100-125f2da3e3ce', 'c18cbf79-1b87-4309-8373-2f78cd481dc2', '4a810902-7114-4541-87a1-7e1734966ebd', 'cec-historical-candidate-0d5584bf64dcac2d', TRUE, '無黨籍', '5', 199, 25.77, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|南投縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '88c09d63-704e-4da7-9284-fec8b6639a7f', 'cec-historical:bc02d1faa41e', '32de3274-7a6f-4008-862d-44b899e39785', '031ac058-35e2-419c-9ff3-f840209f4ce3', '6599fb49-019b-4cf5-b834-8eca727b65a2', 'cec-historical-candidate-072b51da00a12514', TRUE, '無黨籍', '1', 864, 7.09, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|桃園市|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8aa4ff53-e5ff-45c0-9e48-025a63283e39', 'cec-historical:4f03e5ae09c6', '8a223cdf-9dba-44dd-86f2-610c35b13417', '999ed2bc-0d34-4256-822c-fdee58fd5ff0', 'c5f616de-099a-42bd-baa8-9e3385cbda89', 'cec-historical-candidate-815bca04040a26cf', TRUE, '中國國民黨', '7', 746, 8.96, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8b0f43b7-fd90-44e0-a6f9-f5264401abb8', 'cec-historical:2304f2482ca7', '7c65b28d-8158-460d-abf2-ab95422d44ab', '031ac058-35e2-419c-9ff3-f840209f4ce3', '3e8424af-877f-43b7-aa62-d9829553e1ec', 'cec-historical-candidate-482a5aab8da794cd', TRUE, '無黨籍', '6', 1504, 12.35, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|桃園市|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8e09e23c-47f3-4d49-ba8d-a7ed09b27bb6', 'cec-historical:4a1188ebc358', '272b9c7c-81a3-4a08-be16-3460f1acce1c', '7fe5c5a8-0702-4a45-88b6-7ff5ea610acd', '68ff50db-afef-4630-ba68-e7e2aef232c5', 'cec-historical-candidate-93966d07c1860e24', TRUE, '無黨籍', '4', 213, 1.75, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8f8f340a-1373-4976-9c18-732d4f4741aa', 'cec-historical:c626b4ada218', '8ff4124c-6883-4ad2-84d1-9609a16d601a', '49a2ec18-154c-46ee-bc17-3524ba464ced', '99be9116-c67c-4cd0-a5f4-1819b26db4e6', 'cec-historical-candidate-d2cb37d2fec3d337', TRUE, '無黨籍', '2', 1184, 46.32, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|屏東縣|district-16|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '90348a49-314f-4282-a22d-60d7572d422e', 'cec-historical:34713f4534df', '2a37533c-9e4c-4ac4-88d1-54c106cc704b', '13a4334e-dcaf-4085-b7f5-4e2e56160a30', 'd138ca7a-8cd9-4203-9131-4b03b80ceb12', 'cec-historical-candidate-18ec5b6e5852abb2', TRUE, '無黨籍', '3', 216, 6.68, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|基隆市|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '91b234ac-1c7f-482a-8df5-021c49b8a1a1', 'cec-historical:1608bc1addbc', '95d45918-a8e2-5688-391d-23ec88210b3e', '726d9425-3518-4a19-8986-3966db92257d', '06ff688c-db1a-4ff2-8584-97ca72097b5b', 'cec-historical-candidate-8c38d9da91715468', TRUE, '中國國民黨', '2', 2022, 54.56, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|苗栗縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '93bf5e6f-50eb-4db3-98ef-bcde6cb1f7de', 'cec-historical:81bc1699528a', '9663546a-22a2-4bc4-a926-b8d1d66811fa', '0517007c-1f7d-4c85-a4de-c130ba30d16b', 'd314c641-f9d5-40b8-93f5-4fe25f3c4dcc', 'cec-historical-candidate-09dfcd52891e5d0f', TRUE, '中國國民黨', '4', 1027, 28.61, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|花蓮縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '96a23160-8aff-4ae4-a188-8b5a7f39404a', 'cec-historical:9193b8c0b10f', '3e891f6f-ac02-435a-84e5-cf07cb898e8b', '8e7a5c46-de5f-4a0c-b3a6-7cd081cbcd7b', '8659762e-8bcf-4154-9033-574a288edbe0', 'cec-historical-candidate-e3371b8aa518f006', TRUE, '無黨籍', '2', 1184, 46.32, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|屏東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '96d1a7cf-4065-4c09-b2fb-7022da63d117', 'cec-historical:0c75e7633a6b', '3c39e206-bbbe-4447-8bd8-e2a37d930cc6', 'b8373af6-55c6-4494-87a5-d712b31199cf', '5d0bf64c-51ec-4d6e-a0db-59f667442c41', 'cec-historical-candidate-0cf9aaacaf6480a4', TRUE, '無黨籍', '1', 797, 17.68, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺中市|district-15|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '97423856-25b5-46f8-aeda-75fda3e780d6', 'cec-historical:a7cacb1356c3', '9c73e805-29d6-47ea-8a28-b73924bae49f', '616aedf9-49ed-4b39-a223-74f047324bd5', '67eae1e9-6101-4fcd-ba5d-13700f8b6d3e', 'cec-historical-candidate-15434e5c7e5e37e7', TRUE, '中國國民黨', '2', 1456, 38.01, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|宜蘭縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '979d81a4-d3af-43a9-95d7-05fb6b7b97ca', 'cec-historical:d9a8e946a579', '1b18f28d-e81f-47e2-b88c-498b0fa06996', '7fe5c5a8-0702-4a45-88b6-7ff5ea610acd', 'c7705f5a-c21e-4a5d-b0f2-414ce9e03c59', 'cec-historical-candidate-11b8680fd2daf889', TRUE, '中國國民黨', '3', 3459, 28.45, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '980cf71e-8f5a-4f2e-ae7c-fcd620aabcaa', 'cec-historical:ec46ee366f3b', '4c64916e-1e49-4896-b2dc-7dd99290a269', '616aedf9-49ed-4b39-a223-74f047324bd5', '9d1c86a2-f930-43ce-acb3-ee9cb58df598', 'cec-historical-candidate-c7d1c6e9995dbfc7', TRUE, '中國國民黨', '1', 1172, 30.6, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|宜蘭縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '9871dd4a-4f5e-4a46-b1a0-d71501e14414', 'cec-historical:c1a1f775199a', '46f2c4fd-a924-4f82-9f66-88a892b45b52', 'fb4548ec-6a6e-48d1-b233-95d669e31611', '99ad4593-20d4-46e8-9fdc-c06ae72ea052', 'cec-historical-candidate-f621431f2e567d36', TRUE, '中國國民黨', '2', 4105, 58.17, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺中市|district-16|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '9e0e5fba-e7d4-4f32-b040-ac6d03b3c878', 'cec-historical:c41b3e2f3c6f', '12f67be5-6ca8-4c0c-9e58-f046f25618ac', '777765ee-a9b8-439b-929f-dbe0fea3abb0', '446b352a-dbf7-4ebf-984c-616132bd6037', 'cec-historical-candidate-a8c2016ea45b4df1', TRUE, '無黨籍', '2', 288, 16.01, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a08ecdc4-929b-4721-8af8-cbabce8b9fb4', 'cec-historical:197972f223b4', '78286722-86a4-4509-b19c-8282aa50e6e3', 'a7afe489-c8cc-473c-8fb1-eeaaa206bf2f', 'e73a9099-2d30-4aa0-a0bd-c02389ff1fcc', 'cec-historical-candidate-a5c871e5a14e961f', TRUE, '中國國民黨', '2', 288, 16.01, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺東縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a09a7b9a-7ddc-4346-8276-2bf53d59b8ad', 'cec-historical:105f18b19830', '90ec1e14-d0fa-4cb3-a9a0-4ec8a4dcec8b', 'f3b90a27-bb14-48ec-bc86-3f16b664cb6c', 'dc3ab191-1a81-4e86-91b0-fec9bc875681', 'cec-historical-candidate-974407f90d71febb', TRUE, '無黨籍', '3', 779, 21.07, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|新竹縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a1686830-d99d-43e8-aa85-49f795e949f0', 'cec-historical:91050477eba1', '1881123c-0717-436b-d882-7a9e73c50fca', 'ff3a393e-4cbf-4ca4-b1c7-6701266ec187', '1e30adf2-9fe4-45eb-8dd6-d7de2551de13', 'cec-historical-candidate-6f4d4866083093d6', TRUE, '中國國民黨', '2', 710, 79.5, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|新竹縣|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a4beb1b2-7837-4fc0-a7a8-82b879de1378', 'cec-historical:96d28af7baf6', '9d0d4947-ee92-41a0-b8ba-299b9be7a27f', 'a4dfc2e1-0ced-4158-8890-32bdc559f059', 'a958a5eb-1333-4362-a0ab-cc1fd2eb5722', 'cec-historical-candidate-5701f87a606a71ca', TRUE, '中國國民黨', '1', 4018, 52.44, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺東縣|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a7a15af2-103a-4bb1-9f37-588d2ffeb7d5', 'cec-historical:7094fa476a3e', '171a6807-af57-4102-b58b-e866cdca19c3', 'c18cbf79-1b87-4309-8373-2f78cd481dc2', 'bfd7e4c8-815c-4635-95df-8f3ba4fcd0c6', 'cec-historical-candidate-a4f348260a074ebc', TRUE, '中國國民黨', '6', 125, 16.19, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|南投縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'abfe6a0a-e20f-46b1-bb11-7f9cfb21e656', 'cec-historical:d4d943fc72af', '01f800bd-30da-0b0e-e688-427521ca2882', '616aedf9-49ed-4b39-a223-74f047324bd5', '9bccc073-e022-48b9-a3a2-baea6b700b5f', 'cec-historical-candidate-ad40a504436c80d7', TRUE, '中國國民黨', '3', 1202, 31.38, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|宜蘭縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'acadce32-7be8-4c6e-af47-46418040a2fb', 'cec-historical:3a193e75e67f', '618cc645-8281-4708-b2a0-edda8c492272', '12e1b856-5774-446d-9758-4e0a778c98d5', '47242c09-7d6b-4d51-9633-f62f7983db1e', 'cec-historical-candidate-d47167af64e1c169', TRUE, '無黨籍', '3', 424, 37.09, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|彰化縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'aeff6f59-3ca6-4dff-961c-ae72b7134dbb', 'cec-historical:8d1904e7b2ea', '1fb9e03c-ffe6-232e-db9c-733b8223d294', '7a9d66f7-6e4e-4bdd-907d-cadf9a8f03ae', '0f8e2aa7-4156-42d3-b15d-64dfb07fc024', 'cec-historical-candidate-eefaaf0b23066ec7', TRUE, '無黨籍', '1', 933, 66.26, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺南市|district-18|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'af9f77d2-03fa-4415-bb9e-31f45f050354', 'cec-historical:1f025934eb9b', 'cbee2245-48d2-4bc0-b656-446c813d6448', 'f3b90a27-bb14-48ec-bc86-3f16b664cb6c', '59c21a84-a5f9-4cb2-be1e-e1ddde485111', 'cec-historical-candidate-07b1d22d49e1ae1f', TRUE, '無黨籍', '2', 1440, 38.95, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|新竹縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b0b6465b-f030-4ad8-b94c-072617507230', 'cec-historical:fe67a3017704', '8abf6b9b-a456-443a-9a6a-0527513d13b4', '9726da83-cede-4ce7-b5ef-c5c91f3c512e', 'a86a043a-093e-40bb-87f0-b5ce54f9b356', 'cec-historical-candidate-b0e138b970734ae3', TRUE, '民主進步黨', '1', 754, 20.42, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺北市|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b52e6677-a215-401e-81b2-f753b761670f', 'cec-historical:cebc22cbc760', '41adf3c8-757a-438b-85a4-acd68b1df816', 'c18cbf79-1b87-4309-8373-2f78cd481dc2', 'cfe0c15f-f2cc-4f49-bc7a-2827aac8ab06', 'cec-historical-candidate-9c387429f0c37c12', TRUE, '中國國民黨', '2', 64, 8.29, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|南投縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b5c564d2-0786-406a-ac8c-eeef8732cd30', 'cec-historical:f86a3320069d', 'c9757d21-9bed-4bdf-a9b3-454c577a3d4c', '21d967d6-edc9-4296-8db8-02b6d9a15d83', '4f94c87b-1116-46ab-aa71-46b5d1453e04', 'cec-historical-candidate-5fcf44d6a5c699fb', TRUE, '中國國民黨', '1', 1372, 53.67, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|屏東縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b6320e12-730e-4aeb-bdcb-94c02ce1ee23', 'cec-historical:96e10d67c6f7', '70719b36-a6e0-42e6-baec-2dfb54ad8018', '7c4a10f6-30dc-495e-97d6-dfb45966a940', 'a29e4189-f59f-45a6-8e75-2c5ed194463c', 'cec-historical-candidate-77a88fd20f8085d7', TRUE, '中國國民黨', '3', 3643, 47.55, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺東縣|district-10|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b9dbcf54-5de2-4457-be76-d786ffcf74a2', 'cec-historical:ed1b978d9de9', 'c568f82c-1dac-4875-97b1-a1cbac13a949', '21b804bf-c05d-4be0-a6eb-0c892e85e9ec', 'e81c8d28-01d1-4e5d-8b44-196618fb8500', 'cec-historical-candidate-d3472a232abdaa26', TRUE, '中國國民黨', '1', 209, 5.82, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|花蓮縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'bc1fc86b-ac37-4f48-aff2-1fe24f60397d', 'cec-historical:445784694c4d', '11106000-a92c-4521-bc80-e0ce94e42195', 'e8341872-9a6e-46f0-9fc4-5be52e525f56', 'd62ec5f4-d1e5-4d2f-8bad-90ac04d11256', 'cec-historical-candidate-855eb1738676b241', TRUE, '無黨籍', '2', 851, 32.25, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|嘉義縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'bdb60857-1fb7-4b44-8d56-a6fa6babbeec', 'cec-historical:3df0d199e929', '5725b499-3373-4566-9c5e-db0a42dc0b08', 'dd5963d1-8243-4aeb-b498-66940ccf8033', '0a5973c6-ad07-494d-b1cd-f374991f662f', 'cec-historical-candidate-fa494a4711be227d', TRUE, '無黨籍', '1', 4533, 53.85, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|南投縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'be78f3cb-aaee-420b-8502-b78fe409c4e7', 'cec-historical:b435419c3b45', 'bcc86886-5070-456b-b8a5-c9cc4e5e98b7', 'aed194a6-1227-4ec2-b54d-329039f93325', '08e87a47-1cd4-49b9-8e10-953c4a381e4c', 'cec-historical-candidate-15a0ff715adf6dc7', TRUE, '無黨籍', '3', 2529, 46.66, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|屏東縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'bfe32a99-42da-4fc2-b921-467b7868d731', 'cec-historical:cbc68b686706', '5ddf21c3-0166-8fa4-87f5-1ec76b87ba15', '999ed2bc-0d34-4256-822c-fdee58fd5ff0', 'd27b0018-2fa2-43f4-8dd6-8ed3aca2557f', 'cec-historical-candidate-5e795036599bcc27', TRUE, '中國國民黨', '5', 736, 8.84, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c10b5da6-b884-45b6-be31-5ec8dc46fe4b', 'cec-historical:210e70b7e5fc', '8c2f9b50-b181-4b81-929e-7a9bce515863', '06780b4c-e6b0-42ec-93f2-c80aa135a81d', 'd3d759e3-9c57-4a0d-ae10-c1161a9ec2e9', 'cec-historical-candidate-15addf6449c1bc27', TRUE, '民主進步黨', '3', 274, 22.42, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺南市|district-17|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c5d703f4-9876-4c1a-a1d8-fd996b2711c3', 'cec-historical:28d4ab9fde29', '96aa1973-49ff-4033-97f0-d1c810ac687c', 'c0242b12-361d-4f3e-a0ee-0ef2d6eda645', '0712f5e2-e294-478c-b39f-58ae32eaaefe', 'cec-historical-candidate-5a7face70f0f1b14', TRUE, '無黨籍', '2', 1571, 26, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|花蓮縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c89a34b9-830d-4526-aa3a-d9f47dd4cc9a', 'cec-historical:cbeb26679484', '1aa3d503-823e-4d3d-8695-c56db0174ceb', '3f86700d-d042-4c62-819b-a8df48bdffce', '2a5c2d0b-a21b-4fc4-acf9-6f678ebfcd97', 'cec-historical-candidate-be46389636026c99', TRUE, '中國國民黨', '1', 1889, 100, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|屏東縣|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c998738d-ef34-4916-a647-735d3a23a5cf', 'cec-historical:e15e84048bbd', 'c8d8769f-dc9d-43aa-ab01-97bb23ae3735', '8741773a-6a8c-4f0b-bc19-67365772281a', '6b7a6c48-b0fb-47ac-9637-b73b418f0291', 'cec-historical-candidate-6aabba8a656410a8', TRUE, '中國國民黨', '2', 280, 28.02, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|宜蘭縣|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ca0b8726-3bbf-4918-8748-22dca89f0e7c', 'cec-historical:45c400ed4c15', '06a6e43e-ba21-4eda-d683-5b70884554fe', '736aad0b-9d71-4072-85c0-be211e54c15a', '5479fc36-9443-483d-91d0-ed71f1967a84', 'cec-historical-candidate-db85701041afb722', TRUE, '中國國民黨', '1', 4533, 53.85, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|南投縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ce04734d-2b7d-4b58-852b-0d7e186193df', 'cec-historical:d4c8a6ce6976', '29749889-f47e-4450-92bd-374878657736', 'b4428b85-e848-4044-9d81-d7c2724a68e8', '33531af1-e8a0-4709-967c-d3b5cfa62c9b', 'cec-historical-candidate-3f526760d9456f74', TRUE, '中國國民黨', '2', 3449, 33.12, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|桃園市|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ce0f105b-b013-4ec2-bdbe-fd4fe9fde782', 'cec-historical:3fc760cfb020', 'c566fdc3-2c60-4c5a-8a2f-19e425870a7c', 'a4dfc2e1-0ced-4158-8890-32bdc559f059', 'bb3ec9af-6e6d-4d7c-9448-3329d74e0c3c', 'cec-historical-candidate-3e505431d2ad9960', TRUE, '中國國民黨', '3', 3643, 47.55, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺東縣|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'cf27f6d7-36fd-431e-86a9-73591693579e', 'cec-historical:78c0f2f2eeec', 'b7f39136-8899-4d70-bae4-7209c0f333c1', '06780b4c-e6b0-42ec-93f2-c80aa135a81d', '34eea8b6-e34b-4098-bae3-ae4c28e5fed8', 'cec-historical-candidate-682e4943f631a40d', TRUE, '中國國民黨', '1', 669, 54.74, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺南市|district-17|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'cf4c8833-4538-42b0-8f67-5527ab579b61', 'cec-historical:586d47cd9256', '30833061-0acb-46d4-97e7-c31d457b9747', 'b4428b85-e848-4044-9d81-d7c2724a68e8', 'a13dcfbc-9c2f-4083-9873-e80b48098277', 'cec-historical-candidate-4d220e5103617e54', TRUE, '中國國民黨', '3', 2311, 22.19, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|桃園市|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'cf7c3b1c-a1a9-4d85-a5d6-f6affbe9437d', 'cec-historical:b935b71417d5', 'e2486b55-9af9-4d1e-a198-2c83452cdde3', '7a9d66f7-6e4e-4bdd-907d-cadf9a8f03ae', '0e749502-c6b4-45a1-a70c-541c7964f1a0', 'cec-historical-candidate-392a543454ef2d3f', TRUE, '中國國民黨', '2', 475, 33.73, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺南市|district-18|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd059c65b-b226-46d4-83a6-e7cf8c6d769c', 'cec-historical:1b1ea5c17448', '573a2b68-987e-40f4-aa19-9dfd2ff210bf', '6f5ad7c9-c265-4a46-b9af-d08838f5bbab', 'fbd904d7-ae16-465a-88f4-42d862fafb09', 'cec-historical-candidate-18dceb495c81da44', TRUE, '親民黨', '2', 1456, 38.01, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|宜蘭縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd0b250f1-7b46-4921-b145-a056748ebad0', 'cec-historical:8acede50ca02', '3cbc0925-f7d0-4b80-ad15-94d85d68d0a8', '35054462-7b85-42ed-a6e3-583c4290bea8', '59c4cc4e-de83-40c2-afdd-c65337be33b9', 'cec-historical-candidate-97b2b646230d7417', TRUE, '無黨籍', '2', 1440, 38.95, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|新竹縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd29c64b7-b567-40be-91b7-413dedd84023', 'cec-historical:eb0fec1285a1', 'da64a271-e0af-63b6-7679-3608f20e5235', 'fc4169ca-4d7e-4028-b9b3-48b30a64e830', '248503df-6549-4ace-ab19-dee757c3a5d8', 'cec-historical-candidate-fcbea59a510e5e02', TRUE, '中國國民黨', '3', 514, 8.5, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'd5ce3faf-b613-492f-98df-e3e9b0d19a88', 'cec-historical:5fcfc717d56f', 'd08eaa7a-8cb2-4598-862e-1a12a46986e2', 'c0242b12-361d-4f3e-a0ee-0ef2d6eda645', '4995cbdf-f6be-435a-87c4-d3c9b0a85cf5', 'cec-historical-candidate-392b37e92242e8df', TRUE, '中國國民黨', '4', 1660, 27.47, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|花蓮縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd641fc65-9baf-4997-a5a9-85abd9c8959c', 'cec-historical:15347b2fe8e0', '26be0c8d-43c7-44d1-b7d4-9853beafb99c', 'f030ad3c-3dae-4765-a438-6c24b14ac427', '350d61e4-fcef-4bbf-899c-3f6715d2faa9', 'cec-historical-candidate-91edb761d56a40aa', TRUE, '中國國民黨', '2', 1073, 29.89, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|花蓮縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'd8199024-94f2-42f9-8c83-20cf4c7bd7ea', 'cec-historical:4d50fb7e295e', 'e8022a3c-d2b1-40d3-a671-4f332e25245b', 'b4428b85-e848-4044-9d81-d7c2724a68e8', 'ab08edf2-7a81-4a4e-8aaf-c0c03a9ebf32', 'cec-historical-candidate-f5bd6df8350b6b71', TRUE, '無黨籍', '4', 2767, 26.57, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|桃園市|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'dc3b812a-a51f-4662-8f21-228bfe62849a', 'cec-historical:cdb5fe3835d8', '9f6ee7cb-a05c-4aff-b6c1-f429daa36c45', '726d9425-3518-4a19-8986-3966db92257d', 'ccf04508-3ae6-4e97-8235-66bf554c0a21', 'cec-historical-candidate-39821c50885f0e0d', TRUE, '無黨籍', '1', 1684, 45.43, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|苗栗縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'dc49b7e3-3f95-45e2-8c7d-c550063a8f56', 'cec-historical:d3b93ac4bfed', 'b77c9cb8-a426-4da3-8135-247b20839a1d', '12e1b856-5774-446d-9758-4e0a778c98d5', '16ed5a51-1db6-4709-ad6d-22679adc24a0', 'cec-historical-candidate-072fb26f28b31ef1', TRUE, '中國國民黨', '1', 532, 46.54, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|彰化縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'df6def5e-1ef3-467e-b8ac-0cf6d1a0e3c3', 'cec-historical:88f803dccbbb', '1665a1cf-78d6-4c21-8822-f7cde40cae29', 'e8341872-9a6e-46f0-9fc4-5be52e525f56', '1017c27b-bc4b-4b15-993d-63136b395a80', 'cec-historical-candidate-963f61f920162de4', TRUE, '無黨籍', '4', 505, 19.14, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|嘉義縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e109ee11-bd96-4bb7-a08b-703439781e4e', 'cec-historical:fda389ef2381', '1d71cc22-5650-45ae-9264-cb8861369c5b', 'ccd15c0f-8cd6-4b57-84a4-23136b4f04bd', '58a18f1c-76b3-4fcc-87a0-a9419f2ceef2', 'cec-historical-candidate-1162b72612df5548', TRUE, '中國國民黨', '3', 2157, 84.48, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺北市|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e16102a1-f0bf-41b4-b34e-d5b49e14f025', 'cec-historical:72e23cc6926a', '14072c3a-8bf8-4a6b-a673-fcef478d066d', 'ccd15c0f-8cd6-4b57-84a4-23136b4f04bd', 'a45cb7de-290f-4525-9ecb-ac6f080959f5', 'cec-historical-candidate-9810f31d4d9e8c08', TRUE, '民主進步黨', '1', 275, 10.77, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺北市|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e200bccc-a41a-4da1-87a0-7a5e68830644', 'cec-historical:1a3e6266c5fb', '58a261c5-d347-4f32-82c4-f395b41d7e39', 'c0242b12-361d-4f3e-a0ee-0ef2d6eda645', 'ff54c7a1-9115-4084-b5dc-c80b006d41f0', 'cec-historical-candidate-3b3c9e77c7a4db86', TRUE, '中國國民黨', '5', 916, 15.16, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|花蓮縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e3ec19d6-ac48-4108-8429-b8324cbfc7b5', 'cec-historical:b20515281d77', '2f52d4db-ea4b-dd42-e8ab-01774d04dc46', '6f5ad7c9-c265-4a46-b9af-d08838f5bbab', '471db176-1e7f-4cbd-91eb-d75e39f26a6c', 'cec-historical-candidate-2396d71d9995427c', TRUE, '中國國民黨', '1', 1172, 30.6, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|宜蘭縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e435c7c9-0f4e-4a90-8385-e1447d2c41ce', 'cec-historical:e26e8c9f5f45', '9c58fd50-4611-4c20-adda-e47a922d05f2', 'c571ec15-7612-4561-9813-3fced2053dd1', 'afdd3934-f5b1-442a-9a7c-90f45073d432', 'cec-historical-candidate-d4ed884c5e1da1cb', TRUE, '中國國民黨', '2', 288, 16.01, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e5e8d601-5c0d-4a5a-af58-4a6c9c04f37a', 'cec-historical:38e0fc27483a', '976c3ad8-57c7-485f-af3e-29e03fdf766f', '031ac058-35e2-419c-9ff3-f840209f4ce3', '118e4a66-0b67-4f95-8332-d559fb54ecd5', 'cec-historical-candidate-a0f7ee4c5e4a5f58', TRUE, '無黨籍', '8', 2049, 16.82, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|桃園市|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e667f7e5-d77f-43cd-a2e5-71268ac13749', 'cec-historical:febaf3fa107d', '714fd6c6-4b4a-4506-afad-f89cb33c88d6', 'f030ad3c-3dae-4765-a438-6c24b14ac427', '94c22bab-9093-43cf-9e82-b9faac65ea9e', 'cec-historical-candidate-84b328c25135af2d', TRUE, '中國國民黨', '1', 209, 5.82, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|花蓮縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e76fb296-f8d7-4852-8690-4ce3e7605c17', 'cec-historical:a05f1211aa58', '59424fc1-7274-4a56-9d4d-fd7c04014192', '4216580a-32e2-4703-8e5d-ea2484247bb9', '45679cb7-012f-41e7-b2de-543aebc69d6c', 'cec-historical-candidate-61102a4101a6b384', TRUE, '民主進步黨', '1', 2590, 59.92, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|高雄市|district-12|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e7dfdeb0-1815-4863-9571-e1426f5501cd', 'cec-historical:cd6119f49a6c', '450aa6a2-d076-4a65-be0a-290548649156', '88d33581-29e9-442d-9a45-4176fa53ceec', '77e6415a-8d6a-4311-91a1-738bdf06eb77', 'cec-historical-candidate-0dbbbf73ae76d827', TRUE, '無黨籍', '1', 1608, 49.73, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|高雄市|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ea393017-44f5-46f0-969a-dd5726b195d1', 'cec-historical:0f095802508a', '9e622dc6-9de7-1577-d366-2604957feb2f', 'e8341872-9a6e-46f0-9fc4-5be52e525f56', 'eb03e7d9-1ac0-4977-b36f-effd6b41a983', 'cec-historical-candidate-9be6fe3f29c2f961', TRUE, '中國國民黨', '1', 329, 12.47, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|嘉義縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'edb82cf2-658c-48ed-877c-2207dfa4401b', 'cec-historical:6c9b6b400835', '12c35c7a-3ad4-4e0a-a70e-82d269d3fb8b', '031ac058-35e2-419c-9ff3-f840209f4ce3', '86f09099-59f6-4e55-84bf-3d3a8e57685c', 'cec-historical-candidate-16933aabeb94bf5e', TRUE, '中國國民黨', '3', 2630, 21.6, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|桃園市|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ef6a83fa-0663-4f1c-9280-393c12e13dc6', 'cec-historical:b5b9ce91b4ca', '8eadd1c2-7251-4cca-9d41-a572c37e42bf', '88d33581-29e9-442d-9a45-4176fa53ceec', '79d604e7-1b10-4a8d-ac10-2754f7473537', 'cec-historical-candidate-ab26b2be65e755a5', TRUE, '無黨籍', '3', 1267, 41.23, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|高雄市|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'f3e97ed3-a48e-4edb-a3ba-1781d45c6ba1', 'cec-historical:087a799b19d9', 'aea64699-7423-425d-b7e4-d60d965322a6', 'b56d8278-3aeb-4d0b-8d99-74fc7f6bdf20', '0b9b19e8-d13f-4d99-8683-671b75ebafcb', 'cec-historical-candidate-ecf36a6683961293', TRUE, '中國國民黨', '1', 1604, 100, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|苗栗縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'f4ca4556-ca6f-4cbb-bed7-5d5d532201a9', 'cec-historical:3fed94400744', '01341cb1-b8ef-40c9-8f09-35df52ca2e1e', '8e9a18e0-6bdf-454e-8287-7231a7730329', '60febff7-76eb-4f78-821f-e4886f757797', 'cec-historical-candidate-93ac5bc5de4d6f28', TRUE, '無黨籍', '1', 1372, 53.67, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|屏東縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'f4faedd5-d73f-4962-b140-24f286f43a6e', 'cec-historical:55070a2a2e14', '02b65791-b042-4a48-a0cb-150226218e84', '4d32c2db-46bc-42af-8706-6e68f302a736', '6be961a4-fa90-4b73-b049-86b7852fb53c', 'cec-historical-candidate-cbd36ea1ee81793b', TRUE, '親民黨', '3', 1957, 36.88, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|新北市|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'f6681895-7c15-446f-816a-19618f9ec9ec', 'cec-historical:f107fd4f4cc4', '0004f404-f36f-4c01-b6a8-03f752646046', 'c0242b12-361d-4f3e-a0ee-0ef2d6eda645', '2fa02747-4833-4ea7-9ec9-5262f7d9507c', 'cec-historical-candidate-17068001178c84b5', TRUE, '親民黨', '3', 514, 8.5, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|花蓮縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'f9510b81-4326-4d2c-8ad0-925d5ce699c7', 'cec-historical:002ea988ca7f', 'a733c87c-a800-4ef6-9163-516e1eb01600', 'b8373af6-55c6-4494-87a5-d712b31199cf', '39cf787b-d4d3-4ae0-8119-c698a9f050f4', 'cec-historical-candidate-7587679227c36ece', TRUE, '中國國民黨', '5', 715, 15.86, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|臺中市|district-15|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'fb25ab2f-0e9f-4f26-88c3-224b7f9f53bd', 'cec-historical:bd8ea85f068c', 'f6b281d8-5360-44bb-e590-1d54e9d5ca88', '49a2ec18-154c-46ee-bc17-3524ba464ced', '42f2efbf-9a9f-4c5f-b603-d3032f1d6920', 'cec-historical-candidate-807d082896a03f60', TRUE, '中國國民黨', '1', 1372, 53.67, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|屏東縣|district-16|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'fd423191-0c65-4c8b-a66b-ef5474443add', 'cec-historical:334a70d6c34a', 'ce4552c6-aece-3b56-3336-cee32236ed72', '34a94482-bd06-4f6f-9217-5baab1575b8c', '1c10dc17-6f01-467e-868a-040cf4b597bf', 'cec-historical-candidate-094ab6f293d21d20', TRUE, '中國國民黨', '1', 1372, 53.67, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|屏東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'fe3adce6-3419-4684-986a-4ba4c60dffb9', 'cec-historical:cd1ce8f2350d', 'ae724e2b-d448-41e3-994c-d3054bef9033', 'a4dfc2e1-0ced-4158-8890-32bdc559f059', 'cea5bf96-c2c5-4ff9-89a3-4e7d413e5809', 'cec-historical-candidate-44fdbc73bfcf4797', TRUE, '中國國民黨', '2', 2661, 33.91, TRUE, 'qualified', 'elected', 'elected', 2014, '2014|councilor|臺東縣|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'feb2d0f6-512f-49c5-87fb-77489c846d7d', 'cec-historical:f6d937c234d3', 'dd297edb-745d-44f8-96b7-5d090988cbd3', '031ac058-35e2-419c-9ff3-f840209f4ce3', '603354a6-21ad-4862-b285-a900462824e1', 'cec-historical-candidate-14512d65e48341ee', TRUE, '無黨籍', '4', 847, 6.95, FALSE, 'qualified', 'not_elected', 'not_elected', 2014, '2014|councilor|桃園市|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE);

-- Candidate, person, and race UUIDs differ between independently restored
-- environments. Resolve this update-only batch from the candidate's stable
-- external ID before validating or applying the vote backfill.
UPDATE _historical_cec_existing_candidate_input_20260730 input
SET candidate_id = candidate.id,
    person_id = person_map.canonical_person_id,
    race_id = race_map.canonical_race_id
FROM candidates candidate
JOIN person_canonical_map person_map ON person_map.person_id = candidate.person_id
JOIN race_canonical_map race_map ON race_map.race_id = candidate.race_id
WHERE input.operation = 'update'
  AND candidate.external_id = input.candidate_external_id;

UPDATE source_people source
SET source_payload = source.source_payload
        || CASE WHEN input.set_candidate_no THEN jsonb_build_object('candidateNo', input.candidate_no) ELSE '{}'::JSONB END
        || CASE WHEN input.set_vote_count THEN jsonb_build_object('voteCount', input.vote_count) ELSE '{}'::JSONB END
        || CASE WHEN input.set_vote_rate THEN jsonb_build_object('voteRate', input.vote_rate) ELSE '{}'::JSONB END
        || CASE WHEN input.set_is_elected THEN jsonb_build_object('elected', input.is_elected) ELSE '{}'::JSONB END,
    updated_at = NOW()
FROM _historical_cec_existing_candidate_input_20260730 input
WHERE source.id = input.source_person_id
  AND source.source_person_key = input.source_person_key
  AND source.source_type = 'official_election'
  AND source.source_id = 'cec-2024-votedata'
  AND source.election_year = input.election_year
  AND (input.set_candidate_no OR input.set_vote_count OR input.set_vote_rate OR input.set_is_elected);

DO $verify$
BEGIN
    IF (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730) <> 156
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'create') <> 0
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'update') <> 156 THEN
        RAISE EXCEPTION 'Historical CEC migration candidate input count mismatch';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _historical_cec_existing_candidate_input_20260730 input
        WHERE NOT EXISTS (
            SELECT 1 FROM source_people source
            WHERE source.id = input.source_person_id
              AND source.source_person_key = input.source_person_key
              AND source.source_type = 'official_election'
              AND source.source_id = 'cec-2024-votedata'
              AND (CASE WHEN source.party = '無' THEN '無黨籍' ELSE NULLIF(BTRIM(source.party), '') END)
                    IS NOT DISTINCT FROM input.party
              AND (NOT input.set_candidate_no OR NULLIF(source.source_payload->>'candidateNo', '') IS NOT DISTINCT FROM input.candidate_no)
              AND (NOT input.set_vote_count OR COALESCE(NULLIF(source.source_payload->>'voteCount', ''), NULLIF(source.source_payload->>'votes', ''))::INT
                    IS NOT DISTINCT FROM input.vote_count)
              AND (NOT input.set_vote_rate OR NULLIF(source.source_payload->>'voteRate', '')::NUMERIC IS NOT DISTINCT FROM input.vote_rate)
              AND (NOT (input.set_is_elected OR input.set_candidacy_status OR input.set_election_result OR input.set_registration_status)
                   OR (source.source_payload->>'elected')::BOOLEAN IS NOT DISTINCT FROM input.is_elected)
              AND source.election_year = input.election_year
        )
    ) THEN
        RAISE EXCEPTION 'Historical CEC migration candidate source snapshot mismatch';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _historical_cec_existing_candidate_input_20260730 input
        WHERE NOT EXISTS (SELECT 1 FROM people person WHERE person.id = input.person_id)
           OR NOT EXISTS (SELECT 1 FROM races race WHERE race.id = input.race_id)
           OR (
                input.operation = 'create'
                AND NOT EXISTS (
                    SELECT 1 FROM person_identity_matches match
                    WHERE match.source_person_id = input.source_person_id
                      AND match.person_id = input.person_id
                      AND match.match_status = 'auto_matched'
                )
           )
    ) THEN
        RAISE EXCEPTION 'Historical CEC migration candidate identity or race mismatch';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _historical_cec_existing_candidate_input_20260730 input
        JOIN candidates candidate ON candidate.external_id = input.candidate_external_id
        WHERE input.operation = 'create'
          AND (candidate.person_id IS DISTINCT FROM input.person_id OR candidate.race_id IS DISTINCT FROM input.race_id)
    ) OR EXISTS (
        SELECT 1 FROM _historical_cec_existing_candidate_input_20260730 input
        JOIN candidates candidate ON candidate.person_id = input.person_id AND candidate.race_id = input.race_id
        WHERE input.operation = 'create'
          AND candidate.external_id IS DISTINCT FROM input.candidate_external_id
    ) THEN
        RAISE EXCEPTION 'Historical CEC migration create candidate conflict';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _historical_cec_existing_candidate_input_20260730 input
        WHERE input.operation = 'update'
          AND NOT EXISTS (
              SELECT 1 FROM candidates candidate
              JOIN person_canonical_map person_map ON person_map.person_id = candidate.person_id
              JOIN race_canonical_map race_map ON race_map.race_id = candidate.race_id
              WHERE candidate.id = input.candidate_id
                AND person_map.canonical_person_id = input.person_id
                AND race_map.canonical_race_id = input.race_id
                AND candidate.external_id IS NOT DISTINCT FROM input.candidate_external_id
                AND candidate.is_public = input.original_is_public
          )
    ) THEN
        RAISE EXCEPTION 'Historical CEC migration update candidate target changed';
    END IF;
END
$verify$;

INSERT INTO candidates (
    person_id, race_id, party, candidate_no, registration_status,
    source_name, source_url, is_public, external_id, vote_count, vote_rate,
    is_elected, candidacy_status, election_result, status_updated_at, updated_at
)
SELECT
    input.person_id, input.race_id, input.party, input.candidate_no, input.registration_status,
    '中央選舉委員會開放資料', source.source_url, FALSE, input.candidate_external_id,
    input.vote_count, input.vote_rate, input.is_elected, input.candidacy_status,
    input.election_result, NOW(), NOW()
FROM _historical_cec_existing_candidate_input_20260730 input
JOIN source_people source ON source.id = input.source_person_id
WHERE input.operation = 'create'
ON CONFLICT (external_id) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    race_id = EXCLUDED.race_id,
    party = EXCLUDED.party,
    candidate_no = EXCLUDED.candidate_no,
    registration_status = EXCLUDED.registration_status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = FALSE,
    vote_count = EXCLUDED.vote_count,
    vote_rate = EXCLUDED.vote_rate,
    is_elected = EXCLUDED.is_elected,
    candidacy_status = EXCLUDED.candidacy_status,
    election_result = EXCLUDED.election_result,
    status_updated_at = NOW(),
    updated_at = NOW();

UPDATE candidates candidate
SET party = CASE WHEN input.set_party THEN input.party ELSE candidate.party END,
    candidate_no = CASE WHEN input.set_candidate_no THEN input.candidate_no ELSE candidate.candidate_no END,
    registration_status = CASE WHEN input.set_registration_status THEN input.registration_status ELSE candidate.registration_status END,
    vote_count = CASE WHEN input.set_vote_count THEN input.vote_count ELSE candidate.vote_count END,
    vote_rate = CASE WHEN input.set_vote_rate THEN input.vote_rate ELSE candidate.vote_rate END,
    is_elected = CASE WHEN input.set_is_elected THEN input.is_elected ELSE candidate.is_elected END,
    candidacy_status = CASE WHEN input.set_candidacy_status THEN input.candidacy_status ELSE candidate.candidacy_status END,
    election_result = CASE WHEN input.set_election_result THEN input.election_result ELSE candidate.election_result END,
    status_updated_at = NOW(),
    updated_at = NOW()
FROM _historical_cec_existing_candidate_input_20260730 input
WHERE input.operation = 'update'
  AND candidate.id = input.candidate_id;

DO $verify$
BEGIN
    IF (
        SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 input
        JOIN candidates candidate
          ON input.operation = 'create'
         AND candidate.external_id = input.candidate_external_id
         AND candidate.person_id = input.person_id
         AND candidate.race_id = input.race_id
         AND candidate.party IS NOT DISTINCT FROM input.party
         AND candidate.candidate_no IS NOT DISTINCT FROM input.candidate_no
         AND candidate.vote_count IS NOT DISTINCT FROM input.vote_count
         AND candidate.vote_rate IS NOT DISTINCT FROM input.vote_rate
         AND candidate.is_elected = input.is_elected
         AND candidate.candidacy_status = input.candidacy_status
         AND candidate.election_result = input.election_result
         AND candidate.registration_status = input.registration_status
         AND candidate.is_public = FALSE
    ) <> 0 THEN
        RAISE EXCEPTION 'Historical CEC migration created candidate result mismatch';
    END IF;
    IF (
        SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 input
        JOIN candidates candidate
          ON input.operation = 'update'
         AND candidate.id = input.candidate_id
         AND (NOT input.set_party OR candidate.party IS NOT DISTINCT FROM input.party)
         AND (NOT input.set_candidate_no OR candidate.candidate_no IS NOT DISTINCT FROM input.candidate_no)
         AND (NOT input.set_vote_count OR candidate.vote_count IS NOT DISTINCT FROM input.vote_count)
         AND (NOT input.set_vote_rate OR candidate.vote_rate IS NOT DISTINCT FROM input.vote_rate)
         AND (NOT input.set_is_elected OR candidate.is_elected IS NOT DISTINCT FROM input.is_elected)
         AND (NOT input.set_candidacy_status OR candidate.candidacy_status IS NOT DISTINCT FROM input.candidacy_status)
         AND (NOT input.set_election_result OR candidate.election_result IS NOT DISTINCT FROM input.election_result)
         AND (NOT input.set_registration_status OR candidate.registration_status IS NOT DISTINCT FROM input.registration_status)
         AND candidate.is_public = input.original_is_public
    ) <> 156 THEN
        RAISE EXCEPTION 'Historical CEC migration updated candidate result mismatch';
    END IF;
    IF (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE vote_count IS NOT NULL) <> 156
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE vote_rate IS NOT NULL) <> 156
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE is_elected) <> 65
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'update' AND original_is_public) <> 156 THEN
        RAISE EXCEPTION 'Historical CEC migration candidate summary mismatch';
    END IF;
END
$verify$;

SELECT
    0 AS planned_creates,
    156 AS planned_updates,
    156 AS planned_total,
    156 AS publication_states_preserved;

SELECT published.promote(NULL);

DO $verify$
BEGIN
    IF EXISTS (
        SELECT 1 FROM _historical_cec_existing_candidate_input_20260730 input
        JOIN candidates core ON input.operation = 'create' AND core.external_id = input.candidate_external_id
        JOIN published.candidates public_candidate ON public_candidate.candidate_id = core.id
    ) THEN
        RAISE EXCEPTION 'Historical CEC migration unexpectedly published a newly created private candidate';
    END IF;
END
$verify$;

DROP TABLE _historical_cec_existing_candidate_input_20260730;

RESET statement_timeout;
