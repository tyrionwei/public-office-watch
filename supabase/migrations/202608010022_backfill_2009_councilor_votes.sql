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
    ('update', '00234bda-4fb9-479f-85a1-fb9f7677d625', 'cec-historical:a2969e71a353', 'aea64699-7423-425d-b7e4-d60d965322a6', '6c7dcdaf-cb98-4fce-9b83-dda8bcfddf67', '1ad751e3-b0d3-44be-9a5e-142440667379', 'cec-historical-candidate-58b5b52a40762911', TRUE, '無黨籍', '4', 499, 27.44, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|苗栗縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '00521b58-067e-4e36-bcae-eb7210b606f7', 'cec-historical:fdd303fcc97f', '9e622dc6-9de7-1577-d366-2604957feb2f', 'ed0c831c-314d-4acc-aaf6-935255023636', 'f75331c2-fc27-4b64-9348-0b04a6159cd6', 'cec-historical-candidate-93bbc366629ec032', TRUE, '無黨籍', '3', 398, 18.2, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|嘉義縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '0099e6a4-4dc8-4282-bf52-e6b35f9ce6f5', 'cec-historical:dd0e3c24e77b', '88812dfb-6c3d-7f1c-094c-235242ce7f2c', 'ad2f15f6-6b4d-4beb-8677-d3f102bf6b46', 'fa42e694-a50f-4e97-9093-bb072b2f7763', 'cec-historical-candidate-6b8a747968856f5b', TRUE, '中國國民黨', '2', 333, 46.83, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|宜蘭縣|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '069f23de-4d58-4ebc-931b-262ad3e51a94', 'cec-historical:00c126da2705', '1a4a81d5-b94b-b3b0-e63f-2ed161b6a8a4', 'e3fc7557-967d-4bf7-9afd-23b005afdb7a', 'b857b952-3890-4d53-a5d8-422cd877c56d', 'cec-historical-candidate-21e210bbf0dc4b3c', TRUE, '無黨籍', '5', 2100, 26.71, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|臺東縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '06a7f86c-3fd7-4209-8938-751064df90d5', 'cec-historical:97936603a2af', '03f66137-332d-4340-8165-52fb0cb16873', '22706ee2-46f6-43a8-a762-79b4aecf9db8', '334aa48f-f4c0-4cf6-afb9-4694200524fc', 'cec-historical-candidate-4947c119f459d517', TRUE, '中國國民黨', '2', 1540, 30.53, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '081b5af0-077c-4718-99df-b9a5d02c58e1', 'cec-historical:dfa7549dc821', '7fd2e3f6-d555-44f2-a62d-0f7e49c6576e', 'f4b6e52f-f239-4811-bf2e-00d2aa90fb5a', '98f71120-f09c-4e78-9dbe-adb62710e088', 'cec-historical-candidate-629549600a439fdd', TRUE, '無黨籍', '2', 149, 18.71, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|彰化縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '0ba1796e-4cb5-41f9-91e9-bef8cef8696d', 'cec-historical:8cda36b41964', '919e5b90-dc70-4b47-97c6-6a4b5e3542ad', '9d4c2456-088f-464e-acfd-68f076255c3c', 'bcf8c576-702d-4e79-851d-af3b1075ee70', 'cec-historical-candidate-0cc16ab1e30d3225', TRUE, '無黨籍', '1', 3172, 46.05, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|南投縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '11505132-e8f5-4216-a784-6de27ab30c5b', 'cec-historical:eaa548815479', 'e8022a3c-d2b1-40d3-a671-4f332e25245b', '248efccc-be19-4cfd-8087-c715432dece8', 'a5b662c8-3255-4494-a965-aabe986ac595', 'cec-historical-candidate-4e86d5b2b3f0d9d1', TRUE, '中國國民黨', '3', 2445, 33.82, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|桃園縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '117d4ace-9d0b-427c-8bd3-570896a0721d', 'cec-historical:b1b089ca15c0', '8fd858f1-c233-4ad8-a239-ff763f28b355', '452c4880-a997-43b8-9f55-efe651d0327a', '9b939cff-968a-47de-b39f-7586b9699664', 'cec-historical-candidate-28323b63ad74407e', TRUE, '中國國民黨', '2', 758, 45.63, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|臺東縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '12ad0e1a-b64d-420e-bc62-9040037ebc98', 'cec-historical:1623a357bf2b', '0cce0a52-5d26-6465-c237-744cd4fb7894', 'a6308895-bf4a-47df-ac0f-41d4408bdd45', '3460d385-7046-4bbd-8fbc-177e349f11a3', 'cec-historical-candidate-c8fda8bad3d523b2', TRUE, '中國國民黨', '2', 1572, 54.77, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|花蓮縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '13658fe0-cd4c-480e-b400-e2ab2ddb0965', 'cec-historical:5a4b828188b0', '3c290f53-a19a-4c95-9a96-2f3562ef4e50', '22706ee2-46f6-43a8-a762-79b4aecf9db8', 'f4e5c609-f41a-4a1f-91d8-7ec45c4ce603', 'cec-historical-candidate-a0568afe3bc36dbf', TRUE, '無黨籍', '3', 1502, 29.78, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1488a7ed-62d1-4932-8d52-65547d284beb', 'cec-historical:a4c0fa4107b9', '9d0d4947-ee92-41a0-b8ba-299b9be7a27f', 'e58f2622-d593-4f50-a640-15a8029b87bf', 'd8490cb5-d94f-465f-ad01-3da6cdb87650', 'cec-historical-candidate-1098c4a954830b67', TRUE, '中國國民黨', '2', 1551, 19.72, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '1699da0f-e7b3-48cc-96fd-87ca393c867b', 'cec-historical:87879c92592b', 'bf74c8ae-e934-4628-a3e9-756971bb5f8b', '07a5996d-f476-4fd8-8530-cddac3840771', 'bec292e9-b20e-4ca1-aed6-1124afcfe331', 'cec-historical-candidate-fbe3406de2b15280', TRUE, '中國國民黨', '2', 758, 45.63, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|臺東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '171d0111-d17f-4633-a0f1-d2230a96c1d9', 'cec-historical:a9934c687020', 'f171cecc-b123-4adc-a282-9bbcaa96a3c7', 'ad2f15f6-6b4d-4beb-8677-d3f102bf6b46', '97094061-3723-4be0-96d0-fd200377c89f', 'cec-historical-candidate-0fc564b54630b19c', TRUE, '無黨籍', '3', 82, 11.53, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|宜蘭縣|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1c0a9f57-6fdd-4db0-b4f0-cdd6f40148be', 'cec-historical:1a8b854f2a21', '25e14beb-f0d1-4adb-a256-31db4d864c85', '22706ee2-46f6-43a8-a762-79b4aecf9db8', '6bb1a979-b82e-4e9b-ba23-67f4e63981f2', 'cec-historical-candidate-94ab60e8a1c995b9', TRUE, '中國國民黨', '1', 2001, 39.67, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1c2d864c-112b-4878-8a17-2789e3529eee', 'cec-historical:d7fd347bff8e', '95d45918-a8e2-5688-391d-23ec88210b3e', '64001e23-b2e0-4c3a-a3d4-7c2b3b6a053f', '0b2d05d6-d8ff-4ef2-9f9c-ba6fae12eb65', 'cec-historical-candidate-f35ae09f60437d17', TRUE, '中國國民黨', '1', 1678, 50.74, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|苗栗縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2514b64c-6206-4a44-b0e2-b1c8b4f6ec63', 'cec-historical:319d4ffdc602', '0f57bee2-f612-4fc5-a402-d5a94494f718', 'c39b21f8-2ac2-469e-bd77-39f4fabb390c', '41c8cd11-660b-4993-8df1-8a6c08d72c72', 'cec-historical-candidate-03dcb1e888dfef61', TRUE, '中國國民黨', '1', 871, 44.59, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|屏東縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '2876e9e3-12a1-4dbf-8c40-f157e120db57', 'cec-historical:c3b3eeec9429', '61b702e3-1dc7-475e-9d50-2813fb79c870', '1e50df81-aeff-4fba-b236-801dbaa7ceb1', 'bf023876-a247-4760-8c0f-ad567c1fb613', 'cec-historical-candidate-fc5b638f6eea0c38', TRUE, '中國國民黨', '3', 1851, 21.17, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|桃園縣|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '293febb2-8510-4e98-8430-6c9a01495aac', 'cec-historical:acbfea98bb0b', '58ff4758-7965-4b38-85d6-ded3c3416d68', '490d940c-7caf-4603-9c61-cf3870e742df', 'd674075b-6ed0-4fa1-81cc-2ad2cb92e645', 'cec-historical-candidate-855b5cacad083388', TRUE, '無黨籍', '1', 1298, 45.22, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|花蓮縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2c514436-e42b-4723-a554-4307ad08498e', 'cec-historical:f80e75a589ed', 'b77c9cb8-a426-4da3-8135-247b20839a1d', 'f4b6e52f-f239-4811-bf2e-00d2aa90fb5a', '2eba87b0-0aef-4480-bb9e-a9db259ffa12', 'cec-historical-candidate-587bc34754c71784', TRUE, '中國國民黨', '1', 647, 81.28, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|彰化縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2ec816cc-c17a-4f04-a92d-fc7abfc2587f', 'cec-historical:f116c563e196', '590be273-174b-4689-bd0a-965484169534', '4d8b705b-5d3e-4c81-8dbb-e1bab21e6f5c', '9e9040bc-8fef-46f4-bf40-2193b6a3d3a6', 'cec-historical-candidate-55a684c56a9da06e', TRUE, '中國國民黨', '1', 871, 44.59, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|屏東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2f5375d6-9281-4a6a-aa5d-ba3714fa341a', 'cec-historical:d8fd8b0fa7f7', '78286722-86a4-4509-b19c-8282aa50e6e3', 'faa60297-336a-4b35-bcae-d8955509e7fd', '44b3b2c4-31b0-417f-ac37-900b385e0612', 'cec-historical-candidate-5f48ced12e9b84c2', TRUE, '中國國民黨', '2', 758, 45.63, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|臺東縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3027e00b-c0c3-4631-a8e1-ce71b5e80eea', 'cec-historical:b997c6e27ffb', '85055586-49e8-4d33-bede-e9734590290b', 'ad2f15f6-6b4d-4beb-8677-d3f102bf6b46', 'ac2fc945-79a6-4972-a4f6-3c7682537a33', 'cec-historical-candidate-5f4cf421f984839a', TRUE, '中國國民黨', '1', 296, 41.63, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|宜蘭縣|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3221eae3-aa33-46f9-949f-edc959924d49', 'cec-historical:f50df934f7bd', '516192a8-2cd2-4481-8b8a-b1f17c33403f', 'fbdb3ee2-048d-4d2d-a851-727f1a35d126', 'cb8f976d-c549-4c3b-9115-132061e8cde5', 'cec-historical-candidate-6f050b7c75b185ac', TRUE, '中國國民黨', '1', 903, 54.36, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|臺東縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '32544c2c-88f4-4290-9122-a1f49ae6d76a', 'cec-historical:dff1c2a7ecf0', '1aa3d503-823e-4d3d-8695-c56db0174ceb', 'd83066fb-6bfe-4632-a4e8-404b5cb2873f', 'bfab3113-91b6-4c54-ae4c-ea1a65e8f516', 'cec-historical-candidate-511375c70c7768cf', TRUE, '中國國民黨', '1', 1572, 100, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|屏東縣|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '328b2f31-d968-4613-9a46-ab03b9b030f9', 'cec-historical:a4e3f419d96d', '573a2b68-987e-40f4-aa19-9dfd2ff210bf', 'b41d47be-759b-483c-a25e-ffdf53f412fc', '5f6eeaf4-45aa-47fb-9ce5-70c5fd5f6a3c', 'cec-historical-candidate-800528c6c88cddab', TRUE, '親民黨', '2', 1431, 42.85, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|宜蘭縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '34f799b6-391a-4623-aa28-5324228e17e9', 'cec-historical:5a19ecf95bb4', 'c9757d21-9bed-4bdf-a9b3-454c577a3d4c', 'cf06cac4-14b5-4dc9-9627-7a12bbbec03e', '8ce5f865-db13-4199-9d61-0ebc51a8de99', 'cec-historical-candidate-cf4b16a5fe5506b2', TRUE, '無黨籍', '1', 871, 44.59, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|屏東縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '377c3f31-cc8e-4a76-9dcd-77982799b2a6', 'cec-historical:47d7efc5eb68', '29749889-f47e-4450-92bd-374878657736', '248efccc-be19-4cfd-8087-c715432dece8', '628b4ab0-1304-4d26-a742-563f77f9a573', 'cec-historical-candidate-862f6873d99b6f82', TRUE, '中國國民黨', '1', 2766, 38.26, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|桃園縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3946c633-b466-49aa-b0c4-61840425fbb5', 'cec-historical:279dcd8a6ffa', 'dae30897-e507-44f8-af18-4eee4497b188', '9219888b-8257-4787-9cab-beaf147cf66b', '9169e001-e7e0-4a04-bef2-790aec05fa30', 'cec-historical-candidate-558c00b70c1b471c', TRUE, '中國國民黨', '1', 609, 18.23, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|宜蘭縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3f1e33bb-45d1-45ce-9d55-96b8882f078b', 'cec-historical:21c59bd97c72', '4f5d675f-5685-f327-9535-936a5a2f3f5b', '07a5996d-f476-4fd8-8530-cddac3840771', 'df31507a-08f0-4937-99e2-e824d93d1ee1', 'cec-historical-candidate-805a099a9509d5ee', TRUE, '中國國民黨', '1', 903, 54.36, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|臺東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '42d399ff-4f3c-445c-93a0-0e3180dbebec', 'cec-historical:5fa7c3bf245c', '05cea7c9-b430-4d3c-8d9f-a88725a2073c', 'ff35bea5-9303-42dd-8db4-de69075e1742', '3a8e59f5-5752-48c7-9c28-3f54a774e1a7', 'cec-historical-candidate-1e0b31237b30d005', TRUE, '無黨籍', '2', 758, 45.63, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|臺東縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4313b675-99e1-4397-b76c-78190074620a', 'cec-historical:989646ee5349', '8118b3df-5322-44b8-a388-5fb8cdbb86d0', '9219888b-8257-4787-9cab-beaf147cf66b', '3f985c49-006e-440a-84a7-a5e7ab50410d', 'cec-historical-candidate-2bc296288a39352d', TRUE, '中國國民黨', '3', 1299, 38.9, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|宜蘭縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '46b885e2-e86d-422c-bc3c-1d23972999d0', 'cec-historical:1e853f20d14a', '26be0c8d-43c7-44d1-b7d4-9853beafb99c', '9b0ab109-0851-4e99-a7b1-17e429e989fc', 'c79ed14e-1817-41d6-b10b-6a118408f1db', 'cec-historical-candidate-db748d96d9d38cb9', TRUE, '中國國民黨', '1', 1298, 45.22, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|花蓮縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '49fdd6f4-53a6-4ebe-b771-8a42ceca202b', 'cec-historical:70713bab55da', 'ba3575f9-861b-4a20-0b4b-54c255ec481f', '9cbd723f-c522-46d0-aeb7-2f1d9320de6b', '4cfd67fb-ec0f-4188-9265-f986d3a6a86b', 'cec-historical-candidate-454df6ea8872d316', TRUE, '中國國民黨', '1', 1065, 13.54, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|臺東縣|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '4b537007-f5e5-4939-9ac0-a5cfb1b3ca44', 'cec-historical:f54c0cd65a52', '6ce8117d-bcb8-486f-ac54-6eca7a3ccbc7', '484a5568-6cc4-4bae-9a84-86d5e944b531', 'b30517f5-f345-431c-b2d9-97ddab4608bb', 'cec-historical-candidate-4d9e5d72881598af', TRUE, '中國國民黨', '1', 1429, 40.48, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|新竹縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '4c61cfca-4d4d-483c-a671-b9f2ef1482db', 'cec-historical:0e9ba98480aa', '1da9b1c7-9eb7-43b5-9bd6-21e4bbb335fa', '7ba9db36-9e03-4e4e-9b27-8a79d1f616d2', 'e7f97830-63fb-4491-8754-7b4cf3ef7ec4', 'cec-historical-candidate-9483e5d69f356b6b', TRUE, '中國國民黨', '1', 1214, 44.48, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|基隆市|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4f6068eb-d2b5-441d-b1f4-5c3604621002', 'cec-historical:1ccf74900ce4', 'fb88cfd0-4a22-4f2e-b908-28b7a21b3e9f', '9d4c2456-088f-464e-acfd-68f076255c3c', '8f7c18c7-6efd-41c0-99fa-09a6da8ffcaa', 'cec-historical-candidate-8cae0aff39eeb2a8', TRUE, '中國國民黨', '3', 2717, 39.45, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|南投縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '5510b017-b865-4aa6-bf63-66be07a0f52b', 'cec-historical:c125dedffecf', '81bdc536-395c-46dc-bedf-1308941be6c0', '4d8b705b-5d3e-4c81-8dbb-e1bab21e6f5c', 'fb4e4a28-d680-4240-8a2b-e203fe2c00bd', 'cec-historical-candidate-abbd275c227a5b9c', TRUE, '無黨籍', '2', 1082, 55.4, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|屏東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '56480bb7-5d48-419e-ad88-2b7f149b2b09', 'cec-historical:948fb817d122', '9fe5e484-1cc7-8745-4684-fde56d101d36', '15a96adc-e0a3-454a-a70b-48b9bdf3b3e2', '3698572a-5428-42bc-8c74-d577c66cbd9f', 'cec-historical-candidate-b33cac0aaa942873', TRUE, '無黨籍', '2', 1540, 30.53, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '59018790-225b-483b-af42-6f188aa4d4b7', 'cec-historical:9a3fb1713f5c', '976c3ad8-57c7-485f-af3e-29e03fdf766f', '1e50df81-aeff-4fba-b236-801dbaa7ceb1', '5e89f07b-8c0b-4e69-a272-386a795c89e3', 'cec-historical-candidate-ee48c9b3e3213552', TRUE, '無黨籍', '5', 1131, 12.93, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|桃園縣|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '5ada88fb-4b90-4195-9d06-a81b8280416e', 'cec-historical:5569d16155fa', '5daa9dcf-51bd-78f8-4a03-f45913ab7471', '490d940c-7caf-4603-9c61-cf3870e742df', '26bd69e5-fd52-4146-9b9d-5d99ef508465', 'cec-historical-candidate-436dc90588c983c5', TRUE, '中國國民黨', '3', 2887, 38.97, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|花蓮縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '5d1d9c76-9363-4829-afff-c6c400fbf169', 'cec-historical:3ac7d582ae57', 'c7e32a97-15b7-b7ad-cd54-45e516a03b88', 'c51bee9d-57ba-43b4-b56b-18c645408212', '7e2fa332-fdb9-4edb-8852-49a038de0593', 'cec-historical-candidate-a4dd13067f6ff5c0', TRUE, '中國國民黨', '2', 1540, 30.53, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|花蓮縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '5dafa3a8-e3b4-4469-9442-0efe0aa7b532', 'cec-historical:085ee69a9fe2', '903f59e0-9fe6-97b0-3f7a-3dfa8c83123d', 'c24a4ea1-4400-4770-927f-3e325a8287c6', '0c710981-6f20-4aef-99aa-4850cfa6acb5', 'cec-historical-candidate-441f1797de4ce883', TRUE, '無黨籍', '2', 1028, 29.12, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|新竹縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6fd4839b-49a8-43a0-ae01-075a45d4ce10', 'cec-historical:5e676533c72d', 'e0a60376-945f-1730-100c-e8f290ac1375', '9b50ee3c-5245-4aa1-bd93-a5755c8731e0', 'd10a0f87-d4e5-4598-ae82-1f3cb0e60823', 'cec-historical-candidate-5676790f5e9e44c3', TRUE, '中國國民黨', '1', 646, 100, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|新竹縣|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '72b008cb-534f-44c7-b9e2-18092fa38921', 'cec-historical:ded388e54070', '307d8902-1b63-22dd-3a20-6998da133e3a', 'b41d47be-759b-483c-a25e-ffdf53f412fc', 'eee81270-6f02-4315-8679-00922cd81867', 'cec-historical-candidate-c71ebd3956f1c259', TRUE, '中國國民黨', '1', 609, 18.23, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|宜蘭縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '76aa8e25-c36b-4175-862f-073f38e1f32b', 'cec-historical:c39999d74654', 'a41e508f-e378-42cd-a6f4-a3941c661f2e', 'a6308895-bf4a-47df-ac0f-41d4408bdd45', '878b9027-16b5-442c-b123-8f8d822e81e9', 'cec-historical-candidate-36f27201cccd7a25', TRUE, '無黨籍', '1', 1298, 45.22, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|花蓮縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '7c0e9eb7-2fa8-4d29-948d-9f124c32f94d', 'cec-historical:7b719575490f', '01341cb1-b8ef-40c9-8f09-35df52ca2e1e', 'fd5faf1a-2f7d-4cab-b3c9-846b58b3ee3b', '519d5679-ab94-4468-b989-1cf84030bca8', 'cec-historical-candidate-7781f816a3fcdc78', TRUE, '中國國民黨', '1', 871, 44.59, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|屏東縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '7cf6c7d0-562d-46a8-a600-10cac689f703', 'cec-historical:de2319e58802', 'f28355c5-95a1-462b-b6bf-1a16634f6682', '1dea3f20-1076-4191-b672-5c735905403c', 'c4180d03-6708-46b4-bda1-9d5bf5a9ff4e', 'cec-historical-candidate-2f15ddba980928a5', TRUE, '中國國民黨', '1', 871, 44.59, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|屏東縣|district-16|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '82a4c602-d01d-4391-b588-7ad98f660172', 'cec-historical:c05f98a2b4ef', '12c35c7a-3ad4-4e0a-a70e-82d269d3fb8b', '1e50df81-aeff-4fba-b236-801dbaa7ceb1', '5da6be3a-f6ff-444e-8609-95b8cb3d52ff', 'cec-historical-candidate-296ea978215e4744', TRUE, '中國國民黨', '2', 1680, 19.21, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|桃園縣|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8574efea-c45e-4a20-87f1-41d42d00a467', 'cec-historical:8cfd07c23ec1', '55c12aa6-06b1-4875-a1f6-04c32909c341', '9cbd723f-c522-46d0-aeb7-2f1d9320de6b', 'c8e2ad59-4586-4a01-a4af-6129843f9127', 'cec-historical-candidate-00b1b06d46626f75', TRUE, '中國國民黨', '2', 1551, 19.72, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|臺東縣|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '858383b0-f7fb-4c09-a2c6-96d43cce0cb2', 'cec-historical:541f663f1b9d', '23690cdc-664a-4d83-91ab-f703e192414b', 'be2dc7ad-2b2c-43ba-a531-d445483c518d', 'b0cacf7a-3871-4304-ade1-1e261f6ae7d6', 'cec-historical-candidate-339202a880998144', TRUE, '中國國民黨', '3', 2717, 39.45, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|南投縣|district-6|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8686bf0e-6db4-4a76-8d72-d7d50cef7390', 'cec-historical:dc5175db236d', '42e76d73-3bc7-4e00-b954-890258b16a1c', 'e8c309e4-72d6-4e29-a48f-044f71c63ed1', '6b432988-0149-4a3e-8d67-99dc16372c9b', 'cec-historical-candidate-df252651c082f7fd', TRUE, '中國國民黨', '2', 1082, 55.4, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|屏東縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '87c9df16-e53d-4d85-9dd0-e01539aea951', 'cec-historical:3371c71061ef', '8b2b5c19-e40e-c386-0512-01222e4f47ad', 'faa60297-336a-4b35-bcae-d8955509e7fd', '723fe78b-e393-4d50-99ae-21333a7aa522', 'cec-historical-candidate-0e1892896c8db060', TRUE, '中國國民黨', '1', 903, 54.36, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|臺東縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '88a1d92a-3a3e-406d-8758-79afe5cb8b93', 'cec-historical:1c34e3c4bacb', '1fa48ff7-149d-4c83-bc31-05ebe2d2d57b', '82885361-983f-4c12-a09c-be978c13e862', '93171f74-0721-4cf6-9d79-c16c07729076', 'cec-historical-candidate-e9f61c752cf67b4d', TRUE, '中國國民黨', '1', 871, 44.59, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|屏東縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '89ae6112-be0c-459c-ba7f-90d5a2e2fa12', 'cec-historical:27a973bd4a5a', 'd78a7da6-179e-4ae1-b122-5fc0ff9c1482', 'c39b21f8-2ac2-469e-bd77-39f4fabb390c', 'd2d1132f-59fa-42c5-a385-76a4518b57f5', 'cec-historical-candidate-ba6c661c9cf04df3', TRUE, '無黨籍', '2', 1082, 55.4, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|屏東縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '8b48f385-a50e-4b6d-b8b6-84fd45de5ca6', 'cec-historical:feca94a11af1', '19555b85-d58b-4405-8728-07d7f2569c45', 'e3fc7557-967d-4bf7-9afd-23b005afdb7a', '2cac98a7-dbde-42b0-9bac-c865f608c320', 'cec-historical-candidate-b30a5bac40dad2d4', TRUE, '中國國民黨', '2', 1551, 19.72, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|臺東縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8bc20ab5-9ef7-4f04-971e-ae7dc9619883', 'cec-historical:4e79497fc5da', '0ddba0c8-ee7c-4483-acce-b2492c7fa844', 'ff35bea5-9303-42dd-8db4-de69075e1742', 'dc1548a8-b40e-4c5a-afbb-25eacc4e411a', 'cec-historical-candidate-95da3f8c67e678bf', TRUE, '中國國民黨', '1', 903, 54.36, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|臺東縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8df5cc50-eb37-4086-a2d1-b371901c2cfa', 'cec-historical:661fc8a929b4', 'bec1490f-4694-1eee-5511-d2b971324403', 'e3fc7557-967d-4bf7-9afd-23b005afdb7a', 'eb749c12-afaf-43f2-b56d-931241489282', 'cec-historical-candidate-e49883823c0d48c8', TRUE, '無黨籍', '1', 1065, 13.54, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|臺東縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '90223f7e-e3ef-40e0-ac36-fdc539fb4f83', 'cec-historical:372d4768d6ae', '9c7f5ebd-dd70-e476-0d8f-17f252de211e', '7ba9db36-9e03-4e4e-9b27-8a79d1f616d2', '761764f2-aa8f-442f-88a1-e2b68ff27f28', 'cec-historical-candidate-846ad65b3b2562a1', TRUE, '無黨籍', '2', 1515, 55.51, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|基隆市|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '919affdf-03a9-4083-a3a2-39a1f9a450f2', 'cec-historical:43363e550fb5', '0fb6f6b4-bf73-c10e-ac4c-ecdbe73a09dc', '64001e23-b2e0-4c3a-a3d4-7c2b3b6a053f', 'd2293f0a-175f-449d-9335-6bb0bfa2d8ae', 'cec-historical-candidate-9c6e3dde4a44a86a', TRUE, '中國國民黨', '2', 1629, 49.25, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|苗栗縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '959d90e0-784a-4072-b2e1-6e1134d2e44a', 'cec-historical:951624a2570b', '96aa1973-49ff-4033-97f0-d1c810ac687c', 'c51bee9d-57ba-43b4-b56b-18c645408212', 'c68618ea-3e90-4857-b607-f8fd8d744b4b', 'cec-historical-candidate-173d1d55031f7625', TRUE, '中國國民黨', '1', 2001, 39.67, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|花蓮縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '971c5aff-1384-4935-b0bd-46f4e7ce1368', 'cec-historical:f8dd7b74ec7d', 'cb1ed018-931a-4a28-a12f-1d7aeddff99a', '490d940c-7caf-4603-9c61-cf3870e742df', 'd294105e-383e-43cd-8d03-281a562a0397', 'cec-historical-candidate-030609b767dbe9e6', TRUE, '無黨籍', '2', 1572, 54.77, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|花蓮縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '9d5a7201-0655-408b-9cde-3c00eb5747eb', 'cec-historical:3c6f54204c9e', 'd76944cb-9674-45e4-a4d3-97033d5ae82f', '770c047e-bf4d-4bcc-b379-05a17851d0c0', '87f1d222-099e-429b-9ee7-fcd082dfeea3', 'cec-historical-candidate-af0b114381467bdc', TRUE, '無黨籍', '2', 463, 0.46, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|屏東縣|district-3|regional', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a0dd5452-78c5-4261-8278-2d3a0a9222d6', 'cec-historical:4ba1c010efe3', 'cf9b3e36-0356-43f9-9f86-fff7aa0dd3c0', 'e3fc7557-967d-4bf7-9afd-23b005afdb7a', '226dae4f-a7e7-4a2f-9f60-d868b002d892', 'cec-historical-candidate-f94070ab3c8e6231', TRUE, '中國國民黨', '4', 1460, 18.57, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|臺東縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a243411a-6c66-43bc-82dc-5e1c086e46e4', 'cec-historical:72db189cd599', '5a764dd1-e443-7b4d-4a2d-146341f4ac8c', 'e8c309e4-72d6-4e29-a48f-044f71c63ed1', '22f77e5a-6037-4614-85d5-9a0a6254d84f', 'cec-historical-candidate-5ccc900876d5a8b9', TRUE, '中國國民黨', '1', 871, 44.59, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|屏東縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'a9b187f0-25db-4252-b4f7-ac4cca123996', 'cec-historical:6cb6522c2b91', '9c73e805-29d6-47ea-8a28-b73924bae49f', '9219888b-8257-4787-9cab-beaf147cf66b', 'c52d2070-911f-448a-b4af-d87b9e2ea34b', 'cec-historical-candidate-f2d70f8938bcff9a', TRUE, '中國國民黨', '2', 1431, 42.85, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|宜蘭縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ab790e50-90bc-46d6-a360-46f7d574f6ed', 'cec-historical:22ce671ebdb1', '1f50fbad-b55a-4a2e-a35a-324873c87f2c', '531dea3c-5813-4dcb-8dfe-f36752882775', 'f3009cb1-6986-49ec-b3ab-80f86d499032', 'cec-historical-candidate-8b554f4951d4e205', TRUE, '中國國民黨', '1', 1065, 13.54, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|臺東縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'acb9be46-79ae-40ea-9d4b-378501053c64', 'cec-historical:cdfdcf59f6d3', 'a9a8aaa9-6d44-449e-aad6-e340dbfadd84', '15a96adc-e0a3-454a-a70b-48b9bdf3b3e2', 'd34996c5-5d92-4f17-a309-2895fb454403', 'cec-historical-candidate-99140f5da96ea10f', TRUE, '中國國民黨', '1', 2001, 39.67, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'addef888-fff2-4171-8392-93005e8c0ee3', 'cec-historical:2dc8adfbcb21', 'd9f6c9b6-da9e-8fd7-f0e9-638a3f65c5b8', 'c24a4ea1-4400-4770-927f-3e325a8287c6', '81ec1387-3743-43d3-8055-0c2c832d4bc6', 'cec-historical-candidate-08a4640054afcd49', TRUE, '中國國民黨', '1', 1429, 40.48, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|新竹縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b10accf2-e4b6-423f-b33e-1d74e40bb72c', 'cec-historical:53182cc1d9bc', '933d604d-5a6b-4615-bfae-b0a9479b4ebc', '9b0ab109-0851-4e99-a7b1-17e429e989fc', 'eada9c10-4532-4bd6-9f41-6ad64d710c14', 'cec-historical-candidate-f5952d034987467c', TRUE, '無黨籍', '2', 1572, 54.77, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|花蓮縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'b123591a-c85c-405c-8612-074f3c5effbb', 'cec-historical:2c9889a7772c', '3763b93c-dbc7-4f48-8b44-5501599b5aa0', '15a96adc-e0a3-454a-a70b-48b9bdf3b3e2', '17014a7c-85ec-48c9-bba7-a2e585a61697', 'cec-historical-candidate-7d8228e9bdf2cfe1', TRUE, '中國國民黨', '5', 1345, 15.41, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b553fbb1-24a1-4ae3-b569-dc46dbcd078d', 'cec-historical:2a8ee002d030', '47c3d280-498d-4259-9e94-651eafb00329', '6c7dcdaf-cb98-4fce-9b83-dda8bcfddf67', '050804ab-de7a-47f4-893c-f0f9f5e10e5e', 'cec-historical-candidate-cf5e1fa533652371', TRUE, '中國國民黨', '3', 425, 23.37, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|苗栗縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b5b15859-4ab2-4d00-8193-ae7d58eca7ba', 'cec-historical:d27a82ce4315', '4500af8e-d15f-4d68-8f1e-fde3c3381ff6', '6c7dcdaf-cb98-4fce-9b83-dda8bcfddf67', '0f9c0688-d28a-41ca-b5a2-11f88d617c28', 'cec-historical-candidate-ae0c630efb3d1741', TRUE, '中國國民黨', '2', 494, 27.17, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|苗栗縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b5c138a7-b510-43dc-bbce-78167c8866ba', 'cec-historical:417a383ea5a7', '6acf2db8-d570-46a2-920b-f83f4624b59b', '15a96adc-e0a3-454a-a70b-48b9bdf3b3e2', '71f49711-71f2-4ad4-bc28-a90e856631a8', 'cec-historical-candidate-475f342ebaf132a4', TRUE, '中國國民黨', '3', 1502, 29.78, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'bcbc7a2f-3ae5-4300-a003-037f5198d1f8', 'cec-historical:5c3c6fd78880', '06a6e43e-ba21-4eda-d683-5b70884554fe', 'be2dc7ad-2b2c-43ba-a531-d445483c518d', '9c60ecf0-5ad0-4325-8c02-87a26d1f5f5a', 'cec-historical-candidate-85a0b7fe1c82de63', TRUE, '中國國民黨', '1', 3172, 46.05, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|南投縣|district-6|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c0807535-aa94-4b57-8c6f-e609c8cb3b2f', 'cec-historical:1075305b5475', 'c38a6065-568b-419b-8513-776912526265', '1dea3f20-1076-4191-b672-5c735905403c', 'e4662b37-e1f1-4738-a5de-a9386523bdf0', 'cec-historical-candidate-abc03cc84fbfb440', TRUE, '中國國民黨', '2', 1082, 55.4, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|屏東縣|district-16|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c21782a8-198f-4403-bc4a-2c100e2c340f', 'cec-historical:287c1555b61e', '0a807dff-d03c-dace-6c30-d2c213bf2a2a', '484a5568-6cc4-4bae-9a84-86d5e944b531', '0e883c93-e8c9-45cb-a05c-c19c33a0a001', 'cec-historical-candidate-a069847d1275a5a3', TRUE, '無黨籍', '3', 1073, 30.39, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|新竹縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c455b053-4cb8-4aa9-9d8e-0785fe62cbdb', 'cec-historical:2c4f39902800', 'c79f219f-6909-65d7-92c5-f2a01355cb34', '1c1de271-3737-4c56-a1d6-78038e0a9835', '60ec229b-3f2e-44c6-9727-8d7ae90f3546', 'cec-historical-candidate-e8756ff5c0edaa3e', TRUE, '中國國民黨', '1', 871, 44.59, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|屏東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'c74e7ab4-9ea3-47ad-80b5-b64184e639e3', 'cec-historical:44fff57d31b3', '1b8a7913-4e90-46fe-8bc2-67e6aee98bdb', 'e3fc7557-967d-4bf7-9afd-23b005afdb7a', 'e243a135-8297-4d4a-bbf1-30a6babe7769', 'cec-historical-candidate-ffe34f55e502b1e5', TRUE, '中國國民黨', '3', 1686, 21.44, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|臺東縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ca11b847-03f2-4478-b47d-9fc4331ae808', 'cec-historical:1b048d65690a', '0ea1d15f-c8f2-4097-a91c-742c630c882e', 'c51bee9d-57ba-43b4-b56b-18c645408212', '1c963a9f-aab7-4970-88b6-470e949a64a0', 'cec-historical-candidate-f070be96aea626be', TRUE, '中國國民黨', '3', 1502, 29.78, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|花蓮縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'cac7e535-ccdf-4e32-89d2-f1a5d2ce685a', 'cec-historical:766c16ef10a9', '41027194-c2f0-4d5a-9cf9-e6e490d2962b', 'c24a4ea1-4400-4770-927f-3e325a8287c6', 'b3a625e6-c0b0-4495-acbe-91ef6d56d83a', 'cec-historical-candidate-8e0138799f5e6561', TRUE, '中國國民黨', '3', 1073, 30.39, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|新竹縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'cc81fd98-0cfc-4757-b621-2350485f7a1b', 'cec-historical:994740911cc5', '17e8b214-a3db-4c16-b205-0181030746ee', 'e58f2622-d593-4f50-a640-15a8029b87bf', '3d1bf933-d3cc-43c0-9b8e-6666157abebc', 'cec-historical-candidate-04e1bd5a7abbf23a', TRUE, '中國國民黨', '1', 1065, 13.54, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'cd3cf15c-241d-49d5-9dba-13928447dcdd', 'cec-historical:64a1f97b098a', '746b88d7-2ae3-8c1d-3a25-599935a078c3', '531dea3c-5813-4dcb-8dfe-f36752882775', '72f01107-2a2f-4dc9-b7a5-7fd6280f774f', 'cec-historical-candidate-21d2faedf80008e8', TRUE, '台灣團結聯盟', '3', 1686, 21.44, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|臺東縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'cfb5db2e-3196-47ae-8e4d-a68777b9550b', 'cec-historical:35b99cc70f4d', '78db0b99-944c-9931-0a1b-0c62766127af', '1e50df81-aeff-4fba-b236-801dbaa7ceb1', '18f8ceeb-c745-4762-a659-7d42c1916174', 'cec-historical-candidate-89c53f67301cde75', TRUE, '無黨籍', '1', 2076, 23.74, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|桃園縣|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd090bfce-fd5d-40c1-8319-ef8af9b94f1f', 'cec-historical:62d72c52f935', '783e5eb9-1bce-4f76-a428-2180955fdf41', '452c4880-a997-43b8-9f55-efe651d0327a', 'edd2755a-ea02-46a3-bb26-50a6c7dc5ef1', 'cec-historical-candidate-ccc8b2efee247749', TRUE, '中國國民黨', '1', 903, 54.36, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|臺東縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd198c37c-44c6-4252-bcf1-d8dd2a6fdf54', 'cec-historical:d3c90254add0', 'd5059f11-c75f-79ca-5e98-8fa8f274392e', '484a5568-6cc4-4bae-9a84-86d5e944b531', '6e1b3776-6316-492e-9a2a-65e69d037ca6', 'cec-historical-candidate-efde46f4107bfbb9', TRUE, '中國國民黨', '2', 1028, 29.12, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|新竹縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'd269d118-c354-4d23-8e97-4aefd0b90d6a', 'cec-historical:2c5400fc723b', '00f51dd7-bbe2-4668-9093-a9718da04197', 'be2dc7ad-2b2c-43ba-a531-d445483c518d', 'b096cb5c-8dc8-4650-9876-f9bee6426c82', 'cec-historical-candidate-7f61cc2d5fd55669', TRUE, '中國國民黨', '2', 998, 14.49, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|南投縣|district-6|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'da109cb2-4d0b-44c8-8d41-1d38f13a35f4', 'cec-historical:ea859cfe7138', '4e0c3338-9429-493b-adf9-ed7897975abb', 'cf06cac4-14b5-4dc9-9627-7a12bbbec03e', '2d81247b-13e0-4fbe-8e9f-d90ca14df3f0', 'cec-historical-candidate-7bbd1be009b2d966', TRUE, '中國國民黨', '2', 1082, 55.4, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|屏東縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'da296658-0753-4126-9a8c-8806f85a222e', 'cec-historical:8f9b31011ba1', '2c0af3a2-2686-4845-ad11-ba64d371ff35', '531dea3c-5813-4dcb-8dfe-f36752882775', '540f701a-4a83-40ad-be52-ceb6686e4bab', 'cec-historical-candidate-61fa5ad9d0455455', TRUE, '中國國民黨', '2', 1551, 19.72, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|臺東縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'df6085f2-f34a-4c6d-8d82-e58870b831cb', 'cec-historical:ce432f297946', 'b50cd4da-d670-4d2b-bb32-0e5acab98669', '9d4c2456-088f-464e-acfd-68f076255c3c', 'a496fd39-da58-4093-8a7a-d017a56490fd', 'cec-historical-candidate-fee4fcbb3cf8e01d', TRUE, '無黨籍', '2', 998, 14.49, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|南投縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e0b762f0-7c21-4fd9-9f2e-88b1dc0e57a8', 'cec-historical:03c040e24ea9', '74184be8-ea85-4bc3-b4c0-17140eb1a8dc', '1e50df81-aeff-4fba-b236-801dbaa7ceb1', '8a05becc-d347-4f08-9dcc-3fd2931bb5d9', 'cec-historical-candidate-cfbeb26dfaddc3b8', TRUE, '中國國民黨', '4', 2005, 22.93, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|桃園縣|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e1ac7eaf-3f7e-42dd-8b04-f0b216fbee50', 'cec-historical:ab3d94efcd18', '9ab5856c-f4c8-4e35-be8d-f318e42c3a71', '15a96adc-e0a3-454a-a70b-48b9bdf3b3e2', 'f9c696d9-9cce-463e-9bb2-d8a40aeedf7e', 'cec-historical-candidate-8bb1b8ef6ef18c0a', TRUE, '中國國民黨', '4', 2183, 25.74, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'e7c16b0e-c552-489b-ba81-06bb32cc3567', 'cec-historical:73cb61374a5f', 'f7193998-4ba5-4bfd-8200-1181b6a407af', '6c7dcdaf-cb98-4fce-9b83-dda8bcfddf67', 'c895b9fe-a212-4b0c-a4f9-3e3fdb15e4d0', 'cec-historical-candidate-95e5a36940f8341f', TRUE, '中國國民黨', '1', 400, 22, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|苗栗縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e822c188-212b-4b06-947d-b509510419fa', 'cec-historical:a316d351fad8', '1749b069-7111-47ae-89cd-608b6cea04d6', 'ed0c831c-314d-4acc-aaf6-935255023636', '945185f9-aa3c-4db1-a7fc-707e12ca4e96', 'cec-historical-candidate-a8fbfe2c080bd5cf', TRUE, '無黨籍', '2', 1192, 54.52, TRUE, 'qualified', 'elected', 'elected', 2009, '2009|councilor|嘉義縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e84640ec-09d4-479a-93bf-e339ade80bdf', 'cec-historical:09b94d9b3091', '918f2c6f-9d3d-a6a3-9bfe-0ff4a0df436e', '248efccc-be19-4cfd-8087-c715432dece8', '0cd53bda-fa0c-4512-b048-2fbb2a939010', 'cec-historical-candidate-58a145f84659b8bc', TRUE, '無黨籍', '2', 2017, 27.9, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|桃園縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e9bdaf05-c686-4bc7-86e9-af8681aa6021', 'cec-historical:2e6d893b5292', '260ec97e-7b44-42bd-bc67-82ce30b10598', '531dea3c-5813-4dcb-8dfe-f36752882775', 'e328bcfe-81fa-4408-bf9a-c0b005c5b7c5', 'cec-historical-candidate-ca3d4ef075fcadd0', TRUE, '中國國民黨', '4', 1460, 18.57, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|臺東縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'eae6d557-db38-4a20-8805-d8061dfaf6b4', 'cec-historical:ab2ee6a42fac', '40cbcdce-7d50-4cf6-8611-4a35765c4fa3', 'ed0c831c-314d-4acc-aaf6-935255023636', 'c629aed7-0af4-4598-bc1b-16c5e822f81f', 'cec-historical-candidate-d71d1b3571cd0544', TRUE, '中國國民黨', '1', 596, 27.26, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|嘉義縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'efa12998-262a-450b-ae0e-9ebb053ca804', 'cec-historical:d0d331a6b29e', '016cc40e-2a9c-4fda-8dd6-d18049616598', '22706ee2-46f6-43a8-a762-79b4aecf9db8', 'c5c70127-5bc8-437e-bd0a-46599590bf66', 'cec-historical-candidate-8a7e0d2eb05cc747', TRUE, '中國國民黨', '4', 2183, 25.74, FALSE, 'qualified', 'not_elected', 'not_elected', 2009, '2009|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE);

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
    IF (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730) <> 98
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'create') <> 0
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'update') <> 98 THEN
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
    ) <> 98 THEN
        RAISE EXCEPTION 'Historical CEC migration updated candidate result mismatch';
    END IF;
    IF (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE vote_count IS NOT NULL) <> 98
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE vote_rate IS NOT NULL) <> 98
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE is_elected) <> 39
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'update' AND original_is_public) <> 98 THEN
        RAISE EXCEPTION 'Historical CEC migration candidate summary mismatch';
    END IF;
END
$verify$;

SELECT
    0 AS planned_creates,
    98 AS planned_updates,
    98 AS planned_total,
    98 AS publication_states_preserved;

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
