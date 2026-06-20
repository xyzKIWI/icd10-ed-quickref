#!/usr/bin/env python3
"""用官方 ICD-10-CM Alphabetic Index 的臨床用詞，增強碼表條目的「別名」。
做法：解析 index XML →（用詞路徑, 碼）→ 對應到 build/icd_data.json 的碼條目 →
把用詞加進該條目的 ax（alias）欄。搜尋層只需多比對 ax，不必在執行期搜 6 萬筆索引。
就地改寫 build/icd_data.json（新增每條目的 ax 欄）。
"""
import xml.etree.ElementTree as ET
import re, json
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "index_src" / "icd10cm_index_2023.xml"
DATA = ROOT / "build" / "icd_data.json"
STOP = {"with","without","and","of","the","to","in","on","or","due","other","unspecified",
        "see","also","not","elsewhere","classified","as","by","for"}

def title_text(node):
    el = node.find("title")
    if el is None: return ""
    txt = re.sub(r"\([^)]*\)", "", "".join(el.itertext()))
    return re.sub(r"\s+", " ", txt).strip()

def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    # 碼(去點) → 該條目 index 清單；同時準備 prefix 解析
    code2idx = defaultdict(list)
    for i, e in enumerate(data["entries"]):
        code2idx[e["c"].replace(".", "")].append(i)
    sorted_keys = sorted(code2idx.keys())

    def resolve(codeN):
        """index 碼(去點去尾-) → 對應碼表條目 index 清單。先精準，再前綴。"""
        if codeN in code2idx:
            return code2idx[codeN]
        # 前綴：index 碼較短（如 S0141 → S01411/S01412）
        import bisect
        lo = bisect.bisect_left(sorted_keys, codeN)
        out = []
        for k in sorted_keys[lo:lo+40]:
            if not k.startswith(codeN): break
            out.extend(code2idx[k])
        return out

    # 收集每條目的別名詞集合
    alias = defaultdict(set)
    root = ET.parse(SRC).getroot()
    leaf_count = 0

    def walk(node, path):
        nonlocal leaf_count
        t = title_text(node)
        newpath = path + [t] if t else path
        code = node.find("code")
        if code is not None and code.text:
            leaf_count += 1
            codeN = re.sub(r"[.\-]", "", code.text.strip()).upper()
            targets = resolve(codeN)
            if targets:
                words = set()
                for seg in newpath:
                    for w in re.split(r"[ ,/]+", seg.lower()):
                        w = w.strip("'")
                        if len(w) >= 2 and w not in STOP:
                            words.add(w)
                for ti in targets:
                    alias[ti] |= words
        for term in node.findall("term"):
            walk(term, newpath)

    for letter in root.findall("letter"):
        for mt in letter.findall("mainTerm"):
            walk(mt, [])

    # 寫回：ax = 別名詞（排除已在英文名稱出現的詞，省空間）
    enriched = 0
    for i, e in enumerate(data["entries"]):
        if i not in alias:
            continue
        en_words = set(re.split(r"[^a-z0-9]+", e["en"].lower()))
        extra = sorted(w for w in alias[i] if w not in en_words)
        if extra:
            e["ax"] = " ".join(extra)
            enriched += 1

    DATA.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"index 葉節點: {leaf_count}  增強條目數: {enriched}/{len(data['entries'])}")
    print(f"檔案: {DATA}  ({DATA.stat().st_size/1024/1024:.2f} MB)")
    # 抽驗
    for e in data["entries"]:
        if e["c"] in ("K61.0", "S01.411", "S52.531"):
            print(f"  {e['c']} {e['zh']} | ax={e.get('ax','(無)')[:60]}")

if __name__ == "__main__":
    main()
