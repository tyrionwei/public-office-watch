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
    ('update', '02ceac0c-c1f9-4c2c-833a-39c6ccb1d57b', 'cec-historical:14ad1ebeb903', '18010f98-53ae-4fcf-afd5-3a76015c161c', 'b86df453-0185-44f9-adc3-5c6e3a7feda5', 'ee602e05-c56e-43e1-bb9c-0f3fa9e7afdf', 'cec-historical-candidate-e77090d86cc23253', FALSE, '中國國民黨', '1', 447, 18.3, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|屏東縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '0341aa51-fb19-4173-ab3f-b3e28c475f4e', 'cec-historical:8472f930f100', '5ddf21c3-0166-8fa4-87f5-1ec76b87ba15', '23460b52-11ab-4177-8f1f-26507cd329df', '5c01bc1b-027a-49a4-89dd-d4a1a426d623', 'cec-historical-candidate-a8f3e58aa7e4941d', FALSE, '無黨籍', '5', 1853, 21.92, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '0b036232-d34b-46e1-b8ff-ec28f91a6728', 'cec-historical:82e18a4ae72e', '8a223cdf-9dba-44dd-86f2-610c35b13417', '4c69de41-ac9f-4015-9a27-fa934acd6932', 'ed6d3c91-ef73-4391-9d27-af474e011d57', 'cec-historical-candidate-d0231f97bbc8d1d1', FALSE, '中國國民黨', '4', 2757, 32.62, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '0c1eb66f-e347-4ea6-93c3-0fb257959f71', 'cec-historical:dc1d5d32df28', 'a9a8aaa9-6d44-449e-aad6-e340dbfadd84', '138216e9-f0c3-4d14-a735-f41b34830caf', '8eb91e4b-3876-499e-bbf2-d57655c741ca', 'cec-2018-local-councilor-candidate-plain-indigenous-10015-05-23555', TRUE, '中國國民黨', '6', 497, 4.86, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '0d20d6aa-8c84-4711-a37d-b856b1017d2f', 'cec-historical:bdc6cdfd8d15', '29d23c3b-93c6-4596-b946-b92281acc8bb', '7e463627-c434-409e-a388-e626b13c9c95', '58f3f055-b4e4-4bb5-9040-c87c77178b13', 'cec-historical-candidate-0cfacd782673a5b0', FALSE, '中國國民黨', '1', 1165, 52.5, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|屏東縣|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '18663df1-d719-44b2-a609-d1e9542c3dbf', 'cec-historical:daa677f4fbcd', 'd95a40b1-6fdd-4475-89b1-c18b8614e0d9', '4c504280-2a83-4461-a9a2-fcdeaef39642', '79128983-7912-4098-8e32-36bb59a342c3', 'cec-2018-local-councilor-candidate-mountain-indigenous-10013-13-23588', TRUE, '無黨籍', '2', 822, 33.66, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|屏東縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '19048513-b19b-4c13-9d94-36cf66a2789d', 'cec-historical:055f26de3dad', '49605609-8a3c-4f43-ab08-907d029a15a5', 'c800fcfb-a4d6-41d8-8fc6-f4983d024d24', 'af6829e8-2908-467d-9f0b-85bcc129c9b5', 'cec-2018-local-councilor-candidate-mountain-indigenous-10014-12-23621', TRUE, '中國國民黨', '3', 564, 30.73, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|臺東縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '1a2fddb0-c294-4447-8f64-a6698801abb5', 'cec-historical:bf6a07d678c8', 'a4b92da0-aec9-487d-9171-7f24acdf800b', '044d059f-00a3-4d52-8fb6-bb62f9ea622a', 'c1a0db0e-2a16-4934-94dd-1c7578670e1c', 'cec-historical-candidate-a7f6d94461152b38', FALSE, '無黨籍', '4', 1125, 8.01, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|桃園市|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1bc4aefd-9e37-4073-a323-ad44460d9c60', 'cec-historical:fbe26531ab5c', '65927809-6aec-46fb-ae06-f8d963dc3504', '4d082c95-09c9-491d-a80b-5be9af5838a8', 'd7ff01c7-a07c-4d56-b484-2bd6e48b289c', 'cec-historical-candidate-ca9f60e0be5e8f8c', FALSE, '無黨籍', '2', 1795, 50.28, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|花蓮縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1bee267e-f332-4cbe-a6fd-c870eba848f1', 'cec-historical:bea67498a1da', 'b2c2ae5e-754f-49da-b5a6-37ebc7436447', 'f23f2057-dbe9-46d7-a5d6-ecbb635380e2', '331bb026-abb3-4268-b2cd-7f39a5c509a8', 'cec-2018-local-councilor-candidate-plain-indigenous-10014-10-23524', TRUE, '中國國民黨', '1', 1251, 14.8, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-10|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1cdf13da-5b92-4456-82c4-9bd90a802ed9', 'cec-historical:fd9c4cde7cae', '0a915edb-81bd-44c2-84d4-02c9f01fafb4', 'e7bffb88-fc7d-4476-88fc-3b6409a49107', 'e7e28e66-bf5f-4c77-941a-cc9d1a630fa6', 'cec-historical-candidate-79b92c9a7ef32175', FALSE, '中國國民黨', '2', 1415, 16.04, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|南投縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '1f086543-df55-4bc4-a56e-e2d81e5af4d0', 'cec-historical:1e615008afec', 'bbbd4229-d349-47c4-b5fa-4d6bf61df8a4', '836c576f-330d-4997-84ec-0f66d83f997c', '9520ae2c-c936-48bc-b9c7-c3b75f7b30d9', 'cec-historical-candidate-c8d0e20eaa72f69e', FALSE, '無黨籍', '3', 190, 3.07, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '273826c9-452f-4989-8b8b-b7ce4f5b320a', 'cec-historical:a27b1af753e6', 'c166063b-f46a-4977-a6ee-1e2ef0a0a5d2', '138216e9-f0c3-4d14-a735-f41b34830caf', '67780b10-4692-4eb7-bed4-68daab491df5', 'cec-historical-candidate-286ff83925879c30', FALSE, '中國國民黨', '4', 1540, 24.95, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '27eb6d20-5218-466f-9c4b-32d4ebcdd4a1', 'cec-historical:2903cbdd200e', '12feb205-6c35-4241-9bd0-dfc9eb8e4224', 'f9304ebd-c9c8-4263-8bc5-81b9b64d9c50', 'f6ada795-08d5-4efd-b443-61fc0775f367', 'cec-2018-local-councilor-candidate-mountain-indigenous-10013-14-23592', TRUE, '中國國民黨', '4', 609, 24.93, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|屏東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2908b213-b3b4-4e72-9d2e-70235d7bafb0', 'cec-historical:032a4fecf700', '14955918-e5cc-4b2e-9c9e-991a4bedfd71', 'beecc859-e762-4faf-b73e-043cf9f6542a', '63b07bf6-172e-4d70-8580-a24ecab005c9', 'cec-historical-candidate-fac46a86e88a8421', FALSE, '中國國民黨', '4', 441, 24.03, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-16|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '29bf379c-d55d-4b08-a363-0641ce987039', 'cec-historical:ecc16002e3d6', 'cc6ae798-affb-4934-9cc5-eecb33fb39b7', '7050d3e3-bf0d-4489-a818-f870f49a1516', '820965b2-942b-43e2-8140-623c3049d69c', 'cec-historical-candidate-59e2b83247f25ec2', FALSE, '無黨籍', '1', 635, 47.1, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|臺南市|district-12|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2a6d5881-ba19-4bf0-b107-4fa5bf3c44d3', 'cec-historical:1dbe7eeb4f8d', '6fc30c41-d91f-4547-9940-fbf6461eafb3', '8d970dbf-7baa-4c3a-b6f0-6cc830e054d4', '23693386-ca6d-454f-af8c-083f5911bc92', 'cec-2018-local-councilor-candidate-mountain-indigenous-10014-15-23626', TRUE, '無黨籍', '1', 339, 18.47, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2db47cff-4256-4adc-9ee5-e1240e4a3233', 'cec-historical:10c7d472bda4', '75eae506-a75f-4bda-8aca-35568dbacd86', '83f2f377-757f-447a-b8b0-d730349dd347', '0bec7260-8665-4fab-a1bd-b1dd413bbd2c', 'cec-historical-candidate-7a654159c781afe1', FALSE, '無黨籍', '5', 1106, 8.72, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|桃園市|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '302c9c57-d6d4-4483-895f-ec449004b3cd', 'cec-historical:4297700ea294', '1b18f28d-e81f-47e2-b88c-498b0fa06996', '6239fda3-c90c-4173-a63f-bc2092b23e56', 'fc286af5-9a65-4748-907b-a43bf7ea018a', 'cec-historical-candidate-42454a8ef5afa29b', FALSE, '中國國民黨', '5', 5054, 37.07, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '30abf52c-48cd-47cd-a9f3-1ad2e879c9b7', 'cec-historical:3161449446e8', '4411c235-0ef7-9be3-7e7f-1e964a85edda', '86c1e48f-f4a2-4fd8-9175-088733a33e17', '3fcae2bd-0997-4698-8909-578831d5a07a', 'cec-historical-candidate-9ffe3533098e03be', FALSE, '中國國民黨', '2', 491, 26.75, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '30cd3df1-011e-47af-abd2-72521f89734c', 'cec-historical:45da41a2e1cb', '147c1321-53d1-4dd3-89de-7823697c7098', '6239fda3-c90c-4173-a63f-bc2092b23e56', 'a1fb18ae-624a-47e5-8c3d-f97865bbbc46', 'cec-historical-candidate-2e66fde82593f486', FALSE, '民主進步黨', '2', 1314, 9.63, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '31cdca8d-a2eb-4b2b-a2ab-76b9e6dd7d01', 'cec-historical:b0c5b725e40d', 'a63fdd15-dc3d-4f92-ab70-8f58d1a20b5e', 'a6503446-c501-4ad9-9752-dfe62c694e51', 'e91e03e7-ade0-4836-93cf-6436f2bcf13e', 'cec-historical-candidate-92213fe58f3774d8', FALSE, '無黨籍', '1', 1703, 43.17, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|臺中市|district-17|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '32a7ce99-cbf7-42ad-ac77-21a158a25a56', 'cec-historical:83adf72c5539', 'a5d7463c-9b77-4bef-9d4a-da989dd1f6e1', '138216e9-f0c3-4d14-a735-f41b34830caf', 'd9dfcf70-1f0c-4c8d-ac85-201642d34c85', 'cec-historical-candidate-03cd657f926e1862', FALSE, '中國國民黨', '3', 190, 3.07, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '38f46177-f993-4e59-893d-832c7b5018d2', 'cec-historical:86512305464d', 'c6d669bc-302b-0b88-14d3-bf2651ebbcb7', 'b6c7a64b-401a-425a-9f31-6c8efdb006bd', '44b9f822-4938-4ab6-b0dd-d67f988e2cbf', 'cec-historical-candidate-cd13d4672b55a63e', FALSE, '中國國民黨', '1', 1944, 50.42, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|苗栗縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3947564e-544a-4d5a-a8c8-ea103bb852f6', 'cec-historical:601c34fb9d91', 'be12bfa5-9100-41d7-a91a-073d41e54343', '138216e9-f0c3-4d14-a735-f41b34830caf', 'f773e1f1-91c3-4c63-957d-5a4587945010', 'cec-2018-local-councilor-candidate-plain-indigenous-10015-05-23552', TRUE, '無黨籍', '5', 1628, 26.37, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '3bb19b6c-d2d3-47a4-a910-b4b0f2199a9c', 'cec-historical:3a3ff72bad35', '63e61871-6ac4-4fda-bf4f-2bee9962c526', '6defc346-0bed-415e-9cd0-309337da2059', '561f66b1-8c4c-4d8d-9d13-77148f68b086', 'cec-historical-candidate-f6f7b6e7a1eb5e81', FALSE, '無黨籍', '2', 1500, 39, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|新竹縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '3d73dd2d-edef-4c90-8890-304b4c5162e7', 'cec-historical:8d503fd6c73a', 'bcc86886-5070-456b-b8a5-c9cc4e5e98b7', '0eae78f3-06fd-47f9-8659-b5ae54dd9f5b', '577c59f1-d5df-4799-88c3-91848ca6434f', 'cec-2018-local-councilor-candidate-mountain-indigenous-10013-12-23586', TRUE, '無黨籍', '1', 447, 18.3, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|屏東縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '43d13775-4524-483a-b376-e7638ed93b93', 'cec-historical:0500af8e7d0e', '05cea7c9-b430-4d3c-8d9f-a88725a2073c', '8d970dbf-7baa-4c3a-b6f0-6cc830e054d4', '256945a1-7c75-45a4-837d-df10607c057a', 'cec-historical-candidate-6f6430a543b3b3f6', FALSE, '中國國民黨', '2', 491, 26.75, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '44a4118e-63b7-4a86-85ff-d433039b8efc', 'cec-historical:ac451ed1359c', 'c568f82c-1dac-4875-97b1-a1cbac13a949', '96602929-e465-4414-a8c0-e506871a9b41', '24057043-52ee-40f8-9845-1c96da990b50', 'cec-2018-local-councilor-candidate-mountain-indigenous-10015-08-23610', TRUE, '無黨籍', '1', 1775, 49.71, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|花蓮縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '458c73a1-dd3c-48b4-9490-6c12b8cdc536', 'cec-historical:0d5004dfcb62', '69dcf51d-3ccc-b9e6-614d-51fda0a41bc6', '46864032-390e-417f-a352-47d0739b64e4', '7f8e2559-f6c6-4561-873b-10182f9c7f0b', 'cec-historical-candidate-b96ab699c3837516', FALSE, '民主進步黨', '2', 1175, 18.29, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|新北市|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '45b0d5d9-fc41-479c-9dbd-7afde5e1dd15', 'cec-historical:fe71ebcb73ca', '0bb7b43d-bbe3-47d0-b9e2-695238ea24db', '438005de-74d9-4ee7-9fbc-23cdc41fdbbb', '9dc615c0-3be0-49b3-8bd5-6a9d5f429b1e', 'cec-historical-candidate-d85d460d6f59f253', FALSE, '中國國民黨', '2', 1500, 39, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|新竹縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4b6a3bcb-1992-4aae-99c3-a1839e6bbb9a', 'cec-historical:4425b0b2e62b', '9ab5856c-f4c8-4e35-be8d-f318e42c3a71', '138216e9-f0c3-4d14-a735-f41b34830caf', 'f2cbddfe-7d79-4703-8e97-6506800d2b78', 'cec-2018-local-councilor-candidate-plain-indigenous-10015-05-23543', TRUE, '無黨籍', '2', 1752, 28.38, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4d0324ac-03f1-4b2a-94e7-4154e8a77a5c', 'cec-historical:150bc08d62c6', '718dc798-d659-44a6-b794-1e1466a376bf', '303cd822-76aa-4bf5-8045-478bbcef746a', '62f5ae15-311d-4efe-a3b9-480f78e40252', 'cec-historical-candidate-23d2482add38ed1d', FALSE, '無黨籍', '2', 822, 33.66, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|屏東縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '53f7103b-25eb-46ea-b297-1f198e91b119', 'cec-historical:abf7ce366a8a', 'd327a74d-5d73-46b7-afe9-4c7c177aa08f', '94eb6de7-9919-4662-956d-039ce71da2df', 'af3ad513-8aea-4633-9c34-57b65e0065a2', 'cec-2018-local-councilor-candidate-mountain-indigenous-64000-14-20147', TRUE, '中國國民黨', '1', 2011, 49.85, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|高雄市|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '559c2c49-bf6f-434e-b3de-8d55e6c7cba8', 'cec-historical:b1db14a38c96', '21ad81d6-8756-4ef7-a950-7bf72e63c628', '4c69de41-ac9f-4015-9a27-fa934acd6932', 'e9673b07-133f-4398-b15b-ace58884e0bd', 'cec-historical-candidate-165d35a641c81535', FALSE, '無黨籍', '2', 360, 4.25, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '55c86140-c8cb-4830-8a47-bb7ccd25fcab', 'cec-historical:2f8cee0ab271', '14f8f20b-ca28-4ee7-ab75-327f5ec4bfc0', 'beecc859-e762-4faf-b73e-043cf9f6542a', '2a31a27a-f2eb-495f-8845-3fe44ed0a993', 'cec-historical-candidate-bbd567cf97ad80a9', FALSE, '親民黨', '3', 564, 30.73, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|臺東縣|district-16|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '58697321-c375-475b-b42c-d8646219b03e', 'cec-historical:27730c37107b', '12c35c7a-3ad4-4e0a-a70e-82d269d3fb8b', '044d059f-00a3-4d52-8fb6-bb62f9ea622a', '1f97d901-4d75-4077-842f-f76d355146a7', 'cec-historical-candidate-76cd3224afd200e1', FALSE, '中國國民黨', '1', 2676, 19.07, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|桃園市|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '5fc884dd-1980-4112-a0e5-bf1986627e19', 'cec-historical:aad0e3d604bf', '2a63da5f-a053-414c-b9d0-0a3af9ba4976', '044d059f-00a3-4d52-8fb6-bb62f9ea622a', '8bc6d491-0ae7-4e20-82be-1a0cb4b46a5b', 'cec-historical-candidate-6bba790d94509bcc', FALSE, '中國國民黨', '6', 2001, 14.26, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|桃園市|district-13|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '666c0697-c463-463c-9c16-5c5f893c2f87', 'cec-historical:af349e85d2a5', '17a04f10-f823-4b43-a4ad-6c81a58c55ea', 'c800fcfb-a4d6-41d8-8fc6-f4983d024d24', '615136da-305d-4b4d-aa60-e8647d83a81c', 'cec-historical-candidate-43d284a53fce43f4', FALSE, '無黨籍', '2', 491, 26.75, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '677fd141-8535-4e0f-a947-87e95533c5bd', 'cec-historical:6e1dcb1187ee', '1fb9e03c-ffe6-232e-db9c-733b8223d294', 'e24353fd-1565-4742-8ca4-fe5e5707a2a8', '657aa2b3-83ba-4459-a661-8ddb7624d46b', 'cec-historical-candidate-c99849b282d1cb18', FALSE, '無黨籍', '2', 1096, 64.62, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|臺南市|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6bdfbc06-9b7d-42e0-9f06-e1b37c2ffc79', 'cec-historical:308ffc98b936', '2c0af3a2-2686-4845-ad11-ba64d371ff35', '4c69de41-ac9f-4015-9a27-fa934acd6932', '76a56e48-13ad-43aa-b50f-cb5c48efb6fc', 'cec-2018-local-councilor-candidate-plain-indigenous-10014-07-23531', TRUE, '中國國民黨', '3', 2230, 26.38, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6dd229da-a49b-4473-a45a-8db7dc213b86', 'cec-historical:804c5b267af3', '7dd7e22b-6347-4cfc-bcd4-09608820e0c3', 'fc1cf052-9a63-47c9-8c60-4b15362c142e', '352c0c66-33dd-493e-aec7-f73a8d6382be', 'cec-2018-local-councilor-candidate-plain-indigenous-10014-08-23522', TRUE, '無黨籍', '1', 1251, 14.8, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '7677ae66-5dbb-4585-a889-73f9e4596b75', 'cec-historical:43bbe1c1285d', '6786b75d-7e58-4013-b63b-d916aaaf2b58', 'f23f2057-dbe9-46d7-a5d6-ecbb635380e2', 'd0cc5c52-6af2-47e9-a8ec-57eddee9655c', 'cec-historical-candidate-7e0aaae77851b8a2', FALSE, '中國國民黨', '2', 360, 4.25, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-10|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '76c194c0-d294-4e4e-8cc5-e9197c0a3677', 'cec-historical:975daa6cb06c', '6033dad8-2d58-af66-3ba2-3eb42bfe243b', 'c800fcfb-a4d6-41d8-8fc6-f4983d024d24', '846fe05f-232b-4985-92a4-6382e19d302a', 'cec-historical-candidate-186c5de095fa8060', FALSE, '信心希望聯盟', '1', 339, 18.47, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '7947ba42-8d89-4ef9-938d-55dcbdc0b1ab', 'cec-historical:563cea51c436', '0c501325-8f45-4962-9b10-3e84ddbabc09', '88d36857-7087-4d1c-ae74-cdad30dbade8', '16339fce-62a7-4190-94bb-f46f07abba41', 'cec-historical-candidate-3a28c3a8c2370322', FALSE, '無黨籍', '2', 2175, 70.18, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|基隆市|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '82118f8a-d87c-4431-951b-921549c27113', 'cec-historical:cf45961665a7', '3c985571-4dc5-491c-8225-6205e1918569', 'f9c7129a-1432-4cc2-9d94-ceb167cab38f', '04e7e0a0-e156-4946-9475-bbf7d4b7d34f', 'cec-historical-candidate-1f086f39a49fd73f', FALSE, '無黨籍', '2', 1752, 28.38, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|花蓮縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '832be3d6-4bc8-4ddd-b19d-a443aa7746c0', 'cec-historical:6190ca642fc7', '11ef229a-c303-456f-83b8-df4fd1fb8b4e', '138216e9-f0c3-4d14-a735-f41b34830caf', 'd55a3d22-ecc6-48a9-9673-211614902f7a', 'cec-2018-local-councilor-candidate-plain-indigenous-10015-05-23557', TRUE, '中國國民黨', '7', 275, 2.69, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '87c25723-bac8-44c4-91e0-24346e533c96', 'cec-historical:def53a235626', '5d2049fd-86e3-4210-bb24-a668683d5c64', '51668f90-5374-41b0-ab26-7ba0ded737a8', '2221a1d9-f78c-40da-a6d4-56e31f835c75', 'cec-2018-local-councilor-candidate-mountain-indigenous-10015-09-23614', TRUE, '無黨籍', '2', 1795, 50.28, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|花蓮縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '881af7e0-1a25-465c-88e4-309ae93789ec', 'cec-historical:8b221db37e6e', '2e543105-281c-6634-4a6e-f2a69ccf5a64', '836c576f-330d-4997-84ec-0f66d83f997c', 'c6cec997-5cc8-491f-a4a1-3010ad9a717a', 'cec-historical-candidate-1367eb24e1ffbab7', FALSE, '無黨籍', '5', 1628, 26.37, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '89136b64-6c00-424f-bd0b-9ac5258c0917', 'cec-historical:a47d93ead91b', '3bb88ed8-5a36-4681-adf2-056cff84eea9', 'f9304ebd-c9c8-4263-8bc5-81b9b64d9c50', '5d9839a0-a8d9-4173-ac11-2534e25f9271', 'cec-historical-candidate-f7af84c0c0d0de86', FALSE, '無黨籍', '2', 822, 33.66, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|屏東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8c31fdc7-0376-4dce-82d5-ddaf27b22c2c', 'cec-historical:7d4d574a416c', '82f069a2-fdd3-470f-a032-e85be3324efc', '836c576f-330d-4997-84ec-0f66d83f997c', 'eaf22834-25cb-4970-8adb-e5904cc912e2', 'cec-2018-local-councilor-candidate-plain-indigenous-10015-06-23544', TRUE, '民主進步黨', '2', 1752, 28.38, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '8e95cd49-63be-4437-a4d9-afec97f4aa9e', 'cec-historical:fbae4fcb85c4', '6c60e008-6459-af01-a8dd-c04333ae4108', 'ccaaa269-6de2-4060-95d4-385250402e06', '3b75598a-9748-454a-99f8-bd61829b76ba', 'cec-historical-candidate-81f1b2de7cda4dfd', FALSE, '無黨籍', '1', 2011, 49.85, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|高雄市|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '8f87e125-390c-4f3f-8ef3-b40fadb37d84', 'cec-historical:0ce31338545d', '55f137c3-cac7-4d7c-b300-32060511e8b9', '4622c98f-3995-43a5-8ac0-1becec068837', 'c6c03a1c-7ff5-4acc-abb5-90d30d295bd6', 'cec-historical-candidate-9645bf34d378e656', FALSE, '無黨籍', '1', 917, 46.14, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|苗栗縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '918ad2ce-a9ac-4741-b245-867f95fc97b5', 'cec-historical:eae375653c62', 'e3b50848-5bdc-457a-9206-b61302d2bb04', '303cd822-76aa-4bf5-8045-478bbcef746a', 'e5a803a0-b19f-4592-9122-349f6cd6acae', 'cec-2018-local-councilor-candidate-mountain-indigenous-10013-11-23584', TRUE, '中國國民黨', '1', 447, 18.3, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|屏東縣|district-11|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '929409da-53fd-4835-a81e-d5fb28e845ee', 'cec-historical:1915d5251461', '3e891f6f-ac02-435a-84e5-cf07cb898e8b', 'f9304ebd-c9c8-4263-8bc5-81b9b64d9c50', '9a5d7c36-9951-4f9c-8abf-1ad1da7858f8', 'cec-2018-local-councilor-candidate-mountain-indigenous-10013-14-23593', TRUE, '無黨籍', '5', 1050, 28.54, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|屏東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '935197c2-a55b-4d24-b17a-cc1b35a32fd6', 'cec-historical:d898755be15d', '51f55f1b-bac8-4838-b75e-5c8572b91cce', '740cc2a5-befe-4f86-b84d-7d1770391844', 'f5caf840-00f8-4d0d-9aef-e4c86019708d', 'cec-2018-local-councilor-candidate-mountain-indigenous-64000-13-20146', TRUE, '無黨籍', '1', 2011, 49.85, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|高雄市|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '93ae08cf-3d3f-4fb8-9982-54f4c8cbf450', 'cec-historical:26760f317c0d', '38e862a1-187d-4f88-bf68-943253f113d7', 'e7bffb88-fc7d-4476-88fc-3b6409a49107', 'b07d9f6c-760e-4cc1-a1fb-43b3ccc2c584', 'cec-2018-local-councilor-candidate-mountain-indigenous-10008-07-23574', TRUE, '中國國民黨', '3', 4729, 53.61, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|南投縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '974a4687-5426-4f4d-bf48-9ab27d03a6c4', 'cec-historical:95e5bae9ef3e', '301ba6ee-7d59-435f-8e3b-d9ad102f0c52', 'cc378097-6a06-4440-949a-1ca3e2e6d496', '8e5d16c7-825b-466c-88ce-a599aa01e127', 'cec-2018-local-councilor-candidate-mountain-indigenous-10013-09-23581', TRUE, '中國國民黨', '2', 822, 33.66, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|屏東縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '9b75e330-026a-48bf-a463-1d44d0b7f6ce', 'cec-historical:213eddabe371', 'dfb759f6-0fd2-4f62-ae09-3d539acfd121', '6a7611ef-cda7-4d61-8754-ca50ba031ec5', 'b238c746-0cbc-4998-88dd-266bc4495b03', 'cec-2018-local-councilor-candidate-plain-indigenous-10014-09-23523', TRUE, '無黨籍', '1', 1251, 14.8, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '9c5b4230-27c6-4ced-b591-a69f9e3c2977', 'cec-historical:10084815cc51', '29749889-f47e-4450-92bd-374878657736', '83f2f377-757f-447a-b8b0-d730349dd347', '97b339f6-d7a3-4637-9e7d-98368da0c5c5', 'cec-historical-candidate-4c48e633294323ce', FALSE, '中國國民黨', '4', 2733, 21.56, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|桃園市|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '9caaa795-bd2f-49fe-b1c2-3877431a2e24', 'cec-historical:c70a46bd14ee', 'ae724e2b-d448-41e3-994c-d3054bef9033', '6a7611ef-cda7-4d61-8754-ca50ba031ec5', 'fd619c59-215f-43b6-a764-b7900f209836', 'cec-2018-local-councilor-candidate-plain-indigenous-10014-09-23528', TRUE, '中國國民黨', '2', 360, 4.25, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-9|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', '9f8bdd12-70cf-452a-8a7f-bc7d014895e6', 'cec-historical:296fd868b7bf', '2dd3879e-9068-4594-944c-79863f65b493', 'cc378097-6a06-4440-949a-1ca3e2e6d496', '0a148616-af9a-4467-9b12-243fb1d1bc85', 'cec-2018-local-councilor-candidate-mountain-indigenous-10013-09-23580', TRUE, '無黨籍', '1', 447, 18.3, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|屏東縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'a0903473-feca-4f12-a6a0-4e4440a791dd', 'cec-historical:0e3a4c443348', 'cdcb4896-7c24-4df7-9128-85ae88c05ddf', 'ae618ea1-e0fa-4e22-b946-283f7bf3e7ed', '94bb6bfa-58f2-4fa3-beb0-09ae5f24aa7e', 'cec-historical-candidate-70efd86059207f48', FALSE, '無黨籍', '2', 822, 33.66, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|屏東縣|district-16|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a3a1f8a3-1629-4cea-a564-495c6a0cf257', 'cec-historical:d417c269b874', '5c49d6cd-934b-45a6-ad25-cd125f529904', '86c1e48f-f4a2-4fd8-9175-088733a33e17', 'ba683663-b2f2-462c-b41a-d4737387dcd1', 'cec-2018-local-councilor-candidate-mountain-indigenous-10014-14-23624', TRUE, '無黨籍', '1', 339, 18.47, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a66e1af7-1072-4c88-be71-a3d45b1893ab', 'cec-historical:db09e57be255', '592902d4-f3c7-4670-adec-c9e1163c0f6c', 'f9304ebd-c9c8-4263-8bc5-81b9b64d9c50', '2a5d36ba-3f95-473e-962e-f04585630ab2', 'cec-2018-local-councilor-candidate-mountain-indigenous-10013-14-23589', TRUE, '中國國民黨', '1', 447, 18.3, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|屏東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a7d72a9a-2bcf-4c5f-835d-5f33d6ab3ebb', 'cec-historical:92847df10726', '85f8d3cf-f36c-421b-95ed-ca3687130cd6', 'beecc859-e762-4faf-b73e-043cf9f6542a', '3211124d-bd2b-43bc-8ac4-c1457b25072b', 'cec-historical-candidate-ee97c990b36f9fb7', FALSE, '無黨籍', '2', 491, 26.75, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-16|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a806ad35-4b42-40db-a082-b26808632efd', 'cec-historical:e389062e305e', '32cc5c94-6a18-4068-9887-296af0f67d50', 'db9aac67-edb2-4a0f-b998-ebb84d8570e1', '6ef332b3-39ba-48e5-a548-7062f9146386', 'cec-2018-local-councilor-candidate-mountain-indigenous-66000-16-20157', TRUE, '無黨籍', '1', 1703, 43.17, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|臺中市|district-16|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'ab7bdba0-c160-4619-b6e0-22774656129c', 'cec-historical:41f87c49767e', '101226de-3b7d-414f-8b91-c93f84309ac6', 'f9304ebd-c9c8-4263-8bc5-81b9b64d9c50', '04e7f5bd-1ae5-4548-8951-4d15e2ca4f69', 'cec-2018-local-councilor-candidate-mountain-indigenous-10013-14-23591', TRUE, '無黨籍', '3', 564, 23.09, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|屏東縣|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b2b29757-2486-45ef-8194-8c7648e42039', 'cec-historical:971b9de2d56b', 'd6ab301d-479c-4b7d-8ba9-ee0735e36d8f', '438005de-74d9-4ee7-9fbc-23cdc41fdbbb', '1acb52f9-2b55-4d53-bda3-b74345b2eedc', 'cec-2018-local-councilor-candidate-mountain-indigenous-10004-12-23564', TRUE, '無黨籍', '1', 929, 24.15, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|新竹縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b4a97dca-9c4e-46be-8103-97be48bf6b0f', 'cec-historical:f5def08c1f3b', '095721dc-e64b-4792-9dd1-e5f550d4dfe1', '6b3bae7d-48c1-4f70-b68f-e77c5e9c6a21', '213d5dc5-cd98-4a89-9927-4a2ab859a042', 'cec-2018-local-councilor-candidate-mountain-indigenous-10014-13-23623', TRUE, '中國國民黨', '2', 491, 26.75, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'b55682f2-b42c-4fc6-8109-7c70bfa14a99', 'cec-historical:fd3047aff8d9', '46f2c4fd-a924-4f82-9f66-88a892b45b52', 'db9aac67-edb2-4a0f-b998-ebb84d8570e1', '7447a81c-35c5-4a97-ad7e-be8ca1f23b53', 'cec-historical-candidate-b1b785bf62678fa7', FALSE, '中國國民黨', '2', 898, 22.76, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺中市|district-16|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'b7e44c25-ad06-4990-a3d0-160d123c8404', 'cec-historical:160f1eea4687', '10ebd6a9-192a-4982-8ff6-bd007c59d99c', '96602929-e465-4414-a8c0-e506871a9b41', '51aef990-1145-461c-88c7-a7d0893c7a88', 'cec-2018-local-councilor-candidate-mountain-indigenous-10015-08-23611', TRUE, '無黨籍', '2', 1795, 50.28, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|花蓮縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'baadabf9-2f76-45df-9af0-c086c614cf68', 'cec-historical:debef71d1e90', '3958009f-dd9d-4404-b7ad-99101495bb40', 'fc1cf052-9a63-47c9-8c60-4b15362c142e', '9a37a412-dbb3-4aaf-817e-defa30a67f73', 'cec-2018-local-councilor-candidate-plain-indigenous-10014-08-23532', TRUE, '親民黨', '3', 2230, 26.38, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|臺東縣|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'bcb07b2d-c67f-4b5b-acd8-f53f13804ef4', 'cec-historical:857a0ba161ad', '485d1fd4-5828-42d8-93dc-e1f53eec6336', '1fcd13dd-6604-44bc-8ffe-fd443e4cc4fb', '3f7547aa-4d7e-4a06-ab97-4a90f4db0b46', 'cec-2018-local-councilor-candidate-mountain-indigenous-10013-15-23596', TRUE, '無黨籍', '2', 822, 33.66, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|屏東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'c3bde8f4-ced1-4dc8-ac17-b058f41691db', 'cec-historical:92dd0de3e899', '8c2f9b50-b181-4b81-929e-7a9bce515863', '7050d3e3-bf0d-4489-a818-f870f49a1516', 'cf6cf381-75f8-490d-aade-6f2279495f45', 'cec-historical-candidate-e16d588776298943', FALSE, '民主進步黨', '3', 373, 27.67, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺南市|district-12|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'c8ffceaf-0419-47d2-a225-018f400226ea', 'cec-historical:b5fdb438625d', '45392de5-cabf-4444-8b1c-28a82f7a3db3', '46864032-390e-417f-a352-47d0739b64e4', '1f849fa6-daa1-4bbb-88f9-64ecc9ab0490', 'cec-historical-candidate-b201e304307980e2', FALSE, '無黨籍', '1', 2732, 42.52, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|新北市|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'cb2e9989-f73d-4d65-8d7b-405ef0631f98', 'cec-historical:0fe712385875', '9d0d4947-ee92-41a0-b8ba-299b9be7a27f', 'fc1cf052-9a63-47c9-8c60-4b15362c142e', '3e24d452-7723-4127-8f1b-582c4de0e3ca', 'cec-2018-local-councilor-candidate-plain-indigenous-10014-08-23527', TRUE, '中國國民黨', '2', 360, 4.25, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-8|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'cc10f4d0-1eeb-472a-af0e-e3e561539823', 'cec-historical:c1571810dea0', '958a3993-860a-9e04-4204-abec67d46462', '6239fda3-c90c-4173-a63f-bc2092b23e56', 'f2b7ce01-b006-4fac-b886-90ba764822b5', 'cec-historical-candidate-1cba45e607446c70', FALSE, '中國國民黨', '1', 4618, 33.87, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|新北市|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'cc44d9c0-916f-47f4-8b48-39e3574e1245', 'cec-historical:fe3c60e5d1d3', '31f72f99-d0c3-ad38-7882-fcdff1cf9dba', 'fd5b0aa6-ca0b-4f9c-9d6e-9fe614ec5891', '4263e7bc-b820-41d5-889a-7b2658a9a91d', 'cec-historical-candidate-85046bb702636104', FALSE, '中國國民黨', '2', 835, 81.78, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|新竹縣|district-11|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'cf3774f1-c177-4199-bd3d-f49f843655d1', 'cec-historical:8df099bc91cd', 'd78a7da6-179e-4ae1-b122-5fc0ff9c1482', 'b86df453-0185-44f9-adc3-5c6e3a7feda5', '5b998491-83f8-4cd7-9533-abb084bfc58f', 'cec-2018-local-councilor-candidate-mountain-indigenous-10013-10-23583', TRUE, '中國國民黨', '2', 822, 33.66, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|屏東縣|district-10|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd06f2d7f-e6c2-461e-9ebf-7049c245647b', 'cec-historical:58f01245cb8b', '59094c33-316e-4686-8bd7-781889f99294', '4c504280-2a83-4461-a9a2-fcdeaef39642', '85e302c5-ad8d-4ae8-b5a2-8dd6485e1cad', 'cec-2018-local-councilor-candidate-mountain-indigenous-10013-13-23587', TRUE, '中國國民黨', '1', 447, 18.3, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|屏東縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd0b23cb1-c1e1-4dab-b750-1edc7d9dd3de', 'cec-historical:a3a40744c87a', '1f332863-a14a-4dcc-9cc6-67aacab2b39a', '9b4340a8-4b0f-4f30-a1ea-72f8bb821133', '0e039195-1c02-4c17-9c54-b3c460ff8682', 'cec-historical-candidate-9f68ad48441a3d07', FALSE, '中國國民黨', '1', 3598, 100, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|臺北市|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd16b86ff-9251-475d-be4e-92bcccd3eefc', 'cec-historical:c4e67f4af994', 'f0b9171e-a12c-4c5d-b063-ae4578fb8caf', 'e7bffb88-fc7d-4476-88fc-3b6409a49107', 'dc3c5258-3a56-48ae-af8d-4fdf9b4a7f68', 'cec-historical-candidate-ae3ff8d1ebccd9aa', FALSE, '無黨籍', '1', 2677, 30.34, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|南投縣|district-7|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd66e7257-9a4b-4a82-acde-ebdb3f206048', 'cec-historical:df784dce18e1', '935828b7-5629-414c-954b-3d62d9ea7ae9', '4c69de41-ac9f-4015-9a27-fa934acd6932', '1137d2a6-7ce2-49bd-b037-1371b4624795', 'cec-2018-local-councilor-candidate-plain-indigenous-10014-07-23521', TRUE, '無黨籍', '1', 1251, 14.8, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd6fe1939-ee3a-4b12-a6aa-7ba0cf26ce55', 'cec-historical:fdbfada3af22', 'a48123b0-3123-433f-ae97-99c216d5e603', '4c69de41-ac9f-4015-9a27-fa934acd6932', 'f9692d8e-93cc-4ab7-a2d8-2d5d24e1f449', 'cec-historical-candidate-591a24a10a57a7b0', FALSE, '無黨籍', '5', 1853, 21.92, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd906ad5a-a218-4761-a5da-e18f04914e43', 'cec-historical:745e1bcc5fc7', '39d168c5-4e98-42e0-a8ca-0a8ceb12a1af', '51668f90-5374-41b0-ab26-7ba0ded737a8', '5b38add3-e01f-416f-be1f-809e54f4429e', 'cec-2018-local-councilor-candidate-mountain-indigenous-10015-09-23613', TRUE, '中國國民黨', '1', 1775, 49.71, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|花蓮縣|district-9|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e2e879cf-315b-4c98-8ca0-57b14db1cc59', 'cec-historical:23699046e40a', 'de85dd83-04ed-4431-9781-4661306f3a6a', '1fcd13dd-6604-44bc-8ffe-fd443e4cc4fb', '47810642-a79c-4ca5-8994-50b9927bbe23', 'cec-2018-local-councilor-candidate-mountain-indigenous-10013-15-23598', TRUE, '中國國民黨', '4', 609, 24.93, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|屏東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e37ab973-54dd-48be-ace7-1511d049e6e5', 'cec-historical:7bab92ddeb35', '7e568476-c3b5-8b42-b8c0-84381c95eee7', '3ac41d7a-9503-4d0c-bda0-c9fd1801cb37', '48b647da-50db-4b9d-aae6-3539a4dd3a3d', 'cec-historical-candidate-c6ad699e816d08be', FALSE, '無黨籍', '1', 629, 83.2, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|南投縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e48cf481-4597-4cf9-9538-01f21b549918', 'cec-historical:507907020740', '78286722-86a4-4509-b19c-8282aa50e6e3', '6b3bae7d-48c1-4f70-b68f-e77c5e9c6a21', '1cc2e311-fb53-4725-af53-be1eaac6df85', 'cec-2018-local-councilor-candidate-mountain-indigenous-10014-13-23622', TRUE, '無黨籍', '1', 339, 18.47, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e5fec000-4bc4-4319-9941-9cc9d0be74a8', 'cec-historical:96036a84b918', 'de0c0000-7208-4d01-b0a9-1b9f3674ab7c', '740cc2a5-befe-4f86-b84d-7d1770391844', 'd0c3ab78-6e1b-4c89-baac-14b06d9654d8', 'cec-2018-local-councilor-candidate-mountain-indigenous-64000-13-20149', TRUE, '中國國民黨', '2', 2023, 50.14, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|高雄市|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'e6005589-7d42-47af-951e-e6edb3d4a4fa', 'cec-historical:f7d9b72addb9', 'bd195859-4f9b-477b-bc5a-7d0fbfddbfd7', '6fe0fff6-b3fd-41b6-bdc7-29ace5607d8a', 'a0d558ec-0f79-4991-be39-315978b4c1a1', 'cec-2018-local-councilor-candidate-mountain-indigenous-10002-12-23605', TRUE, '中國國民黨', '2', 988, 24.42, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|宜蘭縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'e75309ca-03a8-48f4-973c-57552240f473', 'cec-historical:cca7a2ab71bf', '34a91ec9-54b2-4f0e-be79-0622a47939a6', '1fcd13dd-6604-44bc-8ffe-fd443e4cc4fb', '72c18fb8-b3cb-4b42-ac92-1c68e8b6c170', 'cec-historical-candidate-6f630a7a59894ff7', FALSE, '中國國民黨', '1', 447, 18.3, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|屏東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'e8bbe16a-f6b4-447a-9801-d7ba95a25bee', 'cec-historical:5296e0f7c819', 'b1c79e9f-a6ec-4cf4-9015-89f51b724909', '4c69de41-ac9f-4015-9a27-fa934acd6932', 'c941d6fc-66a9-4651-ae11-e4d8b50d4cdf', 'cec-historical-candidate-a955d092b81768be', FALSE, '中國國民黨', '6', 1202, 13.54, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|臺東縣|district-7|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'ef59a291-20f9-4fd6-8d27-9cf13d60f4d3', 'cec-historical:f36bc46ddb1a', 'eebb9bf1-4e22-45e0-ac98-2aab3ed0cd81', '138216e9-f0c3-4d14-a735-f41b34830caf', '9dc3099a-d7ba-46bd-83d5-f5335d82759b', 'cec-2018-local-councilor-candidate-plain-indigenous-10015-05-23540', TRUE, '民主進步黨', '1', 1062, 17.2, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|花蓮縣|district-5|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'f0ad446f-05a0-4e43-bef5-53c326d96ca8', 'cec-historical:25b1d5f6900f', '8eadd1c2-7251-4cca-9d41-a572c37e42bf', '94eb6de7-9919-4662-956d-039ce71da2df', 'e75c2db0-6fa1-4ba8-8d15-5baf14457122', 'cec-2018-local-councilor-candidate-mountain-indigenous-64000-14-20150', TRUE, '無黨籍', '2', 2023, 50.14, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|高雄市|district-14|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'f22e952f-f4ab-4eb1-bc3a-a3c44841090d', 'cec-historical:f941eb185f32', '1124d201-b42f-2346-9889-05704e5f3576', '836c576f-330d-4997-84ec-0f66d83f997c', '10e080ce-d920-4faf-b0df-6469384830b8', 'cec-historical-candidate-f2dc2aaeb9a3734a', FALSE, '中國國民黨', '1', 1062, 17.2, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'f297b049-40c1-4a15-985d-37c14d40931e', 'cec-historical:965b8ac48ddf', 'c6c90467-9603-4a1a-b021-f5e26001ff7e', '1fcd13dd-6604-44bc-8ffe-fd443e4cc4fb', '21dbdb59-502b-46b2-8195-2cf64469c82e', 'cec-2018-local-councilor-candidate-mountain-indigenous-10013-15-23597', TRUE, '中華統一促進黨', '3', 564, 23.09, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|屏東縣|district-15|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'faf7ee88-4aba-41ea-afc4-bfa0841fe4a9', 'cec-historical:711339215d39', '7a93b47b-f66c-4a9e-87ef-3ba6877d69e0', '740cc2a5-befe-4f86-b84d-7d1770391844', '9231a3f7-0f90-4ac4-a556-a3d79a24deba', 'cec-historical-candidate-c9c29ac8abf1c05f', FALSE, '無黨籍', '4', 1132, 31.07, TRUE, 'qualified', 'elected', 'elected', 2018, '2018|councilor|高雄市|district-13|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'fb5b1245-1071-4392-8edc-2df5c00fc41b', 'cec-historical:92a11e21f91a', 'cb1ed018-931a-4a28-a12f-1d7aeddff99a', '96602929-e465-4414-a8c0-e506871a9b41', 'cb77e8b5-6f41-4d93-902f-b07f7e1b3bbe', 'cec-2018-local-councilor-candidate-mountain-indigenous-10015-08-23612', TRUE, '無黨籍', '3', 889, 21.57, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|花蓮縣|district-8|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'fdfc15d9-5c14-4142-8311-7e7ab8d14f93', 'cec-historical:7fa17aa59d2c', '573a2b68-987e-40f4-aa19-9dfd2ff210bf', '6fe0fff6-b3fd-41b6-bdc7-29ace5607d8a', '46008f1f-4cfd-4819-9a2d-34f0d4fb77a8', 'cec-2018-local-councilor-candidate-mountain-indigenous-10002-12-23604', TRUE, '親民黨', '1', 764, 18.88, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|宜蘭縣|district-12|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'ff35aa0a-37c1-4b11-9bd7-2638ada60acd', 'cec-historical:19e738219660', '5671768b-c99c-463f-aa5d-213e5731670c', '836c576f-330d-4997-84ec-0f66d83f997c', '459771fa-592f-4219-98a1-6fc712919036', 'cec-2018-local-councilor-candidate-plain-indigenous-10015-06-23550', TRUE, '中國國民黨', '4', 1540, 24.95, FALSE, 'qualified', 'not_elected', 'not_elected', 2018, '2018|councilor|花蓮縣|district-6|plain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE);

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
    IF (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730) <> 101
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'create') <> 0
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'update') <> 101 THEN
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
    ) <> 101 THEN
        RAISE EXCEPTION 'Historical CEC migration updated candidate result mismatch';
    END IF;
    IF (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE vote_count IS NOT NULL) <> 101
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE vote_rate IS NOT NULL) <> 101
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE is_elected) <> 43
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'update' AND original_is_public) <> 48 THEN
        RAISE EXCEPTION 'Historical CEC migration candidate summary mismatch';
    END IF;
END
$verify$;

SELECT
    0 AS planned_creates,
    101 AS planned_updates,
    101 AS planned_total,
    48 AS publication_states_preserved;

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
