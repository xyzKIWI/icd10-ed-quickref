# 急診 ICD-10 速查

輸入英文/中文診斷關鍵字 → 即時回傳 ICD-10-CM 代碼 + 官方繁中翻譯。單一 HTML 檔，純前端、可離線。

## 🔗 線上版（測試中）

**https://xyzkiwi.github.io/icd10-ed-quickref/**

手機加入主畫面就像 App。純前端運算，不蒐集任何輸入內容。⚠️ 僅供臨床查詢輔助，非官方編碼系統，最終以院內系統與專業判斷為準（詳見網頁底部免責聲明）。

## 怎麼用

- **線上**：開上面網址，手機可加到主畫面。
- **離線**：`dist/icd_ed.html`（或 repo 根目錄 `index.html`）寄給自己 / 丟 iCloud，點開即用，完全離線。

查詢範例：
- `contusion left forearm` → S50.12XA 左側前臂挫傷
- `lt radial fx` → 左橈骨骨折候選（縮寫、拼錯字都能命中）
- `abscess anus` → K61.0 肛門膿瘍（俗稱靠官方字母索引命中）
- `頭部撕裂傷` / `前臂挫傷` → 中文也能查
- `N20.1` / `N20` → 代碼反查診斷
- 點整個框框即複製代碼；外傷碼可切換第 7 碼（初診 A / 後續 D / 後遺症 S / 開放型等）
- 勾「高醫模式」→ 複製時去掉小數點（配合診間系統）
- 右上角可切換明亮/暗黑模式，偏好會存在本機瀏覽器。
- 外傷小人圖可選外傷類型、側別與前/後部位，快速組出查詢字串；開始搜尋後會自動收合以保留結果版面。小腿骨折會再提供 tibia/fibula 細分。

## 設計重點

- **資料來源**：衛福部健保署官方「2023 年版中文版 ICD-10-CM」（data.gov.tw dataset 177507），非機器翻譯。
- **不自己組碼**：官方表已列出所有合法碼（含第 7 碼、X 補位），工具只做搜尋+排序，保證代碼合法。
- **全章節收錄**：所有 billable 碼共 38,301 條目。S/T/V/W/X/Y（外傷+外因）有第 7 碼者以「診斷主幹」分組（前端重組第 7 碼）；其餘章節直接收。
- **分類分頁**：全部 / 外傷 S·T / 外因 V·Y（貓狗咬、車禍、跌倒…）/ 一般診斷。
- **外傷小人圖**：前後人體圖同頁顯示，點部位後沿用既有搜尋核心，不另維護一套 ICD mapping；骨頭等內部構造用情境式細分按鈕處理。
- **明亮/暗黑模式**：預設明亮，保留暗黑切換並用 `localStorage` 記住偏好。
- **typo/同義詞/縮寫**：本機處理（同義詞 fx→fracture、bite→bitten、縮寫 UTI/COPD/MI 展開 + 模糊比對），不需 LLM、不需網路。常見急診診斷有排序加權。
- **效能**：38k 條目單次查詢約 40 ms（indexOf 快篩 + 閘門化模糊比對；依機器而異）。

## 重新產生（資料更新時）

⚠️ 資料源：**用 NHI 官方 XLSX，不要用 data.gov 的 CSV**（CSV 有 Big5 編碼瑕疵，6956 列中文變 `?`）。

```bash
# 1a. 碼表（每年更新時）— NHI 官方 XLSX，工作表 'ICD-10-CM'
curl -sL "https://www.nhi.gov.tw/ch/dl-80147-c2be3cea667a4214802554bbca90bb49-1.xlsx" -o data/icd_nhi.xlsx
#     轉乾淨 CSV（含 ?管→瘻管 修補）見 git 紀錄的轉檔片段

# 1b. 字母索引（同義詞來源）— CMS FY2023
curl -sL "https://www.cms.gov/files/zip/2023-code-tables-tabular-and-index.zip" -o data/index_src/got.zip
cd data/index_src && unzip got.zip && cd ../..

# 2. 重建（順序固定）
python3 src/build_data.py     # XLSX-CSV → build/icd_data.json（碼表）
python3 src/build_index.py    # 字母索引別名烤進 icd_data.json（ax 欄）
python3 src/build_html.py     # 注入 search_core + 資料 → dist/icd_ed.html

# 3. 測試
node src/test_search.js       # 44 案例 + 極性/側別/手指傷守門應全過

# 4. 更新線上版（GitHub Pages）
cp dist/icd_ed.html index.html
git add -A && git commit -m "update" && git push   # 1-2 分鐘後線上自動更新
```

## 部署架構

- repo：`xyzKIWI/icd10-ed-quickref`（public）
- GitHub Pages：`main` 分支根目錄 `index.html` → 自動發佈
- repo 只含 `index.html` + `src/` 腳本 + README；大型原始資料（XLSX/zip/CSV）走 `.gitignore`，不進版控

## 檔案結構

```
data/   官方原始 CSV
src/    build_data.py（資料）  search_core.js（搜尋邏輯，HTML 與測試共用）
        template.html（UI）     build_html.py（注入）  test_search.js（驗證）
build/  icd_data.json（中間產物）
dist/   icd_ed.html ← 最終成品，這個就是工具本體
```

## 已知範圍與未來可擴充

- 目前：全章節 billable ICD-10-CM 代碼皆收錄；`build_data.py` 的 `COMMON_BOOST` 只影響急診常見診斷的排序加權。
- 外傷小人圖目前是初版：負責快速選外表部位；tibia/fibula、radius/ulna 這類內部骨頭或關節細節，應用點選後的情境式細分按鈕處理。已先做小腿骨折 tibia/fibula，下一步可補 forearm/elbow fracture 的 radius/ulna 細分，並美化小人圖。
- 未來選配：若要貼整段 note 自動抽診斷，再加「線上 LLM 模式」（會需網路+注意 PHI），MVP 刻意不做。
