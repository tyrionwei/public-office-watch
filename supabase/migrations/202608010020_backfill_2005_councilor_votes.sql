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
    ('update', '008cfbec-fef3-45d4-8449-aef4825f5e7f', 'cec-historical:fc0461222bda', '1aa3d503-823e-4d3d-8695-c56db0174ceb', '41c52141-2f63-4fd7-a7dd-3a2159448ad1', '399cbce6-3442-46a8-9b87-bcec69d74ff0', 'cec-historical-candidate-3f4cefc4f4cb1f52', TRUE, '中國國民黨', '1', 1430, 100, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|屏東縣|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '01277f7e-6025-4fe6-beb5-bb063fefda1f', 'cec-historical:6e661d9b7736', '693ae425-5523-4fc3-9be4-2844f8f23042', 'a6235a91-4cb5-4bb9-b9fd-9f33f726562c', 'd46b15e1-5e61-4fb2-a4fe-881fb68f9279', 'cec-historical-candidate-ddf2d29b006221d0', TRUE, '無黨籍', '5', 630, 7.31, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '04a22460-7546-411d-b451-9ba9ed76b478', 'cec-historical:504456b1ba01', '571a3d07-a03b-439e-b5ee-de24abf1318b', '3185be5f-e65f-4fa1-a9d8-2ed0bd7c59df', '017f923d-0a58-4b28-b0dd-72f192b0168e', 'cec-historical-candidate-22a698b61d5b89de', TRUE, '中國國民黨', '4', 1884, 25.72, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '06b81df2-0cb5-4f0f-a4aa-f470238aaa2d', 'cec-historical:d1bac916ef79', 'c38a6065-568b-419b-8513-776912526265', 'e09c4669-7f13-4a77-aee6-560ded2ebdb1', 'ab711826-d973-41fa-a2cb-ee43c43d5cfe', 'cec-historical-candidate-ce49033ddcca9d7a', TRUE, '中國國民黨', '1', 856, 28.1, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|屏東縣|district-16|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '08943696-8202-4141-88bc-3f1335819e6b', 'cec-historical:b55dac52f7c7', '1ee617f7-3af1-49ef-90ee-19edc3e5896e', '871db566-6c12-446d-86f7-5177d2e18623', 'c2c6eade-9903-4bed-ba17-f57b26704427', 'cec-historical-candidate-8c0a30de8c9db5cf', TRUE, '民主進步黨', '5', 205, 22.93, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|彰化縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '08bbaa45-7fe9-453d-90c3-2f008bf0a9ac', 'cec-historical:7c2a72d9ac4a', '8bba49d9-0af1-1744-d5d5-6b94c3cb6eba', '5dccb1da-3167-4ebb-a28b-bba7d0367c5c', 'a41b2cb7-bfb0-45e3-a993-a7ca06cdd33d', 'cec-historical-candidate-2933bb8e26417566', TRUE, '無黨籍', '3', 139, 16.33, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺中市|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '0916f3dc-767f-4956-92c7-9a468d44c63b', 'cec-historical:6f551b17c6ff', '0a807dff-d03c-dace-6c30-d2c213bf2a2a', '8d898994-aa82-4e5a-b375-601a6a470b25', 'cca9e611-a701-49f8-8b0a-e23fa2ef213a', 'cec-historical-candidate-2fb5ea8299e51341', TRUE, '無黨籍', '1', 1065, 31.82, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|新竹縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '0c3479ba-1b5c-4aad-bff8-26c9b598798f', 'cec-historical:89297373e701', '4db793cf-3bbe-4884-8660-b264b7656790', 'd7b3edc6-e081-4f58-8e10-e76b2f92d516', '8d3a3c3e-3a79-436b-862d-56a72fca2a44', 'cec-historical-candidate-ec81bb69ce0f6781', TRUE, '中國國民黨', '2', 1019, 13.91, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺東縣|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '0f164407-327a-4587-a6fd-3ced9d6b9b7e', 'cec-historical:b8a260b4b3b3', 'aea64699-7423-425d-b7e4-d60d965322a6', '1ea07e43-27cc-4a28-b3fb-cf20c1fb4345', 'e1ea5da1-c645-4f60-ba5d-40f9d4669b84', 'cec-historical-candidate-f23fbe43884f9f5d', TRUE, '無黨籍', '1', 453, 30.06, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|苗栗縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '11e0f46f-b376-4139-96cf-a2f34db16534', 'cec-historical:e194cb575d45', 'e73a2578-f7e2-40b2-b74a-2a44fdf0eea3', '8a217bc0-7787-4c16-b28c-ac51a4ef2900', '92758082-1100-4104-8656-b3aebd4286b0', 'cec-historical-candidate-fa2e594cef2d05d4', TRUE, '無黨籍', '2', 730, 45.17, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺東縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1319de5c-9ab2-4bce-aae0-d18874ed886a', 'cec-historical:2df47d331f84', '9d5248d3-9c5d-42ed-8f5c-4ddb42d0a560', 'a6235a91-4cb5-4bb9-b9fd-9f33f726562c', '87369069-a3ac-4f82-9e39-edf98d227c98', 'cec-historical-candidate-63f0e0cdb1ce7190', TRUE, '無黨籍', '2', 1654, 30.68, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '16cf63e5-ee82-471a-870b-55e9df7366ef', 'cec-historical:613fce55d1c8', 'dd9eb471-34ae-436d-9901-1f8231ed672b', 'b437f1f2-ecdc-462a-ac54-a703d8e46f35', 'e215f82d-c229-4cc0-a580-41247db2d399', 'cec-historical-candidate-3767cf3447adcfb3', TRUE, '中國國民黨', '2', 1654, 30.68, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '18c159f6-7845-4be1-95c9-1334a337490d', 'cec-historical:2ce037116009', '746b88d7-2ae3-8c1d-3a25-599935a078c3', '59558596-417c-49e5-9950-b3797c1a6e17', 'ed79d2b3-de93-4234-bdcc-b4d1432543ce', 'cec-historical-candidate-39a2d523998371e8', TRUE, '台灣團結聯盟', '1', 1276, 17.42, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '192cf030-7f55-4483-b6da-4a5f3f3dbe5d', 'cec-historical:98e76afcecc8', '81ac8e46-9f20-272b-82cb-07c701b900fa', 'dbe86880-ce6c-41b8-8288-6d6068cd14cf', 'ca056611-2504-42c3-b13b-e75787e367ba', 'cec-historical-candidate-93db7e7e9d0a6de8', TRUE, '中國國民黨', '4', 3629, 41.24, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺北縣|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '198f4bf7-3c62-43f3-b546-a0b77266e93b', 'cec-historical:d97385e2ba4a', 'ba00c53a-1a7a-1998-97bf-710c69f1a0e6', '59558596-417c-49e5-9950-b3797c1a6e17', 'd678a41d-283a-414d-bc0c-cabb47fd6936', 'cec-historical-candidate-1a1e8a066de1f5ba', TRUE, '中國國民黨', '5', 1401, 19.13, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1acf83b3-c8f9-4ef3-b1a5-e0be3c545a47', 'cec-historical:a84ee3ee810f', '9d0d4947-ee92-41a0-b8ba-299b9be7a27f', '0c77ddf8-afc7-4e51-a711-d00b4e17a794', '725bf6e9-172d-4d86-ac3b-ccc7486b040d', 'cec-historical-candidate-ab4d8494e50c4adc', TRUE, '中國國民黨', '6', 660, 9.01, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1c50980b-ef9c-4f3a-98b0-1ab9729eedc4', 'cec-historical:48a117735616', '19ba53ec-c57d-45b5-bca8-b540be69d352', 'dbe86880-ce6c-41b8-8288-6d6068cd14cf', '7aa65126-831d-4be6-b00a-7db0a694f7c8', 'cec-historical-candidate-450cdf5406a78b87', TRUE, '民主進步黨', '2', 1792, 20.37, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺北縣|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '1dc765ca-f2d2-4724-9dca-b4dc284c8ec7', 'cec-historical:03d066f0d279', '4c7c8c58-fd09-4c8e-97e7-12c44bdca053', '0efceda9-294c-4af0-8000-8b3e6026d7d9', '044a7ca5-bd23-4f8b-8242-1e31145ad76e', 'cec-historical-candidate-185f12528aacbb9e', TRUE, '無黨籍', '2', 287, 2.78, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|高雄縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '21d89378-9c58-49b1-8927-dae6a095e7d3', 'cec-historical:1d9b5852a7d0', '32cc5c94-6a18-4068-9887-296af0f67d50', '9f2c42ff-d2d1-4f23-a7d5-8bc41e3dd88c', '0c86db2c-e877-4aa8-866b-c327a6b8a1ac', 'cec-historical-candidate-610810c76cbec917', TRUE, '工教聯盟', '1', 915, 24.5, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺中縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '22f7b05f-3c89-4bc9-8b91-aa5c1fa5bf45', 'cec-historical:ee73df37baf1', '9e219eb0-8696-44c8-84e1-20a0ec5ab1f7', '520c0f0a-8c5c-4c36-9ea4-e9891b9f81a0', '12f8b741-8b11-498a-9063-8c4c80ace33b', 'cec-historical-candidate-116cb15504872e11', TRUE, '民主進步黨', '3', 1027, 27, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺北縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '243f3893-45a0-4c65-8e79-10ae6ee70960', 'cec-historical:bd4a6b6baad0', '1da9b1c7-9eb7-43b5-9bd6-21e4bbb335fa', '65044be3-0eca-4745-8021-47611e1a2e0b', 'ba759e95-eccc-4131-bbca-e41961ab4f31', 'cec-historical-candidate-2616e6979f23c075', TRUE, '中國國民黨', '1', 1335, 48.56, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|基隆市|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '2634d41b-5501-415f-916a-60893276e5fd', 'cec-historical:687d4a1cfb1d', '595312a0-d835-4e70-af22-dda796ab2388', 'b437f1f2-ecdc-462a-ac54-a703d8e46f35', '3eab145f-1da1-4665-845f-233e2f40568d', 'cec-historical-candidate-8b6746663697c093', TRUE, '中國國民黨', '7', 1448, 16.81, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '26bf6378-d5cf-4985-b3c2-95d0cd0cf94a', 'cec-historical:eb7e10a629e1', '259be84e-c06b-4cd9-b99f-8f5286f7fcb8', 'db5b4bbe-191c-45c7-b37e-c6e3afe8fa25', 'c7b9c304-b505-4c17-bbd9-9cad17030cad', 'cec-historical-candidate-1525fe1e4e6f42a2', TRUE, '無黨籍', '3', 980, 9.59, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|南投縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '270c7909-46c4-4fc8-bed3-f4acfb499da7', 'cec-historical:b93373617192', '3ec2a0a0-9258-4f42-8cdc-12e07702bbe3', '9f2c42ff-d2d1-4f23-a7d5-8bc41e3dd88c', '13717480-31cc-4fa8-8cc0-353bd9cd9a3b', 'cec-historical-candidate-091acd66d973ef29', TRUE, '無黨籍', '3', 1649, 44.15, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺中縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '2ae9e534-b96e-447f-bec7-d309b84703e6', 'cec-historical:1860e8e540f7', 'd78a7da6-179e-4ae1-b122-5fc0ff9c1482', 'e7c19c2d-49d6-4a86-bf33-d201b7e9f5df', '0961a8dc-66d6-4db4-8acd-88a724328c08', 'cec-historical-candidate-270961c7bde4d3b8', TRUE, '無黨籍', '2', 570, 18.71, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|屏東縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '30088c74-a5bd-4eb3-9fff-052fb28849f0', 'cec-historical:1d88a7a9f184', '78286722-86a4-4509-b19c-8282aa50e6e3', 'e3095df7-9c14-43a4-a091-8b60465dbfe4', '525a7fc3-f7e0-4734-aa97-9fb468977e5d', 'cec-historical-candidate-0c3ef2fe59197218', TRUE, '中國國民黨', '1', 886, 54.83, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '36e446de-f894-4fc6-b5fc-cfaec6ea58b7', 'cec-historical:ac630021de72', '060578ea-e91d-4fe5-8748-1ff49955b59a', 'c6e5d443-3354-4f39-b13e-72e3ce71fbe5', 'e542ac9e-ae3a-4222-b2c0-ab20fb7ac544', 'cec-historical-candidate-088f8e174bd14972', TRUE, '親民黨', '1', 886, 54.83, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '379ba440-1027-4af9-b4db-da9a33b9eee4', 'cec-historical:108d8fedca4b', '0479715c-48dd-4715-ad8f-493c5c07cf92', '0c77ddf8-afc7-4e51-a711-d00b4e17a794', 'f5b65e4e-994b-4af8-9649-fccfd0edb563', 'cec-historical-candidate-e5c4839004b86709', TRUE, '中國國民黨', '1', 1276, 17.42, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '385da29d-ce60-4688-a74d-33a52dbef871', 'cec-historical:dc12c4513bcb', '10a18a04-0936-4776-8c51-ec1dd63f8184', '90fbc396-a7d1-446c-8d4f-97e1faf4f280', '27940577-bb1f-4e13-9238-eae017ee0450', 'cec-historical-candidate-07c0a6de0e0494e0', TRUE, '中國國民黨', '1', 856, 28.1, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|屏東縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '38d15136-5d89-45fb-9e31-dd50cd840fad', 'cec-historical:c98610f2125a', '24ee80a4-474e-0c06-f7b2-3e856c88c891', 'dbe86880-ce6c-41b8-8288-6d6068cd14cf', '6326f896-096e-49c1-a96d-1b7a975d07c5', 'cec-historical-candidate-6936072ba6bf485d', TRUE, '無黨籍', '3', 2424, 27.55, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺北縣|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '3c0451c1-297c-4765-b907-1c095ee33312', 'cec-historical:c6d44957c96a', '0e7b050c-b366-4819-bee0-664ea0c4a702', '215c8866-8f7c-471c-a84a-38fce25728cb', 'cdff7884-7011-4850-a304-d3865846c4b1', 'cec-historical-candidate-02758bc0c8aa2a17', TRUE, '無黨籍', '3', 1307, 24.24, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|花蓮縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3d0d9e46-eb8c-4173-be60-9dc991cabbe7', 'cec-historical:af24dbd13bc1', 'bec1490f-4694-1eee-5511-d2b971324403', '3185be5f-e65f-4fa1-a9d8-2ed0bd7c59df', '3e491ea7-b5c9-40df-8a5e-82ed56b0b4d6', 'cec-historical-candidate-e89bac88cd86e481', TRUE, '中國國民黨', '1', 1276, 17.42, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3d7bcc4a-daeb-4711-b0d0-0fab4cf53227', 'cec-historical:eb65cf57eecc', '7f7db07b-5523-49be-aa07-34401de22bd4', '0c77ddf8-afc7-4e51-a711-d00b4e17a794', '072597a7-7791-4990-ada3-01de1f9dbcc3', 'cec-historical-candidate-5c07f148262a0348', TRUE, '中國國民黨', '2', 1019, 13.91, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3e8c0e62-039e-4fb4-b758-43be4285fda5', 'cec-historical:cb661bbd819b', 'fd8de052-d159-4f1d-a752-cfab2c5a10b2', '0c77ddf8-afc7-4e51-a711-d00b4e17a794', 'cdf99840-dc60-4448-be67-df33599092ed', 'cec-historical-candidate-2277f3013b77e6c8', TRUE, '中國國民黨', '4', 1884, 25.72, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '40cd48a6-3b11-41c8-91ee-7381d38067da', 'cec-historical:84be2fb43362', '7a39709c-121c-4a3f-9539-a13644c70819', '1ea07e43-27cc-4a28-b3fb-cf20c1fb4345', 'ffcc6b86-6a16-42e9-ad3e-911218070b3a', 'cec-historical-candidate-9898abf81a3bded3', TRUE, '無黨籍', '2', 1054, 69.94, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|苗栗縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '41d18a3c-daaf-4f91-9863-c07bbdcb32b0', 'cec-historical:eb87102d9980', '783e5eb9-1bce-4f76-a428-2180955fdf41', 'e523bc04-b502-4488-946a-f110265bb718', 'a07f5e79-7ac0-4d79-8882-473dcb657f3c', 'cec-historical-candidate-c50f6a9bf23252ba', TRUE, '中國國民黨', '2', 730, 45.17, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺東縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '42a8e4e4-3e17-4233-869a-713d4fd4b038', 'cec-historical:5ddf092c9fdc', '0cce0a52-5d26-6465-c237-744cd4fb7894', 'e46c2f0c-6064-4fec-a4f5-8349881a300e', '21dda78d-3943-414c-a332-36350fd08af7', 'cec-historical-candidate-de9037e8008bf416', TRUE, '無黨籍', '2', 1872, 62.17, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|花蓮縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '444bd1a0-60c1-44f2-9f9d-f00c782da22b', 'cec-historical:ca5964105a3b', '23690cdc-664a-4d83-91ab-f703e192414b', 'a730bd40-0f94-4b84-9366-7aee7815e996', '5e6ada56-e139-4091-b6a8-3789fb96d3c6', 'cec-historical-candidate-6ca22995659e9fc6', TRUE, '中國國民黨', '1', 3535, 36.09, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|南投縣|district-6|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '4838a898-f3d0-4540-b50c-649bd573a25e', 'cec-historical:28a57ebc5997', '00d72d82-8b7b-4f95-9440-cf5fcfb96ba3', 'ef2a228f-9eae-4ff7-8a59-6d06be2a95f5', '0c7e7928-8acf-418f-b4cd-937ddd7a2899', 'cec-historical-candidate-be720c9eb8527ca0', TRUE, '中國國民黨', '1', 1139, 37.83, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|花蓮縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '49b0ddd6-908d-4039-8dec-76ba76e0820f', 'cec-historical:5fce3cd72ffd', '96aa1973-49ff-4033-97f0-d1c810ac687c', '215c8866-8f7c-471c-a84a-38fce25728cb', '0cea2661-8d8b-44ae-beb3-b916cc8560d1', 'cec-historical-candidate-587d22b2feebb3c1', TRUE, '中國國民黨', '2', 1654, 30.68, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|花蓮縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '4e7daf2d-7747-4ed2-976e-b127e292fce4', 'cec-historical:c3b408a4b5e3', '016cc40e-2a9c-4fda-8dd6-d18049616598', 'a6235a91-4cb5-4bb9-b9fd-9f33f726562c', 'f0f84b24-bf07-438b-b0c8-6b85ec1424da', 'cec-historical-candidate-19b242813eecae53', TRUE, '中國國民黨', '3', 1307, 24.24, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '50499d09-e8ad-4d83-aaa3-eba3958ab19d', 'cec-historical:01cffd15f17c', '16e6c23d-d158-467d-8230-64229fbd1aee', 'b437f1f2-ecdc-462a-ac54-a703d8e46f35', '7efa94d6-48c5-4b2e-85b3-5f82ae1d3fea', 'cec-historical-candidate-1b515cd56625dde3', TRUE, '親民黨', '1', 1108, 20.55, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '524240c8-03b5-4c4d-86f9-ae1e6ee941a3', 'cec-historical:4eca70376bd8', '301ba6ee-7d59-435f-8e3b-d9ad102f0c52', '90fbc396-a7d1-446c-8d4f-97e1faf4f280', '5a98f999-eddd-4445-8f6b-11054afb8a69', 'cec-historical-candidate-094c23be2d57fba7', TRUE, '中國國民黨', '2', 570, 18.71, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|屏東縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '539f94e7-d881-4385-990b-2eda4df8daae', 'cec-historical:0d694c629e8b', '35176b92-d24a-4a18-9515-437966e3d3af', '1217d46f-de76-42be-9672-9b619e90f899', '776962fc-c264-42d3-9522-b58331c4a32d', 'cec-historical-candidate-dbf1b8e2d0979a5b', TRUE, '中國國民黨', '1', 1700, 100, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|高雄縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '55395706-bd99-4063-8d66-f0de746e2666', 'cec-historical:0f7e229c4ada', '618cc645-8281-4708-b2a0-edda8c492272', '871db566-6c12-446d-86f7-5177d2e18623', '7ced830c-e9dc-4714-b373-bb42fcb29378', 'cec-historical-candidate-c0359b45d52559a6', TRUE, '中國國民黨', '2', 416, 46.53, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|彰化縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '575670b9-b933-4a0d-9f08-211e95bddbf9', 'cec-historical:d8162103900d', '61f72fda-9a65-409a-b900-80081ad09644', '844fb4d4-906e-4938-9852-7fac2a7109e9', '64f769c0-99d8-43d7-af00-098eeaebd8e5', 'cec-historical-candidate-fb3b4e9e48b6cc22', TRUE, '中國國民黨', '1', 808, 7.82, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|嘉義縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '5756d66f-4dbe-4bd6-be5a-7cbee590de36', 'cec-historical:4f5decff4e94', '01341cb1-b8ef-40c9-8f09-35df52ca2e1e', '53ea29e7-5b50-41ab-801f-7f97d4aada31', 'a06b9af0-2e09-49fa-84ba-88f7051bb63c', 'cec-historical-candidate-2b8a322ea6120ffe', TRUE, '中國國民黨', '2', 570, 18.71, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|屏東縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '5e2013c7-6000-4820-95d4-7f833f67a1fa', 'cec-historical:2377aa7bc6b9', '5538e65d-e18c-4470-88ea-29f1e8a71459', '1fb6bc39-cc9a-4e72-8a80-4d5731a6dd3f', '57fa0f21-8bf2-4b0e-a580-cab3a85f9b0f', 'cec-historical-candidate-31b1a543f0a60f9a', TRUE, '無黨籍', '1', 856, 28.1, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|屏東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '63c04ea5-242b-49ad-b342-d34335ad1b28', 'cec-historical:23b7f84f44f6', '8488f17d-592e-dbe3-eff0-1ea8ed275d91', '8d898994-aa82-4e5a-b375-601a6a470b25', 'a83a5418-c756-4c33-ad6f-d8ae8d9f9beb', 'cec-historical-candidate-541db4f83ade0cc9', TRUE, '中國國民黨', '2', 1074, 32.09, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|新竹縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '695c0a81-ada2-4fea-8be9-f509552f1c42', 'cec-historical:02e6bdb8ac73', '1b8a7913-4e90-46fe-8bc2-67e6aee98bdb', '3185be5f-e65f-4fa1-a9d8-2ed0bd7c59df', '0509b6c1-9dd5-4cbc-9632-6b345de86401', 'cec-historical-candidate-b6a88307f41c1a63', TRUE, '無黨籍', '5', 1401, 19.13, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6aaf766b-09b0-4e41-ac80-fdd7f8beaebb', 'cec-historical:4cc9b4eb7606', 'cebf2e0e-893f-44d2-b509-79f1b497b38f', 'e3095df7-9c14-43a4-a091-8b60465dbfe4', '9144541c-fbb8-4a4f-971f-bf0a282754f1', 'cec-historical-candidate-7fc16f059c622d82', TRUE, '無黨籍', '4', 195, 10.24, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺東縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6bc2d6f3-2df9-48ec-b26e-21c0c686bcdc', 'cec-historical:7e9d3d8a328b', '0ddba0c8-ee7c-4483-acce-b2492c7fa844', '8a217bc0-7787-4c16-b28c-ac51a4ef2900', 'dbb071d8-a3d8-4d10-a37b-9161f161fcd4', 'cec-historical-candidate-e23d383822681fa1', TRUE, '中國國民黨', '3', 770, 39.35, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '6e852ce6-23b6-4e7a-9c1d-ea18330c48a6', 'cec-historical:6f97d2a56e36', '2371248c-8e93-466a-a799-0eac41d536bf', 'db5b4bbe-191c-45c7-b37e-c6e3afe8fa25', 'afd0b251-1007-4062-a98a-651933efd388', 'cec-historical-candidate-7fcc6ac6a99b05ff', TRUE, '無黨籍', '1', 3535, 36.09, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|南投縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '7014717b-6005-4c34-88d3-a88b5c1fef94', 'cec-historical:64b86bd5e94d', 'e9e6d60a-197c-d7fe-be08-2789d5cf100a', '9f2c42ff-d2d1-4f23-a7d5-8bc41e3dd88c', '40b75b23-1970-4765-8f54-2dbecfda004d', 'cec-historical-candidate-d577db1e75db5bf0', TRUE, '無黨籍', '2', 1171, 31.35, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺中縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '7153a193-3b1d-4d3b-a54c-f4c05f70be98', 'cec-historical:e94550972cce', '60bba821-72bc-447e-a542-cc82cbde8c1f', 'e3095df7-9c14-43a4-a091-8b60465dbfe4', 'e53a0e5c-ea94-4f9d-915c-85bb34d063d3', 'cec-historical-candidate-275eb61a18e39321', TRUE, '中國國民黨', '2', 730, 45.17, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺東縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '736a440b-aa4f-4851-8d61-d43b8af567a7', 'cec-historical:d3d218269045', '2b3df0f3-e034-426c-91c1-13b4c98ca309', 'bfaf3da5-9fc1-47c6-918d-4524ad2199dc', '7b46df2c-1310-42a0-9dcf-e4bb9ad5b4ab', 'cec-historical-candidate-a1c83d6e394bfcb5', TRUE, '中國國民黨', '4', 946, 31.5, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|宜蘭縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '7445d873-dc09-42c3-b0b3-fc53d7988d00', 'cec-historical:f22264387acf', 'd663875f-829d-438b-a26f-cfa4292217c8', '147fd846-8741-4e58-92a7-a3bcbc785a7b', '8c419b09-d344-4bd1-84dd-653f370e1ff4', 'cec-historical-candidate-bc6b3753d84e6801', TRUE, '無黨籍', '1', 680, 22.64, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|宜蘭縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '75e28419-4032-4c45-949b-8e37d3ef9209', 'cec-historical:9d47725ff2f8', '17e8b214-a3db-4c16-b205-0181030746ee', '0c77ddf8-afc7-4e51-a711-d00b4e17a794', '84d68127-5780-4ff3-a23d-33541510db5f', 'cec-historical-candidate-b3f9a1dbb7d6e4e0', TRUE, '無黨籍', '5', 1401, 19.13, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '76f2ac0f-6c3d-41b8-a341-eb876423c1fc', 'cec-historical:25c34a559937', '8ea070c4-ee20-4fae-bb43-15c33e7b71de', '1fb6bc39-cc9a-4e72-8a80-4d5731a6dd3f', '9c9c16c6-1738-41ac-9daa-b1c6559c60f6', 'cec-historical-candidate-62d3ad535a757764', TRUE, '無黨籍', '4', 632, 20.75, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|屏東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '77a81bb6-c075-47f8-8061-4479c4e8616f', 'cec-historical:e9a2b45b600d', '95d45918-a8e2-5688-391d-23ec88210b3e', 'f8dc7d3b-921f-4090-8ed9-84cafccf7e08', '0c0c6f19-9d52-41dd-83fb-f9a35c448591', 'cec-historical-candidate-8a37f9621564a8d2', TRUE, '中國國民黨', '1', 1417, 49.63, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|苗栗縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '7c5edc93-7b12-4c98-8e7e-f1fb17539b97', 'cec-historical:e0512c90c97a', '9936b0dc-82cb-49ad-a819-ed4b53273970', '2bae1d05-c31f-48d7-bbf6-0b5656620ab7', '78926ef7-9d1d-4cd7-a25e-3f714a8f28a6', 'cec-historical-candidate-c6d973ee11d8097c', TRUE, '中國國民黨', '3', 1113, 38.41, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|高雄縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '7c64f115-9b45-4943-a3a6-4db9f86db17e', 'cec-historical:6dde1919ba61', '9cfcda22-76b2-48e3-96bf-31d605e07dfc', '8a217bc0-7787-4c16-b28c-ac51a4ef2900', 'e353dfea-bc73-47bf-b103-a540399d8d73', 'cec-historical-candidate-06094c463835d8fa', TRUE, '無黨籍', '1', 886, 54.83, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '7dc49ecd-6157-4e74-abfb-1e526f3d9c47', 'cec-historical:d93dcd125ffa', '1edae40b-0f99-6bed-ea1a-c1b0083116b4', '493f5497-e86d-407f-b75f-e149561eae77', 'e486d5f1-e0a5-4bff-9c5c-403efbf30d58', 'cec-historical-candidate-0997ad493db36506', TRUE, '親民黨', '1', 1700, 100, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|高雄縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '7ed3f9fc-0daa-4d8d-b5d6-68b3d2b605b4', 'cec-historical:65ffe0f33eba', '1749b069-7111-47ae-89cd-608b6cea04d6', '844fb4d4-906e-4938-9852-7fac2a7109e9', 'dfcee26d-b398-46d1-8e6a-18299c274d46', 'cec-historical-candidate-458833336b4247f7', TRUE, '無黨籍', '2', 873, 8.45, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|嘉義縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '80d5e72d-b835-4856-a188-b814c437c67b', 'cec-historical:2c7647c13a49', '42e2ca49-9f42-4091-9903-dbcbc9872c9e', '1fb6bc39-cc9a-4e72-8a80-4d5731a6dd3f', 'b37beb3f-890c-47bd-b0d2-1409bcd9a802', 'cec-historical-candidate-b5fd5663d8a45470', TRUE, '無黨籍', '2', 570, 18.71, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|屏東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '813db245-46b6-4452-8162-2448b26c0948', 'cec-historical:4883549b61f8', '5daa9dcf-51bd-78f8-4a03-f45913ab7471', '0a0e71dd-76c6-4bbd-9c11-b03d366ee7ca', '6651d155-7a14-48fd-966a-b9d4eeeb41ac', 'cec-historical-candidate-70901c17d4577524', TRUE, '親民黨', '1', 1139, 37.83, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|花蓮縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '84350006-83cb-474e-8b6d-63c8e53c332a', 'cec-historical:5df9ee6e411b', '22abb088-21b0-4c4e-8ff8-402458553ca2', '0a0e71dd-76c6-4bbd-9c11-b03d366ee7ca', 'df2eaa21-cdaa-4be4-9a7f-6e97c38f8509', 'cec-historical-candidate-ef41f76785d22305', TRUE, '中國國民黨', '2', 1872, 62.17, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|花蓮縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '847b7eb3-3c1e-493e-b11b-7f7aa81ca738', 'cec-historical:3f1fd5721eea', '1400790d-e8c6-4dd4-bcd4-055606ef2fb7', '1217d46f-de76-42be-9672-9b619e90f899', 'e8c75eef-01bd-4046-982c-7b5ec86cc92d', 'cec-historical-candidate-8e1778661e911b4f', TRUE, '中國國民黨', '2', 1445, 49.86, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|高雄縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '86533a8c-33a5-47ac-a315-073f8ce09a19', 'cec-historical:d07f4ef6a485', '933d604d-5a6b-4615-bfae-b0a9479b4ebc', 'ef2a228f-9eae-4ff7-8a59-6d06be2a95f5', 'e09fe0bd-0a24-4ac2-ba46-4e8aac0a6963', 'cec-historical-candidate-cb76abee6ca6e93d', TRUE, '中國國民黨', '2', 1872, 62.17, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|花蓮縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '8661b3d1-2d31-4e61-acaa-97f3eee6644d', 'cec-historical:b81b37959759', '166c996e-3c22-45d2-8636-ecd2a50f6661', 'b437f1f2-ecdc-462a-ac54-a703d8e46f35', '09b779b1-58ef-40ee-a30d-4985be4db19d', 'cec-historical-candidate-78936c601303b297', TRUE, '無黨籍', '5', 630, 7.31, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8d389d2e-f838-48d1-af12-9832df4bf22c', 'cec-historical:96af3a8e3058', 'e6fecff0-169b-46ee-ae6e-888179d54342', '5dccb1da-3167-4ebb-a28b-bba7d0367c5c', '09d856bc-6668-4fc8-b7a4-16f44f4b76a0', 'cec-historical-candidate-3d4850bcfc810b34', TRUE, '親民黨', '1', 304, 35.72, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺中市|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '91dc8ca4-e726-4b57-8750-8f3c3409a949', 'cec-historical:58512f5c561f', 'e117435d-40d4-140d-6778-3f0a305ce88b', '871db566-6c12-446d-86f7-5177d2e18623', 'e3d3e201-ae1e-48a5-a0b8-2a6567dd9625', 'cec-historical-candidate-87abb98a50ec436e', TRUE, '親民黨', '1', 48, 5.37, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|彰化縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '92ed9fd0-f020-43af-a165-44bfe42554b6', 'cec-historical:7c0530921915', '9d43f2a7-e407-3cee-a675-3daaae99e9f2', '871db566-6c12-446d-86f7-5177d2e18623', 'cf06276a-6a8c-44af-ab50-14373ce82c6a', 'cec-historical-candidate-4f5909d69e4f8933', TRUE, '無黨籍', '4', 27, 3.02, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|彰化縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '94705cc2-939b-45d5-ae0b-174e9ac51165', 'cec-historical:118bd988bc42', 'cb83357c-484e-485f-8055-eca02d538b96', '871db566-6c12-446d-86f7-5177d2e18623', 'ddcec7f3-5d8e-430f-a16e-f455dce15648', 'cec-historical-candidate-dfeb399439289403', TRUE, '無黨團結聯盟', '3', 198, 22.15, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|彰化縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '99abca7b-45f5-4477-a5b9-5c7001a20b29', 'cec-historical:a6e261f966a4', '57f6130a-cdfd-450b-ad85-468c27114fba', 'c6e5d443-3354-4f39-b13e-72e3ce71fbe5', '2cc73d32-8dc0-4f3d-ab1c-4b8f68677a8f', 'cec-historical-candidate-964e395e5f64e042', TRUE, '中國國民黨', '2', 730, 45.17, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '9ab4f9fe-0352-4957-a798-22217c8cee4f', 'cec-historical:9d198c8b84b6', 'fa0c099a-f04e-4503-b405-405ea61fda79', 'bfaf3da5-9fc1-47c6-918d-4524ad2199dc', '45128954-7235-41fc-9737-7734a4703dfc', 'cec-historical-candidate-cd325812b24d0aa6', TRUE, '親民黨', '1', 680, 22.64, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|宜蘭縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '9c07193d-6536-42a1-9563-60ecd35b4086', 'cec-historical:b4d75ac62698', 'd5f0d0cd-94ab-4293-a0f5-583210b06861', '1fb6bc39-cc9a-4e72-8a80-4d5731a6dd3f', 'eae5b066-e6c6-4444-bd3a-8d0f3dad9202', 'cec-historical-candidate-74dc34fb1c253abf', TRUE, '中國國民黨', '3', 988, 32.44, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|屏東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '9d1cb30f-bbcc-4016-ba3b-826f5cbc3a1f', 'cec-historical:5c27dcff22cf', '61979ec4-b837-4a82-abf9-df29df38a6eb', 'ba23235b-a8b6-40e7-9045-737da8d97321', '37ce3ca8-ced4-407f-9939-d964eb21b220', 'cec-historical-candidate-95493b4d12f3d9d2', TRUE, '親民黨', '2', 1158, 62.7, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺中縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '9d978766-d3a0-4782-a41b-6d8b9099d493', 'cec-historical:c0daaeed4a3c', '8b2b5c19-e40e-c386-0512-01222e4f47ad', 'e3095df7-9c14-43a4-a091-8b60465dbfe4', 'ea7e2c30-9b98-48f5-a100-6b06407d6897', 'cec-historical-candidate-0c778d6845c73535', TRUE, '無黨籍', '3', 770, 39.35, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '9f5632f4-ae53-4239-b93e-7e61a3dcdc53', 'cec-historical:67c278f97edf', '41e77d15-7faf-49af-a913-7c99b8656cf3', 'dbe86880-ce6c-41b8-8288-6d6068cd14cf', '05ffb254-28a1-4fda-ab53-9853bcc481b3', 'cec-historical-candidate-2fe977aae10e22bb', TRUE, '無黨籍', '1', 954, 10.84, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺北縣|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a3c8b536-1215-4c81-b748-67ec76d9918d', 'cec-historical:0f6694a9216c', '260ec97e-7b44-42bd-bc67-82ce30b10598', '59558596-417c-49e5-9950-b3797c1a6e17', 'c23677a7-3e05-4ecf-98a3-17d214d6b672', 'cec-historical-candidate-39146e650cdfac71', TRUE, '中國國民黨', '2', 1019, 13.91, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺東縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a4ddec0c-f4bb-4386-97da-2e05ec10b086', 'cec-historical:8b2e58067a3e', '8418e4e4-3cd7-40f0-9f85-1dd2dec68557', '5dccb1da-3167-4ebb-a28b-bba7d0367c5c', '71f589a4-c6db-4666-a34b-38f8bb81f617', 'cec-historical-candidate-8094e949f8cdcc82', TRUE, '中國國民黨', '2', 408, 47.94, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺中市|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'a73533bc-9f07-4484-a5b7-9798863c6a62', 'cec-historical:61612e83e950', '74184be8-ea85-4bc3-b4c0-17140eb1a8dc', '3e0272fa-525f-47f3-af74-d7786bc75fc9', 'e138aff4-3ec5-488f-ba44-58a275c8eb49', 'cec-historical-candidate-d9c59157a48befab', TRUE, '中國國民黨', '2', 2819, 44.6, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|桃園縣|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'a9b96cbc-cd37-4b49-a0d7-5abb0b121778', 'cec-historical:381fa0f3f174', 'd09acd1c-c77e-4a87-89dc-f1e44aaea2a1', '0efceda9-294c-4af0-8000-8b3e6026d7d9', '813363ee-f6a4-4de6-b211-47f4ace414bc', 'cec-historical-candidate-eeb7534f6ee8859f', TRUE, '無黨籍', '5', 115, 1.11, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|高雄縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'acdec0a3-42a4-431e-9703-92d52160a2ee', 'cec-historical:449c714fa2db', '65081d03-b5b3-1fb6-9095-10ad8229cc11', 'b437f1f2-ecdc-462a-ac54-a703d8e46f35', '39cc3552-2675-4e90-8691-7cfb4cbb1e52', 'cec-historical-candidate-9c15b6afe315001a', TRUE, '中國國民黨', '4', 1322, 24.52, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'aced8bea-6d04-4afd-9f8b-980da979b736', 'cec-historical:1f78d4bf7963', '3b49119b-d1c9-5aab-5f50-e14a00e1bebd', 'f1637792-228b-4f07-b462-434266fa99ef', '4e25fd2d-44c8-458c-bcb4-f394661cc7bd', 'cec-historical-candidate-711ef334ccc89d1d', TRUE, '中國國民黨', '3', 1208, 36.09, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|新竹縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ada818c7-15ec-4fbf-97a8-17e360abb83f', 'cec-historical:2658bbb8f5a8', '19555b85-d58b-4405-8728-07d7f2569c45', '3185be5f-e65f-4fa1-a9d8-2ed0bd7c59df', '53542da7-32ec-4bd6-bdf8-7cdaf53b8f66', 'cec-historical-candidate-fe1b04187003e50a', TRUE, '中國國民黨', '3', 1084, 14.8, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺東縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'ae72ddd8-ae18-49ba-be90-3bed7dc082f5', 'cec-historical:6357caad7b39', '5059cab1-06c2-4e08-82f3-612ce9a9933b', '0efceda9-294c-4af0-8000-8b3e6026d7d9', 'cb4ed5ea-bbca-4006-8c0a-0b1ec604a0c9', 'cec-historical-candidate-dc2f72b821b43044', TRUE, '親民黨', '4', 322, 3.12, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|高雄縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'aeaace48-6926-49a9-9d15-8453414e33c0', 'cec-historical:d727c7337fbc', 'c371d90d-17c9-43cc-9728-0005a5a2154b', 'e523bc04-b502-4488-946a-f110265bb718', '4e5b751f-35b7-4d1f-b50f-c4e1de64d6cd', 'cec-historical-candidate-217c3d749c28970c', TRUE, '中國國民黨', '1', 886, 54.83, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'afb47ee8-90bc-4b64-b492-fb714be28134', 'cec-historical:55a71848b2de', '03f66137-332d-4340-8165-52fb0cb16873', 'a6235a91-4cb5-4bb9-b9fd-9f33f726562c', '0947129d-840d-47c4-87e9-60f00b479d4a', 'cec-historical-candidate-92a0aece3cc20ff2', TRUE, '中國國民黨', '4', 1322, 24.52, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b3e3afca-282f-43e1-b1c9-60c0abe6a9ca', 'cec-historical:eb8d875368ba', '307d8902-1b63-22dd-3a20-6998da133e3a', '147fd846-8741-4e58-92a7-a3bcbc785a7b', '44db9f0b-260e-438c-ab7f-ef52adb1743f', 'cec-historical-candidate-ced19da9e92fb599', TRUE, '中國國民黨', '2', 346, 11.52, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|宜蘭縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b51f77fb-cd80-4ce3-a044-6fc23e47d2d7', 'cec-historical:c3c0db0394ac', 'b62c03bd-2641-b853-f722-abb037ef43ff', 'db5b4bbe-191c-45c7-b37e-c6e3afe8fa25', 'b92c5f33-a381-44c5-9ef1-dbc9abbd1a0e', 'cec-historical-candidate-db0ba992e9593b91', TRUE, '中國國民黨', '2', 2748, 27.76, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|南投縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'b742ec70-c63b-46e6-8866-74c3ca7bccdd', 'cec-historical:5df2a767ab10', '04fdf83e-f8f4-46de-a6a7-6e9a2796881a', '520c0f0a-8c5c-4c36-9ea4-e9891b9f81a0', 'ed42276d-1d98-4ead-beb3-11eede724aa4', 'cec-historical-candidate-6473cd9fa7649dbe', TRUE, '中國國民黨', '2', 1612, 42.39, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺北縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b9da2636-ef39-4f2a-bca3-7dfae2e1bc67', 'cec-historical:b9b88b26fb18', '6f25cd54-eb66-4826-aab1-bf0abb8d03d9', '2bae1d05-c31f-48d7-bbf6-0b5656620ab7', '340d1309-f9be-4a45-af8b-1a1932cec154', 'cec-historical-candidate-e28d269c91e85030', TRUE, '中國國民黨', '2', 1445, 49.86, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|高雄縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'ba87cb28-ff37-464c-85dc-f64da5b5b016', 'cec-historical:4e3d3fa4fd60', '603177ca-c298-4f44-a953-872b738a93c6', 'a6235a91-4cb5-4bb9-b9fd-9f33f726562c', '6eb558c4-eb95-4208-a6bf-a78946c91d26', 'cec-historical-candidate-5172435a823b9dd5', TRUE, '中國國民黨', '1', 1108, 20.55, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'bcd8b1aa-3bf8-4848-ac3d-087ff481eac8', 'cec-historical:f1ce8e9e85ed', '1fa48ff7-149d-4c83-bc31-05ebe2d2d57b', 'be461f75-3fec-4abd-8eff-9a63a5a1a49f', 'ac568001-f8a8-4645-af64-938d65a2daaa', 'cec-historical-candidate-01a2ecc0d707434b', TRUE, '中國國民黨', '1', 856, 28.1, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|屏東縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'bef9151d-1c27-4a5a-8e87-f8ae2c6e0d10', 'cec-historical:df2125a27750', '7b6674f4-5d41-44f3-8d55-bd117a782a29', 'b11da923-3c0c-47a5-aad2-38541214af1a', '5e7a1ffe-c4ad-4473-b7f7-dcf2f2a8eb30', 'cec-historical-candidate-a1cfe558b1945efe', TRUE, '中國國民黨', '1', 856, 28.1, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|屏東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c1907510-3fdb-4d14-8b2d-0a3560969b94', 'cec-historical:21a800d2b111', '25e14beb-f0d1-4adb-a256-31db4d864c85', 'a6235a91-4cb5-4bb9-b9fd-9f33f726562c', 'a0ecc88d-96f9-49f3-be79-38276b6db30e', 'cec-historical-candidate-e72d663e8d38d6a4', TRUE, '親民黨', '6', 1490, 17.29, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'c21aac13-f31e-45ce-8181-e443e3c7d2f0', 'cec-historical:9546b8faca6f', '3700d84f-2251-456c-b55b-4af80997d7a3', '3185be5f-e65f-4fa1-a9d8-2ed0bd7c59df', 'cc63aaa8-0deb-491a-b1f2-ba401ec8f9fc', 'cec-historical-candidate-9db812f633b44642', TRUE, '中國國民黨', '2', 1019, 13.91, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺東縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c24cc611-2ee5-4f39-95f7-b4cdfeb17b8e', 'cec-historical:d10581ebe9b7', '4bb72abd-b786-4e76-ae6f-81149c640560', '520c0f0a-8c5c-4c36-9ea4-e9891b9f81a0', '835a0e21-0442-4d74-9e59-d112e42c6630', 'cec-historical-candidate-7b7198d2d9ea89a1', TRUE, '無黨籍', '1', 1164, 30.61, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺北縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c551d362-bc4b-4b6c-b043-15c8f02001d0', 'cec-historical:08a274c121fc', 'ba132a68-8c70-401d-9a81-41b3d02b758c', 'bfaf3da5-9fc1-47c6-918d-4524ad2199dc', 'b5f81ed5-a70e-485f-bacd-df4c43f0e210', 'cec-historical-candidate-ad6dfe47b00a5a43', TRUE, '中國國民黨', '2', 346, 11.52, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|宜蘭縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c8966f99-1218-4e0c-a69d-747fa4eec11b', 'cec-historical:b6ad1a91ba12', 'a177c195-c8cf-4627-b438-d8cad639831b', '0efceda9-294c-4af0-8000-8b3e6026d7d9', '891e2cb7-fc03-4d7a-bd62-fd98a374813a', 'cec-historical-candidate-38a0eb4853cc73ed', TRUE, '無黨籍', '1', 150, 1.45, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|高雄縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c8a5e7ba-5bd8-4a30-a801-cd770ac39560', 'cec-historical:23eee7470179', '918f2c6f-9d3d-a6a3-9bfe-0ff4a0df436e', '52d33c35-7ad2-4240-bf36-e4487ee42c5a', 'a9c60b21-e70a-44e2-b203-4289bef24b89', 'cec-historical-candidate-46fec4c3ef93b158', TRUE, '無黨籍', '1', 3580, 54.01, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|桃園縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'c9f8a14c-7b6e-49fb-bf87-5ae995f292f6', 'cec-historical:2be2ded4d94a', '516192a8-2cd2-4481-8b8a-b1f17c33403f', '0bdc3203-4113-41e6-8673-8fe9b8a02516', '906923e1-e88f-4489-af09-0f1291c39d29', 'cec-historical-candidate-4739d7011709beae', TRUE, '無黨籍', '1', 886, 54.83, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'ca0cac03-861c-4e28-809b-c356634d889c', 'cec-historical:56d0f2fe2f21', '1f50fbad-b55a-4a2e-a35a-324873c87f2c', '59558596-417c-49e5-9950-b3797c1a6e17', '6240decf-98a8-4038-ade1-9bb6c551d766', 'cec-historical-candidate-bd762acdfe0bb4f7', TRUE, '無黨籍', '3', 1084, 14.8, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺東縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ca8b3c4b-62be-4a95-9814-630ffaa61ca0', 'cec-historical:2b9fe2becd5d', '79542653-9954-4616-90ce-6d4cc3fe5494', '59558596-417c-49e5-9950-b3797c1a6e17', 'bb82211d-5403-489d-a83b-3eaff5c9a745', 'cec-historical-candidate-fb01c0955199ca1e', TRUE, '中國國民黨', '4', 1884, 25.72, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'cb35a688-9028-4340-817a-1a1d0f5611b1', 'cec-historical:6e23216c74c5', '47e07913-9c20-428e-83e4-572e1cf0c302', 'e46c2f0c-6064-4fec-a4f5-8349881a300e', '01463d0b-73c3-4618-a91a-8a9cba8036a3', 'cec-historical-candidate-d3bd3494b85ff7b0', TRUE, '中國國民黨', '1', 1139, 37.83, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|花蓮縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'cd856b01-cbd7-4298-9980-97741f47b8cc', 'cec-historical:ab729d3bfe41', '0fb6f6b4-bf73-c10e-ac4c-ecdbe73a09dc', 'f8dc7d3b-921f-4090-8ed9-84cafccf7e08', 'f69b39a1-5b7f-4c0a-b0c2-70324ccb90e6', 'cec-historical-candidate-f8c92f30ea8570c3', TRUE, '中國國民黨', '2', 1438, 50.37, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|苗栗縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'd090bbd5-f827-4b0d-8ad6-1b6de8425508', 'cec-historical:6ee5a59e92d5', '0ea1d15f-c8f2-4097-a91c-742c630c882e', '215c8866-8f7c-471c-a84a-38fce25728cb', '0e791540-8170-42b0-8212-6cf9fc428a03', 'cec-historical-candidate-fef32eb713bdd853', TRUE, '中國國民黨', '4', 1322, 24.52, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|花蓮縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd2e1e142-958b-4048-929f-7046be176eb5', 'cec-historical:e882b385ad3f', 'e41fe3aa-c3f3-45ac-ac1b-081bb6602f70', '0efceda9-294c-4af0-8000-8b3e6026d7d9', '87c99f61-bfce-4ec5-9739-12d365165b7f', 'cec-historical-candidate-9004dd047e3215ac', TRUE, '無黨籍', '3', 103, 1, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|高雄縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd75ded75-4fcb-4826-bdcb-5e5e95b0895a', 'cec-historical:b7a5646d7fd9', '2eea51a3-8088-46f7-82a2-7312f31fc306', 'ba23235b-a8b6-40e7-9045-737da8d97321', '34cb4817-3bbd-429f-917c-c6cd549d712f', 'cec-historical-candidate-d0fa711cb0a290a5', TRUE, '中國國民黨', '1', 689, 37.3, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺中縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'dc48f8f4-d11c-424f-b7ee-46212219b03b', 'cec-historical:01ce6c9cd5e1', '69170684-77d5-42d0-ba3a-58012c3a0987', '53ea29e7-5b50-41ab-801f-7f97d4aada31', 'e97c67e5-091c-4603-99b5-74401e77dffa', 'cec-historical-candidate-12856f5635aa52b8', TRUE, '中國國民黨', '1', 856, 28.1, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|屏東縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'de63fbbe-75de-4313-abcb-ede25dc46161', 'cec-historical:d1dc270aebdf', 'a9a8aaa9-6d44-449e-aad6-e340dbfadd84', 'b437f1f2-ecdc-462a-ac54-a703d8e46f35', '7612acd6-641c-4470-b009-9fd671206bb6', 'cec-historical-candidate-221f24df0104d8f9', TRUE, '無黨籍', '3', 1307, 24.24, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'de92bca3-7ad1-488d-9116-bb2316f859a9', 'cec-historical:3f5ae7284125', '0f57bee2-f612-4fc5-a402-d5a94494f718', 'e7c19c2d-49d6-4a86-bf33-d201b7e9f5df', '017c00ae-7392-4fab-8d75-ca88f0408a1b', 'cec-historical-candidate-0057fe77157391be', TRUE, '中國國民黨', '1', 856, 28.1, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|屏東縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e00dec86-d280-4268-b6d8-0f9f70167c8b', 'cec-historical:649400036bf2', 'ff5ef915-970a-4f75-a02e-b98880a94b15', '65044be3-0eca-4745-8021-47611e1a2e0b', 'a19bf38a-3db0-494a-a967-b1d298523f94', 'cec-historical-candidate-be6ab4835d12c3cc', TRUE, '民主進步黨', '2', 172, 6.26, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|基隆市|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e0654091-3031-4d38-87fc-f7f37569d89f', 'cec-historical:97bb6f5b7512', 'b3df7c62-5d25-4c05-877b-73f9ddb49989', 'f1637792-228b-4f07-b462-434266fa99ef', '0095eca1-50cb-4704-ac62-f344550737a6', 'cec-historical-candidate-75d00fd24107b8f9', TRUE, '中國國民黨', '2', 1074, 32.09, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|新竹縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e1680633-b9ad-41eb-b44b-a77edc97489c', 'cec-historical:6917c8ad70eb', '379b857d-759e-44f5-baa0-a48cd008d75f', '52d33c35-7ad2-4240-bf36-e4487ee42c5a', '02d08262-d71a-40cc-9e8b-975f4bf9500b', 'cec-historical-candidate-5cc6024f95519d55', TRUE, '中國國民黨', '2', 3049, 45.99, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|桃園縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'e5d3d55e-8431-4628-99da-fbf602d9697a', 'cec-historical:453fb4dca1a4', '61b702e3-1dc7-475e-9d50-2813fb79c870', '3e0272fa-525f-47f3-af74-d7786bc75fc9', 'c0c5ffbe-426d-42c6-81fb-c91808e52014', 'cec-historical-candidate-e8fca175d8f753e2', TRUE, '中國國民黨', '1', 3502, 55.4, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|桃園縣|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'e7ba83f0-72e9-4423-8660-8727a4a4804b', 'cec-historical:840d2d3ca6a2', '55c12aa6-06b1-4875-a1f6-04c32909c341', 'd7b3edc6-e081-4f58-8e10-e76b2f92d516', '86b2cbb3-4d3d-41af-87fb-ff552c73630d', 'cec-historical-candidate-a3731d61a4085aa9', TRUE, '中國國民黨', '1', 1276, 17.42, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|臺東縣|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'e83199a7-c922-43dc-b228-e97d8b94b589', 'cec-historical:da1732ea522d', '47d822f0-1246-4343-94e2-c5c3ab96ced1', '844fb4d4-906e-4938-9852-7fac2a7109e9', '4e3d4fa0-b07a-4892-9cf7-ec9a1147f312', 'cec-historical-candidate-31890548abb0a465', TRUE, '無黨籍', '3', 414, 4.01, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|嘉義縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e8d6ec51-07ab-48f9-bce4-4db9c56c171c', 'cec-historical:71a6e0e198ba', '9ab5856c-f4c8-4e35-be8d-f318e42c3a71', 'b437f1f2-ecdc-462a-ac54-a703d8e46f35', 'a09be5d3-a7a3-48ed-87f8-570e424ff9ab', 'cec-historical-candidate-9fc7b3e8c73c769a', TRUE, '無黨籍', '6', 1490, 17.29, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'eb3a4577-be65-4e8b-9ab1-6f1c6311c2a8', 'cec-historical:538b5220bb4a', '0c501325-8f45-4962-9b10-3e84ddbabc09', '65044be3-0eca-4745-8021-47611e1a2e0b', '3adf4d5c-519b-409b-8664-22fc0d705530', 'cec-historical-candidate-0e8c49a54594887c', TRUE, '親民黨', '3', 1242, 45.18, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|基隆市|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'eb7925a4-97c8-4818-92f6-9d999e1da71c', 'cec-historical:e42cdfc40260', '938ed224-7d7f-4ff5-9b5c-5866b602fdb3', '215c8866-8f7c-471c-a84a-38fce25728cb', '0bf40a8a-3f6c-477b-bc21-39d07a37f051', 'cec-historical-candidate-587a52df8c6fe89f', TRUE, '中國國民黨', '1', 1108, 20.55, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|花蓮縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ee638274-9046-47a0-ba32-3a0596a7763a', 'cec-historical:765ecadaa9bf', '06b4b844-7b5f-46d5-96e7-2c669a66f52f', 'bfaf3da5-9fc1-47c6-918d-4524ad2199dc', 'f1929324-7b59-4aaf-bf91-3d5b983179be', 'cec-historical-candidate-99fd1c5280e7097d', TRUE, '中國國民黨', '3', 1031, 34.33, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|宜蘭縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'ef7a7405-e256-4851-972d-4270dd14aa4a', 'cec-historical:074d23da95e7', '60e6abe6-bbb3-3044-cbae-0c6237b1aa4e', 'f1637792-228b-4f07-b462-434266fa99ef', '67aac84c-8f63-483b-8ffe-02b6261cce54', 'cec-historical-candidate-370dd3c458b15644', TRUE, '中國國民黨', '1', 1065, 31.82, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|新竹縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'f1f9a779-5bd5-4712-b5de-2e6b53e447cc', 'cec-historical:482a9e8d2f93', '935828b7-5629-414c-954b-3d62d9ea7ae9', '3185be5f-e65f-4fa1-a9d8-2ed0bd7c59df', '75d2daa6-cf1e-49cf-b03a-b9f489bcf78b', 'cec-historical-candidate-568bb93f31534c14', TRUE, '中國國民黨', '6', 660, 9.01, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺東縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'f489f004-39d2-41ba-b1f5-5b27e7afa762', 'cec-historical:6a3a8df93a2b', '4e0c3338-9429-493b-adf9-ed7897975abb', 'a8478243-622d-4e89-b682-f36051da9a56', '26f2f604-f497-4b0e-bd7e-9e3e63b48924', 'cec-historical-candidate-339200723800749e', TRUE, '中國國民黨', '1', 856, 28.1, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|屏東縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'f965dcf6-dd40-4d27-99d6-58c7fc5ba854', 'cec-historical:20d5058c5c8a', 'e0a60376-945f-1730-100c-e8f290ac1375', 'ae35031e-fa51-48e4-95bd-9a54b2190d83', '4abb41d6-8435-4b6f-98e3-00ce19a8fbcd', 'cec-historical-candidate-645a312490010f26', TRUE, '無黨籍', '1', 556, 100, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|新竹縣|district-10|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'fbcbe87d-7fb5-44d9-825c-18e1306b8938', 'cec-historical:50a885bb212e', '8cd27f2c-d892-4ab2-bc2e-59ba63235e8e', '2bae1d05-c31f-48d7-bbf6-0b5656620ab7', '1a966a46-058a-4e84-ad31-031e0ee302df', 'cec-historical-candidate-43c8f830e63614a3', TRUE, '無黨籍', '1', 1700, 100, TRUE, 'qualified', 'elected', 'elected', 2005, '2005|councilor|高雄縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'fdfe6967-ace0-48ed-a9dc-0ec762c6f0a9', 'cec-historical:8f094a10ec8e', 'a831e697-92c0-bb52-ef25-eadb05d69330', 'a6235a91-4cb5-4bb9-b9fd-9f33f726562c', '18708f2b-91cf-4dd5-aaee-3606c288c4f1', 'cec-historical-candidate-ebc5edd08add6ad3', TRUE, '無黨籍', '7', 1448, 16.81, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'ff9fe730-5e1e-4cd9-96d1-5f11188e9264', 'cec-historical:da0e09ea83b8', 'f1e5ddbc-e9fa-497f-eb5c-c981fbb647de', '0c77ddf8-afc7-4e51-a711-d00b4e17a794', 'e260b090-9ba5-48ef-8262-56e4302c3d93', 'cec-historical-candidate-528fe0e717aa5fe0', TRUE, '中國國民黨', '3', 1084, 14.8, FALSE, 'qualified', 'not_elected', 'not_elected', 2005, '2005|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE);

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
    IF (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730) <> 131
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'create') <> 0
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'update') <> 131 THEN
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
    ) <> 131 THEN
        RAISE EXCEPTION 'Historical CEC migration updated candidate result mismatch';
    END IF;
    IF (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE vote_count IS NOT NULL) <> 131
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE vote_rate IS NOT NULL) <> 131
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE is_elected) <> 55
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'update' AND original_is_public) <> 131 THEN
        RAISE EXCEPTION 'Historical CEC migration candidate summary mismatch';
    END IF;
END
$verify$;

SELECT
    0 AS planned_creates,
    131 AS planned_updates,
    131 AS planned_total,
    131 AS publication_states_preserved;

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
