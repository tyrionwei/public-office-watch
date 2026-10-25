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

## 具名人物插畫與來源

`candidates/` 中的具名人物圖為 AI 生成／改作插畫，供人物頁與參選人物顯示；不是官方肖像照片，也不表示本人或機關背書。檔名以人物識別碼對應，不應僅憑姓名推定同一人。

人物頁的「插畫來源與授權」連結及[關於本站](/about)提供已收錄的逐圖來源、署名、授權連結與改作說明，並可下載來源清單。對應紀錄維護於 `apps/web/src/data/candidateSpriteSources.json`。來源清單的收錄範圍不等於全部圖片已完成同一輪授權查核；未列出的圖片不能推定適用相同授權。

原照片與衍生插畫的來源條件須逐圖區分，不能以程式碼授權或 AI 生成標示取代原作者／提供機關署名。官方網站開放宣告仍保留個別作品聲明、其他智慧財產、個資及人格權等例外，不代表所有權利全面許可。總統府來源圖片保留「國史館提供」等個別署名；立法院來源圖片保留「委員研究室提供」等個別署名。原始照片不隨本目錄提供。

原照未顯示的下裝、鞋、手勢等屬插畫補繪，不是真實穿著或歷史事實的證據；低解析來源僅支持可辨的大形，細節不應視為事實。圖片不能用於認定人物目前職務、任期或照片拍攝日期。

### 個別來源補充

以下保留既有圖片的個別來源說明；其他圖片請使用人物頁的逐圖來源入口。

| 人物 | 檔案（相對 candidates/） | 來源與署名紀錄 |
| --- | --- | --- |
| 盧秀燕 | cc4de44b-a6ba-4816-b388-ad59cb379d9a.png | 內政部；AI生成改作。[來源](https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0004&_PARENT_ID=MYR11112BD0001&_TYP=MYR&n=578)；[內政部政府網站開放聲明](https://www.moi.gov.tw/cp.aspx?n=10954)。[原照片連結](https://ws.moi.gov.tw/001/Upload/localofficial/urllink/d5bcc6f6-58de-4a88-82bc-ea59f2cc7134.jpg)（不納入資產）。AI生成Q版全身插畫；原照僅頭肩，腿部為插畫，不是真實穿著證據。 |
| 張麗善 | cae4d254-c26c-4990-942c-677e24434555.png | 內政部，via Wikimedia Commons；AI生成改作。[來源](https://commons.wikimedia.org/wiki/File:雲林縣縣長張麗善.jpg)；[內政部政府網站開放聲明](https://www.moi.gov.tw/cp.aspx?n=10954)。原照日期：2018。由上半身照片AI生成Q版全身插畫；腿部為插畫，裝飾向日葵省略，不是真實穿著證據。 |
| 徐榛蔚 | 801b13e5-b4fd-4ca7-b5b8-360b4f3dfd7f.png | 內政部，via Wikimedia Commons；AI生成改作。[來源](https://commons.wikimedia.org/wiki/File:徐榛蔚縣長.jpg)；[內政部政府網站開放聲明](https://www.moi.gov.tw/cp.aspx?n=10954)。由上半身照片AI生成Q版全身插畫；腿部為插畫，不是真實穿著證據。 |
| 楊文科 | db2ed4f2-1f21-4753-81df-21a47c6610ec.png | 新竹縣政府，via Wikimedia Commons；AI生成改作。[來源](https://commons.wikimedia.org/wiki/File:Yang_Wen-ke.jpg)；[新竹縣政府網站授權條款](https://www.hsinchu.gov.tw/cp.aspx?n=303)。由上半身照片AI生成Q版全身插畫；腿部為插畫，不是真實穿著證據。 |

黃偉哲插畫使用臺南市政府原照作 AI 改作。來源：[市長簡介](https://www.tainan.gov.tw/cp.aspx?n=5034)；授權：[政府網站資料開放宣告](https://www.tainan.gov.tw/cp.aspx?n=13612)。原照未見的下身與空手姿勢為示意，非官方製作或背書。個別照片來源及改作說明以逐圖紀錄為準。
