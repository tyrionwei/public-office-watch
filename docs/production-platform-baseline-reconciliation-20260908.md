# Production pre-repair baseline reconciliation — 2026-09-08

## Scope and evidence

- Production backup: local private directory tmp/production-backups/2026-09-08-pre-pr47-c73733a. SQL backup files and SHA-256 manifest are retained, not committed.
- Baseline ledger: 20260906140000. Replayed all 34 later migrations in a disposable container, without writing production.
- Original audit: tmp/platform-quality-audit-20260907/person-platforms.json. This is an audit snapshot, not the current remaining count.
- Compared 93 differing/missing referenced platform records: 86 transaction-local bridges below, 3 earlier exact variants, 1 Wu Li-hua variant, 1 absent Xiao platform, and 2 classification-only records.
- Bridges preserve candidate/person/key identity, exact source text and needs_review state. Completion must have reviewed verified repair state; the known Lu Qi-jun short-platform classification remains verified_short_platform. Any failure rolls back the entire release transaction.
- Existing vote-protection triggers are not disabled. No broad source fallback or unrestricted overwrite is introduced.

## Verification

- Formal backup restore and checksums: PASS.
- All 34 migrations from the actual production backup: PASS.
- Refreshed published views and published.promote in disposable database: PASS.
- Xiao public RPC election context, 3 platform items and hidden old candidacy assertions: PASS.
- 140 source bridge fixture cases: PASS.
- 5 Xiao archive roster cases: PASS.
- No production migration, deployment, commit or push performed in this follow-up.

## Classification-only boundary

7033acd5-56c5-4ed3-b869-3f8f17b5cc91 and ab2ebe8a-7b0d-490b-aa0a-cce1ed510fed occur only in the second-round classification migration. Their differing full texts are not overwritten by this reconciliation; exclusion/classification is not full-text verification.

## Xiao archive scope

Production contains only 3 of the 16 local superseded VoteTW claims: education, experience and birth_date. The other 13 are absent. Accept only the exact known 16-ID or 3-ID roster, with matching person/source key/type; unexpected IDs or partial sets fail. No nonexistent old private claims are inserted.

## Per-record bridge mapping

| Claim | Person | Candidate / election record | Source key | Migration |
|---|---|---|---|---|
| 92125e61-820d-4403-a106-0e4b2f67038b | 62d79cbd-48e4-4c0a-b936-ef1ce3673fbd | 36dafa04-d36c-4a31-a2ad-787e568c91f6 | cec-platform:2022:votetw-candidate-c15f655c303360a6 | 20260907061839_release_verified_people_and_platforms.sql |
| ddfab220-fa61-45f9-bfb3-8bf9edff7529 | 75967696-d559-4570-bb92-706960800883 | 55788941-aa26-48c7-a701-88279e8629d8 | cec-platform:2022:votetw-candidate-58bf02c7120490ae | 20260907061839_release_verified_people_and_platforms.sql |
| 1a559ded-e439-4804-9e35-8c2b9d02789d | a4f35596-4472-4372-b650-2525d43c3a1e | 5984c280-4a3a-4dcc-9407-a7b96facd941 | cec-platform:2024:votetw-candidate-45c61010c15107d4 | 20260907080443_release_verified_remaining_high_priority_platforms.sql |
| 205dd2ba-a3b0-4c92-9908-997ffe9e3451 | 3d3ebc9a-6fc0-44fc-94dd-ace3b446182c | b99fc42c-0f8a-4827-96c5-847fe3736776 | cec-platform:2022:votetw-candidate-b3bc45e8d7005658 | 20260907080443_release_verified_remaining_high_priority_platforms.sql |
| 40367687-3c3a-4597-9b8e-28cebe100fbb | 6950878a-9a09-4c70-8512-757b50af9293 | c4b7dd59-a103-4375-b0fb-f1a54677629f | cec-platform:2024:votetw-candidate-32e40e93ebed6a0a | 20260907080443_release_verified_remaining_high_priority_platforms.sql |
| 571f28ef-da0f-4281-b1e6-6ced5ece8042 | 359ec9cb-1cf9-4610-a34d-6d64c1799b11 | dd0e64c1-e6cc-4e2c-a11f-53c337ea9a4a | cec-platform:2022:votetw-candidate-ddd755e001b173b3 | 20260907080443_release_verified_remaining_high_priority_platforms.sql |
| 67ef984f-b965-49ed-ad44-f8627d1265ff | 971320cf-8050-41e1-8d5b-57617cc14297 | e2429d3e-6574-45bc-902e-e9cfdb6220bc | cec-platform:2022:votetw-candidate-8e7964fb579bfc1e | 20260907080443_release_verified_remaining_high_priority_platforms.sql |
| 702f6bc1-0726-4e3c-b685-fd5cb3ebd181 | c2e117ce-ca1f-4fa6-97fb-8decbbbc014f | 73120e63-e44f-460f-8300-a50c0c58e29a | cec-platform:2022:votetw-candidate-24626cca34417174 | 20260907080443_release_verified_remaining_high_priority_platforms.sql |
| b2b89529-4a8b-4387-84d0-63e068a1f928 | 0db18c89-a071-4584-9202-6d46d91bf8f1 | 34a9156c-dc7a-4f8f-84bb-a811deca688d | cec-platform:2022:votetw-candidate-6a03bcecb9b4172a | 20260907080443_release_verified_remaining_high_priority_platforms.sql |
| b98f9729-37f3-492d-927b-305832f455bc | 475c7752-0db6-4ac5-91d2-155430667f0e | 271aafee-58e3-4682-9a2d-79737ebe27b4 | cec-platform:2022:votetw-candidate-9102bd417a3a40d1 | 20260907080443_release_verified_remaining_high_priority_platforms.sql |
| ba844082-78ea-48e7-a2cb-dd6a1dc53d15 | dc6a8178-2ba9-4b0a-8b3e-3a0f74ee7ccc | ebb089e9-c339-4087-885e-ba48513eefea | cec-platform:2022:votetw-candidate-1f928f6d07d0b491 | 20260907080443_release_verified_remaining_high_priority_platforms.sql |
| cc5fb095-ed3d-43ed-bc58-fc0b7e7ae8a0 | bf02aaf0-9a18-4d56-a1b2-d1e398720663 | 3fd33e16-d0c9-4dee-9ecb-1c6dcbdc97fc | cec-platform:2022:votetw-candidate-2e8f1938d38a827e | 20260907080443_release_verified_remaining_high_priority_platforms.sql |
| df0b4204-a19c-4a66-a813-1d8523727181 | 588cabea-89b3-45b2-87f8-cb3a4f5019cd | b87db885-ce08-47b4-827f-d276834183bf | cec-platform:2022:votetw-candidate-d8a4a86928adf710 | 20260907080443_release_verified_remaining_high_priority_platforms.sql |
| f3754f44-ba01-4edd-a08e-e4ef1e0b1b3b | 31aacd68-e42c-4bf9-be2b-4790bce6657b | 47e7058d-f0a8-485d-a7ce-9e7745f288bd | cec-platform:2022:votetw-candidate-561c97a012db5ead | 20260907080443_release_verified_remaining_high_priority_platforms.sql |
| f4f77c32-5eaf-456d-8095-b929056ddc48 | 9a397842-d6cb-46ec-bcff-409cfa9e80f8 | f22dc1be-4b36-4c9e-9a9d-5cc501db3dfc | cec-platform:2022:votetw-candidate-a37a518ab9c9cded | 20260907080443_release_verified_remaining_high_priority_platforms.sql |
| f7c8ee98-6ecd-42f5-be45-d409749c3246 | 6ebea9fb-76c6-471d-b2e8-82b580e4fb92 | 879dd5c5-e14d-4252-b157-490ec0cb7cef | cec-platform:2022:votetw-candidate-2823dd3e8ab180d1 | 20260907080443_release_verified_remaining_high_priority_platforms.sql |
| 54cf673e-03be-4b8c-a58c-737121e48d66 | df1c38fd-2041-4c67-8404-ad8f094dc4d7 | 18e79806-7ea9-478d-b77e-3a7a0e80fdbe | cec-platform:2022:votetw-candidate-0a4cb139174c41b2 | 20260907084442_release_verified_high_source_rule_platforms.sql |
| 82d849f6-38ee-4101-aac1-ec41b4065ca3 | 7dda3f82-9377-4ecc-a9aa-74b7397533c4 | 274223f8-51a3-40f2-9f87-0b7406402e23 | cec-platform:2022:votetw-candidate-ea841953beff2f9d | 20260907084442_release_verified_high_source_rule_platforms.sql |
| 98d9b65f-0482-4980-b7b8-4d77501fe6f2 | 7d7d856d-a5de-40ae-800d-07dcb320bf8a | 2b5fbaef-abc7-43be-bc66-da5230459af6 | cec-platform:2022:votetw-candidate-ef605dc738f24485 | 20260907084442_release_verified_high_source_rule_platforms.sql |
| a0d81e50-375f-4c03-84df-bc0a051f6c80 | c9b60512-33d1-47fe-98fa-4cbf90b5964b | 1a0445f3-33e3-4116-9d62-4ceeb8972e22 | cec-platform:2022:votetw-candidate-6083ce0ee0258566 | 20260907084442_release_verified_high_source_rule_platforms.sql |
| a2fa74d7-4170-4ae0-ab07-d405c367fb0e | 990fcf7b-07bf-4cf3-82bc-27c708161222 | bc61dd6f-2ca2-4353-a554-19e5292ef3b9 | cec-platform:2022:votetw-candidate-7e72849fe2353f7b | 20260907084442_release_verified_high_source_rule_platforms.sql |
| d2a91c3a-e7d8-4091-b321-009dc211f4ba | c3b948da-4ce2-4988-a0a7-9a7401943533 | 52c458c2-f254-4389-8d60-8b2eeed04ce1 | cec-platform:2022:votetw-candidate-bf80f7d1f54a340b | 20260907084442_release_verified_high_source_rule_platforms.sql |
| 72c762be-1e05-4ff9-9b66-f492d5f4befb | 1f5373e1-707c-41a1-8f5b-4712a9e371ab | f4b35f5a-d695-4fb6-ac1f-b1404daf718a | cec-platform:2024:votetw-candidate-ace2593e330616df | 20260907093712_release_verified_high_omission_platforms_01.sql |
| 884d41e3-68e1-4ae2-9faa-549f1994426f | 35118713-e1d7-4b70-85d6-8edfa094aa47 | 521c5920-f5c9-46e8-b055-6c47fc356c8a | official-profile:tainan-city-council-current-councilors:aff972cb12c1:35118713-e1d7-4b70-85d6-8edfa094aa47:platform | 20260907093712_release_verified_high_omission_platforms_01.sql |
| 938b21a3-ff01-4edb-9d42-731507e17691 | e794fd0c-d492-4ded-bea8-393c5a87ec3e | b9b8b1c4-da30-43f4-9be6-8eb3cefe422c | cec-platform:2022:votetw-candidate-0dfc67a57b00cf9a | 20260907093712_release_verified_high_omission_platforms_01.sql |
| 9644c26a-ddd5-4cc4-98ca-6ad1d2ae7969 | 80082cee-85ef-40a3-bb95-0e427771edbd | 80e29c35-168f-4a70-97f1-15557bb06491 | cec-platform:2022:votetw-candidate-16668e746656a0aa | 20260907093712_release_verified_high_omission_platforms_01.sql |
| d5435035-0f80-4952-9816-b7aede1eefee | fe9e8dfe-eb13-48da-8797-fbdfc4504172 | a27ecf7e-8b97-41bd-8c07-1b0cea9dcd6f | cec-platform:2022:votetw-candidate-647d01b42270fcd2 | 20260907093712_release_verified_high_omission_platforms_01.sql |
| cc03cdf1-b263-4a07-ba63-c6ed2863c637 | 27268e9a-f252-4f2d-8443-b4d7eab0cfbc | d2229293-7ef9-407c-aef4-ee1588edb5b5 | cec-platform:2022:votetw-candidate-540d3f17c656effd | 20260907094705_release_verified_high_omission_platforms_02.sql |
| ef3620c0-7d3c-4c29-8c55-6f3688123fb5 | 620b889e-f625-4061-ba93-bf7dda9de6f8 | 710ec475-7d3f-4f79-bb36-b330dea32b1d | cec-platform:2022:votetw-candidate-7e3396d73e98841d | 20260907094705_release_verified_high_omission_platforms_02.sql |
| 408da69e-9e37-42e3-892c-ec5498c1517c | 1daa1817-3963-41cb-aa6a-e570e0f1d635 | 78cd5eed-5522-4067-b785-40591540801a | cec-platform:2022:votetw-candidate-41fe147b9017731a | 20260907101459_release_verified_high_omission_platforms_03.sql |
| f098cca2-0d71-4b5c-8b8a-a043a9b8fe8f | b423857b-aaf0-4414-99e8-a0071859d18e | 28fce42c-139a-42cf-8803-c7b2037297f3 | cec-platform:2022:votetw-candidate-9824e22d55d13d81 | 20260907101459_release_verified_high_omission_platforms_03.sql |
| 041caeef-1272-4b67-b720-c0556b321a07 | 59075080-197e-4702-92c3-56ecfad200a1 | cfca9ada-2029-4f6a-a259-a318176d0607 | cec-platform:2022:votetw-candidate-6571744e1efd06f0 | 20260907105452_release_verified_high_omission_platforms_04.sql |
| 0742aa7b-ad12-4a8c-975c-d8b725972e7c | f0a760ab-2763-4806-9d15-873bdac1e97f | 1c3a6d63-292b-4a58-b417-c1366577ae81 | cec-platform:2024:votetw-candidate-672e631e0d18ecd6 | 20260907105452_release_verified_high_omission_platforms_04.sql |
| 2d41ca1b-b652-45db-9ac0-208e279b68b7 | 9c6365ef-b3ed-4b49-87e7-6adbe925792a | e67f981c-16b4-496b-9c7a-030aa92cd23e | cec-platform:2022:votetw-candidate-f65b8929e0b10b5b | 20260907105452_release_verified_high_omission_platforms_04.sql |
| 748a57ef-a5cd-48d4-9689-9f77908d86de | 639bdf4c-a801-48b7-9ca6-44a3aa016c9a | 9e126312-18fc-4e43-81c2-19dce69b71ad | cec-platform:2022:votetw-candidate-90da162e9bccd7b4 | 20260907105452_release_verified_high_omission_platforms_04.sql |
| b2b41815-66b9-4083-b3b0-ecb890f48407 | f9860a9c-7ba3-45cc-bc9d-3269d60d4548 | af457c66-eeb9-4384-8371-9c7d63f4f8ce | official-profile:tainan-city-council-current-councilors:d75568dc48f5:f9860a9c-7ba3-45cc-bc9d-3269d60d4548:platform | 20260907114145_release_verified_high_omission_platforms_06.sql |
| f8efab6c-8056-4018-9d50-79498ba1ae86 | 77171388-00f0-4dcd-a709-db4496b1d3f4 | b570ad7f-50c9-4646-b011-377eb7c77452 | official-profile:tainan-city-council-current-councilors:092cce357f0c:77171388-00f0-4dcd-a709-db4496b1d3f4:platform | 20260907114145_release_verified_high_omission_platforms_06.sql |
| 168fbd35-c28f-4cbf-86c2-171c8954babe | 24d90f21-d167-44ec-b677-90815f62b4d0 | 91f67ca4-2407-4119-a77f-194c626ad57f | cec-platform:2022:votetw-candidate-8a4a648a4244f79b | 20260907124439_release_verified_high_omission_platforms_08.sql |
| 95a3110b-10c4-42e5-980a-30ec46d3528e | 4a509962-1bb7-4153-8100-4c912752a1a6 | c165c358-db82-4d8f-a0b5-156a2b87da31 | cec-platform:2022:votetw-candidate-6b86fe3bf78380ec | 20260907124439_release_verified_high_omission_platforms_08.sql |
| 059160b7-9ab1-4010-b8a8-0c42930b5ab0 | abf2082c-c7c9-4493-aabd-cc9392298b9d | 2ec28c65-dfde-4b8f-95b9-ec946c2d6fe8 | cec-platform:2022:votetw-candidate-feea3dbae3dcd6e3 | 20260907131741_release_verified_high_omission_platforms_09.sql |
| 4a6da7e9-6f69-471f-88ac-a9f6ba7091d8 | dd044d90-04e9-4419-be4f-74b3864c1a94 | 41db1cbd-ecb3-42cd-9e0c-76d9ddc89323 | cec-platform:2022:votetw-candidate-8107edf0c2b63e5d | 20260907131741_release_verified_high_omission_platforms_09.sql |
| adcaaf12-8e2b-4fbb-a2b5-6d9fda543e29 | 79c23b82-d62f-45c5-b819-59b90e882b8e | f9ca8fcf-4be3-4254-8341-71ed29d22f55 | cec-platform:2022:votetw-candidate-9f27faed67e28ef1 | 20260907131741_release_verified_high_omission_platforms_09.sql |
| bfee0c02-8db3-4d9e-9915-4bcc44ef56e3 | 368d7251-58d5-4cdb-86e0-a91bc663a5df | da0871d4-a737-4a59-87db-3c29f69350e0 | cec-platform:2022:votetw-candidate-61081f0999883d06 | 20260907131741_release_verified_high_omission_platforms_09.sql |
| d493a215-b575-4996-a520-b6195af0ed33 | 2ffa1d96-4a57-44b5-983f-805221f3281e | f07ed24e-ae36-4aad-9502-884c0cdcb579 | cec-platform:2022:votetw-candidate-0cae20e753eb103d | 20260907131741_release_verified_high_omission_platforms_09.sql |
| eb9a9042-3511-4373-9db9-390a0e637761 | 941b6b2c-d225-40c3-b68f-86fcd05828f3 | 7d3d1590-f02b-4b25-a66a-bb800ed45b13 | cec-platform:2022:votetw-candidate-ac6c4c959ed8ff58 | 20260907131741_release_verified_high_omission_platforms_09.sql |
| 0593d0c5-e868-4460-850a-6df9c6e4d35e | 518bf5cd-e4be-4824-90a0-942b14efcca7 | 753cdbd7-f8fb-49df-aa19-a4fcc2eb35c4 | cec-platform:2022:votetw-candidate-7cd92cc746e20171 | 20260907132440_release_verified_high_omission_platforms_10.sql |
| 297e28ec-4cc0-4ba0-9624-9350f0b25f44 | e2920a30-0b27-430d-b644-3b5cb5601ce6 | f4a7a161-ffe9-43b5-9c27-223ee8af8977 | cec-platform:2022:votetw-candidate-6099ed3d14f6ff64 | 20260907132440_release_verified_high_omission_platforms_10.sql |
| 30312a75-dd49-4d1c-9351-4e2b48e803f7 | 3072766a-5917-44fc-94ad-89477bb0ec84 | ead9f8cf-245a-42fe-845d-b8bb0358126f | cec-platform:2022:votetw-candidate-388ef64c76e38315 | 20260907132440_release_verified_high_omission_platforms_10.sql |
| 4cd0e0ca-8782-4858-a067-468e19d7a9ec | e978b4be-4f90-4c87-812a-cdb162b71be1 | 3d10a17a-c025-4eec-b945-0e78caea225d | cec-platform:2022:votetw-candidate-029dc02c8e428df1 | 20260907132440_release_verified_high_omission_platforms_10.sql |
| 52978743-36d0-4f5b-a8ae-6a92d9b9eff0 | 0c0232df-8fed-42ef-b806-c271a327e14d | 9b26a58f-23fb-41c3-ab31-39ef97967c01 | cec-platform:2022:votetw-candidate-16d518b3d0c97d0e | 20260907132440_release_verified_high_omission_platforms_10.sql |
| 2730e39b-a90a-4540-ab2c-4c9d01d4c3eb | f2b71c92-997e-4061-84fb-cbef68d0b202 | 2fc3b5a7-5b32-4784-9d7e-969816da6743 | cec-platform:2022:votetw-candidate-bc820ec16ee48447 | 20260907133311_release_verified_high_omission_platforms_11.sql |
| 28ee7985-cb15-45df-a423-6126faf35f50 | 16132a70-c7a7-497f-9b8d-bde17ccb4aad | fac161c9-f6e4-4d21-9456-72921b6e636f | cec-platform:2022:votetw-candidate-b39af6e932dcff01 | 20260907133311_release_verified_high_omission_platforms_11.sql |
| 7bfc192d-e933-457f-a961-426d6d47e4af | cd8a6c0c-69ed-4101-a059-d3ad36d9f411 | 1f2f0d1b-aa8d-47d2-b3f7-114d2e06a751 | cec-platform:2024:votetw-candidate-bcf087cf9a9c3fc4 | 20260907133311_release_verified_high_omission_platforms_11.sql |
| a05abc8d-5a33-402f-b3d3-1347a1f34b6d | a89660cb-b58a-441b-a09f-c0972ac81073 | f6d65780-2609-4848-951b-f556df487d2d | cec-platform:2022:votetw-candidate-aca615f73ca43f90 | 20260907133311_release_verified_high_omission_platforms_11.sql |
| ea5ee72f-9981-4b5f-b6ba-787a86ebf068 | a7a50e51-cae5-49d7-a664-c4bd25b3abb2 | d19a94d2-976c-43cf-98aa-58965c4e2007 | cec-platform:2022:votetw-candidate-a52210aebdd090da | 20260907133311_release_verified_high_omission_platforms_11.sql |
| 66ad8978-325e-49a2-a7db-a1ec271c1620 | 6cf9771b-bd86-4d87-9a68-89cf65d44f0c | d531cdc3-4398-4128-b4b5-9e0d08716f96 | cec-platform:2022:votetw-candidate-506258453f07c091 | 20260907135143_release_verified_high_omission_platforms_12.sql |
| 68b51740-af0c-42c2-b8a5-a54ec079c1df | be7f8b49-536c-4b83-9ca9-d0c6ecb68d6b | 10df4e37-c0bf-4fcb-a249-d11518e7cdb1 | cec-platform:2022:votetw-candidate-cb05c8ef1819908e | 20260907135143_release_verified_high_omission_platforms_12.sql |
| 76e0cd05-6a10-42c6-b427-47604441e7bf | 1a7f3dc4-04dc-4669-a986-4befcbf81f97 | 408bac63-a6fd-4561-b69f-1622115291dd | cec-platform:2024:votetw-candidate-f2ae3e770bfdd40e | 20260907135143_release_verified_high_omission_platforms_12.sql |
| a9034ba4-9944-445b-a82d-479afeabc386 | 32d0f51a-dc11-4061-8814-d1e6ba5cc92b | 99e51402-b3e4-4325-8475-f5d24018ca45 | cec-platform:2022:votetw-candidate-ffecab9688abf4e0 | 20260907135143_release_verified_high_omission_platforms_12.sql |
| d12cc49e-dfa5-4653-8438-7835d7f0390f | 22134434-326b-4fa3-ac6d-d30cb40ecd9b | 33378b2d-4c6b-4295-897a-4991bef35bf1 | cec-platform:2022:votetw-candidate-6a72fd9e52932ade | 20260907135143_release_verified_high_omission_platforms_12.sql |
| 6842e0bd-ec61-47f2-9fb2-47069678db8c | 867c25b7-4017-4865-9fe2-4e870dd7e13c | 08a427ab-256f-4b89-8e67-977a018a18d9 | cec-platform:2022:votetw-candidate-58e50e5412b821a6 | 20260907140243_release_verified_high_omission_platforms_13.sql |
| 7566783b-0637-4228-a61c-07262019e640 | e79f1b88-6248-4bea-ac6b-7f0c0e7b6f96 | a98820af-fa15-4598-9795-dc82db419688 | cec-platform:2024:votetw-candidate-4a44f7b007c1e36f | 20260907140243_release_verified_high_omission_platforms_13.sql |
| 8c7bd277-3bb7-435c-8469-e214d9d4da88 | 32e6597a-ffe6-4dbb-a66f-7d4292276952 | 1c670438-1a02-4403-81a5-7942b4764b6e | cec-platform:2022:votetw-candidate-3c686371ab1313a6 | 20260907140243_release_verified_high_omission_platforms_13.sql |
| cb6b0210-a874-40c7-8af6-af25aba15df2 | 245b0ccd-ea20-48ab-826d-c98d0cf2dd84 | 2e967cad-6872-4bce-a04a-e0ce1144fd96 | cec-platform:2022:votetw-candidate-51b7cb0ece3df3ff | 20260907140243_release_verified_high_omission_platforms_13.sql |
| f7a9e1af-404c-4c10-8cdb-c2a7f0dd19d2 | ce92e37b-7af6-42ac-a114-8b8ddf340c63 | 2a0178dd-f928-4ad1-98e2-7da4f1255885 | cec-platform:2022:votetw-candidate-5f023180915e61ec | 20260907140243_release_verified_high_omission_platforms_13.sql |
| 1a8ebf40-6b14-4267-992f-a92f39be8013 | e9293e38-c3e7-4fda-87b7-799462805239 | 9dea99f7-c826-42b3-81f4-7f79125ae66a | cec-platform:2022:votetw-candidate-c45a34f92879ebf5 | 20260907141404_release_verified_high_omission_platforms_14.sql |
| 415a82ff-0c89-4299-a3fa-53047e9eb61f | 71aa5a07-e3a6-482c-b17e-4cb7228e019c | ad70fafd-3458-456d-962e-ae0ba2520578 | cec-platform:2022:votetw-candidate-7ed9b869aded6723 | 20260907141404_release_verified_high_omission_platforms_14.sql |
| 53657df3-bfcd-42ce-93c0-0aefeda5dc58 | bbee55b2-1ed6-4e8b-af34-a563c7a89e01 | ff4d37e0-30fd-4193-8f24-ddab8e46fe7e | cec-platform:2022:votetw-candidate-ef7e7092a0d83c61 | 20260907141404_release_verified_high_omission_platforms_14.sql |
| 70dd7a7e-8b53-46ac-b768-0cb883ecd274 | a779e071-4cc6-41e3-a5b0-cb4235fa25d0 | 7647f3f6-b99d-406d-98a8-83e9f0ad4dcc | cec-platform:2022:votetw-candidate-336b316ac57b7e46 | 20260907141404_release_verified_high_omission_platforms_14.sql |
| f540fb76-2f4b-414b-b616-6a506aa3e944 | dc5ec79a-be58-4af3-8f1b-d0ac0d1f3b49 | af62347f-45f7-49b6-850a-6634cf010e55 | cec-platform:2022:votetw-candidate-6da5726be2ceb33d | 20260907141404_release_verified_high_omission_platforms_14.sql |
| 05cd932d-2d1c-4b05-a02a-2ce06835cf9d | b346dc00-d690-43ef-9545-24068fa10df3 | 7a65fdab-7456-4405-aa06-733b3c1d06e4 | cec-platform:2022:votetw-candidate-0390390793980041 | 20260907142608_release_verified_high_omission_platforms_15.sql |
| 1324dba3-bd10-4851-95cf-ec4e6ac6cfca | ee824add-3d6a-4d3b-a2c2-acc4fae63c55 | e10b7be5-0649-48a1-ae8d-757fe464ba26 | cec-platform:2022:votetw-candidate-e29261850f6f639f | 20260907142608_release_verified_high_omission_platforms_15.sql |
| 6e45b6bb-b945-478b-b880-1257b464cc8d | 3d811542-4709-409e-b133-8d40b1477b4c | d80e9a05-731d-42a8-a368-cd5ed55e197f | cec-platform:2022:votetw-candidate-b67334776fb2b15e | 20260907142608_release_verified_high_omission_platforms_15.sql |
| a5497a9a-b560-436d-b7f3-bada38074ab4 | c97b365d-6112-4bd6-8038-bfc9dc5c0304 | b699d590-d1df-4f77-8d4f-542a6debbb0b | cec-platform:2024:votetw-candidate-58cb43109600ac4e | 20260907142608_release_verified_high_omission_platforms_15.sql |
| ddf580b9-92ca-4970-a73b-4b86b2a30c07 | d40001ae-5431-41be-8f28-875b13e57155 | 968b0b4d-4680-44f8-b4d7-5c95ae915e56 | cec-platform:2022:votetw-candidate-ffb88fa8b49213b4 | 20260907142608_release_verified_high_omission_platforms_15.sql |
| 883dd346-ad09-49a4-8be3-c9804677343b | f7f9f5ef-5906-4e4d-95f9-35cdb76c4c77 | 2b753682-8ead-4110-9de4-06c115c9abdc | cec-platform:2022:votetw-candidate-00706466d37ae9c0 | 20260907161851_release_verified_high_omission_platforms_18.sql |
| 9943d1ca-112e-4124-b25b-705b0bf15b03 | 2fda7100-b6f8-41e9-953c-dd7efe371fd4 | 3d1a72f2-9b7a-47ba-a013-a05131c443b8 | cec-platform:2022:votetw-candidate-cd86c386824d1d9c | 20260907161851_release_verified_high_omission_platforms_18.sql |
| d886f0f8-a16b-49a4-ab33-8ff0cc822c9b | 17c9f3e3-d292-42c3-a418-8a76883a8a8f | 9e7894a1-8563-4eb6-8707-0c1463979be3 | cec-platform:2022:votetw-candidate-2bb0fbb8775e1bf0 | 20260907161851_release_verified_high_omission_platforms_18.sql |
| 0e904b1b-f02c-48fc-bef2-ef9698b2c327 | 4f75873b-c72c-4d30-8c45-b9a14affc86a | fe78022b-73ee-4b21-8705-f90b6db09708 | cec-platform:2024:votetw-candidate-9ceb6f26343538a4 | 20260907163629_release_verified_high_omission_platforms_19.sql |
| 41236b3c-8036-4e4e-909e-c266122f8a25 | 83c02535-6d15-4203-8d94-11bbbf4d653c | 0c3d5e20-eb70-4cbb-92c3-c24cf9544bee | cec-platform:2022:votetw-candidate-6f11907bf5fe7e12 | 20260907163629_release_verified_high_omission_platforms_19.sql |
| 53292131-e90e-48d1-a0b8-cbaf1d3e3229 | 3168e677-72cf-479e-b530-133f77721bf0 | 1192c20e-e14d-4b3b-b4ef-cc641e5da8c5 | cec-platform:2022:votetw-candidate-8f656a90f62df4fb | 20260907165548_release_verified_high_omission_platforms_20.sql |
| ad175882-b92f-45da-b903-78b3a379d937 | 2e48b2ea-642b-4217-87a1-a6f9a06a1980 | ee682e37-9f94-4061-adbe-71d5ec110cfc | cec-platform:2022:votetw-candidate-138cc5ad206049f3 | 20260907165548_release_verified_high_omission_platforms_20.sql |
| f557442f-2e17-47f3-9f4f-c89c896f60ad | f209a422-1032-4725-a2c6-22a7db8c8288 | 5bab54d7-f374-45d2-a1e7-2217ed58a990 | cec-platform:2022:votetw-candidate-180aa111557eca54 | 20260907165548_release_verified_high_omission_platforms_20.sql |
| 3129d1fd-2eb4-40d8-9309-57ff77345d7b | 64338b89-0816-4e8b-8693-492770be8602 | 957c7e75-83d4-44b9-930a-86364626466d | cec-platform:2022:votetw-candidate-fe2905d95b889a1b | 20260907170609_release_verified_high_omission_platforms_21.sql |
| 38dcce6d-31fd-41e8-9f14-bc6e9d873d8b | f532946d-1269-4ad6-9b1c-c13bc3794d8b | 99cd299e-a274-4c19-bcb2-466b736d7e10 | cec-platform:2022:votetw-candidate-6bdf5eadb39a7542 | 20260907170609_release_verified_high_omission_platforms_21.sql |
| 3dc80306-500f-4640-8824-46fed3755883 | cc250214-4368-4476-ba8a-b5a280439559 | 9e3930d9-9873-43b5-a66e-75b8883ecc46 | cec-platform:2022:votetw-candidate-aa557b3b545c2292 | 20260907170609_release_verified_high_omission_platforms_21.sql |
