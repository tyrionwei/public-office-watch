# 2026 登記名冊：參選身分與官方完整姓名核對（第十二輪）

最新進度：以官方出生年區分同名者，新增確認 17 筆，目前本機公開 17,330 筆、待核 1,087 筆；詳見[第十三輪審核](cec-registration-identity-review-2026-09-05-round-13.md)。下文保留前一階段紀錄。

2026-09-05；分支 codex/2026-registration-polling-analytics；完整本機研究資料庫。

本輪完成 17 筆既有人物連結，待核由 1,121 降為 **1,104**，本批公開登記資料由 17,296 增為 **17,313**。累計十二輪解除 491 筆身分待核。正式網站及正式資料庫未變更。

## 核對依據

16 件使用參選報導或本人競選頁連結既有公職身分；1 件使用議會完整姓名欄位。全部對應唯一既有官方人物檔案，沒有已知性別、生日衝突或其他 2026 參選關係。報導僅補充身分判斷，登記日期、選區及政黨仍採中選會原始名冊。部分報導使用搜尋索引可讀內容，直接存取失敗者已在 external-evidence.json 記錄，未宣稱取得全文。

| 姓名 | 登記選區 | 身分補證來源 |
|---|---|---|
| 曾玟學 | 苗栗縣頭份市 | [核對來源](https://tsengwenhsueh.oen.tw/) |
| 張顧礫 | 苗栗縣苑裡鎮 | [核對來源](https://www.cna.com.tw/news/aloc/202609030295.aspx) |
| 葉忠倫 | 苗栗縣竹南鎮 | [核對來源](https://udn.com/vote2026/story/7324/9646372) |
| 林品仰 | 花蓮縣壽豐鄉 | [核對來源](https://cnews.com.tw/250260713a03/) |
| 黃馨 | 花蓮縣吉安鄉 | [核對來源](https://etaiwan.news/2026/09/03/%E5%AE%8C%E6%88%90%E5%8F%83%E9%81%B8%E7%99%BB%E8%A8%98%EF%BD%9C%E6%9B%BE%E4%BB%BB%E5%90%89%E5%AE%89%E9%84%89%E9%A6%96%E4%BD%8D%E5%A5%B3%E9%84%89%E9%95%B7%EF%BC%8C%E5%BB%BA%E8%A8%AD%E6%96%B0%E5%90%89/) |
| 施佩妤 | 彰化縣鹿港鎮 | [核對來源](https://tw.news.yahoo.com/%E6%96%BD%E4%BD%A9%E5%A6%A4%E4%BD%8E%E8%AA%BF%E7%99%BB%E8%A8%98%E5%8F%83%E9%81%B8%E9%B9%BF%E6%B8%AF%E9%8E%AE%E9%95%B7-15%E5%B9%B4%E5%89%8D%E5%BE%9E%E9%87%8C%E9%95%B7%E5%87%BA%E7%99%BC-%E5%A6%82%E4%BB%8A%E6%BA%96%E5%82%99%E6%89%BF%E6%93%94-%E5%80%8B%E9%8E%AE-150913605.html) |
| 黃俊源 | 彰化縣福興鄉 | [核對來源](https://tw.news.yahoo.com/%E5%BD%B0%E5%8C%96-%E7%A6%8F%E8%88%88%E9%84%89%E9%95%B7%E9%81%B8%E6%88%B0-%E8%97%8D%E6%81%90%E9%BB%A8%E5%85%A7%E4%BA%92%E6%89%93-201000838.html) |
| 陳明達 | 屏東縣里港鄉 | [核對來源](https://udn.com/vote2026/story/124652/9732850) |
| 洪鴻斌 | 金門縣烈嶼鄉 | [核對來源](https://www.kmdn.gov.tw/1117/1271/1272/589889/) |
| 徐功凡 | 苗栗縣頭份市 | [核對來源](https://www.ftvnews.com.tw/news/detail/2026903C11M1) |
| 禹耀東 | 苗栗縣苗栗市 | [核對來源](https://www.cna.com.tw/news/aloc/202609020342.aspx) |
| 陳春暖 | 苗栗縣卓蘭鎮 | [核對來源](https://udn.com/vote2026/story/7324/9731939) |
| 顏翎熹 | 嘉義市第1選舉區 | [核對來源](https://finance.ftvnews.com.tw/news/detail/2026903W0138) |
| 程美蓮 | 花蓮縣秀林鄉 | [核對來源](https://www.hsnews.com.tw/political-news/cheng-mei-lian-zheng-shi-deng-ji-can-xuan-xiu-lin-xiang-zhang-ge-cun-xuan-jiang-qi-ju-zhan-xian-min-zhu-xin-qi-xiang.html) |
| 顏忠義 | 雲林縣斗南鎮 | [核對來源](https://udn.com/news/story/6656/9675929?from=udn-catelistnews_ch2) |
| 林庭秝 AliWalis | 南投縣第8選舉區 | [核對來源](https://www.ntcc.gov.tw/tw/rep/p02.aspx?district=8&period=20) |
| 林月琴 | 苗栗縣苗栗市 | [核對來源](https://www.cna.com.tw/news/aloc/202609020342.aspx) |

## 本機驗證

- 先執行交易式試跑並回滾，再正式寫入；官方原始文件校驗 10 份。
- 寫入 17 筆參選關係、17 筆登記事件及 17 筆私人審核結果；不新增人物，不改動既有人物、公職或其他候選資料。
- 累計 491 位人物、491 筆參選關係及登記事件吻合；一般訪客核對 174 個樣本，包含本輪全部 17 人。
- 整批 17,313 筆公開參選關係及登記事件一致；重複人物 0、錯誤資格狀態 0、公開原始登記審核資料 0。
- 17 人均有參選職位；轉選首長者保留議員或立委現職，不把登記首長當成現職。郭璽職位回歸檢查通過。
- Windows 端網站與本機 Auth API 均回應 200；API 容器實際映射 54321，provider 為 published。

本機發布識別：b782d65f-e30f-463b-820b-ff23fbb28336。

## 仍待整理

本輪完成的是登記身分連結，沒有宣稱其餘 1,104 筆已全部完成外部來源查核。林庭秝及顏翎熹已連結議會現用姓名人物，但舊名歷史人物與現職標籤仍需後續對齊；本輪不把舊名人物逕行合併，也不製造當選或任職事件。

逐筆證據及校驗值見同名 JSON；原始資料保存在本機 tmp/cec-registration-identity-review-12。
