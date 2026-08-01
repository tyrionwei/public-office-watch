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
    ('update', '0962ca91-1ad3-4c4e-83a2-9cb52c699321', 'cec-historical:9e7260a54e5a', '1d71cc22-5650-45ae-9264-cb8861369c5b', '0779af70-0efe-49f7-9e40-243616984772', 'ad0a0ac3-d153-40ac-85c3-6a78a6f610e7', 'cec-historical-candidate-2ddb181ca1553853', TRUE, '中國國民黨', '5', 1275, 58.03, TRUE, 'qualified', 'elected', 'elected', 2010, '2010|councilor|臺北市|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '0c0221ce-04eb-440b-a1c2-a059b4fdc989', 'cec-historical:2c957921752c', '02b65791-b042-4a48-a0cb-150226218e84', 'c0fc2757-7e8d-432b-82a3-ecc57a3a57fc', '94ead7b6-eaaa-4e3f-ba09-3dba931f0741', 'cec-historical-candidate-75e9f8547d6787f6', TRUE, '無黨籍', '3', 1434, 27.87, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|新北市|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '20301ff1-d5c1-48c4-b528-a898fa1eae18', 'cec-historical:7189b5976f22', '459ae689-688f-4e5e-8f0b-19d54ed3c8d5', '168f77b2-a157-4f06-b182-3891694b02eb', '0703facf-2a3a-4856-8441-fc424445d9f6', 'cec-historical-candidate-a9b54ceaf6e78ad9', TRUE, '中國國民黨', '4', 265, 21.44, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺南市|district-18|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '20de17b3-23d8-466b-93f7-fec9a49b6413', 'cec-historical:f4d1c9592176', 'bbf0afbf-d479-4b3b-a75d-8a2b930ee8f9', '75a97321-87c7-4b9e-bed1-4d5442f12088', '8ab6b683-f159-43cf-9fbb-8fd89fd5d76d', 'cec-historical-candidate-439f451f722168f1', TRUE, '中國國民黨', '2', 1035, 35.02, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|高雄市|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '311a2c05-2d3d-4759-9c59-49fcb1ad17fe', 'cec-historical:a301e3b2eed3', '836ad69d-9b8a-41c9-8b49-f08d0de5eb08', '168f77b2-a157-4f06-b182-3891694b02eb', 'e4ae409c-5116-44f5-98b6-4cb4c0152a65', 'cec-historical-candidate-88e51125f9b06938', TRUE, '中國國民黨', '5', 236, 19.09, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺南市|district-18|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3207b78b-6781-487f-82d4-fdc9fcc3322e', 'cec-historical:7d6d4f42a4be', 'e385bd0e-23a0-4098-ad13-5b100f504633', 'bbaa1e5c-1e07-489e-883a-b80cd272a361', '91145892-6dab-48db-ab60-fb43c3b8f80d', 'cec-historical-candidate-f7ae8f4850022ebf', TRUE, '中國國民黨', '3', 1068, 26.33, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺中市|district-15|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3572e749-71fd-4225-ae42-9af9610142c2', 'cec-historical:5337505104f6', '46f2c4fd-a924-4f82-9f66-88a892b45b52', '4048c031-f9c7-465c-82c0-00a4c2a556bb', '351ef9b6-4f36-4ffd-a399-f8f0810edef0', 'cec-historical-candidate-19ff92f4ffbdbfd7', TRUE, '中國國民黨', '1', 3316, 50.26, TRUE, 'qualified', 'elected', 'elected', 2010, '2010|councilor|臺中市|district-16|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3be936cb-a444-41e9-871f-fd0ae7789f76', 'cec-historical:d41f5434125e', 'b7f39136-8899-4d70-bae4-7209c0f333c1', '7025f71d-dc8d-4423-92c5-8c9ad74e6190', '8dfef242-c093-4b43-9f68-ca600bfcd740', 'cec-historical-candidate-b50dd7602339192a', TRUE, '中國國民黨', '1', 271, 26.1, TRUE, 'qualified', 'elected', 'elected', 2010, '2010|councilor|臺南市|district-17|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3c524596-26af-47c0-b232-f7aa37fddd48', 'cec-historical:e092ef16a460', 'bfd30003-6872-47cf-9297-35d535e52388', 'f5f1f5ed-6f0e-4385-900e-add028a171fd', '6294c283-6cf6-4c52-b06a-c6d4f4b4809e', 'cec-historical-candidate-0b3fc49c26a66d9c', TRUE, '無黨籍', '5', 693, 5.6, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '45c818e4-ce4d-4c71-90dd-1a7f40f16e20', 'cec-historical:03a6b330d905', 'e2b33d81-ce58-455e-aad6-e611ba53292c', '4048c031-f9c7-465c-82c0-00a4c2a556bb', 'ce58ae2e-ac05-4ddd-808b-bba76348f003', 'cec-historical-candidate-a1a57e92896631ff', TRUE, '中國國民黨', '3', 1388, 21.03, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺中市|district-16|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '489c836c-10e2-41e5-a1ee-18834e6c08cf', 'cec-historical:38594e27ba68', '8eadd1c2-7251-4cca-9d41-a572c37e42bf', 'df8adf0b-b589-4ad2-9b42-51456088a305', 'ab0bceb0-7e21-4672-97c1-2c13447b40a5', 'cec-historical-candidate-c1da45ab2bd8b706', TRUE, '無黨籍', '4', 1240, 38.83, TRUE, 'qualified', 'elected', 'elected', 2010, '2010|councilor|高雄市|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '49bad466-9288-42a5-a13e-9c368d975f4a', 'cec-historical:650245421a7c', '7e676ac4-ec3f-4b26-8943-039266906d4a', '168f77b2-a157-4f06-b182-3891694b02eb', '4714f247-f99e-474a-bd12-0f4684e091bf', 'cec-historical-candidate-b7ae6ba59c49f778', TRUE, '無黨籍', '3', 160, 12.94, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺南市|district-18|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '5454e589-c9d2-490a-b8e5-de48dcc9bcbe', 'cec-historical:56232bd9a359', '764a4aee-e9b1-4f4c-83e0-6f5e3ceba958', '0779af70-0efe-49f7-9e40-243616984772', 'c2b3bfc5-21da-4cf2-9789-8853fa2f81cc', 'cec-historical-candidate-74270f08c752814f', TRUE, '無黨籍', '2', 483, 21.98, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺北市|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6400cb16-8178-4242-b8e9-cc36ac126725', 'cec-historical:568151d8b0e4', '8c2f9b50-b181-4b81-929e-7a9bce515863', '7025f71d-dc8d-4423-92c5-8c9ad74e6190', 'b6002801-4a45-4f60-b392-a7ecb8d16eff', 'cec-historical-candidate-c1239df9e49e82f4', TRUE, '民主進步黨', '3', 138, 13.29, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺南市|district-17|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '661d244f-72fe-4ed5-a9e5-00c43d58d56e', 'cec-historical:40f941d8a2e2', '59424fc1-7274-4a56-9d4d-fd7c04014192', '526b0616-b192-437c-a582-4d182941b45d', '7efe1d49-2f85-4289-bf44-43a069c63289', 'cec-historical-candidate-28a2ba8b4ed82db8', TRUE, '民主進步黨', '3', 1876, 47.19, TRUE, 'qualified', 'elected', 'elected', 2010, '2010|councilor|高雄市|district-12|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '66258df3-3df0-422a-a558-5af290759cf8', 'cec-historical:6e78d17dbd80', 'f3ccc47a-5a98-4620-903e-48d3b1e700fc', '168f77b2-a157-4f06-b182-3891694b02eb', '88334670-af8a-47be-b4cb-140a7ac7c144', 'cec-historical-candidate-42a1c2fbda94f1fe', TRUE, '無黨籍', '2', 464, 37.54, TRUE, 'qualified', 'elected', 'elected', 2010, '2010|councilor|臺南市|district-18|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6892aa91-e518-4132-941b-8394d1bf7566', 'cec-historical:87198c0bc2ad', 'e6fecff0-169b-46ee-ae6e-888179d54342', 'bbaa1e5c-1e07-489e-883a-b80cd272a361', 'fded8d67-7506-47b2-a598-6b38afdccc0d', 'cec-historical-candidate-21e94f64ce3a8ea6', TRUE, '中國國民黨', '1', 1619, 39.91, TRUE, 'qualified', 'elected', 'elected', 2010, '2010|councilor|臺中市|district-15|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6b52eed0-1538-48f5-b107-11898b9b390c', 'cec-historical:7f183196f765', '082f11c2-9612-4a8b-839d-ea0a65013b59', 'cb27c2e6-a546-48bb-964d-f056317cc555', '8037e487-9f63-45a4-b2ec-536e2787ed1b', 'cec-historical-candidate-af7bb1228ce0b79c', TRUE, '無黨籍', '1', 814, 26.54, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺北市|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6e8cefa4-459e-45d4-96a7-0649f3a837d0', 'cec-historical:53c0d25cf1b8', 'b938eb30-d5d3-467f-bdc0-57e2c4fb1daa', 'df8adf0b-b589-4ad2-9b42-51456088a305', '6171f71c-0750-4427-b799-55d5b2684238', 'cec-historical-candidate-a67ac1c5c2b5e828', TRUE, '中國國民黨', '3', 1509, 51.06, TRUE, 'qualified', 'elected', 'elected', 2010, '2010|councilor|高雄市|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '6fd8eae7-fddb-429b-a14a-a20e09f13dfc', 'cec-historical:d48fd2816844', 'e6787294-1e4d-497b-9ad0-b330f138ae8e', '7025f71d-dc8d-4423-92c5-8c9ad74e6190', '93fce903-9892-4e45-9f7a-ce963ee6e6a2', 'cec-historical-candidate-21480d7fb000c0cc', TRUE, '無黨籍', '5', 153, 14.73, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺南市|district-17|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '7387042a-9bcd-497d-b3b4-04c6e8b6aa1e', 'cec-historical:d19d352fb4af', '9e493221-1ff7-474d-8f67-dd8b45155919', '7025f71d-dc8d-4423-92c5-8c9ad74e6190', '49742bbb-33c5-44cd-a195-6ec88bdac3f8', 'cec-historical-candidate-9bcef5d59bc295e9', TRUE, '台灣民意黨', '6', 138, 13.29, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺南市|district-17|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '74867daf-68a2-4dc3-b3ea-535713de92b4', 'cec-historical:0166115c60d1', 'bae94b1d-2167-4497-9d4a-be511ce370eb', '75a97321-87c7-4b9e-bed1-4d5442f12088', 'be243296-ceb5-427b-be30-80a4a39c0618', 'cec-historical-candidate-858a2567575540a6', TRUE, '中國國民黨', '1', 411, 13.9, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|高雄市|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '7a873300-926c-4d96-8a9d-534b75b1078f', 'cec-historical:9e83f0ad5816', '5059cab1-06c2-4e08-82f3-612ce9a9933b', '526b0616-b192-437c-a582-4d182941b45d', '6fa1f1a4-dd09-4917-885f-6aa09e89acdf', 'cec-historical-candidate-99e9d7174e025029', TRUE, '中國國民黨', '1', 1135, 28.55, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|高雄市|district-12|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '81b49242-ddbb-4b7a-9236-0f9d7bd2260c', 'cec-historical:0bded7f9889a', 'a40227e1-d24a-44f0-9ddf-f85d3a844a08', 'f5f1f5ed-6f0e-4385-900e-add028a171fd', 'f3748cb6-eb6c-43a6-a05c-0662614b1ceb', 'cec-historical-candidate-0141628949bfd6aa', TRUE, '無黨籍', '3', 642, 5.19, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '81c19931-f325-4917-9d58-7117a64c8c68', 'cec-historical:37f516de5661', '9cd7498c-8440-4660-b9c5-b26646eb9cde', '7025f71d-dc8d-4423-92c5-8c9ad74e6190', '4a41e78e-92f9-4cde-b0f4-d7fc9eee7def', 'cec-historical-candidate-31072a73a0b8bf1a', TRUE, '無黨籍', '2', 98, 9.44, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺南市|district-17|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '87b4ba75-758f-44b2-a493-fd09c1611114', 'cec-historical:acc447e43843', '272b9c7c-81a3-4a08-be16-3460f1acce1c', 'f5f1f5ed-6f0e-4385-900e-add028a171fd', 'd72128df-39d3-4dec-9bc7-5349015767a3', 'cec-historical-candidate-6911434f6f311f77', TRUE, '親民黨', '7', 379, 3.06, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8dfe3f8b-d8e5-41ef-a900-418df0f58f33', 'cec-historical:6a6f07d7b601', 'b790710a-4e1b-412e-bbba-c98488a9e6ac', '2f57687e-483f-40cf-bcf1-e78d1e6a4155', '18cd1f55-da74-49f4-bc75-21587379dfa6', 'cec-historical-candidate-b7d749cacede5884', TRUE, '中國國民黨', '2', 1035, 35.02, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|高雄市|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8fde0ada-e096-4a8d-a5fa-631f5ae6bba7', 'cec-historical:ccf15228d60c', '04fdf83e-f8f4-46de-a6a7-6e9a2796881a', 'c0fc2757-7e8d-432b-82a3-ecc57a3a57fc', 'a5beb5a5-e452-4606-bd08-c0448a9ce2b1', 'cec-historical-candidate-c6e289280cd60307', TRUE, '中國國民黨', '2', 1939, 37.68, TRUE, 'qualified', 'elected', 'elected', 2010, '2010|councilor|新北市|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '922e7476-5299-453d-a141-ce1be005e659', 'cec-historical:ca1a9c68f004', 'e99949c5-6f5b-4d6e-ab16-fa91008f84f0', 'f5f1f5ed-6f0e-4385-900e-add028a171fd', 'd22cdfee-db94-4527-8891-31e2dd0f6547', 'cec-historical-candidate-39732086039aa35a', TRUE, '無黨籍', '8', 2590, 20.96, TRUE, 'qualified', 'elected', 'elected', 2010, '2010|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '9a26c319-8441-4d92-8c52-c921ad11bf55', 'cec-historical:41ea4f6d98c7', '61979ec4-b837-4a82-abf9-df29df38a6eb', 'bbaa1e5c-1e07-489e-883a-b80cd272a361', 'd3902cd0-c95a-46c0-b456-5b6610a66d5e', 'cec-historical-candidate-b6d1eebb352c2d4c', TRUE, '中國國民黨', '2', 1369, 33.75, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺中市|district-15|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '9bcc165c-b895-49be-8ee6-2790a1f79ba2', 'cec-historical:ea2f9dffa981', '2ab70f16-9a9a-4739-9c4b-fbf3362de9a5', '0779af70-0efe-49f7-9e40-243616984772', 'bbd8a663-d454-42b8-92c7-e4b25c9a2b2c', 'cec-historical-candidate-dcd6a503981fe705', TRUE, '無黨籍', '1', 205, 9.33, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺北市|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '9ddad8fe-d1f4-483b-be11-6d344a5e606b', 'cec-historical:968ffbe0e31c', '21061fdc-b9e1-40c2-9dee-6b6ae351b9dc', 'df8adf0b-b589-4ad2-9b42-51456088a305', 'bc76967c-185a-411a-ad32-28aedc4d6edf', 'cec-historical-candidate-6303bc47c387aa6b', TRUE, '無黨籍', '1', 411, 13.9, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|高雄市|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a801879b-8252-4586-a8de-7dff709e4347', 'cec-historical:5af4dc0bacfa', '0f4287b0-db4f-4182-8472-9e8103bac4f4', 'df8adf0b-b589-4ad2-9b42-51456088a305', '4a963ec7-f966-472c-a8c3-da624998518e', 'cec-historical-candidate-5a53867707fc7603', TRUE, '中國國民黨', '2', 1035, 35.02, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|高雄市|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'afd014d9-29d6-455e-8045-c59c72d554a2', 'cec-historical:553a70828737', '89486b80-aee3-45ec-9447-bb6d006ca737', '2f57687e-483f-40cf-bcf1-e78d1e6a4155', '856b108f-b469-4c1e-aa73-ec89894aaa47', 'cec-historical-candidate-b2725bb33a1b2bd9', TRUE, '民主進步黨', '1', 411, 13.9, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|高雄市|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b03a42e9-b14d-48ff-89b5-138a71b49cce', 'cec-historical:f0a0fe97fa3b', 'ba1f6eba-e719-4141-b706-91f782fa1cd2', 'f5f1f5ed-6f0e-4385-900e-add028a171fd', '6f71fcb8-dfef-4cc5-811c-e3b7692fd6b8', 'cec-historical-candidate-238e45f4f655fd62', TRUE, '中國國民黨', '9', 1862, 15.07, TRUE, 'qualified', 'elected', 'elected', 2010, '2010|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b625b88d-7b5c-48eb-b4cc-f3921d4d46a6', 'cec-historical:e36926c839a5', '1f19fd19-74e2-460c-9b8d-960cf7b27924', '2f57687e-483f-40cf-bcf1-e78d1e6a4155', '940e3fb6-5b51-42e8-8f56-fa495bb18890', 'cec-historical-candidate-6a4d6cb46cdcb73b', TRUE, '中國國民黨', '3', 1509, 51.06, TRUE, 'qualified', 'elected', 'elected', 2010, '2010|councilor|高雄市|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b94b1045-241a-47ee-a0ca-6a1f18ec5293', 'cec-historical:9264c22e378a', 'f2724032-b9be-432c-920f-28a918bb2b62', '7025f71d-dc8d-4423-92c5-8c9ad74e6190', '033790f4-ed2c-4770-a05f-04b887e7f1ae', 'cec-historical-candidate-f7e0d928a000db1d', TRUE, '中國國民黨', '4', 240, 23.12, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺南市|district-17|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c320efa7-8f45-45a1-959e-9a59ea7b2da9', 'cec-historical:2dd36b4c4354', 'f0431288-fefb-4490-b7a0-4aa95ed8615c', 'cb27c2e6-a546-48bb-964d-f056317cc555', 'd952ff3d-6db5-4896-a411-61b0516c909a', 'cec-historical-candidate-b6569b432bde4eec', TRUE, '無黨籍', '2', 415, 13.53, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺北市|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c6e7846a-17a6-4af0-83b0-54e2b94878b7', 'cec-historical:2203f4291da5', '44b83aa7-5692-475c-a28a-4459e14b6fb4', '0779af70-0efe-49f7-9e40-243616984772', 'b6372147-5afa-481d-9e86-2bdcaf4d7b41', 'cec-historical-candidate-ec6b716a157ebb25', TRUE, '無黨籍', '3', 118, 5.37, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺北市|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'cd34755d-3619-4cca-a6df-74840c589f04', 'cec-historical:9a33927a6e11', '3057fbeb-4a0c-25df-8d6c-43a23f467ad5', 'f5f1f5ed-6f0e-4385-900e-add028a171fd', 'd72e35e1-bb24-47ae-a886-34e114456f9c', 'cec-historical-candidate-7d6e819f94704e08', TRUE, '民主進步黨', '1', 1995, 16.14, TRUE, 'qualified', 'elected', 'elected', 2010, '2010|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd45c49a7-e77b-41db-83b1-9d43581c5971', 'cec-historical:6030d097f387', '1b18f28d-e81f-47e2-b88c-498b0fa06996', 'f5f1f5ed-6f0e-4385-900e-add028a171fd', 'bed9f7af-e360-4a14-a97a-7ffb68523389', 'cec-historical-candidate-49aa6cc5bb1c8260', TRUE, '無黨籍', '2', 1767, 14.3, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'de2248d2-f566-4a9f-9330-7a748c5f2a25', 'cec-historical:d906c971d559', '060e761d-4467-4468-b29c-081f63edb72f', '4048c031-f9c7-465c-82c0-00a4c2a556bb', '20bec0bc-f9e2-4048-8f0d-70e24ab6c741', 'cec-historical-candidate-e668fb60df588fa0', TRUE, '中國國民黨', '2', 1893, 28.69, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺中市|district-16|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'de57910d-deec-4aba-b44e-af6632ade37c', 'cec-historical:8761a2d61e6b', '1f332863-a14a-4dcc-9cc6-67aacab2b39a', 'cb27c2e6-a546-48bb-964d-f056317cc555', '384682fd-034d-4d97-9925-ae92ad8285ea', 'cec-historical-candidate-7c2b69bf0aae82fb', TRUE, '中國國民黨', '3', 1630, 53.16, TRUE, 'qualified', 'elected', 'elected', 2010, '2010|councilor|臺北市|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'dfd15564-c255-4c72-b1e3-890e49cbad86', 'cec-historical:a91e5364406f', '0b2ed37d-e60c-447e-91ad-41eb7392442b', 'f5f1f5ed-6f0e-4385-900e-add028a171fd', '67439ada-25d0-4377-93cb-d167fa096131', 'cec-historical-candidate-c69ee36d6af13735', TRUE, '中國國民黨', '4', 1687, 13.65, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e141213a-a7fe-4ce4-be24-6c6af3c615a0', 'cec-historical:b9c938bf1b1a', '62b44ead-9802-4e7a-989c-afbb5b0f4afc', 'f5f1f5ed-6f0e-4385-900e-add028a171fd', 'c0a2f5b0-1b6b-4fad-b1b4-75d224c501ef', 'cec-historical-candidate-ddea548b7692b541', TRUE, '無黨籍', '6', 561, 4.54, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e31f8f4e-d30b-47f3-b1ad-d5fbda70a504', 'cec-historical:72fb0cfeb2b5', '15047f8d-11d0-467e-ba52-30b7fa1f1374', 'cb27c2e6-a546-48bb-964d-f056317cc555', 'f4d0b30b-7819-4c4c-a303-34a8420ca4a6', 'cec-historical-candidate-45a90f007ae39576', TRUE, '無黨籍', '4', 207, 6.75, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺北市|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'eba8c41d-f563-4889-8827-b3d3f0872729', 'cec-historical:881d45b752d3', '2a5eaaa5-418b-42d3-a22e-75a1e18ed296', '0779af70-0efe-49f7-9e40-243616984772', '4ff2b244-983e-427c-8fe2-dad2a546ff69', 'cec-historical-candidate-e6db417b257bca7e', TRUE, '親民黨', '4', 116, 5.27, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺北市|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ee74783d-e93a-44d2-a4a7-6381cc15dcad', 'cec-historical:6a36a354cbb0', '054c1df6-6c77-4b21-9da0-3cb7536228ad', 'c0fc2757-7e8d-432b-82a3-ecc57a3a57fc', '13e8d6f5-6611-41b1-b3c5-ed09f02395a3', 'cec-historical-candidate-4dd9ea61f3a48206', TRUE, '無黨籍', '1', 1772, 34.44, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|新北市|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'f73ab14f-bf6b-4751-a6b7-8629ab0b0fdc', 'cec-historical:3babd387f4b1', '758de43d-8a28-4047-a22f-d59c9545441c', '526b0616-b192-437c-a582-4d182941b45d', 'dfb7bc32-9c07-475e-bfc0-9e4c4a1d110b', 'cec-historical-candidate-355279d0547e0c80', TRUE, '無黨籍', '2', 964, 24.25, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|高雄市|district-12|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ffbc8803-ea39-4898-9586-c3e747ca96c8', 'cec-historical:d6707139bd4a', '24c5de11-e031-4548-b8dd-fb9d15a15854', '168f77b2-a157-4f06-b182-3891694b02eb', 'd8f55df5-3369-4938-b479-a7f49c849a0c', 'cec-historical-candidate-ddc83cb7c0c782d1', TRUE, '民主進步黨', '1', 111, 8.98, FALSE, 'qualified', 'not_elected', 'not_elected', 2010, '2010|councilor|臺南市|district-18|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE);

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
    IF (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730) <> 50
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'create') <> 0
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'update') <> 50 THEN
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
    ) <> 50 THEN
        RAISE EXCEPTION 'Historical CEC migration updated candidate result mismatch';
    END IF;
    IF (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE vote_count IS NOT NULL) <> 50
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE vote_rate IS NOT NULL) <> 50
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE is_elected) <> 14
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'update' AND original_is_public) <> 50 THEN
        RAISE EXCEPTION 'Historical CEC migration candidate summary mismatch';
    END IF;
END
$verify$;

SELECT
    0 AS planned_creates,
    50 AS planned_updates,
    50 AS planned_total,
    50 AS publication_states_preserved;

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
