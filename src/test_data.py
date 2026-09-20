#!/usr/bin/env python3
"""ICD 資料成品的離線回歸檢查。"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA = ROOT / "build" / "icd_data.json"
MINIMUM_SOURCE_UPDATE = date(2026, 8, 27)
ENCOUNTER_SUFFIX = re.compile(r"之?(?:初期照護|後續照護|後遺症)[。．.]?\s*$")
S7_ORDER = "ABCDEFGHJKMNPQRS"
CODE_PATTERN = re.compile(r"^[A-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$")
EXPECTED_2023_BILLABLE_COUNT = 73_681
EXPECTED_2023_CODE_SET_SHA256 = (
    "a4c9652a610aeaef37ea917d7de12f4f9ad55c3b2bb7b1631cd4376dfc6abd65"
)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def expand_billable_codes(entries: list[dict[str, object]]) -> list[str]:
    codes: list[str] = []
    for entry in entries:
        stem = str(entry.get("c", ""))
        seventh = str(entry.get("s7", ""))
        if not seventh:
            codes.append(stem)
            continue
        compact = stem.replace(".", "")
        require(len(compact) <= 6, f"第七碼主幹過長：{stem}")
        compact = compact.ljust(6, "X")
        codes.extend(
            compact[:3] + "." + compact[3:] + encounter for encounter in seventh
        )
    return codes


def check_inline_build_safety() -> None:
    from build_html import javascript_safe_json, replace_markers

    raw = '{"value":"</script>/*CORE*/\u2028\u2029"}'
    safe = javascript_safe_json(raw)
    require("<" not in safe, "inline JSON 仍可形成 </script> 邊界")
    require("\\u2028" in safe and "\\u2029" in safe, "JS line separator 未跳脫")
    require(json.loads(safe) == json.loads(raw), "JS-safe 跳脫改變 JSON 資料")

    template = "D/*DATA*/C/*CORE*/F/*FRONT_IMG*/B/*BACK_IMG*/"
    output = replace_markers(
        template,
        {
            "/*DATA*/": safe,
            "/*CORE*/": "CORE_VALUE",
            "/*FRONT_IMG*/": "FRONT_VALUE",
            "/*BACK_IMG*/": "BACK_VALUE",
        },
    )
    require(output.count("CORE_VALUE") == 1, "模板 CORE marker 替換異常")
    require(
        "/*CORE*/" in output,
        "注入資料中的 marker 被後續替換，形成跨 placeholder 污染",
    )


def check(path: Path) -> None:
    check_inline_build_safety()
    data = json.loads(path.read_text(encoding="utf-8"))
    entries = data.get("entries")
    metadata = data.get("metadata")
    require(isinstance(entries, list), "entries 必須是陣列")
    require(isinstance(metadata, dict), "缺少資料來源 metadata")
    require(len(entries) == 38_301, f"條目數異常：{len(entries)}")

    by_code = {entry.get("c"): entry for entry in entries}
    require(len(by_code) == len(entries), "代碼重複")
    require(metadata.get("entryCount") == len(entries), "metadata.entryCount 不一致")
    require(metadata.get("sourceFormat") == "xlsx", "正式資料來源必須是 XLSX")
    require(
        date.fromisoformat(str(metadata.get("sourceUpdated"))) >= MINIMUM_SOURCE_UPDATE,
        "資料來源日期早於 2026-08-27",
    )

    expanded_codes = expand_billable_codes(entries)
    require(
        len(expanded_codes) == EXPECTED_2023_BILLABLE_COUNT,
        f"完整 billable 碼數異常：{len(expanded_codes)}",
    )
    require(
        len(set(expanded_codes)) == len(expanded_codes),
        "展開後的完整 billable 碼有重複",
    )
    invalid_codes = [code for code in expanded_codes if not CODE_PATTERN.fullmatch(code)]
    require(not invalid_codes, f"完整碼格式異常：{invalid_codes[:10]}")
    code_set_sha256 = hashlib.sha256(
        "\n".join(sorted(expanded_codes)).encode("utf-8")
    ).hexdigest()
    require(
        code_set_sha256 == EXPECTED_2023_CODE_SET_SHA256,
        "2023 billable 全集與既有基準不同；若官方代碼有異動，須先查明並更新基準",
    )
    require(
        metadata.get("billableCodeCount") == len(expanded_codes),
        "metadata.billableCodeCount 不一致",
    )
    require(
        metadata.get("billableCodeSetSha256") == code_set_sha256,
        "metadata.billableCodeSetSha256 不一致",
    )

    expected_radial = {
        "G56.30": "未明示側性橈神經病灶",
        "G56.31": "右側橈神經病灶",
        "G56.32": "左側橈神經病灶",
        "G56.33": "雙側上肢橈神經病灶",
    }
    for code, expected in expected_radial.items():
        require(by_code.get(code, {}).get("zh") == expected, f"{code} 仍是過時中譯")
    for code in ("M80.0AXS", "M97.8XXS"):
        require(
            str(by_code.get(code, {}).get("zh", "")).endswith("後遺症"),
            f"{code} 應修正為後遺症",
        )

    lossy = [
        entry["c"]
        for entry in entries
        if "?" in str(entry.get("zh", "")) or "\ufffd" in str(entry.get("zh", ""))
    ]
    require(not lossy, f"中譯含有損字元：{lossy[:10]}")
    require(str(by_code["K11.4"]["zh"]).endswith("瘻管"), "K11.4 中譯被 ? 降級")

    grouped_residue = [
        entry["c"]
        for entry in entries
        if entry.get("s7") and ENCOUNTER_SUFFIX.search(str(entry.get("zh", "")))
    ]
    require(not grouped_residue, f"第七碼分組仍殘留照護階段：{grouped_residue}")

    order = {char: index for index, char in enumerate(S7_ORDER)}
    bad_s7 = []
    for entry in entries:
        value = str(entry.get("s7", ""))
        if any(char not in order for char in value) or value != "".join(
            sorted(set(value), key=order.get)
        ):
            bad_s7.append(entry["c"])
    require(not bad_s7, f"第七碼集合或順序異常：{bad_s7[:10]}")

    alias_count = sum(bool(entry.get("ax")) for entry in entries)
    require(alias_count >= 26_000, f"ax 搜尋別名大量遺失：{alias_count}")
    require(
        metadata.get("alphabeticIndexAliasCount") == alias_count,
        "metadata 的 ax 數量不一致",
    )
    print(
        f"資料測試通過：{len(entries)} 搜尋條目、{len(expanded_codes)} 完整碼、"
        f"ax {alias_count} 筆、"
        f"來源 {metadata['sourceUpdated']}"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data", nargs="?", type=Path, default=DEFAULT_DATA)
    return parser.parse_args()


if __name__ == "__main__":
    check(parse_args().data)
