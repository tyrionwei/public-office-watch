Default pixel character assets for the frontend prototype.

## Generated assets

- `candidate-male-01.png` through `candidate-male-04.png`: generic male civic candidate presets for ages under 40, 40–49, 50–59, and 60+.
- `candidate-female-01.png` through `candidate-female-04.png`: generic female civic candidate presets for the same four age groups.
- `xiezhi-mascot.png`: original Xiezhi mascot source used during the initial integration.
- `candidate-unknown.png`: legacy unknown/undisclosed candidate silhouette.
- `data-principles-guide.png`: legacy data-principles guide character.
- `default-civic-sprite-sheet-source.png`: generated chroma-key source sheet used to derive the transparent sprites.

These are generic UI placeholders and are not intended to resemble real people.

## Xiezhi mascot poses

Reusable transparent mascot assets live in `xiezhi/`:

- `idle`: default mascot and incomplete-data fallback.
- `blink`: subtle idle animation frame.
- `hop`: lively or success state.
- `play`: playful engagement state.
- `sign-info`: blank navy information sign.
- `sign-warning`: blank amber warning sign.

Sign text must remain live HTML and follow the active locale. Short labels may show Chinese and English together; longer copy should show only the active language. Do not bake words into the image.

## Default candidate selection

- Complete gender and full birth date: select the corresponding gender and age-group sprite.
- Missing or unknown gender: use the Xiezhi mascot.
- Missing or incomplete birth date: use the Xiezhi mascot.

Xiezhi is an ancient Chinese mythical beast associated with justice, discernment, and impartiality. When used as a fallback portrait, it only means that the person's gender or exact birth date is unavailable; it does not imply any judgment about that person.

## 具名人物插畫（2026-10-21 本機整合）

以下為使用者委託製作並確認的大眼 Q 版 AI 生成插畫，供人物頁與參選人物共用；不是官方肖像照片，也不表示本人或機關背書。PNG 以已核對的 canonical UUID 命名，僅新增 canonical 對應，不另外建立 alias 圖片或覆寫舊圖。

本次操作授權範圍為製作、驗收與可回復的本機整合；此操作範圍不是對圖片再利用新增限制。本紀錄不代表已發布或取得參考照片的額外授權。原始照片及私人審核證據不納入公開資產。AI 插畫的生成/修改紀錄不應視為原照片作者署名的替代。

| 人物 | 檔案（相對 candidates/） | 圖稿版本 | 來源與署名紀錄 |
| --- | --- | --- | --- |
| 盧秀燕 | cc4de44b-a6ba-4816-b388-ad59cb379d9a.png | v3 | 內政部；AI生成改作。[來源](https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0004&_PARENT_ID=MYR11112BD0001&_TYP=MYR&n=578)；[內政部政府網站開放聲明](https://www.moi.gov.tw/cp.aspx?n=10954)。[原照片連結](https://ws.moi.gov.tw/001/Upload/localofficial/urllink/d5bcc6f6-58de-4a88-82bc-ea59f2cc7134.jpg)（不納入資產）。AI生成Q版全身插畫；原照僅頭肩，腿部為插畫，不是真實穿著證據。 |
| 張麗善 | cae4d254-c26c-4990-942c-677e24434555.png | v3 | 內政部，via Wikimedia Commons；AI生成改作。[來源](https://commons.wikimedia.org/wiki/File:雲林縣縣長張麗善.jpg)；[內政部政府網站開放聲明](https://www.moi.gov.tw/cp.aspx?n=10954)。原照日期：2018。由上半身照片AI生成Q版全身插畫；腿部為插畫，裝飾向日葵省略，不是真實穿著證據。 |
| 徐榛蔚 | 801b13e5-b4fd-4ca7-b5b8-360b4f3dfd7f.png | v1 | 內政部，via Wikimedia Commons；AI生成改作。[來源](https://commons.wikimedia.org/wiki/File:徐榛蔚縣長.jpg)；[內政部政府網站開放聲明](https://www.moi.gov.tw/cp.aspx?n=10954)。由上半身照片AI生成Q版全身插畫；腿部為插畫，不是真實穿著證據。 |
| 楊文科 | db2ed4f2-1f21-4753-81df-21a47c6610ec.png | v1 | 新竹縣政府，via Wikimedia Commons；AI生成改作。[來源](https://commons.wikimedia.org/wiki/File:Yang_Wen-ke.jpg)；[新竹縣政府網站授權條款](https://www.hsinchu.gov.tw/cp.aspx?n=303)。由上半身照片AI生成Q版全身插畫；腿部為插畫，不是真實穿著證據。 |



公開署名入口本機驗證：TypeScript 通過；資產與來源完整性測試 7/7 通過；24 個圖片案例尺寸、比例及 SHA256 保持一致；桌機/手機共 10 條「參選卡片 → 人物頁 → 關於頁對應紀錄」鍵盤路徑通過；五筆作者/來源/授權/改作及下載 JSON 一致，另驗英文與未收錄署名 fallback。本機 mock build 已輸出相同來源紀錄，沒有部署。

所有本批 PNG 為 1024×1024 RGBA；主要輪廓以 alpha ≥ 16/255 量測，高 945 px、下界 984 px（exclusive）。更淡的抗鋸齒邊緣可略超出此範圍，四條畫布外緣全透明。樣式與縮放沿用既有元件。

## 2026-10-22 本機增量：翁章梁、陳光復

新增兩張1024×1024透明RGBA人物插畫，僅canonical映射；逐檔作者機關、來源、授權及AI改作說明沿用 `src/data/candidateSpriteSources.json`，可從人物頁署名入口前往關於頁。兩張均署名「內政部；AI生成改作」，原始照片為頭肩照，腿部屬補繪插畫，不是真實穿著證據。不同圖片授權分別保留，不套用程式碼授權；未部署。

## 2026-10-22 第八張本機整合：陳其邁

新增canonical `d47e556d-f6f8-4462-9b90-af760ce055e8` 全身Q版插畫；來源為高雄市政府新聞局2026-09-04官方新聞照片，署名「高雄市政府新聞局；AI生成改作」。個別來源與高雄市政府網站資料開放宣告連結記於共用逐檔manifest；補繪下半身不代表真實完整衣著，未表示政府背書。原照片不納入公開資產；本批未部署。

## 2026-10-22 第九至十一張本機整合

新增陳福海、饒慶鈴、黃敏惠canonical全身Q版插畫。前兩張署名「內政部；AI生成改作」，黃敏惠署名「嘉義市政府；AI生成改作」。逐檔來源、個別授權及修改說明見共用manifest與人物頁署名入口。三張下半身皆為插畫補繪，非真實完整衣著證據；黃敏惠移除桌杯、背景與徽章，原照拍攝日期未確認。原照片不納入公開資產，不擴張授權、不代表政府背書；未部署。

## 2026-10-24 二十張議員插畫本機整合候選


## 2026-10-24 Additional six local candidates

Six exact person IDs added with MOI profile/photo references and individual source records in candidateSpriteSources.json. Publisher: Ministry of the Interior, Taiwan; no named photographer inferred. AI-generated chibi adaptation, illustrated lower body and empty hands; no official endorsement. Current membership and district are inherited from the reviewed 2026-09-30 seed, not independently certified today. No aliases changed. This remains a local candidate only.

## 2026-10-24 Additional four local candidates

Four exact person IDs added with MOI profile/photo references and individual source records in candidateSpriteSources.json. Publisher: Ministry of the Interior, Taiwan; no named photographer inferred. AI-generated chibi adaptation, illustrated lower body and empty hands; no official endorsement. Current membership and district are inherited from the reviewed 2026-09-30 seed, not independently certified today. No aliases changed. This remains a local candidate only.

## 2026-10-24 Additional four local candidates

Four exact person IDs added with MOI profile/photo references and individual source records in candidateSpriteSources.json. Publisher: Ministry of the Interior, Taiwan; no named photographer inferred. AI-generated chibi adaptation, illustrated lower body and empty hands; no official endorsement. Current membership and district are inherited from the reviewed 2026-09-30 seed, not independently certified today. No aliases changed. This remains a local candidate only.

## 2026-10-24 Additional seven local candidates

Seven exact person IDs added with MOI profile/photo references and individual source records in candidateSpriteSources.json. Publisher: Ministry of the Interior, Taiwan; no named photographer inferred. AI-generated chibi adaptation, illustrated lower body and empty hands; no official endorsement. Current membership and district are inherited from the reviewed 2026-09-30 seed, not independently certified today. No aliases changed. This remains a local candidate only.

## 2026-10-24 Additional four local candidates

Four exact person IDs added with MOI profile/photo references and individual source records in candidateSpriteSources.json. Publisher: Ministry of the Interior, Taiwan; no named photographer inferred. AI-generated chibi adaptation, illustrated lower body and empty hands; no official endorsement. Current membership and district are inherited from the reviewed 2026-09-30 seed, not independently certified today. No aliases changed. This remains a local candidate only.

## 2026-10-24 Additional eight local candidates

Eight exact person IDs added with MOI profile/photo references and individual source records in candidateSpriteSources.json. Publisher: Ministry of the Interior, Taiwan; no named photographer inferred. AI-generated chibi adaptation, illustrated lower body and empty hands; no official endorsement. Current membership and district are inherited from the reviewed 2026-09-30 seed, not independently certified today. No aliases changed. This remains a local candidate only.

## 2026-10-24 Additional eight local candidates

Eight exact person IDs added with MOI profile/photo references and individual source records in candidateSpriteSources.json. Publisher: Ministry of the Interior, Taiwan; no named photographer inferred. AI-generated chibi adaptation, illustrated lower body and empty hands; no official endorsement. Current membership and district are inherited from the reviewed 2026-09-30 seed, not independently certified today. No aliases changed. This remains a local candidate only.

## 2026-10-24 Additional nine local candidates

Nine exact person IDs added with MOI profile/photo references and individual source records in candidateSpriteSources.json. Publisher: Ministry of the Interior, Taiwan; no named photographer inferred. AI-generated chibi adaptation, illustrated lower body and empty hands; no official endorsement. Current membership and district are inherited from the reviewed 2026-09-30 seed, not independently certified today. No aliases changed. This remains a local candidate only.

## 2026-10-24 Additional eight local candidates

Eight exact person IDs added with MOI profile/photo references and individual source records in candidateSpriteSources.json. Publisher: Ministry of the Interior, Taiwan; no named photographer inferred. AI-generated chibi adaptation, illustrated lower body and empty hands; no official endorsement. Current membership and district are inherited from the reviewed 2026-09-30 seed, not independently certified today. No aliases changed. This remains a local candidate only.

## 2026-10-24 Additional eight local candidates

Eight exact person IDs added with MOI profile/photo references and individual source records in candidateSpriteSources.json. Publisher: Ministry of the Interior, Taiwan; no named photographer inferred. AI-generated chibi adaptation, illustrated lower body and empty hands; no official endorsement. Current membership and district are inherited from the reviewed 2026-09-30 seed, not independently certified today. No aliases changed. This remains a local candidate only.

## 2026-10-24 Additional eight local candidates

Eight exact person IDs added with MOI profile/photo references and individual source records in candidateSpriteSources.json. Publisher: Ministry of the Interior, Taiwan; no named photographer inferred. AI-generated chibi adaptation, illustrated lower body and empty hands; no official endorsement. Current membership and district are inherited from the reviewed 2026-09-30 seed, not independently certified today. No aliases changed. This remains a local candidate only.

## 2026-10-24 Additional six local candidates

Six exact person IDs added with MOI profile/photo references and individual source records in candidateSpriteSources.json. Publisher: Ministry of the Interior, Taiwan; no named photographer inferred. AI-generated chibi adaptation, illustrated lower body and empty hands; no official endorsement. Current membership and district are inherited from the reviewed 2026-09-30 seed, not independently certified today. No aliases changed. This remains a local candidate only.

## 2026-10-24 Additional Kao Hung-an local candidate

One exact person ID added with Hsinchu City Government profile/photo references and individual source records in candidateSpriteSources.json. Publisher: Hsinchu City Government; no named photographer inferred. AI-generated chibi adaptation, illustrated lower body and empty hands; no official endorsement. Current membership and district are inherited from the reviewed 2026-10-22 identity evidence, not independently certified today. No aliases changed. This remains a local candidate only.

## 2026-10-24 Additional Wang Hui-mei local candidate

One exact person ID added with Changhua County Government, Department of Civil Affairs profile/photo references and individual source records in candidateSpriteSources.json. Publisher: Changhua County Government, Department of Civil Affairs; no named photographer inferred. AI-generated chibi adaptation, illustrated lower body and empty hands; no official endorsement. Current membership and district are inherited from the reviewed 2026-10-22 identity evidence, not independently certified today. No aliases changed. This remains a local candidate only.

## 2026-10-24 Additional nine historical presidents and vice presidents

Nine supplied exact person IDs added with President Office photo references and individual source records in candidateSpriteSources.json. Source: Office of the President, photos provided by Academia Historica; no photographer or photo date inferred. AI-generated chibi adaptation, illustrated lower body and empty hands; no official endorsement. Historical identities use exact parent supplied IDs; no current-office claim. Seven earlier people lacking IDs remain on hold. No aliases changed. This remains a local candidate only.

## 2026-10-24 Six historical local chiefs

Six exact supplied IDs, individual MOI or Legislative Yuan source and license records retained. Li Chu-feng and Lin Cheng-tse are expressly accepted half-body illustrations; no legs added or stretching. Other unseen lower clothing is illustrative. Photo dates unknown, not inferred from tenure. Historical-role evidence from parent handoff; full aliases unknown. No official endorsement. Local candidate only.

## 2026-10-24 Eight historical local chiefs

Eight exact supplied IDs, individual official source and license records retained. Hsieh Chang-ting and Lin Tsung-nan are expressly accepted half-body illustrations; no legs added or stretching. Other unseen lower clothing is illustrative. Photo dates unknown, not inferred from tenure. Historical-role evidence from parent handoff; full aliases unknown. No official endorsement. Local candidate only.

## 2026-10-24 Seven historical local chiefs

Seven exact supplied IDs, individual official source and license records retained. Chang Po-ya is an expressly accepted half-body illustration; no legs added or stretching. Other unseen lower clothing is illustrative. Photo dates unknown, not inferred from tenure. Historical-role evidence from parent handoff; full aliases unknown. No official endorsement. Local candidate only.

## 2026-10-24 Three full-body historical local chiefs

Three exact supplied IDs and accepted full-body figures; individual official source and license records retained. Cumulative candidate remains provisional pending eight older half-body replacements. Other unseen lower clothing is illustrative. Photo dates unknown, not inferred from tenure. Historical-role evidence from parent handoff; full aliases unknown. No official endorsement. Local candidate only.

## 2026-10-24 Final full-body correction

This section supersedes earlier half-body acceptance notes: all 27 historical local chiefs now use full-body accepted illustrations. Eight same-Library v1 files replace five retained v0 half-body files and add three previously excluded people. Lower clothing and shoes are illustrative, not historical attire evidence. Source credits remain unchanged. Old v0 files exist only outside this candidate for rollback. Local-only candidate, no deployment.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## 2026-10-24 Additional councilors

Exact supplied IDs and accepted full-body empty-hand illustrations; MOI per-person source/credit retained. Current office inherited only from2026-09-30 snapshot, full aliases unknown. Lower clothing illustrative, not actual attire facts. Low source precision cautions retained in provenance. Local candidate only, no publication.

## Official-photo replacement (2026-10-24)

黃偉哲採全新臺南市政府原照生成，不是替舊Ring Chang衍生圖換署名。來源：[市長簡介](https://www.tainan.gov.tw/cp.aspx?n=5034)；授權：[該站政府網站資料開放宣告](https://www.tainan.gov.tw/cp.aspx?n=13612)。AI改作及未見下身、空手垂放姿勢為示意；非官方製作或背書。原始照片SHA256：9dea9821ec4560de56e83b1ced68053dfacb94796157e6e98e7b1eabd3ecc33b。舊CC BY-SA圖只存私人歷史證據，不隨此候選發布。

本候選331筆逐圖來源紀錄與原237張來源範圍分開；不宣稱568張皆完成本次新版授權稽核。官方宣告保留特別聲明作品、其他智慧財產、個資及人格權等例外，不是所有權利全面許可。
