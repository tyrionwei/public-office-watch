# 2026 登記名冊：第三批外部生日補證

2026-09-05，分支 `codex/2026-registration-polling-analytics`。

後續六批再解除 70 筆，本機公開名單目前為 17,269 筆、待核 1,148 筆；詳見[第四批同名排除](cec-registration-identity-review-2026-09-05-round-4.md)、[第五批性別正規化與轉戰證據核對](cec-registration-identity-review-2026-09-05-round-5.md)、[第六批縣市長身分鏈](cec-registration-identity-review-2026-09-05-round-6.md)、[第七批現職轉戰核對](cec-registration-identity-review-2026-09-05-round-7.md)及[第八批現職轉戰核對](cec-registration-identity-review-2026-09-05-round-8.md)。最新逐筆核對見[第九批審核](cec-registration-identity-review-2026-09-05-round-9.md)。下文保留第三批完成時的數字。 最新完整比對見[第十輪審核](cec-registration-identity-review-2026-09-05-round-10.md)。

本批針對第二批後「官方有完整生日，但既有同名人物缺少可比對生日」的 108 筆補查既有選舉人物頁。解除 7 筆待核，全部接回既有人物；本機公開名單由 17,184 增至 17,191 筆，待核由 1,233 降至 1,226。正式網站與正式資料庫沒有變更。

## 結果

| 判定 | 筆數 |
|---|---:|
| VoteTW 人物頁生日精確吻合，且 2022 參選經歷可對回本站既有候選紀錄 | 6 |
| 中選會 2024 不分區資料生日精確吻合，且歷史候選紀錄一致 | 1 |
| 合計解除待核 | 7 |
| 本批後仍待核 | 1,226 |

接回既有人物者為林振德、鄭宇翔、賴文龍、陳志偉、林月琴、蔡坤達與李貞秀。每筆均要求本次中選會完整生日與補查來源完全一致，性別不衝突，且來源所列歷史參選經歷能對回本站相同人物的既有候選紀錄。

逐筆人物、候選、選區識別，來源網址、頁面雜湊、取得時間及採用文字保存在[第三批審核清單](cec-registration-identity-review-2026-09-05-round-3.json)。補查 106 個不重複姓名時，24 個網址成功回應，18 個姓名頁能解析出人物資料；只有上述 7 筆同時滿足完整日期與歷史紀錄驗證，其餘沒有據此推定。VoteTW 原始頁面在後續重取時回應 403，因此本次可稽核輸入為當時凍結的解析資料、頁面 SHA-256、網址、取得時間與採用文字，沒有宣稱保存原始 HTML。李貞秀使用已保存並校驗雜湊的中選會 2024 官方 JSON。

## 套用與驗證

套用程式固定檢查本批 7 筆原始待核聲明、官方登記檔、補查證據與支援用歷史候選紀錄。它只新增公開參選關係、身分對照及 `registration_filed` 事件；候選號次仍空白，選舉結果仍為 `pending`，沒有資格通過或不合格事件，原始登記聲明保持私有。

完整本機發布版本為 `8fd073f6-1672-4349-9a8a-514352a70cd9`，套用紀錄為 `tmp/cec-registration-identity-review-3/2026-09-04T19-33-10-848Z-apply.json`（UTC）。固定清單見[第三批 JSON 審核帳冊](cec-registration-identity-review-2026-09-05-round-3.json)，本機私有輸入位於 `tmp/cec-registration-identity-review-3/`。
