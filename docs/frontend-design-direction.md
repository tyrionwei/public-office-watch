# Frontend Design Direction

本專案前端採用 Arcade Civic Data 風格：

- Retro arcade
- 8-bit / pixel art accents
- Fighting game HUD inspired layout
- Civic data platform readability
- Evidence-first public data presentation

## 重要限制

1. 不使用任何特定遊戲的 Logo、角色、字體、音樂、UI 素材。
2. 不模仿特定遊戲畫面。
3. 遊戲風格只能作為視覺語言，不能影響資料中立性。
4. 不使用攻擊性政治文案。
5. 詳細證據頁以可讀性與可信度優先。

## 1. Visual Identity

- 中文名稱：公職資料觀測站
- 英文名稱：Public Office Watch
- 風格名稱：Arcade Civic Data
- 主標語：選舉地圖 × 公開資料 × 可驗證關聯

## 2. Page Tone Scale

不同頁面的遊戲感比例：

- HomePage：80%
- RacePage：70%
- RegionPage：60%
- PersonDetailPage：40%
- CompanyDetailPage：35%
- RelationEvidencePage：20%

`RelationEvidencePage` 必須最正式，重點是證據可讀性、來源可信度與資訊密度，而不是遊戲感。

## 3. Layout Concepts

### 首頁
- Next Event ticker
- Search Command
- Stage Select Taiwan Map
- Selected Region HUD
- Upcoming Election Cards
- Data Principles Panel

### 縣市頁
- Region Map
- Election Info HUD
- Race List

### 選舉項目頁
- Race Info
- Poll Battle module placeholder
- Candidate list

### 人物頁
- Pixel profile card
- Avatar / sprite
- Public relation table

### 公司頁
- Company data card
- Related people list

### 證據頁
- Evidence Log
- Source
- Confidence level
- Disclaimer

## 4. Poll Battle Module

民調焦點對戰模組定義：

- 顯示目前民調前兩名
- 左右候選人以 pixel sprite 呈現
- 背景依候選人政黨色分割
- 其餘候選人顯示在後景或下方列表
- 必須顯示民調來源數、資料區間、更新日期
- 必須顯示「依公開民調彙整，非正式選舉結果」
- 不使用 `FIGHT` / `KO` / `擊敗` / `碾壓` 等文案
- 可使用 `Poll Snapshot` / `民調焦點` / `Current Standings`

## 5. Party Color System

初版 party theme 定義：

- 民進黨：green
- 國民黨：blue
- 民眾黨：white / cyan
- 時代力量：yellow
- 親民黨：orange
- 台灣基進：purple
- 無黨籍：slate gray + gold accent
- 未知政黨：neutral slate

原則：

1. 政黨色只作為視覺識別，不代表網站立場。
2. 背景使用政黨色時必須降低透明度。
3. 文字必須保持高對比。
4. 不可只靠顏色表示資訊，必須同時顯示政黨名稱。
5. 小黨顏色可透過 `partyThemes.ts` 或未來資料表擴充。
6. 未設定顏色時使用 `unknown` theme。

TypeScript 範例：

```ts
export const partyTheme = {
  dpp: {
    key: 'dpp',
    label: '民主進步黨',
    primary: '#1F8B4C',
    accent: '#8FE3B2',
    text: '#F8FFF9',
  },
  kmt: {
    key: 'kmt',
    label: '中國國民黨',
    primary: '#1E4FA8',
    accent: '#9BC1FF',
    text: '#F7FBFF',
  },
  tpp: {
    key: 'tpp',
    label: '台灣民眾黨',
    primary: '#7BE7F3',
    accent: '#E9FDFF',
    text: '#10343A',
  },
  npp: {
    key: 'npp',
    label: '時代力量',
    primary: '#F2D43D',
    accent: '#FFF4A8',
    text: '#2C2400',
  },
  pfp: {
    key: 'pfp',
    label: '親民黨',
    primary: '#F28A24',
    accent: '#FFD0A3',
    text: '#2A1700',
  },
  tsp: {
    key: 'tsp',
    label: '台灣基進',
    primary: '#7B3FE4',
    accent: '#D6C2FF',
    text: '#FAF7FF',
  },
  independent: {
    key: 'independent',
    label: '無黨籍',
    primary: '#5B6472',
    accent: '#D7B75E',
    text: '#F8FAFC',
  },
  unknown: {
    key: 'unknown',
    label: '未知政黨',
    primary: '#667085',
    accent: '#CBD5E1',
    text: '#F8FAFC',
  },
};
```

## 6. Pixel Avatar / Sprite Policy

- 第一版使用原創 / placeholder pixel sprite
- 不使用未授權真人照片轉換
- 不抓 Google Images、新聞照片、社群照片
- 若未來使用人物特徵化 sprite，應避免高度肖像還原
- 無照片時顯示預設 avatar

## 7. BGM Policy

- BGM 預設關閉
- 使用者點擊後才播放
- 音量預設 10%～15%
- 切頁不中斷
- 可關閉
- 不使用任何既有遊戲音樂
- 使用原創 chiptune loop

## 8. Writing Guidelines

允許用語：

- 公開資料
- 可驗證關聯
- 來源可追溯
- 民調焦點
- 選舉項目
- 目前排序
- 證據來源

禁止用語：

- 黑幕
- 貪腐
- 政商勾結
- 可疑人物
- 擊敗
- KO
- 碾壓
- 開戰
- 敵人

## 9. Frontend Data Rule

前端未來只能讀 public views：

- `public_people`
- `public_companies`
- `public_relation_details`
- `public_regions`
- `public_elections`
- `public_races`
- `public_candidates`
- `public_home_election_ticker`
- `public_region_election_summary`
- `public_person_primary_photos`

不得讀取：

- `relation_candidates`
- `raw_source_records`
- `person_media` raw table
- `pending` / `rejected` data
- service role key
- `DATABASE_CONNECTION_STRING`

## 10. Accessibility

- 不能只靠顏色傳達政黨
- 所有 icon / sprite 必須有文字替代
- BGM 預設關閉
- 動畫不可影響閱讀
- 支援 reduced motion
- 文字對比要足夠
