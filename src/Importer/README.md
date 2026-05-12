# PublicOfficialInterest.Importer

## 目的

讀取 `data-updates/YYYY-MM-DD/changes.json`，進行 dry-run 驗證，阻擋危險 action 與不安全欄位。

## 目前階段

第一階段 / 第二測試任務：
- 讀取 `changes.json`
- 驗證必要欄位
- 驗證允許 action
- 驗證 relation type 白名單
- 驗證統編基本格式
- 拒絕 `isPublic = true`
- 拒絕 `reviewStatus != pending`
- 輸出 dry-run 匯入資訊與 summary

## 使用方式

```bash
dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- data-updates/YYYY-MM-DD/changes.json
```

若未提供路徑，預設使用：

```text
../../samples/sample-changes.json
```

## 未來擴充

- JSON schema 驗證
- 匯入 staging tables
- import log
- secrets / risk 掃描
- CI dry-run 整合
