#!/usr/bin/env python3
"""把 icd_data.json 內嵌進 template.html，輸出單一可離線檔 dist/icd_ed.html"""
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
data = (ROOT/"build"/"icd_data.json").read_text(encoding="utf-8")
core = (ROOT/"src"/"search_core.js").read_text(encoding="utf-8")
tpl = (ROOT/"src"/"template.html").read_text(encoding="utf-8")
out = tpl.replace("/*DATA*/", data).replace("/*CORE*/", core)
dist = ROOT/"dist"; dist.mkdir(exist_ok=True)
f = dist/"icd_ed.html"
f.write_text(out, encoding="utf-8")
print(f"輸出: {f}  ({len(out.encode('utf-8'))/1024/1024:.2f} MB)")
