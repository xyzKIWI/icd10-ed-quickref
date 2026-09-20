#!/usr/bin/env python3
"""把資料、搜尋程式與圖片內嵌為單一離線 HTML。"""

from __future__ import annotations

import base64
import json
import re
from pathlib import Path
from typing import Mapping

from restore_build import restore_from_index


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "build" / "icd_data.json"
DESIGN = ROOT / "design"
FRONT = DESIGN / "chart_front_final.png"
BACK = DESIGN / "chart_back_final.png"


def ensure_inputs() -> None:
    if DATA.is_file() and FRONT.is_file() and BACK.is_file():
        return
    restore_from_index(
        index_path=ROOT / "index.html",
        data_path=DATA,
        design_dir=DESIGN,
        force=False,
    )


def image_data_url(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def javascript_safe_json(raw: str) -> str:
    """驗證 JSON，並避免資料提前結束 inline ``<script>``。"""

    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("icd_data.json 頂層必須是物件")
    return (
        raw.replace("<", "\\u003c")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def replace_markers(template: str, replacements: Mapping[str, str]) -> str:
    """只替換原模板 marker，不再次掃描已注入的資料或程式。"""

    for marker in replacements:
        if template.count(marker) != 1:
            raise ValueError(f"template.html 的 {marker} 數量不是 1")
    pattern = re.compile("|".join(re.escape(marker) for marker in replacements))
    return pattern.sub(lambda match: replacements[match.group(0)], template)


def main() -> None:
    ensure_inputs()
    data = javascript_safe_json(DATA.read_text(encoding="utf-8"))
    lexicon = (ROOT / "src" / "lexicon.js").read_text(encoding="utf-8")
    search_core = (ROOT / "src" / "search_core.js").read_text(encoding="utf-8")
    core = lexicon + "\n" + search_core
    template = (ROOT / "src" / "template.html").read_text(encoding="utf-8")

    replacements = {
        "/*DATA*/": data,
        "/*CORE*/": core,
        "/*FRONT_IMG*/": image_data_url(FRONT),
        "/*BACK_IMG*/": image_data_url(BACK),
    }
    output = replace_markers(template, replacements)

    destination = ROOT / "dist" / "icd_ed.html"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(output, encoding="utf-8")
    size_mib = destination.stat().st_size / 1024 / 1024
    print(f"輸出：{destination}（{size_mib:.2f} MiB）")


if __name__ == "__main__":
    main()
