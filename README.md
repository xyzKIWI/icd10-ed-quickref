# 急診 ICD-10 外傷速查

輸入英文/中文診斷關鍵字 → 即時回傳 ICD-10-CM 代碼 + 官方繁中翻譯。離線單一 HTML 檔，手機/電腦雙擊即用。

## 怎麼用

**最簡單**：把 `dist/icd_ed.html` 寄給自己或丟到 iCloud，手機/電腦點開就能用。完全離線、不連網、不送任何資料出去。

查詢範例：
- `contusion left forearm` → S50.12XA 左側前臂挫傷
- `lt radial fx` → 左橈骨骨折候選清單（縮寫、拼錯字都能命中）
- `頭部撕裂傷` / `前臂挫傷` → 中文也能查
- 點代碼可複製；外傷碼可切換第 7 碼（初診 A / 後續 D / 後遺症 S / 開放型等）

## 設計重點

- **資料來源**：衛福部健保署官方「2023 年版中文版 ICD-10-CM」（data.gov.tw dataset 177507），非機器翻譯。
- **不自己組碼**：官方表已列出所有合法碼（含第 7 碼、X 補位），工具只做搜尋+排序，保證代碼合法。
- **全章節收錄**：所有 billable 碼共 38,301 條目。S/T/V/W/X/Y（外傷+外因）有第 7 碼者以「診斷主幹」分組（前端重組第 7 碼）；其餘章節直接收。
- **分類分頁**：全部 / 外傷 S·T / 外因 V·Y（貓狗咬、車禍、跌倒…）/ 一般診斷。
- **typo/同義詞/縮寫**：本機處理（同義詞 fx→fracture、bite→bitten、縮寫 UTI/COPD/MI 展開 + 模糊比對），不需 LLM、不需網路。常見急診診斷有排序加權。
- **效能**：38k 條目單次查詢約 27 ms（indexOf 快篩 + 閘門化模糊比對）。

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
node src/test_search.js       # 36 案例 + 極性守門應全過
```

## 檔案結構

```
data/   官方原始 CSV
src/    build_data.py（資料）  search_core.js（搜尋邏輯，HTML 與測試共用）
        template.html（UI）     build_html.py（注入）  test_search.js（驗證）
build/  icd_data.json（中間產物）
dist/   icd_ed.html ← 最終成品，這個就是工具本體
```

## 已知範圍與未來可擴充

- 目前：外傷全收 + 常見急診 80 筆。要加更多非外傷診斷 → 編輯 `build_data.py` 的 `COMMON_ED_CODES`。
- 未來選配：若要貼整段 note 自動抽診斷，再加「線上 LLM 模式」（會需網路+注意 PHI），MVP 刻意不做。
