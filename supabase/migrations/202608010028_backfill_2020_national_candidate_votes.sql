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
    ('update', '00e20780-dd90-4b73-a66f-2d9e5d0c6d3a', 'cec-historical:6156dae2cc47', '9fdb5db2-ea2a-4bad-a741-974ccf51fcc1', 'fc45fc08-d9b5-4706-b8c3-81e4b289eb30', '4c08be58-06d2-4e24-97fb-9e740df2c81c', 'cec-historical-candidate-83bc8cc51b529015', FALSE, '無黨籍', '2', 1176, 0.79, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新竹縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '0109c515-eeac-4972-9be2-31e1c2003243', 'cec-historical:15f85d414bc3', '4002bf66-c18a-4648-92a2-005890fe5b5d', '57f0c1e4-5477-4c3e-a513-540056b3024a', 'e71ec335-1301-4904-aa9e-99485db6f715', 'cec-historical-candidate-2f71c570c2cf3926', FALSE, '中國國民黨', '4', 102108, 56.41, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|新北市|district-9|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '0134e0cc-37ed-4635-9bc6-ab83b77e6bd6', 'cec-historical:7507db6b8df9', '31f59ea3-6dc9-4999-b4cd-81691b8af603', '8b1924c0-4878-4539-8445-6ee8fc5cd6dd', '88a97bba-61ee-487e-adbc-e359523a4114', 'cec-historical-candidate-7fcfd12938b9592a', FALSE, '台灣工黨', '4', 1102, 0.48, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|屏東縣|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '036c43f2-5c2a-4902-bd74-b14fce6310cd', 'cec-historical:93d3092ec99e', '8bd0900a-154a-4d3d-9cd6-ff67fefa39f4', 'c2e39d0e-ca02-4122-9a5e-cc73a6d4c6c8', '6f29f022-8dbb-4af2-9f0c-9b3340386ee1', 'cec-historical-candidate-715333eef2abb2f5', FALSE, '中國國民黨', '3', 2938, 48.97, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|連江縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '03cbcf4f-ae84-4557-9413-9ebb0a4153ed', 'cec-historical:128033645904', '6eec8a91-e26f-4ee6-a177-fe44ddd554d9', 'ecc349d4-f349-45aa-bf53-11aac553b6bf', '1bd6efb8-7090-4435-9b43-5010128ccba0', 'cec-historical-candidate-0f4b9e4edee2fc69', FALSE, '中國國民黨', '2', 5522119, 38.61, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|president|national|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '05b1b9f4-ab14-45bc-a956-fa1340d5d8d2', 'cec-historical:c6b8aa042d2e', '52833d32-1aa6-44e6-8997-84210c541cd6', '22e009ca-2f6e-4619-a76d-d41b6c932634', '6ace081f-35f3-4e36-ad59-90703ba1fd0b', 'cec-historical-candidate-614771df5b46cad4', FALSE, '無黨籍', '6', 15570, 5.92, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|宜蘭縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '0640eeaf-192a-47bc-aa80-f6acfeccb499', 'cec-historical:33e67f4c0b9d', '1ae34474-85b8-40b0-94dd-6a7ef1e9b777', '56ad2faa-ef94-494a-8dc7-43e353a5585a', '74f2a6c2-14c7-4d44-8f8f-cef871d1b4d9', 'cec-historical-candidate-043b6cafc7395b95', FALSE, '中國國民黨', '1', 73480, 53.57, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|南投縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '083b718c-5136-43b7-85b3-ce55ac43b3bf', 'cec-historical:0b1ad51fa1b4', '53f5e2f0-8f8b-4224-820c-aadfd5c66eab', 'e1f44fac-388c-43d3-b679-be0b012714c9', 'bced850c-d4d6-4c02-b61b-a67f587399ba', 'cec-historical-candidate-bdc77312808a3b9b', FALSE, '中國國民黨', '7', 80455, 37.13, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新北市|district-4|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '0b75fda4-272e-4b90-856e-32e257e4533d', 'cec-historical:3df8792c4db3', 'a09267b3-fe84-4434-a703-1f58786184a0', 'b6928509-1440-4ce0-89a5-e46ac0d0adce', '1a08849a-f4d3-4918-999a-8a6d761773f1', 'cec-historical-candidate-d2161ab66ec1c4d3', FALSE, '中國國民黨', '2', 70659, 40.08, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新北市|district-7|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '0e63f50b-75a7-4f6c-b4fe-8f1b146978dd', 'cec-historical:b6b393b904b1', 'c806349f-2c25-43d5-a222-c037179a4815', 'bd0ba3af-f94a-4c51-9826-851830505e3d', '15226374-6647-4cb0-8c33-c5243ef59f1e', 'cec-historical-candidate-4d5e2660849f709f', FALSE, '民主進步黨', '8', 102300, 43.75, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|高雄市|district-3|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1146d44b-3e35-4d80-b3d5-0a38c0a1f773', 'cec-historical:a556e3175c00', '4fba4b3b-c7f0-442d-b60e-40a9227a6a7c', '4af41fee-e181-4df6-94af-2777bd9281c6', 'b6530bac-c30a-4a76-a947-699ae788a849', 'cec-historical-candidate-2f999f9697824435', FALSE, '台灣動物保護黨', '2', 7660, 3.97, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺北市|district-8|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1203e479-65c7-4139-9827-bc61599989fd', 'cec-historical:46cc2ac27d47', 'a14805bb-dbb0-44d6-b7bf-77479658a7e0', 'b3224eb7-675a-4a03-9434-02d12c4d3d17', '9f0b4243-4b1c-4c7f-8707-362d6bb86043', 'cec-historical-candidate-edf5bf26fac1b817', FALSE, '中國國民黨', '1', 39740, 32.61, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|national|district-1|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '12d3cedf-8bdc-4c64-9c0a-9f1eaeb46088', 'cec-historical:9a4d170a2378', '0ff1030c-d527-4a1e-b27c-8bd7929dfdeb', '4af41fee-e181-4df6-94af-2777bd9281c6', '0bc0c676-a2f3-421f-9812-77a20d3dacb2', 'cec-historical-candidate-147cbd3e7139106d', FALSE, '中國國民黨', '6', 96377, 49.98, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺北市|district-8|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '13239ba9-6430-4d31-9481-1392ee30b5cc', 'cec-historical:33ab433c56d6', '52fe5599-4ed3-4292-a2a9-8702c171bc95', 'b3224eb7-675a-4a03-9434-02d12c4d3d17', 'd878a3f7-36d4-45e9-b248-e94db00430d4', 'cec-historical-candidate-ce56c5529eb27191', FALSE, '民主進步黨', '9', 25843, 21.2, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|national|district-1|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '13eb2c3a-084e-475c-abe2-33fe6eae7ddc', 'cec-historical:c353b1decc81', '10d005ce-0feb-438c-a239-56a4de35a5e9', 'f4ece734-42e4-4df4-b992-4912c3eb09e9', '7e6087f9-e5fa-4ca2-8f19-290bdbca29d4', 'cec-historical-candidate-6416f8ad4470d5b5', FALSE, '中華統一促進黨', '3', 800, 0.37, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|桃園市|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '162f7eed-cf01-4ea9-8a87-2adc6a43f2fa', 'cec-historical:f01cee1376db', '36fd1ae0-76a8-46ac-81fd-f0952558a536', 'a4abb101-c939-436a-9df1-b4ea8f9efb6f', '64e22e3c-846f-4622-8583-4609f919176d', 'cec-historical-candidate-2fd23d09c80fd214', FALSE, '中國國民黨', '1', 86862, 46.38, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|雲林縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1743bba0-ae2d-4b27-b4b1-e191bec1a1c0', 'cec-historical:91894bbbabd8', '95119878-2ce0-4094-b207-85f913fe309d', '7fb73c30-b3cb-42be-86cf-0666aad38d22', '1f232dd8-d34c-4736-8615-7a6a0482e25b', 'cec-historical-candidate-e51185d70cd29a6d', FALSE, '時代力量', '5', 17512, 8.27, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|桃園市|district-3|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '19b2a5df-0dda-4430-9364-2a0191186874', 'cec-historical:1542a86a157b', '2c6feb80-9b13-4e57-a793-929b6132e5c9', '2f5e66f6-e428-45ff-80b6-86bdacda6835', '749357e3-bd16-4cd9-8383-7e5f670665eb', 'cec-historical-candidate-194cd3d395c5dd01', FALSE, '民主進步黨', '2', 104735, 46.12, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|桃園市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1e805a6b-a3ff-447f-ba97-d818a61e6416', 'cec-historical:2a766e5c80a6', '3c91d0c0-c4a2-4884-92e3-69f902cf5dc0', '344bbd80-09fe-474d-8dc9-97a2b7c2286f', '3a661a46-1a86-4f1e-95b6-e4b19e69fbd0', 'cec-historical-candidate-e9702505539069a7', FALSE, '民主進步黨', '1', 118219, 60.03, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|高雄市|district-4|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '234f8d81-03c5-4e01-ac28-833322f8c99b', 'cec-historical:652398bf4f6d', '3d4cb2ae-cedf-4ffe-8f06-897ec2600d08', '0fef4485-7b19-4ae0-837d-34e3952e66f9', 'f7e35825-98dd-4bcd-a5f4-29cdf5b4af39', 'cec-historical-candidate-12f60e88b132233e', FALSE, '民主進步黨', '1', 106368, 57.1, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|新北市|district-5|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '23ce2a14-90cb-4391-ad33-8f71b5b0091b', 'cec-historical:34fa751c4aea', '36a6eb0f-e140-4064-ae2f-ebced0d153ff', 'a4abb101-c939-436a-9df1-b4ea8f9efb6f', 'e4c43888-edcd-4812-81c7-07f8762d7bda', 'cec-historical-candidate-3818fe7311ac2d06', FALSE, '民主進步黨', '2', 94786, 50.61, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|雲林縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '240da4a3-0e32-49a3-b712-a36053c70e22', 'cec-historical:96c001c72a8b', '13f7d7d5-55fd-4cbb-bad5-6ae608b64b71', '955ec28b-28fc-4337-86bf-47e86f16c6d0', 'cc2bcf3c-92aa-4f9d-80f8-3cc628ebda5a', 'cec-historical-candidate-be524a22575ffd64', FALSE, '民主進步黨', '2', 126469, 63.17, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|高雄市|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '24a9f6c6-8712-4186-8ca2-13b94521585d', 'cec-historical:1a9c45d54b13', '5c0cb582-08d9-4f11-962e-ca78b0649b59', '7fb73c30-b3cb-42be-86cf-0666aad38d22', 'f85f51f1-e380-4fcb-bd78-295e20cb09ad', 'cec-historical-candidate-15620e5aae7e0434', FALSE, '民主進步黨', '4', 90148, 42.59, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|桃園市|district-3|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '26e5583a-2541-43fc-a298-9aebf92ff1d4', 'cec-historical:acc1ce92d7f2', '9032a782-985c-4bc9-ad5e-cb1805bf1833', 'd7dc55e2-893b-4675-97c9-ba015e4b5c48', '58548e66-e6ed-471c-811e-4e212fcb2e12', 'cec-historical-candidate-3d44a3bbda041d2f', FALSE, '無黨籍', '3', 13374, 6.08, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|基隆市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '279016ad-274d-4b45-85fe-04e184eb6687', 'cec-historical:611de49acfe0', 'da777a46-5a18-4b1d-9821-0ed2be67e9a0', '92019767-0da0-4023-bc3d-60832dc359a5', '92b6a504-fa64-486d-bda0-97d7ac070d2c', 'cec-historical-candidate-0eb4c28b4aa703ca', FALSE, '中華婦女黨', '8', 3507, 1.96, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺北市|district-6|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2904b194-25af-4f87-b737-cb1677da7a17', 'cec-historical:7a52be0dea07', '096388de-262a-49b3-b0ce-bd846e0b7228', '57f0c1e4-5477-4c3e-a513-540056b3024a', 'baedb6fa-2bf2-4133-b029-05995a7b3eb0', 'cec-historical-candidate-539666806a45570c', FALSE, '台灣維新', '1', 4881, 2.7, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新北市|district-9|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '29486efa-695c-459c-8b7e-671eabef3f05', 'cec-historical:0d055f0f0335', '2efdb57d-4e66-4330-aad5-f15ac0f56a7d', '954a197d-b656-4fac-b6a0-56a667d77979', '590e5a03-7466-4712-ac94-a900aabb9f77', 'cec-historical-candidate-5ee9e324265ffb7d', FALSE, '民主進步黨', '4', 81028, 57.55, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|嘉義縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2a01a8f5-46c7-4767-b4c9-5228697fe2e1', 'cec-historical:5a2d54e3d17e', '0349788f-0413-44f7-9285-c56f952618ec', '27459e73-b426-4eb5-aaf7-79fac188b7bf', '3dd524bd-10cf-4a6f-9b13-a3fdbb31d71f', 'cec-historical-candidate-300adf3ec4dadc35', FALSE, '中國國民黨', '3', 124714, 58.37, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|新北市|district-11|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2a0c40b9-bd78-4f2b-b2c2-ab1ba847104f', 'cec-historical:1a99685e6420', '39aeb075-764b-41e9-bc7d-972da3e8a73b', 'dbab9c66-e036-47ac-9f1d-d378b9c57f93', 'fec54a95-6e7b-40b6-a3a6-2f81858f408a', 'cec-historical-candidate-b5723cb793b0ecca', FALSE, '中國國民黨', '3', 58575, 36.17, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|新竹縣|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2ba0f6af-858e-4ec0-865d-a92e70b058ab', 'cec-historical:2ff4ebbc3ed1', 'ae7ba3fd-c884-404f-a5d1-4bb587c9ca5a', '1b5c3c57-7e9c-40c6-bc53-baabbfa850d6', '8e5b544a-d220-478d-abb5-21710cf3da6d', 'cec-historical-candidate-d04a4ab5c7782fc7', FALSE, '民主進步黨', '1', 25772, 17.81, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|national|district-1|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2e38f161-6781-4ee2-8c2b-ed90f645e7d6', 'cec-historical:6b1fca2b6be1', 'a59f6729-c463-4390-9bf2-a69d1027f914', '3d08e247-ec02-4086-beaf-c7e617570264', 'c5123ced-62e6-4ad6-86e8-8fed5c0087bb', 'cec-historical-candidate-f6a4adcea054bb1c', FALSE, '中國國民黨', '2', 52886, 26.97, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺南市|district-3|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2e42b968-fcfa-46b4-a13b-2d5574999806', 'cec-historical:309f9397183b', '19d1a17e-aa25-4de6-89b9-b4f2204c0a1f', '5fd65ff1-ef8a-461f-bfd8-28dbf4dd5f2e', 'e8c07d4e-0d64-437a-96c1-c8723134cf92', 'cec-historical-candidate-cdd54774ac14fe60', FALSE, '民主進步黨', '4', 41493, 53.09, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺東縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2fb1748f-86a5-4721-95e2-cfe9451059b6', 'cec-historical:b88af3ff179d', '27f2c52d-57cc-41c0-a201-3e47ba325972', '73dfde34-6e8b-43e3-b0f4-b6b5a05a4aa6', 'c1eb0362-faf7-46ba-a3e1-d4617c2e6d20', 'cec-historical-candidate-bd2bcb91eac6b45e', FALSE, '中華統一促進黨', '3', 2803, 1.66, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|苗栗縣|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2ffb7a27-1541-4114-86e7-bb47a74f1b8c', 'cec-historical:f11d35883aa2', '219584df-2937-40f0-9fd3-556adf42a9fc', '8bed0207-1b1c-45df-931e-cdd41f6a1206', 'e7a34a1c-b568-4aeb-ab7a-f7e25f6851eb', 'cec-historical-candidate-41e52c762d42d81c', FALSE, '臺灣前進黨', '4', 561, 0.22, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺中市|district-5|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '336d17fe-539c-4421-8d6c-ecc223bd94e3', 'cec-historical:5f55fe29087e', 'db752145-e274-4ff9-ac85-aa03c8317c1c', 'b6928509-1440-4ce0-89a5-e46ac0d0adce', 'fc270157-fccf-4f14-8684-a57385fe1ece', 'cec-historical-candidate-9d406ac98293076d', FALSE, '台灣民眾黨', '5', 20579, 11.67, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新北市|district-7|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '363b5679-65cb-4304-9cd0-44d1cfa5d24b', 'cec-historical:40740fed4f8b', '282f2c6e-69b9-4c06-8571-2e7d1ca6bb7a', 'd0c7ec9f-0cf1-440a-83db-9c276c22a0d5', '087756f6-4a0b-42cd-a540-34bda4ab9e3b', 'cec-historical-candidate-88ab8ffec15aa1e2', FALSE, '喜樂島聯盟', '5', 331, 0.17, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺中市|district-3|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '36e0da5e-37fb-4200-a7da-0e0d3d332ecd', 'cec-historical:5f88b53b8397', 'b46d510a-7c0c-4e1f-a4bb-a624d5b39544', '22f396ce-63d4-472e-983d-bc7311896451', '870beaa8-ace7-4006-ad74-699e59bc77cb', 'cec-historical-candidate-c375f74a0f97e788', FALSE, '民主進步黨', '3', 99344, 55.64, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺南市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '37652f5b-1892-4bf1-b59a-f4a256fb5dbe', 'cec-historical:5e04cb5d97ab', 'a715cdbd-6267-44be-898c-3ad982a06c01', '37b6389b-43ac-46d8-b0a5-4771e2ace012', '8738601e-e8c6-40c0-8ec9-a0b79fc83a25', 'cec-historical-candidate-a96540d5470bb2e0', FALSE, '中國國民黨', '5', 53154, 33.22, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|嘉義市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3803c01a-cc48-4f01-accd-facab64cae9e', 'cec-historical:e79fbddc01e6', '4471812c-3a19-40dd-96be-4627d9b1e45b', 'ce67fd2f-5c16-4a51-90de-57b468063d88', 'bcd442ac-0ed7-4f2d-a122-2cc08f4707cd', 'cec-historical-candidate-042416406a001018', FALSE, '無黨籍', '2', 63832, 32.45, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新北市|district-3|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3875b4b0-2a21-431d-8e11-6ecec6b94f08', 'cec-historical:d34063f69b98', 'd1978cfd-9cc5-4edf-a634-ae37868f4542', 'f4ece734-42e4-4df4-b992-4912c3eb09e9', '3f0e4395-be21-4a86-ae53-1514d26a2d18', 'cec-historical-candidate-2e8a2904ec2e7873', FALSE, '民主進步黨', '1', 111963, 51.64, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|桃園市|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '38d5b09e-c5eb-43e5-953f-d05947d43594', 'cec-historical:733ce747de49', '284d5afc-9a8a-44d0-8c8a-646de13f06d4', 'dbab9c66-e036-47ac-9f1d-d378b9c57f93', 'c4e92c44-e955-4456-bc13-3e7d6cde00db', 'cec-historical-candidate-ec6d1f5fc91af99d', FALSE, '無黨籍', '5', 1072, 0.66, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新竹縣|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3ade11e3-6372-4e15-9d05-62a8ef100c37', 'cec-historical:bf6e67f611bb', 'b0eec057-6247-47b2-b0e7-83c79bcec32b', '4af41fee-e181-4df6-94af-2777bd9281c6', '38eeb25c-3302-4c04-beea-b4cbb0ca9340', 'cec-historical-candidate-bfa20231c1275934', FALSE, '台灣民眾黨', '9', 12111, 6.28, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺北市|district-8|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3d183e67-db9c-4bc4-8c08-ffb44d144340', 'cec-historical:f4c7d5602da2', '04050593-ddbd-4a45-88e8-304315d074ce', 'da22d788-6dff-49ba-8b7d-5145d120af9f', '3250bf8d-1898-4a96-85c8-60d9d11ddc2d', 'cec-historical-candidate-88a11f9e0fc4013b', FALSE, '民主進步黨', '2', 83013, 45.11, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|彰化縣|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '49fc4609-9fdf-48d0-94e2-8697bd0b3e07', 'cec-historical:b27d2615fe88', '2e37dd21-ae9b-4201-95b8-00831983cfa5', 'bd0ba3af-f94a-4c51-9826-851830505e3d', '1f3733a5-bae5-49c6-b8fc-6d9a0990f09a', 'cec-historical-candidate-c64357fb53f56f21', FALSE, '台灣民眾黨', '10', 12099, 5.17, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|高雄市|district-3|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4a134131-a67b-453a-a897-af9a96c018ac', 'cec-historical:9c0d8cc42766', 'a56ce4cf-bb1d-4e0b-b9e3-d4524694dd2d', '22e009ca-2f6e-4619-a76d-d41b6c932634', '7c23d82b-1238-4e23-a738-b8f06c55d053', 'cec-historical-candidate-9b889611a2e4a0c5', FALSE, '民主進步黨', '2', 121526, 46.23, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|宜蘭縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4a2dadc7-f4fc-472b-9b6b-31d47a472490', 'cec-historical:c7d4b84eb0a4', '29a12ba6-45e8-424f-a3d8-449f97e362b4', '5ebfcfba-1a7d-49ab-b800-a3ec229af386', 'a12f1449-5dbd-4ecc-b242-58178bc2e2a1', 'cec-historical-candidate-cb0cedcc0f03baa8', FALSE, '民主進步黨', '1', 106376, 66.69, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺中市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4a3c815a-cc34-4e83-b2fc-64a9140a1734', 'cec-historical:7f9733fdb322', '7c5ebbd2-91e6-4af0-b890-36ac7e5d556c', 'e2f9d94b-1fca-4601-9c56-34a2196779e3', '6473db8a-5353-4105-947c-e5f47cca7fc6', 'cec-historical-candidate-d546bbd4ed9154da', FALSE, '民主進步黨', '3', 26737, 53.77, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|澎湖縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4acde120-1ba5-4e1f-aaf5-b37e32f409b3', 'cec-historical:c7bf6e971782', '81af49f0-92d6-4233-8510-4e997afd45d9', 'b6928509-1440-4ce0-89a5-e46ac0d0adce', 'f99dbee4-63e8-49e1-93be-c76205985d58', 'cec-historical-candidate-7c20baecd3250e54', FALSE, '民主進步黨', '7', 82764, 46.95, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|新北市|district-7|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4c9d1b3f-fae4-40bc-a787-6ccded08200c', 'cec-historical:d4016f2e962f', 'c2513cc0-a97f-4d04-8a32-01c4fcdfe300', 'dbab9c66-e036-47ac-9f1d-d378b9c57f93', '80da1fb0-24b7-4f8e-9cc8-fca5d89edc86', 'cec-historical-candidate-bf65893cb032c753', FALSE, '台灣民眾黨', '1', 17902, 11.05, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新竹縣|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '5448447f-b909-4982-b086-8bdc9caaa43a', 'cec-historical:d6e577456f8b', '5b77daf4-2f38-4af6-8013-bde818215238', '5fd1f5ae-27a8-4a92-b479-e3ce73d076d5', '912c431e-557a-475d-8ea3-3999b1be0436', 'cec-historical-candidate-3fe9897c5404ff75', FALSE, '民主進步黨', '6', 84393, 45.36, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|新北市|district-12|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '54f3916d-af96-4e77-b3b8-5b6b2d18191d', 'cec-historical:4b3284d50c49', 'ebac73ea-4ae0-4b06-a487-102a8ee1cfb6', 'd0c7ec9f-0cf1-440a-83db-9c276c22a0d5', '40bd8ea3-9db5-4b9f-b8cf-a16d95dba4f8', 'cec-historical-candidate-016aa1633b57b05a', FALSE, '台灣民眾黨', '4', 14700, 7.46, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺中市|district-3|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '587a2182-a968-40cb-9caa-d6a37582a458', 'cec-historical:1d070f8d71bf', 'b8dc2398-2fc6-40c6-8daf-0f2e43d0957c', 'd58b61f1-69d4-4b5a-974b-6d07aa155d5c', 'a936453a-2724-46c9-ab97-c84f908adb0a', 'cec-historical-candidate-52b4d33c2f5c2928', FALSE, '中國和平統一黨', '2', 570, 0.35, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新北市|district-6|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '5abee1e0-f530-4eea-8fb9-cfbc1780e6e9', 'cec-historical:81c359c9986f', '2cb14d00-02d3-4b59-b971-e9fe50e5c0d7', 'ae1a1594-be60-4eda-88a9-25e94b08cbb8', 'b0dcf081-ce9f-4bb4-b642-6c9ba6807fed', 'cec-historical-candidate-1ef12a4fa03ba23e', FALSE, '無黨籍', '1', 4180, 2.19, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺南市|district-4|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '66380306-ad37-4067-b659-d0bc05030086', 'cec-historical:bf5773252b60', '574f1edd-001d-49ad-b9c5-44da5c545056', 'ae1a1594-be60-4eda-88a9-25e94b08cbb8', 'e5ffc977-7f1f-4ba3-a8af-3d9a7858a39e', 'cec-historical-candidate-83fb55532f42850a', FALSE, '民主進步黨', '6', 113046, 59.11, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺南市|district-4|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '678187fe-121c-4f9d-a019-adb0f52d1423', 'cec-historical:bfc84aadb3bf', '4f75873b-c72c-4d30-8c45-b9a14affc86a', '3e8aeaed-3938-47df-88b5-2533bf21ae7d', '45d93856-0537-46e0-a420-02db5931c4a8', 'cec-historical-candidate-58d65e74bf0efd47', FALSE, '中國國民黨', '1', 97396, 51.15, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|彰化縣|district-3|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '69bfed29-62b4-4d11-8e71-841037344712', 'cec-historical:f39c10bbeb70', '383c916b-6a03-499d-a656-da0a27fea389', 'f8724fb2-9761-4c42-b98e-fc611519bcd0', '13d54a63-a4a6-4067-8cc0-a2af2cbf9396', 'cec-historical-candidate-e19a2a24567a1199', FALSE, '中國國民黨', '10', 92337, 38.17, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|高雄市|district-6|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6ace3abd-7699-48dd-ade9-d05489054049', 'cec-historical:f0e18e59b2ac', '103e1cad-947f-4046-b3a4-dbf91cbbc89e', '2317682f-f98e-460d-8f44-80754f49a16c', '87f24030-d03f-4343-abdf-717cead8becf', 'cec-historical-candidate-a5329e0c004342c2', FALSE, '民主進步黨', '3', 123239, 52.27, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|高雄市|district-5|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6b2b7825-4a18-4d2e-8ff4-05e567e00a43', 'cec-historical:d90637782c43', 'eb132af3-9e40-4278-9eef-219ded68b08a', 'd7dc55e2-893b-4675-97c9-ba015e4b5c48', '424b090e-2b36-40c4-ab07-4ab07ea6ed94', 'cec-historical-candidate-5f193d66135ab849', FALSE, '中國國民黨', '2', 83689, 38.03, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|基隆市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6e75824d-f552-435f-9bb6-f1b6201d892f', 'cec-historical:558215c69d26', 'a4a44dff-efa9-45cc-8371-cbaa4cf6772d', 'd38159b5-c505-4929-b746-4357e928de15', 'aa086360-29b0-4eea-90b3-5d67b0db89ae', 'cec-historical-candidate-25c6709e86365e86', FALSE, '中國國民黨', '4', 112784, 51.44, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺北市|district-3|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6ef3fc20-6701-42d9-a4f0-a38b4c5e0e22', 'cec-historical:752d81b8a961', 'e53d804a-023f-4cc0-aa69-7d7f5264e74e', '5c8c24f3-eb5f-4962-adc3-a39b0d211194', 'f7cc900e-52e0-42a8-bce0-06076fe28775', 'cec-historical-candidate-05050ab286fa3ca6', FALSE, '無黨籍', '7', 13801, 29.42, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|金門縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6f809607-771f-466a-8d7b-d7a72198758b', 'cec-historical:3f17af1839db', '1e15b107-7ab4-450b-aa0b-d5d3ac38e2c4', 'ecc349d4-f349-45aa-bf53-11aac553b6bf', '555166bd-725b-4dc2-9543-3df813182486', 'cec-historical-candidate-d7aa8e030e90f273', FALSE, '中國國民黨', '2', 5522119, 38.61, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|president|national|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '7098d1fe-238b-43e2-acf8-7107ee2868bc', 'cec-historical:c9e7e4d5d345', '16e73ab2-33a7-424d-a87a-bdb107f9e236', 'a4abb101-c939-436a-9df1-b4ea8f9efb6f', 'd9125a4e-507f-4df7-864e-995826739138', 'cec-historical-candidate-48da50683512d75e', FALSE, '台灣革命黨', '4', 2088, 1.11, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|雲林縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '77bf0522-949f-49e9-b586-593c343c6d19', 'cec-historical:b25bb87c9819', '384a2330-b65c-4fec-a17d-8bd13fcb7e57', 'ea986f64-8f5d-47ea-8617-127735573533', 'abb3e41e-4f6c-4fc9-8b2a-904c397516dd', 'cec-historical-candidate-c40234813305fca8', FALSE, '民主進步黨', '1', 149538, 63.3, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺中市|district-7|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '7e2e9fe1-be81-477d-801d-699e5d7ce178', 'cec-historical:a6a103b60639', '65326294-d60a-4635-aaad-1f5c16e5aa6f', 'f3a03eb6-340a-4b8d-ba91-4b7dd4ed8a88', '62ac08ac-761a-4da2-8667-f3c2dec99897', 'cec-historical-candidate-2cdbd060ad696b82', FALSE, '民主進步黨', '4', 103740, 53.42, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|彰化縣|district-4|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '801f86a0-2d1b-4f5f-a204-8c356b14d53f', 'cec-historical:f66e8e5b2b76', '13039c92-43b8-4f0d-af44-9895f1c8500f', 'd850f6b4-9d2e-4254-b159-286ccd5df453', '63bb55ca-1dcd-4a69-9691-32bfcf0e2922', 'cec-historical-candidate-612144904ef471bc', FALSE, '中國國民黨', '4', 73154, 49.07, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|苗栗縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '80c91022-bb5d-4814-8712-701f0ad572a3', 'cec-historical:02341354b9a4', '96463cfd-9ecf-4ebc-a0b4-bd2c688cd827', 'f31a41c5-6b58-44eb-a9a8-9bec00ccf8c8', 'b9e646e5-0ae3-4f6d-9e1a-dd1d5e7df11d', 'cec-historical-candidate-7adb431447204ff6', FALSE, '民主進步黨', '2', 119468, 57.3, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|雲林縣|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '812b36d4-b334-4ecf-b6be-25a4df5472ac', 'cec-historical:55b6bca8eabe', '5521e9af-f988-486e-a05c-9eb694d4af57', 'efe92d81-9a58-43a2-8e73-805847df72cb', '2e631c95-6442-4ccf-8f06-314fdccde0a8', 'cec-historical-candidate-e9870dca08a978d5', FALSE, '民主進步黨', '2', 92665, 44.77, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|新北市|district-10|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '84113a39-4ad1-462e-858e-a084f7a0d357', 'cec-historical:1b3cfbdfe3ae', '86e2ac4f-66a3-4350-8ddf-dd4723ff4daa', '26d390c6-6442-4098-950a-9fafaa5eeef3', '8c475011-c967-4ac2-9918-4640fa764635', 'cec-historical-candidate-a73f12e8b0911b35', FALSE, '中華統一促進黨', '2', 418, 0.21, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺北市|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '84bec5ca-8871-4b50-81d0-57d7adfb1f56', 'cec-historical:a4281c85ddd1', '19ab2b72-7a81-4800-9da0-b40c6821ab4d', '795ab8d0-0e97-4332-8f50-ec55d9cbe4af', 'fb927c30-ce87-491e-9eaa-39a8654a47fc', 'cec-historical-candidate-0eb2a6d68183cb74', FALSE, '中國國民黨', '1', 107766, 48.85, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺中市|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '84dcecba-7c81-4151-aa54-1fc25b602434', 'cec-historical:dbe769ca58bf', '3a3a3826-cdb7-4155-b968-e58547054102', 'd58b61f1-69d4-4b5a-974b-6d07aa155d5c', '1de75ffe-084a-452e-a431-0102b1e985c1', 'cec-historical-candidate-1a0b153fb6e54a49', FALSE, '民主進步黨', '1', 88236, 54.35, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|新北市|district-6|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '851b4f51-999d-4bcd-a941-8dcb136f406b', 'cec-historical:c4c654df726a', '7a4d2370-42b0-4acf-9b41-545eb1905cec', 'dba54573-4160-43f1-9ffa-cfc59317d604', '2f321bab-2244-45e4-87f0-97f66812d42f', 'cec-historical-candidate-29cff7139039419e', FALSE, '中國國民黨', '2', 94750, 59.03, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺中市|district-8|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '854709ed-65e4-4231-acca-cfb23ea3327a', 'cec-historical:bbd26b15a3f0', 'd3bde701-9238-4f22-8231-49d6f4f8771c', 'c0ae2f97-74ef-499b-a2c2-6fd9e8813aaa', 'b44c7a94-2c67-4739-868b-d75abd298c7c', 'cec-historical-candidate-314e1725234eb28f', FALSE, '民主進步黨', '3', 120097, 63.96, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺南市|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '881768c2-8ac5-4f92-b0b7-8ea417bad101', 'cec-historical:43f88cbae0e1', '47345c01-6af4-4454-a20c-f0bb1f83dd1a', 'dbab9c66-e036-47ac-9f1d-d378b9c57f93', '1eeed881-ce4b-4620-ba1c-cea109d9ee47', 'cec-historical-candidate-a23a8c205e041467', FALSE, '綠黨', '2', 4121, 2.54, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新竹縣|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8a4892b3-6aa3-4c29-ad29-502c13b6714d', 'cec-historical:39b61dce291b', '50b80683-9734-468c-bcba-e843f2bd3e55', 'd829b622-8706-4ced-b64b-7609aaa094b7', 'cf57935c-af4e-4df5-9096-b5c821eb7c0f', 'cec-historical-candidate-5913dc39b6864c9e', FALSE, '中國國民黨', '4', 67364, 33.76, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺南市|district-5|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8ae13628-85d7-47be-8c92-df3d5883d6f0', 'cec-historical:08b73ac03f22', 'e6fecff0-169b-46ee-ae6e-888179d54342', 'b3224eb7-675a-4a03-9434-02d12c4d3d17', '88b5e91c-90db-4c35-a073-7e818b4acde7', 'cec-historical-candidate-427a3230664cb0b7', FALSE, '中國國民黨', '3', 15158, 12.44, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|national|district-1|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8bac8f27-d575-4f85-b13b-d7d2652df7c5', 'cec-historical:6ae5e1bcdcc2', '0ecf679c-cff2-4e3b-88b6-f6ec68f6d563', '3d08e247-ec02-4086-beaf-c7e617570264', '3a822b4f-debf-4ed4-afef-21acfaa5fd7b', 'cec-historical-candidate-880c4411e4e9f832', FALSE, '民主進步黨', '3', 136815, 69.77, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺南市|district-3|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8d04403b-c13b-4274-b997-7f46d97717c1', 'cec-historical:ba8a89cc5d02', '8604be68-d410-4130-8469-9a5d771823c5', 'b3d8aa58-b3e4-46a1-88ed-d126f7d40ab7', 'f9bd5d0b-3ba1-4eb3-a10b-360da2436ac1', 'cec-historical-candidate-1da2897a52051eec', FALSE, '人民民主黨', '5', 1870, 0.9, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺北市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8d5e31b4-3f65-440f-8b83-5dbd202493e6', 'cec-historical:2c171faff912', '4f7db982-15de-44ee-8db1-6989bc8b6e77', '37b6389b-43ac-46d8-b0a5-4771e2ace012', '4dbf63b8-94ed-4d16-876a-250d47e0cf04', 'cec-historical-candidate-c3c0093283a666a9', FALSE, '民主進步黨', '6', 80333, 50.2, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|嘉義市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8db631c2-8ea4-422e-a522-f822a68e51d4', 'cec-historical:74c117c18256', '1bdf1b69-8e6d-4bed-921c-64479a54213f', 'd47e97b7-3e21-4db0-9245-5de177e5fbb6', '745ecd06-42a1-4199-b2aa-96d01fa4792c', 'cec-historical-candidate-e6c2caadf8358036', FALSE, '中國國民黨', '1', 95298, 36.97, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|新竹市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8e1a3bab-526a-48ef-b48b-61c614274124', 'cec-historical:6b0d99b97726', '0569f998-6212-4a5d-b2d2-9f5a00dc1d06', '4e6dd8e4-355e-44f1-a2b8-9f61e1b328ae', 'e625ba6a-a414-45b8-8145-b4088c5d4548', 'cec-historical-candidate-969ca00b215790a5', FALSE, '民主進步黨', '1', 132591, 62.37, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|新北市|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8e6b9c10-f1f4-4254-b19b-0d3aef8b6753', 'cec-historical:e34fdaae28ac', '4f25892a-b0c5-484e-bb26-88f1e7aea483', 'edddfc73-a72b-4530-976e-f7f26a9c520d', 'c0ff613b-f390-43b8-a647-75716ca28f87', 'cec-historical-candidate-bfaea113a0c0866c', FALSE, '中國國民黨', '4', 102763, 49.11, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|桃園市|district-4|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '9027de13-3202-4e18-99e0-fed7ebcb7027', 'cec-historical:fd3ffe4c9ddc', 'b63e779a-47e9-4162-9047-71d78b1343d2', '291eba68-a08d-4588-b8e2-fcb78824d33b', '34e7cd79-9dda-4947-bccf-b0dda0a6e061', 'cec-historical-candidate-6a68acea2e618848', FALSE, '中國國民黨', '5', 80478, 39.78, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺中市|district-6|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '9194ff64-37e6-49c8-bb3a-4ab9c157b332', 'cec-historical:0efaae45e90c', 'a6981b25-a402-4b05-95cf-00717f1d984d', '5c8c24f3-eb5f-4962-adc3-a39b0d211194', '08119cad-e70d-4425-8ef7-d5019f7a95fd', 'cec-historical-candidate-1d7c1edd17879d46', FALSE, '中國國民黨', '9', 21875, 46.64, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|金門縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '949f8cc8-50ae-4ed5-a99f-53a65dc2a795', 'cec-historical:19ab0df1e9ad', 'fccc527b-5250-46e5-b12e-e452074425c7', '8b1924c0-4878-4539-8445-6ee8fc5cd6dd', '72bf3604-21bb-42a5-b003-fc30486b3259', 'cec-historical-candidate-6dad63cb26218210', FALSE, '無黨籍', '8', 19209, 8.36, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|屏東縣|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '9f66ca47-d762-4c9f-b42e-1d05a7046bab', 'cec-historical:0eb67773d81e', '5d76175c-5773-4b9f-95a5-14cdb0536173', '1b5c3c57-7e9c-40c6-bc53-baabbfa850d6', '9ed44681-00cc-499f-bf16-a8364a9c6c94', 'cec-historical-candidate-527cf8a7098eeeb2', FALSE, '喜樂島聯盟', '3', 577, 0.4, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|national|district-1|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a03062f2-4a8a-4734-a5a9-cde22ba7a2f5', 'cec-historical:89ff74907e3e', '8c1f9f80-03ab-41aa-8fe7-0f4f9e5c4fc0', '2ff0e1e4-605a-41f1-b931-2c3063333e81', 'b5b561a7-5f9c-49bd-bfef-bd263786480b', 'cec-historical-candidate-5385c077224ed62e', FALSE, '臺灣前進黨', '4', 795, 0.57, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|花蓮縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a15a1786-6ce3-4176-805f-5f26d91b831e', 'cec-historical:ae2e3a220229', 'e314db40-3101-4810-a9da-c13845005ae1', 'e1f44fac-388c-43d3-b679-be0b012714c9', '685d2f3a-2083-42db-a0cc-7dd4307a94a5', 'cec-historical-candidate-347c076b235415e1', FALSE, '正黨', '9', 623, 0.29, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新北市|district-4|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a749609a-52de-4d32-9e9f-d6a855b0d938', 'cec-historical:72145cfe93cb', '61bab423-f269-4e64-813c-97d9784e6e12', 'd47e97b7-3e21-4db0-9245-5de177e5fbb6', '76130b7d-2b31-4aad-8745-327e1adc6683', 'cec-historical-candidate-cbd281e025070296', FALSE, '無黨籍', '4', 971, 0.38, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新竹市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ad36df47-711a-4412-9688-3d8064e4aff1', 'cec-historical:8b4f49afdf11', '6483e2a3-08a8-42f7-a3ec-a4d63875a93a', 'ae1a1594-be60-4eda-88a9-25e94b08cbb8', '4d242453-ba13-42e1-8b63-ecd179eb0a76', 'cec-historical-candidate-9b3a41df85310d5b', FALSE, '中國國民黨', '4', 71052, 37.15, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺南市|district-4|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ae0d4138-d385-4cc9-9265-635b5177cb3b', 'cec-historical:1b70d1e1a415', '4b8056aa-46b1-4718-a612-04de238cb375', '8aaf5237-baa2-4bd5-8574-4d9520c536aa', '4d359ab8-35f7-4722-8523-3a391e0e9c88', 'cec-historical-candidate-8c67fbdbc56371a3', FALSE, '民主進步黨', '3', 91561, 55.92, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|高雄市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b3342dde-99d1-4a0d-8c16-0b08542149cd', 'cec-historical:b295d67d3aac', '60c860f2-f6f9-4efe-8c51-4c40f166839d', '22f396ce-63d4-472e-983d-bc7311896451', 'ba9c6889-9fce-4095-b495-95b97e1cd07a', 'cec-historical-candidate-524de1a18a2652d0', FALSE, '合一行動聯盟', '4', 616, 0.35, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺南市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b4acf205-fa04-476d-8273-2eaf8b7f6edc', 'cec-historical:e472c4188cf4', '1d1cb511-1198-4d6c-a888-4771c90d4d42', '6168d6ae-4644-4631-9b12-efeb40d059c3', '314ca726-3146-47ac-9af9-36d29ba213eb', 'cec-historical-candidate-915278ce5c9d4536', FALSE, '中國國民黨', '2', 118432, 47.44, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺北市|district-4|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b4d349b4-0090-402f-8711-63dbbad4d62e', 'cec-historical:011851d7f9ce', '52b6adb4-38c5-4615-b2c2-4d149ae5c163', '954a197d-b656-4fac-b6a0-56a667d77979', 'c33c85cc-3481-408e-a63d-a0dcafec8f05', 'cec-historical-candidate-9ed101d61149ef3d', FALSE, '中國國民黨', '2', 56256, 39.96, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|嘉義縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b53a8c0c-42a4-448a-901d-a7709e58971a', 'cec-historical:c9faa37d94e4', 'c15c4669-bd02-4418-b9b5-f5999fe7c7ce', 'b3224eb7-675a-4a03-9434-02d12c4d3d17', 'ef1afefc-c565-4a08-bd05-721240e16f1b', 'cec-historical-candidate-2c46ae3988c5986b', FALSE, '無黨籍', '6', 7604, 6.24, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|national|district-1|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b6d5f303-297b-4ae3-95e2-d8f6e8c2edab', 'cec-historical:88e9b1bf2b1c', '80b17e0e-20a9-4141-92fc-bdca821709f7', 'b3224eb7-675a-4a03-9434-02d12c4d3d17', '64482293-2027-445f-ba56-419aa70a8be7', 'cec-historical-candidate-a3b9bd5f67111340', FALSE, '中國國民黨', '10', 23255, 19.08, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|national|district-1|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b9751429-4244-4cd9-8924-0988825e5738', 'cec-historical:7e025c33d80b', '244928a9-66fc-4c2f-b4a7-01a530cbefa3', 'd7dc55e2-893b-4675-97c9-ba015e4b5c48', '36409ce0-26d1-4fd8-b6ab-2fa3b47be2ec', 'cec-historical-candidate-2716105831998c30', FALSE, '民主進步黨', '1', 104082, 47.29, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|基隆市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b9c8eb07-dc66-4745-857a-65bf49b12c48', 'cec-historical:2b57fcb1b65e', '055d76e4-03f0-420e-b491-2fa461b09b18', '2317682f-f98e-460d-8f44-80754f49a16c', '7caa90bc-f88b-4333-956e-0c376da202c3', 'cec-historical-candidate-d855111f3bb312c3', FALSE, '台灣民眾黨', '1', 20336, 8.62, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|高雄市|district-5|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ba331050-c45e-4669-ad88-784a4e57f32c', 'cec-historical:496ef4ff1684', '2ebb787e-5abb-45fe-9dd0-364e5418e046', '2ff0e1e4-605a-41f1-b931-2c3063333e81', '06f6c8b0-a34a-4a99-b696-f55f96a9c58c', 'cec-historical-candidate-5cbd0244ecd5103e', FALSE, '無黨籍', '6', 64060, 45.97, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|花蓮縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ba599a93-fedb-4b57-8b43-5655c1192f8f', 'cec-historical:c3ec711d627d', '457aa1a0-618b-464b-8b41-691994a9f3cd', '7fb73c30-b3cb-42be-86cf-0666aad38d22', '2d9c75d0-ad82-404c-a3d8-9ba987f7af4a', 'cec-historical-candidate-9efdff187d647462', FALSE, '中國國民黨', '2', 100463, 47.46, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|桃園市|district-3|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'baeb7a2a-0b38-4ffc-97b1-dba924a23aeb', 'cec-historical:bad88f1aed7e', '3776d7cf-e27d-4089-8cf3-a06f14a41d95', 'd0c7ec9f-0cf1-440a-83db-9c276c22a0d5', '1fae64e9-7dbd-4d79-bb39-7bde9e439a43', 'cec-historical-candidate-250a846217afa43f', FALSE, '中國國民黨', '6', 91182, 46.29, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺中市|district-3|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'bbafbd7d-4eb7-4af7-abaf-e61ad390d147', 'cec-historical:991dfab341bf', 'cfdae087-9637-4767-a4f1-517aebecf3c6', 'd850f6b4-9d2e-4254-b159-286ccd5df453', '5b9325ad-a38f-4602-b3ed-012ddbf7d103', 'cec-historical-candidate-d3a7cf01a55883d5', FALSE, '民主進步黨', '2', 56622, 37.98, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|苗栗縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'bc9089ad-1dcb-4cf2-85f5-8c52c6b74888', 'cec-historical:c046d95e7bd0', '0ee1d8d0-b836-47ee-aebc-97ca91294694', '4120431a-0dd5-4046-84b9-9ac6d511cfa5', '23b5bdf1-3df4-4b48-aec1-077765ad6bb7', 'cec-historical-candidate-3317036097606cea', FALSE, '民主進步黨', '4', 116174, 58.85, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺南市|district-6|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'bdb2661a-28bc-4c60-9d5c-98f8fb23f318', 'cec-historical:049458ffa23a', '196b92a3-a4a7-428b-9942-13dfd9f97fa4', '37b6389b-43ac-46d8-b0a5-4771e2ace012', 'f9afc898-f8a6-4db4-9b02-69c3a0de40de', 'cec-historical-candidate-0e822b65c4188ad8', FALSE, '無黨籍', '3', 14000, 8.75, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|嘉義市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c3390485-bc0f-4acc-9bc6-3bbe64edaf88', 'cec-historical:7e401e2f918f', '1e7539af-cd23-4664-8ce7-502af58bfc22', 'e1f44fac-388c-43d3-b679-be0b012714c9', 'c0b516de-f838-4399-8e01-17f2f9802d21', 'cec-historical-candidate-41b8d005debff175', FALSE, '民主進步黨', '3', 119461, 55.13, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|新北市|district-4|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c50f1b49-0126-42fe-923d-507b679bd2a6', 'cec-historical:1c4bc6e96124', '1cf231cf-01c4-43c0-ba9a-b6b30cd9adb6', 'efe92d81-9a58-43a2-8e73-805847df72cb', '43ec3091-39d9-401e-b786-b8173697d731', 'cec-historical-candidate-139e83a886ca3d4f', FALSE, '中國國民黨', '1', 73686, 35.6, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新北市|district-10|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'cc709ddc-ffa4-4507-8d7c-ce3328749e20', 'cec-historical:9c92fde63ca1', '1d6d74ef-ea70-4503-bc59-6bf36d9f25cf', '2ff0e1e4-605a-41f1-b931-2c3063333e81', '6b7f4faa-f379-4173-817a-251946894aa2', 'cec-historical-candidate-07a294ce391966cd', FALSE, '民主進步黨', '2', 56485, 40.53, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|花蓮縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'cd079a77-1348-42ce-b601-fe4a3a3e8198', 'cec-historical:c73d4e39af2c', '6bc54045-f1f5-4ae0-b57f-b084f2dc8985', 'fc45fc08-d9b5-4706-b8c3-81e4b289eb30', '42269fc1-13f5-48e7-b2c7-33e0b2f9b541', 'cec-historical-candidate-8b1c168c32b074a9', FALSE, '中國國民黨', '1', 74087, 49.88, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|新竹縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'cd535d49-a0b4-4677-96f4-ff13066d5345', 'cec-historical:51f9ba646275', '84d8c394-073d-4edd-8e28-8ca15752d309', 'b3d8aa58-b3e4-46a1-88ed-d126f7d40ab7', '44575ed9-ed69-4b86-97cf-71f74d912bf1', 'cec-historical-candidate-2631ad3748c4dc2f', FALSE, '中國國民黨', '7', 83566, 40.38, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺北市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'cd6ce236-2262-444b-9d8b-6de3b5ec4fdc', 'cec-historical:50080eb3a3cf', 'a6dacc2f-35d3-411e-9812-083681eb9b7f', 'edddfc73-a72b-4530-976e-f7f26a9c520d', '23cb7dec-e114-4b50-b0ce-c8580aa5a0f2', 'cec-historical-candidate-abc55d87d8960660', FALSE, '民主進步黨', '5', 97316, 46.5, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|桃園市|district-4|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ce25429d-bd02-45ba-8cdb-98705677db70', 'cec-historical:ac8470fa4831', '5301fc21-dd24-48f8-940a-6aeb8d83f5d9', 'dd105c15-09fe-4a52-ada7-dd91d598ba99', 'fb67748e-46bb-4170-9248-a4e680587d4a', 'cec-historical-candidate-205c2c566da966ee', FALSE, '中國國民黨', '1', 80067, 54.83, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|南投縣|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ce594ce7-fe0f-4036-8349-af84d4dcf360', 'cec-historical:588e350f7bd2', '2ddedfab-1640-49e6-86fe-97f4ffa90a53', 'b3d8aa58-b3e4-46a1-88ed-d126f7d40ab7', '9ea34071-06f2-49f3-8118-2a0ad199562c', 'cec-historical-candidate-691e1f5a2e184efc', FALSE, '民主進步黨', '2', 107850, 52.12, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺北市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'cecd602a-7b3b-4cee-bb9d-01edc6493b98', 'cec-historical:e563e3bba749', 'ad75b12d-33df-42f4-9e28-2028a685bcc0', 'd1a1472d-317f-448e-be7e-21e8bb047a6b', '03c3f8ef-a435-485a-bf7f-3ebfde85038d', 'cec-historical-candidate-1fb39f9a5bbd998b', FALSE, '中國國民黨', '1', 94218, 46.72, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|桃園市|district-5|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd0e87ce8-5d12-460f-b2db-6c59233164ef', 'cec-historical:8ee9681e76e2', 'd202716e-11ab-4ea5-a481-6134b1674686', '1b5c3c57-7e9c-40c6-bc53-baabbfa850d6', 'c5d9c181-e9fe-4af8-bc42-49746a074fca', 'cec-historical-candidate-4eaf59738ce8b758', FALSE, '中國國民黨', '10', 25788, 17.82, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|national|district-1|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd3979d55-a908-431e-a633-b80cc3033d9e', 'cec-historical:39984b3bf280', '22f4a8b5-9888-493d-8a01-d5bcf95483c3', '8bed0207-1b1c-45df-931e-cdd41f6a1206', 'beb78409-16c7-40b4-a98c-47445d2e2dca', 'cec-historical-candidate-52ff54f4c68bebcd', FALSE, '無黨籍', '1', 5225, 2.03, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺中市|district-5|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd40ddb48-44d5-4cc8-b2fa-796cb43ba59e', 'cec-historical:a07e653c2e1e', '42cc9eb6-6427-4332-96a4-e8143e5bcea7', 'ecc349d4-f349-45aa-bf53-11aac553b6bf', '1cf2605d-5d0f-47a1-9c4a-c3f2b14d09d7', 'cec-historical-candidate-4c9660c807b6e17d', FALSE, '民主進步黨', '3', 8170231, 57.13, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|president|national|district-1|regional', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'd6ca5e67-709b-49f7-bcee-a3df401054dc', 'cec-historical:3fbeb3694155', 'af939a8c-1183-40b7-b570-5b97d6d8f573', '22f396ce-63d4-472e-983d-bc7311896451', '6259dde2-c23b-4c1f-b822-8494d768e7ab', 'cec-historical-candidate-3e3cc2da8a3d4266', FALSE, '中國國民黨', '7', 68568, 38.4, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺南市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd8672dea-d08c-4130-972a-a09f80e74485', 'cec-historical:62b6d32b6159', '5b1f1a78-c9e0-44da-a663-eb10ec5f5659', '6168d6ae-4644-4631-9b12-efeb40d059c3', 'ba2ddd81-4795-4d04-ab8f-174e1503c97f', 'cec-historical-candidate-ccc16367809f9cc7', FALSE, '民主進步黨', '5', 125138, 50.12, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺北市|district-4|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd97bad98-2803-41f8-8d61-7449908f9db0', 'cec-historical:b9fa7e288c8e', '1c0a3096-71d6-4584-81ef-19ce06c0b3ac', 'b53d4b22-4daa-4a1f-a8c7-5e972f864973', '6389719d-82fc-487f-9b98-77a5470df36e', 'cec-historical-candidate-36f8077972893172', FALSE, '民主進步黨', '3', 135052, 57.73, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|高雄市|district-8|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'da0b75e9-9d67-47be-aada-85409bf27a4d', 'cec-historical:7411bd624429', '8f533484-880b-4a02-8305-8b675b6ddb3a', '73dfde34-6e8b-43e3-b0f4-b6b5a05a4aa6', 'b9552f4f-d5e9-4564-8467-55b9799a99c7', 'cec-historical-candidate-16383706d417170f', FALSE, '民主進步黨', '2', 50629, 30.07, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|苗栗縣|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'da14ab70-7444-481c-9b30-01b003f53fad', 'cec-historical:b05f683868ac', '3942ac9e-1220-47a6-a36e-d5c11d344d37', 'd58b61f1-69d4-4b5a-974b-6d07aa155d5c', 'c590cb21-57b7-44f6-a168-e6def340d3a7', 'cec-historical-candidate-5b1d608b2cfe96f2', FALSE, '中國國民黨', '4', 69178, 42.61, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新北市|district-6|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'da8dff6f-1031-482d-adfc-224181e63ee8', 'cec-historical:57775e50a9d6', 'a9ff4d89-f8d0-4492-85fb-a6e7815e323d', 'd778b785-e7ba-41e6-9ce7-915ccf486aad', '83533ad3-f96d-44a3-b80c-5d110f2d298c', 'cec-historical-candidate-baa7ea98e90e4799', FALSE, '無黨籍', '2', 22208, 12.19, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺北市|district-5|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'db832b81-9819-41c2-8c1a-f6b9a4ce07ab', 'cec-historical:a0260cfcc273', 'b48334e9-72ee-4214-9fd1-9722dc0e0b06', '73dfde34-6e8b-43e3-b0f4-b6b5a05a4aa6', 'ad0cd348-bc95-4a48-b970-0030ec1af4fa', 'cec-historical-candidate-950528a5e0ed3dad', FALSE, '無黨籍', '1', 19418, 11.53, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|苗栗縣|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'de8b1cd1-c074-4c42-8066-c3d23cf166b8', 'cec-historical:b5503ba7a656', '1167ee73-e3bb-4cc7-94a6-39726ee8efc3', 'd829b622-8706-4ced-b64b-7609aaa094b7', 'f084dfa2-840b-4123-a927-6736bd65df37', 'cec-historical-candidate-b90e6b3de0a305a5', FALSE, '民主進步黨', '3', 110547, 55.41, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺南市|district-5|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'de8ecb2a-6e6f-4b40-996d-fb0457ba5e10', 'cec-historical:222970af289b', '65fc9c11-4e21-4965-9db1-b9cf19632768', 'f8724fb2-9761-4c42-b98e-fc611519bcd0', '8f7d9266-d313-45a8-8e7a-f0781431ef5c', 'cec-historical-candidate-ddec7ca127e86391', FALSE, '無黨籍', '5', 4112, 1.7, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|高雄市|district-6|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'df8949d7-8b52-4453-ac91-0016d89d4ab7', 'cec-historical:81bdc35c43a8', '5dffdbb8-9047-49d7-988f-b43e4bb38f6c', '2317682f-f98e-460d-8f44-80754f49a16c', '32589ba6-7f22-481a-a21c-26a4f1f2a411', 'cec-historical-candidate-79f89ad95a8cba27', FALSE, '中國國民黨', '2', 92220, 39.11, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|高雄市|district-5|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e1a89e26-560b-40d1-9747-8e69dd60e52f', 'cec-historical:299dbd7c6fdd', '1760a6e6-41ec-4019-a473-2d5f945178a3', '5c8c24f3-eb5f-4962-adc3-a39b0d211194', '1fff28b6-dfc2-4f41-9409-b8a47f46af4f', 'cec-historical-candidate-c53097d8cf8a3dba', FALSE, '無黨籍', '4', 264, 0.56, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|金門縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e1d59713-9231-4543-b367-8316c06526bc', 'cec-historical:5f70c018725a', '4bcbb465-c25e-4694-87a5-cc21a3634ae1', 'b53d4b22-4daa-4a1f-a8c7-5e972f864973', '6c38ae32-8e3f-468f-9c29-5463e71a46b2', 'cec-historical-candidate-64276334b6a857a3', FALSE, '中國國民黨', '2', 83148, 35.54, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|高雄市|district-8|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e2307b13-449c-4c88-9ffe-b795a18d3cb4', 'cec-historical:d7005fc0aa32', '4be3dfb3-dff0-41c9-b202-9d56fa555078', '26d390c6-6442-4098-950a-9fafaa5eeef3', '7687159d-a9a4-48d6-81b1-86dda6daf27d', 'cec-historical-candidate-23f1a6307d46c578', FALSE, '合一行動聯盟', '6', 2360, 1.2, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺北市|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e26bd117-a3b4-41eb-b741-ee82746b62d8', 'cec-historical:8759fef180fc', 'a5d153ce-94ae-4f7b-b4c1-df01a944a458', '4e6dd8e4-355e-44f1-a2b8-9f61e1b328ae', '079e744e-11a3-4021-85c5-bfb9712c8b51', 'cec-historical-candidate-1364a0835b9510f1', FALSE, '中國國民黨', '3', 77625, 36.51, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新北市|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e2a07d6d-cae8-4f1b-bab6-9c4ee5102e4b', 'cec-historical:d9c2ce55f83c', '1e26ebc7-76c5-4f28-9612-d084094dd504', '58523411-974d-41bf-9982-ab5e89cf620d', '5b998d37-5a25-4ddb-9f5a-c1dbd3b07c0b', 'cec-historical-candidate-c9d39267888aae69', FALSE, '民主進步黨', '2', 119871, 49.55, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|屏東縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e2f60b60-9353-4df2-98fe-a22dbf5d0104', 'cec-historical:45e67bccfcdb', 'e4afd0c0-c2c8-4efe-b585-b75341a80017', 'dd105c15-09fe-4a52-ada7-dd91d598ba99', '748bc81d-76c0-4969-9c43-b404a2d967ec', 'cec-historical-candidate-d5fcef863cc5f29b', FALSE, '民主進步黨', '5', 59322, 40.62, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|南投縣|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e34c806f-c271-447e-b1d3-6bc0639c2309', 'cec-historical:4a2c72929df2', '09709cc8-d847-4401-877a-03a1fd03fc87', 'd829b622-8706-4ced-b64b-7609aaa094b7', 'ca346f62-9c8a-4b8c-98b6-dccf253ad46e', 'cec-historical-candidate-3a1f3005b3ab3d95', FALSE, '無黨籍', '2', 10110, 5.07, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺南市|district-5|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e3d93ee6-9012-43cc-8a2c-d0235a4d3f47', 'cec-historical:07323bc42282', '168c620f-602d-44ea-b545-eea4cda7a1e7', 'c2e39d0e-ca02-4122-9a5e-cc73a6d4c6c8', '256b1cfe-a5bf-4ab2-85c1-e05c9c7361bb', 'cec-historical-candidate-df01cf2b769ea57f', FALSE, '民主進步黨', '2', 706, 11.77, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|連江縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e5164890-badb-4a5c-9678-6f5a553632c6', 'cec-historical:16b3b5c80e40', '12097a64-2d82-433a-b98e-1bc81d7d643a', 'c3d34ec2-3253-4401-b6d2-6d8fb6ad74c8', '92e19d93-f644-467c-9102-fb59e85be6af', 'cec-historical-candidate-3802e73108942667', FALSE, '民主進步黨', '6', 119886, 50.9, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺中市|district-4|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e5beecfa-bc7a-4c6c-9138-d2f3a497515a', 'cec-historical:807c73ffde17', '3b8d4038-5280-4932-a2b3-58d2b500df76', '0917e815-9a00-40ea-985e-9355fa76da45', '3b9db5e9-5b2a-465b-a2de-000982f12143', 'cec-historical-candidate-96fbd281e8fb5629', FALSE, '中國國民黨', '7', 119401, 46.4, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|新北市|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e62b3372-db0a-48ae-920c-f05966bf06d8', 'cec-historical:5f746fe88550', '991d7179-0516-477c-a1bd-3c4b879ce2d6', 'f507a525-a77e-4ab1-b9ab-776d34db20ed', '9d656a55-52af-4359-99a6-cfae62241316', 'cec-historical-candidate-af23d9aa09de8387', FALSE, '中國國民黨', '1', 95471, 44.6, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新北市|district-8|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e6f645e6-83e8-4674-8082-375017f6cde4', 'cec-historical:8ef1ec78dc94', 'e34c3d98-dbf0-433e-bbd3-4b0a7e7f3ce4', 'e49eba9b-aa21-40e4-9686-92a8110f7f93', '0d19671f-bd37-4b0b-9aaa-a25d3c785d32', 'cec-historical-candidate-a1b48fc4708f4c68', FALSE, '民主進步黨', '4', 79057, 43, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺北市|district-7|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'eadcf031-2f4d-4569-b0d1-d2d168ba8ad5', 'cec-historical:2775534da593', '0fda2b34-a35f-4749-9eaf-34dbfab25e4a', 'abe89637-5970-4b23-bbad-6cf0f0f9bbcc', '43c01eda-4174-4758-a98a-24f3d709dc64', 'cec-historical-candidate-a2309e6305cd18e5', FALSE, '民主進步黨', '2', 96191, 52.03, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|彰化縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'efbdd77b-6521-47bc-8ee1-81a9f429bd94', 'cec-historical:dbf00ad82ad1', '56278c5d-6324-4d52-a486-eedad23979d1', 'fc45fc08-d9b5-4706-b8c3-81e4b289eb30', '626b69f9-2538-4d2a-b2b4-943b069008c9', 'cec-historical-candidate-883f2e7116232e8f', FALSE, '民主進步黨', '5', 54862, 36.93, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新竹縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'f1113441-9975-4629-9248-6c09c2265442', 'cec-historical:21e9729bd8e6', 'd549a34a-cfd2-40f3-9d62-0cd376160e0d', 'c3d34ec2-3253-4401-b6d2-6d8fb6ad74c8', '331d5360-1462-4fb9-b893-15485f48d500', 'cec-historical-candidate-40927f7c8d577d5d', FALSE, '中國國民黨', '3', 96460, 40.95, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺中市|district-4|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'f30cebc9-ca80-483f-b9f8-aba61a316aba', 'cec-historical:b16b88ab1772', 'bd2aa955-7c95-433b-8232-8b08598297a9', '22e009ca-2f6e-4619-a76d-d41b6c932634', '44a65a23-fbf1-4e9a-9452-d30072e22158', 'cec-historical-candidate-db96149164577bf0', FALSE, '無黨籍', '1', 33026, 12.56, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|宜蘭縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'f4f2b11f-e4a6-4f2e-bf9b-64def50cefd6', 'cec-historical:aaa19221682e', 'd5286dc2-74e5-49f5-8c95-678e197c5181', '8bed0207-1b1c-45df-931e-cdd41f6a1206', '011acb7a-5303-4e79-bd4a-7d573c082d00', 'cec-historical-candidate-75ffeca1776afe82', FALSE, '民主進步黨', '2', 114738, 44.63, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺中市|district-5|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'f6adba35-09a4-43db-8602-e23962788f93', 'cec-historical:34f69b6e1147', '63351f22-5061-4003-8194-74c65fde6257', 'f31a41c5-6b58-44eb-a9a8-9bec00ccf8c8', '3525f1be-bbea-4b70-8bb6-7480e4b9937b', 'cec-historical-candidate-765898dd10b13f15', FALSE, '無黨籍', '1', 6070, 2.91, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|雲林縣|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'fa44bb0d-6332-401b-ab6f-7a3b503c21c5', 'cec-historical:03047d460da2', '4d9c2a64-7c6f-4d70-a142-a4a639abab50', '9b219337-c6fb-4dbf-a98f-2206de1918b1', '5b9045c7-e119-451b-9749-8c0224550df7', 'cec-historical-candidate-2c2bc808c9875eab', FALSE, '民主進步黨', '3', 114998, 51.1, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|高雄市|district-7|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'fa797e7f-06eb-4eb8-b33d-aaa8503d4351', 'cec-historical:a8018c33ea03', 'd51392ec-ab3e-499b-b702-b157a2c3ee87', '291eba68-a08d-4588-b8e2-fcb78824d33b', '465f12f0-34d1-42e3-a553-67fae5b4ad6c', 'cec-historical-candidate-46acacc3ab29fe89', FALSE, '民主進步黨', '2', 113128, 55.91, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺中市|district-6|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'fd06348d-af62-4697-afc4-24519f587d03', 'cec-historical:a2016146227e', 'bf7f86e3-eb1b-4670-b7de-c8567c64b0ae', '9b219337-c6fb-4dbf-a98f-2206de1918b1', 'bf574b62-62f8-4250-93f7-66d196fdd965', 'cec-historical-candidate-0599c6168f32137a', FALSE, '中國國民黨', '1', 86127, 38.27, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|高雄市|district-7|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ff1d4ac1-0f7f-478e-a292-e93dd1886af2', 'cec-historical:a5b2d1d008f7', '5c4b7b14-a7ae-4c31-9b63-5746bd81d942', 'e49eba9b-aa21-40e4-9686-92a8110f7f93', '8c5db105-fd1b-4b97-ae1c-f0f17e09346e', 'cec-historical-candidate-c55901871a0ca4b5', FALSE, '中國國民黨', '3', 85082, 46.28, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|臺北市|district-7|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ff8e1932-ed2d-413c-a63f-8b97a48de102', 'cec-historical:4733d0df2fc3', '54709b82-1761-4aa8-aec2-6a1eb704aef2', 'fc45fc08-d9b5-4706-b8c3-81e4b289eb30', '077b5702-2342-4fbe-b33d-31e377ac81ae', 'cec-historical-candidate-2c8b5bbd5da6be16', FALSE, '綠黨', '3', 7142, 4.81, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新竹縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ffebfc2e-8412-4a57-8790-b3535bb152d9', 'cec-historical:cfdf463de579', 'b2901f14-186c-4b43-91b4-ad0f6fb3b6d1', 'd1a1472d-317f-448e-be7e-21e8bb047a6b', 'd2d26f85-c2fe-4cdb-93e1-e73f6097423a', 'cec-historical-candidate-5343595ede80fe81', FALSE, '無黨籍', '4', 2783, 1.38, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|桃園市|district-5|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE);

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
    IF (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730) <> 149
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'create') <> 0
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'update') <> 149 THEN
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
    ) <> 149 THEN
        RAISE EXCEPTION 'Historical CEC migration updated candidate result mismatch';
    END IF;
    IF (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE vote_count IS NOT NULL) <> 149
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE vote_rate IS NOT NULL) <> 149
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE is_elected) <> 68
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'update' AND original_is_public) <> 0 THEN
        RAISE EXCEPTION 'Historical CEC migration candidate summary mismatch';
    END IF;
END
$verify$;

SELECT
    0 AS planned_creates,
    149 AS planned_updates,
    149 AS planned_total,
    0 AS publication_states_preserved;

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
