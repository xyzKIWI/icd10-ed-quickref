# ICD-10 速查

輸入英文/中文診斷關鍵字 → 即時回傳 ICD-10-CM 代碼 + 官方繁中翻譯。單一 HTML 檔，純前端、可離線、零安裝。

## 🔗 線上版

**https://xyzkiwi.github.io/icd10-ed-quickref/**

手機可加到主畫面當 App。純前端運算，不蒐集任何輸入內容。⚠️ 僅供臨床查詢輔助，非官方編碼系統，最終以院內系統與專業判斷為準（詳見網頁底部免責聲明）。

## 怎麼用

- **線上**：開上面網址，手機可加到主畫面。
- **離線**：`dist/icd_ed.html`（＝ repo 根目錄 `index.html`，約 7 MB 單檔）寄給自己／丟 iCloud，點開即用，完全離線。

查詢範例：
- `contusion left forearm` → S50.12XA 左側前臂挫傷
- `lt radial fx` → 左橈骨骨折候選（縮寫、拼錯字都能命中）
- `GB stone` / `AGE` / `APN` → 縮寫展開後命中
- `abscess anus` → K61.0 肛門膿瘍（俗稱靠官方字母索引命中）
- `頭部撕裂傷` / `前臂挫傷` → 中文也能查
- `N20.1` / `N20` / `S50.12XA` → 代碼反查診斷
- 點整個框框即複製代碼；外傷碼可切換第 7 碼（初診 A／後續 D／後遺症 S／開放型等）
- 勾「高醫模式」→ 複製時去掉小數點（配合診間系統，N20.0→N200），偏好存本機
- ＋清單：把多個碼加進本次診斷籃，一鍵複製整段「碼＋中文」；最近使用會記住
- ✏️ 回報：臨床測到搜不準的字會記在本機，「複製全部回饋」貼回來給我據此調整
- 右上角切換明亮/暗黑；偏好存本機瀏覽器

### 外傷小人圖

前（Front）後（Back）人體圖同頁，點部位 → 自動帶出該部位的 ICD 碼段：

- 先選傷型（撕裂傷/挫傷/骨折/扭傷/擦傷/燒燙傷）和側別（自動/未指定/左/右/雙側），再點身體部位
- **側別標示**：Front 左 Rt 右 Lt；Back 為背面故相反（左 Lt 右 Rt）。點下去會依解剖正確的左右帶碼
- 點部位後用既有搜尋核心做「碼段白名單」硬過濾，查無不會 fallback 全域（防帶錯碼）
- 骨頭等內部構造（tibia/fibula、radius/ulna）用點選後的情境式細分按鈕處理
- 開始搜尋後小人圖自動收合以保留結果版面

## 設計重點

- **資料來源**：衛福部健保署官方「2023 中文版 ICD-10-CM」XLSX，**非機器翻譯**。
  ⚠️ 不要用 data.gov.tw 的 CSV（Big5 編碼瑕疵，6,956 列中文變半形 `?`）；用 NHI 官方 XLSX（乾淨，僅 8 個「瘻」字 build 時補 `?管→瘻管`）。
- **不自己組碼**：官方表已列出所有合法 billable 碼（含第 7 碼、X 補位），工具只做搜尋＋排序，保證代碼合法。
- **全章節收錄**：38,301 條目。S/T/V/W/X/Y 有第 7 碼者以「診斷主幹」分組、前端重組第 7 碼；其餘直接收。
- **分頁**：全部／外傷（S·T）／一般診斷。
- **typo/同義詞/縮寫全本機處理、不用 LLM**：選了離線單檔，LLM 會破壞離線/PHI/零安裝優勢。
  - 同義詞表（fx→fracture、stone→calculus、bite→bitten…）、縮寫表 ABBR（GB/UTI/COPD/AGE/APN…）、模糊比對（Levenshtein）、尾綴/連字號正規化
  - **官方字母索引**：CMS FY2023 Alphabetic Index（62k 臨床用詞→碼）烤進每個碼的 `ax`(別名) 欄；別名命中封頂 0.5 分、正式碼名 1.0 主導，俗稱也查得到
- **搜尋精準度**：
  - **IDF 字詞權重**（上限 5.5）：罕見字主導、acute/unspecified 等常用字幾乎不計分 → 濾掉「只命中常用字」的洪水
  - **臨床安全懲罰**（硬約束）：極性相反（traumatic↔nontraumatic、displaced↔nondisplaced）score−0.9；專一構造詞（tendon/nerve/artery 未打出）懲罰；未查左右時帶側性的碼降權；急診沒查 chronic 時慢性碼降權（acute 優先）
  - **PHRASE_CODE**：臨床慣用語直接置頂（nasal bleeding→R04.0、gum bleeding→K06.8…）
- **效能**：38k 條目單次查詢約 40 ms（indexOf 快篩 + 閘門化模糊比對）。
- **單檔內嵌**：資料、搜尋邏輯、兩張底圖（base64）全部內嵌進 HTML（file:// 下瀏覽器擋外部 JSON 的 CORS）。搜尋邏輯抽成 `search_core.js`，HTML 與測試共用同一份。

## 重新產生（pipeline）

固定順序，每一步驗證方式如下：

```bash
# ── 1. 資料層（每年碼表更新時才跑）────────────────────────
# 1a. 碼表 — NHI 官方 XLSX，工作表 'ICD-10-CM'
curl -sL "https://www.nhi.gov.tw/ch/dl-80147-c2be3cea667a4214802554bbca90bb49-1.xlsx" -o data/icd_nhi.xlsx
python3 src/build_data.py      # XLSX → build/icd_data.json（38,301 條目 + COMMON_BOOST 排序加權）

# 1b. 字母索引（同義詞來源）— CMS FY2023，就地把別名烤進 icd_data.json 的 ax 欄
curl -sL "https://www.cms.gov/files/zip/2023-code-tables-tabular-and-index.zip" -o data/index_src/got.zip
cd data/index_src && unzip got.zip && cd ../..
python3 src/build_index.py     # icd10cm_index_2023.xml → 別名寫入 icd_data.json

# ── 2. 小人圖層（只在調整熱區/換底圖時跑）──────────────────
#   底圖：design/chart_{front,back}_final.png（乾淨無標籤，前後對稱）
#   ⚠️ 背面圖左肩線稿曾破損 → 用「鏡像乾淨右半」做成對稱底圖（見 figure_versions/chart_back_PREmirror.png）
python3 src/manual_zones.py    # 方框 ∩ silhouette → approxPolyDP 多邊形 → design/zones_{front,back}.json
                               # 同時輸出 design/_manual_{front,back}.png 除錯疊圖（顏色塊＝熱區，肉眼校準）
python3 src/build_figure.py    # zones json → 寫進 template.html 的兩個 SVG
                               # 側別映射：front R→right、back R→left（背面解剖反轉）；標題自動帶左右

# ── 3. 組裝 ──────────────────────────────────────────────
python3 src/build_html.py      # 注入 icd_data.json + search_core.js + 兩張底圖 base64 → dist/icd_ed.html

# ── 4. 測試 ──────────────────────────────────────────────
node src/test_search.js        # 78 案例 + 極性/側別/手指/prefix 守門，應全過

# ── 5. 上線（GitHub Pages）────────────────────────────────
cp dist/icd_ed.html index.html
git add -A && git commit -m "update" && git push   # 1-2 分鐘後線上自動更新
#   ⚠️ push 若 401：gh auth setup-git 重設認證後再 push
```

**驗證小人圖熱區**：把所有 `.zone` 強制顯色截圖比對（不是用想的）——

```bash
python3 - <<'PY'
html=open('dist/icd_ed.html',encoding='utf-8').read()
inj='<style>.zone{opacity:.5!important;fill:#2563eb!important;stroke:#1e3a8a!important;stroke-width:2!important}</style>'
open('/tmp/dbg.html','w',encoding='utf-8').write(html.replace('</head>',inj+'</head>'))
PY
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --force-device-scale-factor=2 --window-size=760,950 --virtual-time-budget=1800 \
  --screenshot=/tmp/dbg.png "file:///tmp/dbg.html"
```

## 部署架構

- repo：`xyzKIWI/icd10-ed-quickref`（public）
- GitHub Pages：`main` 分支根目錄 `index.html` → 自動發佈
- repo 只含 `index.html` + `src/` + `design/`（含底圖與 zones）+ README；大型原始資料（XLSX/zip/CSV）與記憶檔（AGENTS.md/CLAUDE.md）走 `.gitignore`

## 檔案結構

```
data/    官方原始資料（XLSX、字母索引、損毀 CSV 備份）── .gitignore，不進版控
src/
  build_data.py     XLSX → build/icd_data.json（碼表 + 排序加權）
  build_index.py    CMS 字母索引別名 → 烤進 icd_data.json（ax 欄）
  search_core.js    搜尋邏輯（norm/IDF/懲罰/PHRASE_CODE）── HTML 與測試共用同一份
  manual_zones.py   小人圖熱區：方框 ∩ silhouette → 多邊形 json
  build_figure.py   zones json → 寫進 template.html 的 SVG（側別映射）
  template.html     UI（CSS + SVG 小人圖 + JS）
  build_html.py     注入資料 + 邏輯 + 底圖 base64 → dist/icd_ed.html
  test_search.js    78 案例 + 守門函式
design/
  chart_{front,back}_final.png   小人圖乾淨底圖（內嵌進成品）
  zones_{front,back}.json        熱區多邊形座標
  figure_versions/               每版小人圖備份
build/   icd_data.json（中間產物）
dist/    icd_ed.html ← 最終成品，這個就是工具本體
```

## 已知範圍與未來可擴充

- 全章節 billable ICD-10-CM 皆收錄；`COMMON_BOOST` 只影響急診常見診斷的排序。
- 小人圖：負責快速選外表部位；內部骨頭/關節用點選後的情境式細分按鈕處理（已做小腿 tibia/fibula，可續補 forearm/elbow 的 radius/ulna）。
- 回饋循環：✏️ 累積臨床測到搜不準的字 → 據此補 PHRASE_CODE/同義詞/排序。
- 未來選配：貼整段 note 自動抽診斷的「線上 LLM 模式」（需網路 + 注意 PHI），MVP 刻意不做。
