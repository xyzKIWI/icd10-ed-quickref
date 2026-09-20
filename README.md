# ICD-10-CM 急診快速查詢

單檔、可離線使用的臺灣 2023 年版 ICD-10-CM 中英診斷碼搜尋工具。正式頁面：
[https://tools.kiwi-ai.uk/icd10/](https://tools.kiwi-ai.uk/icd10/)

本工具是查詢輔助，不是最終診斷、申報或編碼判定。送出前仍須由臨床人員依病歷，核對官方 Alphabetic Index、Tabular List、Includes、Excludes、Code first／Use additional code、側別與第七碼照護階段。

本站依使用者慣例將 **PN** 對應 **pneumonia（肺炎）**，可直接查詢；**PNA** 保留為相容別名。這是本站的縮寫約定，不代表所有醫療情境通用；否定或疑似診斷仍會被防呆規則排除。

## 資料版本與官方來源

- 代碼／中譯：健保署「2023年版_中文版 ICD-10-CM/PCS（正式版）」XLSX，工作表 `ICD-10-CM`。
- 目前資料更新日：民國 115 年 8 月 27 日（2026-08-27）。
- 臺灣健保門、住診申報自民國 114 年 1 月 1 日起採用 2023 年版。
- 英文 Alphabetic Index 搜尋別名 `ax`：CMS 2023 ICD-10-CM Index；重新匯入中譯時會按代碼保留，不會靜默丟失。

官方連結：

- [健保署 ICD-10 現行版本](https://www.nhi.gov.tw/ch/np-3733-1.html)
- [健保署 2023 年版正式檔下載頁](https://www.nhi.gov.tw/ch/lp-3847-1.html)
- [健保署正式 XLSX](https://www.nhi.gov.tw/ch/dl-80147-c2be3cea667a4214802554bbca90bb49-1.xlsx)
- [健保署 2023 年版編碼指引](https://www.nhi.gov.tw/ch/lp-3843-1.html)
- [CMS 2023 Code Tables, Tabular and Index ZIP](https://www.cms.gov/files/zip/2023-code-tables-tabular-and-index.zip)

`build_data.py` 刻意只接受 XLSX，不匯入資料開放平臺的 CSV，以免轉碼後的 `?` 或亂碼污染中譯。115.08.27 官方 XLSX 本身有 8 個中譯儲存格含字面 `?`；建置時會保留已版控單檔內同碼的既有可信中譯，並把代碼記錄在 `metadata.translationFallbacks`。若找不到可信值，建置會直接失敗。

## 乾淨 clone：不下載即可測試

需求：Python 3.10 以上與 Node.js。無需額外 Python 套件。

```powershell
python src/restore_build.py
python src/test_data.py
node src/test_search.js
node src/test_safety.js
node --test src/test_ui.js
python src/build_html.py
```

`restore_build.py` 從已版控的 `index.html` 還原內嵌 `build/icd_data.json` 與缺少的兩張 PNG。預設只補缺檔、不覆寫現有資料；只有明確需要重置建置輸入時才使用 `--force`。

`build_html.py` 若發現建置輸入缺少，也會先執行同樣的非覆寫還原。輸出為 `dist/icd_ed.html`，不會自行覆寫已版控的 `index.html`。

## 以最新官方 XLSX 重建資料

```powershell
New-Item -ItemType Directory -Force data | Out-Null
curl.exe -L --fail "https://www.nhi.gov.tw/ch/dl-80147-c2be3cea667a4214802554bbca90bb49-1.xlsx" -o "data/icd10cm_2023_zh_1150827.xlsx"

# 先確保有既有 ax 與可信中譯可保留
python src/restore_build.py
python src/build_data.py --input data/icd10cm_2023_zh_1150827.xlsx
python src/test_data.py
node src/test_search.js
node src/test_safety.js
node --test src/test_ui.js
python src/build_html.py
```

建置器會從 XLSX 的「更新歷程」讀出來源日期、驗證列數與欄位、計算來源 SHA-256，並把資料日期、來源 URL、筆數、保留的 `ax` 數量及中譯回退清單寫入 JSON metadata。輸出採暫存檔後原子替換，驗證失敗不會產出半套資料。

只想驗證官方檔而不寫入：

```powershell
python src/build_data.py --input data/icd10cm_2023_zh_1150827.xlsx --check
```

如要重新產生 CMS Alphabetic Index 別名，先將官方 ZIP 中的 `icd10cm_index_2023.xml` 放到 `data/index_src/`，再執行：

```powershell
python src/build_index.py
python src/test_data.py
```

## 資料與搜尋回歸重點

`python src/test_data.py [JSON路徑]` 會檢查：

- 38,301 個搜尋條目展開後須為 73,681 個完整 billable 碼，且不得重複。
- 完整碼格式與 2023 全集 SHA-256 基準，以及 2026-08-27 來源日期。
- 115.08.27 修正的 6 筆實際輸出中譯：`G56.30`–`G56.33`、`M80.0AXS`、`M97.8XXS`。
- 第七碼分組後不得殘留「初期照護／後續照護／後遺症」字樣。
- 中譯不得含 `?` 或 Unicode replacement character。
- `ax` 不得大量遺失，metadata 計數須與實際資料一致。

## 臨床與隱私護欄

- 未明示照護階段時，不自動假設或補上第七碼 `A`；由使用者確認初期、後續或後遺症。
- 多部位、側別與骨折快捷結果必須逐項確認，不把一個推論套用到所有項目。
- 回饋內容只在目前頁面形成草稿；手動開啟 Google 表單，不把搜尋 query 或診斷內容附加到網址。
- 不要在程式碼、Issue、測試資料、網址或回饋中放入姓名、病歷號、身分證字號、生日等可識別病人資訊。
- 搜尋不到或結果相近時，回到官方 Index 與 Tabular List 核對；不要以模糊比對分數取代編碼規則。

## 主要檔案

- `index.html`：已版控、可部署的單檔網站，也是乾淨 clone 的還原來源。
- `src/build_data.py`：官方 XLSX → 精簡 JSON，保留 `ax` 並阻擋有損中譯。
- `src/restore_build.py`：由 `index.html` 還原忽略版控的建置輸入。
- `src/test_data.py`：資料版本、內容與別名回歸檢查。
- `src/search_core.js`、`src/lexicon.js`：搜尋、正規化與同義詞邏輯。
- `src/template.html`：單檔頁面模板。
- `src/build_html.py`：內嵌資料、程式與圖片，輸出 `dist/icd_ed.html`。

`data/`、`build/`、`dist/` 均為忽略版控的衍生資料；正式可重現基準是已版控的來源程式與 `index.html`。
