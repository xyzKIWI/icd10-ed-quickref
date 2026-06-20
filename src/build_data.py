#!/usr/bin/env python3
"""把官方 ICD-10-CM 中文版 CSV 轉成工具用的精簡 JSON（全章節）。
- 收錄所有 billable 碼 (USE=1)。
- S/T/V/W/X/Y（外傷+外因，第 19/20 章）有第 7 碼，去碼分組成「診斷主幹 stem」，第 7 碼在前端重組。
- 其他章節（一般內外科診斷）直接收，不分組。
輸出 build/icd_data.json
"""
import csv, re
from pathlib import Path
from collections import OrderedDict

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "icd10cm_2023_zh_raw"
OUT = ROOT / "build" / "icd_data.json"

SEVENTH = {
    "A": "初期照護", "B": "初期照護(開放I/II型)", "C": "初期照護(開放IIIA-C型)",
    "D": "後續照護", "E": "後續(開放I/II)", "F": "後續(開放IIIA-C)",
    "G": "後續-延遲癒合", "H": "後續-延遲癒合(開放I/II)", "J": "後續-延遲癒合(開放IIIA-C)",
    "K": "後續-未癒合", "M": "後續-未癒合(開放I/II)", "N": "後續-未癒合(開放IIIA-C)",
    "P": "後續-畸形癒合", "Q": "後續-畸形癒合(開放I/II)", "R": "後續-畸形癒合(開放IIIA-C)",
    "S": "後遺症",
}
SEV_LETTERS = set("ABCDEFGHJKMNPQRS")
SEVENTH_CHAPS = set("STVWXY")  # 這些章節第 7 碼=就診類別，可分組

# 急診常見診斷 → 排序加權（不排除任何碼，只是讓常用的浮上來）
COMMON_BOOST = {
    "R07.9","R07.89","R10.9","R10.84","R10.0","R51.9","R42","R55","R06.02","R50.9",
    "R11.2","R11.10","R41.82","R40.4","R53.1","R56.9","R57.0","R57.1","R65.20","R65.21",
    "I10","I20.9","I21.9","I48.91","I50.9","I26.99","J18.0","J18.9","J20.9","J44.1","J45.901",
    "J96.01","J81.0","K35.80","K75.0","K80.20","K85.90","K92.2","K59.00","N39.0","N20.0",
    "N17.9","E11.65","E11.10","E86.0","E87.6","A41.9","A09","K52.9","B34.9","U07.1","L03.90",
    "H11.30","R51.9","R11.10","M54.50","I47.1","N10","K92.2",
    "L03.115","L03.116","G43.909","F41.9","T78.40XA","W55.01XA",
}

def nodot(code): return code.replace(".", "")

def chapter_of(code):
    c0 = code[0]
    if c0 in "ST": return "inj"
    if c0 in "VWXY": return "ext"
    return "dx"

def stem_of(code):
    raw = nodot(code)[:6].rstrip("X")
    return raw[:3] + "." + raw[3:] if len(raw) > 3 else raw

def build(rows):
    by_code = {r[0]: r for r in rows}
    entries = OrderedDict()  # key=stem(或碼)
    for r in rows:
        code, use, en, zh = r[0], r[1], r[2], r[3]
        if use != "1" or not code:
            continue
        nd = nodot(code)
        groupable = code[0] in SEVENTH_CHAPS and len(nd) >= 7 and nd[6] in SEV_LETTERS
        if groupable:
            key = stem_of(code)
            seventh = nd[6]
            if key not in entries:
                p = by_code.get(key)
                entries[key] = {
                    "c": key,
                    "en": p[2] if p else re.sub(r",?\s*(initial|subsequent|sequela).*$", "", en, flags=re.I),
                    "zh": p[3] if p else zh,
                    "s7": "", "k": chapter_of(code),
                }
            if seventh not in entries[key]["s7"]:
                entries[key]["s7"] += seventh
        else:
            if code not in entries:
                entries[code] = {"c": code, "en": en, "zh": zh, "s7": "", "k": chapter_of(code)}
    # 第 7 碼排序 + 標記常見
    order = {ch: i for i, ch in enumerate("ABCDEFGHJKMNPQRS")}
    out = []
    for e in entries.values():
        if e["s7"]:
            e["s7"] = "".join(sorted(e["s7"], key=lambda c: order.get(c, 99)))
        if e["c"] in COMMON_BOOST:
            e["b"] = 1
        out.append(e)
    return out

def main():
    rows = [r for r in csv.reader(open(RAW, encoding="utf-8-sig")) if len(r) >= 4 and r[0]][1:]
    entries = build(rows)
    from collections import Counter
    kc = Counter(e["k"] for e in entries)
    data = {"version": "2023 ICD-10-CM 中文版 (衛福部/健保署官方)", "seventh": SEVENTH, "entries": entries}
    OUT.write_text(__import__("json").dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size = OUT.stat().st_size
    print(f"總條目: {len(entries)}  分類: {dict(kc)}")
    print(f"輸出: {OUT}  ({size/1024/1024:.2f} MB)")
    for e in entries:
        if e["c"] in ("S50.12", "W55.01", "R65.21", "K75.0"):
            print(f"  {e['c']}: {e['zh']} | s7={e['s7']} | {e['en'][:40]}")

if __name__ == "__main__":
    main()
