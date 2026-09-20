#!/usr/bin/env python3
"""從健保署官方 XLSX 建置網站使用的 ICD-10-CM JSON。

資料只取 ``ICD-10-CM`` 工作表；不讀政府資料開放平臺的 CSV，避免 CSV
轉碼造成中文遺失。S/T/V/W/X/Y 章節的第七碼會合併為診斷主幹，交由前端
依使用者選擇的 encounter 重新組合。

既有 ``ax``（CMS Alphabetic Index 搜尋別名）會按代碼保留。官方 115.08.27
XLSX 中少數中文儲存格含字面 ``?``；遇到這類有損文字時，僅可沿用既有、
不含亂碼的同碼中譯，否則中止建置，絕不把有損文字寫入成品。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import posixpath
import re
from collections import Counter, OrderedDict
from datetime import date
from pathlib import Path
from typing import Iterable, Iterator, Sequence
from xml.etree import ElementTree as ET
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT / "data" / "icd10cm_2023_zh_1150827.xlsx"
DEFAULT_OUTPUT = ROOT / "build" / "icd_data.json"
DEFAULT_INDEX = ROOT / "index.html"

SOURCE_PAGE = "https://www.nhi.gov.tw/ch/lp-3847-1.html"
SOURCE_FILE_URL = (
    "https://www.nhi.gov.tw/ch/"
    "dl-80147-c2be3cea667a4214802554bbca90bb49-1.xlsx"
)
EFFECTIVE_FROM = "2025-01-01"
MINIMUM_SOURCE_UPDATE = date(2026, 8, 27)

SEVENTH = {
    "A": "初期照護",
    "B": "初期照護(開放I/II型)",
    "C": "初期照護(開放IIIA-C型)",
    "D": "後續照護",
    "E": "後續(開放I/II)",
    "F": "後續(開放IIIA-C)",
    "G": "後續-延遲癒合",
    "H": "後續-延遲癒合(開放I/II)",
    "J": "後續-延遲癒合(開放IIIA-C)",
    "K": "後續-未癒合",
    "M": "後續-未癒合(開放I/II)",
    "N": "後續-未癒合(開放IIIA-C)",
    "P": "後續-畸形癒合",
    "Q": "後續-畸形癒合(開放I/II)",
    "R": "後續-畸形癒合(開放IIIA-C)",
    "S": "後遺症",
}
SEV_LETTERS = set("ABCDEFGHJKMNPQRS")
SEVENTH_CHAPS = set("STVWXY")
SEVENTH_ORDER = {ch: i for i, ch in enumerate("ABCDEFGHJKMNPQRS")}

# 急診常見診斷只影響排序，不會排除其他代碼。
COMMON_BOOST = {
    "R07.9", "R07.89", "R10.9", "R10.84", "R10.0", "R51.9", "R42",
    "R55", "R06.02", "R50.9", "R11.2", "R11.10", "R41.82", "R40.4",
    "R53.1", "R56.9", "R57.0", "R57.1", "R65.20", "R65.21", "I10",
    "I20.9", "I21.9", "I48.91", "I50.9", "I26.99", "J18.0", "J18.9",
    "J20.9", "J44.1", "J45.901", "J96.01", "J81.0", "K35.80", "K75.0",
    "K80.20", "K85.90", "K92.2", "K59.00", "N39.0", "N20.0", "N17.9",
    "E11.65", "E11.10", "E86.0", "E87.6", "A41.9", "A09", "K52.9",
    "B34.9", "U07.1", "L03.90", "H11.30", "M54.50", "I47.1", "N10",
    "L03.115", "L03.116", "G43.909", "F41.9", "T78.40XA", "W55.01XA",
}

_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_REL_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}"
_RID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
_EN_ENCOUNTER = re.compile(
    r",?\s*(?:initial encounter.*|subsequent encounter.*|sequela)\s*$", re.I
)
_ZH_ENCOUNTER = re.compile(r"(?:[，,、 ]*)之?(?:初期照護|後續照護|後遺症)[。．.]?\s*$")


def nodot(code: str) -> str:
    return code.replace(".", "")


def chapter_of(code: str) -> str:
    if code[0] in "ST":
        return "inj"
    if code[0] in "VWXY":
        return "ext"
    return "dx"


def stem_of(code: str) -> str:
    raw = nodot(code)[:6].rstrip("X")
    return raw[:3] + "." + raw[3:] if len(raw) > 3 else raw


def strip_grouped_encounter_zh(text: str) -> str:
    """移除分組主幹末尾誤帶的初期/後續照護或後遺症字樣。"""

    return _ZH_ENCOUNTER.sub("", text).rstrip("，,、 ")


def _column_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha()).upper()
    value = 0
    for ch in letters:
        value = value * 26 + ord(ch) - ord("A") + 1
    return value - 1


class XlsxReader:
    """只用 Python 標準函式庫讀取本專案需要的 XLSX 儲存格。"""

    def __init__(self, path: Path):
        self.path = path
        self.archive = ZipFile(path)
        self.shared_strings = self._read_shared_strings()
        self.sheets = self._read_sheet_paths()

    def __enter__(self) -> "XlsxReader":
        return self

    def __exit__(self, *_: object) -> None:
        self.archive.close()

    def _read_shared_strings(self) -> list[str]:
        try:
            root = ET.fromstring(self.archive.read("xl/sharedStrings.xml"))
        except KeyError:
            return []
        return [
            "".join(node.text or "" for node in item.iter(_NS + "t"))
            for item in root
        ]

    def _read_sheet_paths(self) -> dict[str, str]:
        rel_root = ET.fromstring(self.archive.read("xl/_rels/workbook.xml.rels"))
        rels = {
            node.attrib["Id"]: node.attrib["Target"]
            for node in rel_root.findall(_REL_NS + "Relationship")
        }
        workbook = ET.fromstring(self.archive.read("xl/workbook.xml"))
        sheets: dict[str, str] = {}
        for sheet in workbook.iter(_NS + "sheet"):
            target = rels[sheet.attrib[_RID]].lstrip("/")
            if not target.startswith("xl/"):
                target = posixpath.normpath(posixpath.join("xl", target))
            sheets[sheet.attrib["name"]] = target
        return sheets

    def rows(self, sheet_name: str, max_columns: int = 6) -> Iterator[list[str]]:
        try:
            target = self.sheets[sheet_name]
        except KeyError as exc:
            available = "、".join(self.sheets)
            raise ValueError(f"XLSX 找不到 {sheet_name!r} 工作表；現有：{available}") from exc

        with self.archive.open(target) as stream:
            for _, row in ET.iterparse(stream, events=("end",)):
                if row.tag != _NS + "row":
                    continue
                values = [""] * max_columns
                for cell in row.findall(_NS + "c"):
                    index = _column_index(cell.attrib.get("r", ""))
                    if not 0 <= index < max_columns:
                        continue
                    kind = cell.attrib.get("t")
                    raw = cell.find(_NS + "v")
                    if kind == "inlineStr":
                        value = "".join(
                            node.text or "" for node in cell.iter(_NS + "t")
                        )
                    elif raw is None:
                        value = ""
                    elif kind == "s":
                        value = self.shared_strings[int(raw.text or "0")]
                    else:
                        value = raw.text or ""
                    values[index] = value
                yield values
                row.clear()


def _parse_roc_date(value: str) -> date:
    match = re.fullmatch(r"\s*(\d{2,3})[./-](\d{1,2})[./-](\d{1,2})\s*", value)
    if not match:
        raise ValueError(f"無法辨識民國日期：{value!r}")
    year, month, day = (int(part) for part in match.groups())
    return date(year + 1911, month, day)


def read_official_xlsx(path: Path) -> tuple[list[list[str]], date, list[str]]:
    if path.suffix.lower() != ".xlsx":
        raise ValueError("資料來源必須是健保署官方 XLSX；本流程刻意不接受 CSV")
    if not path.is_file():
        raise FileNotFoundError(
            f"找不到官方 XLSX：{path}\n下載網址：{SOURCE_FILE_URL}"
        )

    with XlsxReader(path) as workbook:
        rows = list(workbook.rows("ICD-10-CM"))
        history = list(workbook.rows("更新歷程", max_columns=2))

    if not rows or len(rows[0]) < 4:
        raise ValueError("ICD-10-CM 工作表是空的或欄位不足")
    header = rows[0]
    if "USE" not in header[1].upper() or "英文" not in header[2] or "中文" not in header[3]:
        raise ValueError(f"ICD-10-CM 欄位與預期不符：{header[:4]!r}")

    cm_updates = [
        _parse_roc_date(row[0])
        for row in history[1:]
        if row[0] and "ICD-10-CM" in row[1].upper()
    ]
    if not cm_updates:
        raise ValueError("更新歷程找不到 ICD-10-CM 日期")
    source_updated = max(cm_updates)
    if source_updated < MINIMUM_SOURCE_UPDATE:
        raise ValueError(
            f"來源更新日 {source_updated.isoformat()} 早於目前基準 "
            f"{MINIMUM_SOURCE_UPDATE.isoformat()}，請重新下載官方 XLSX"
        )

    body = [[cell.strip() for cell in row[:6]] for row in rows[1:] if row[0].strip()]
    billable_codes = [row[0] for row in body if row[1] == "1"]
    if len(body) < 90_000 or len(billable_codes) < 70_000:
        raise ValueError(
            f"ICD-10-CM 資料筆數異常（總列 {len(body)}、"
            f"USE=1 {len(billable_codes)}）"
        )
    if len(set(billable_codes)) != len(billable_codes):
        raise ValueError("ICD-10-CM 工作表的 USE=1 代碼有重複")
    return body, source_updated, billable_codes


def build(rows: Iterable[Sequence[str]]) -> list[dict[str, object]]:
    normalized = [list(row[:6]) for row in rows]
    by_code = {row[0]: row for row in normalized}
    entries: OrderedDict[str, dict[str, object]] = OrderedDict()

    for row in normalized:
        code, use, en, zh = row[0], row[1], row[2].strip(), row[3].strip()
        if use != "1" or not code:
            continue
        compact = nodot(code)
        groupable = (
            code[0] in SEVENTH_CHAPS
            and len(compact) >= 7
            and compact[6] in SEV_LETTERS
        )
        if groupable:
            key = stem_of(code)
            seventh = compact[6]
            if key not in entries:
                parent = by_code.get(key)
                parent_en = parent[2].strip() if parent else ""
                parent_zh = parent[3].strip() if parent else ""
                entries[key] = {
                    "c": key,
                    "en": parent_en or _EN_ENCOUNTER.sub("", en).rstrip(" ,"),
                    "zh": strip_grouped_encounter_zh(parent_zh or zh),
                    "s7": "",
                    "k": chapter_of(code),
                }
            if seventh not in str(entries[key]["s7"]):
                entries[key]["s7"] = str(entries[key]["s7"]) + seventh
        elif code not in entries:
            entries[code] = {
                "c": code,
                "en": en,
                "zh": zh,
                "s7": "",
                "k": chapter_of(code),
            }

    output: list[dict[str, object]] = []
    for entry in entries.values():
        if entry["s7"]:
            entry["s7"] = "".join(
                sorted(str(entry["s7"]), key=lambda char: SEVENTH_ORDER.get(char, 99))
            )
        if entry["c"] in COMMON_BOOST:
            entry["b"] = 1
        output.append(entry)
    return output


def _load_json(path: Path) -> dict[str, object] | None:
    if not path.is_file():
        return None
    value = json.loads(path.read_text(encoding="utf-8"))
    return value if isinstance(value, dict) else None


def load_preservation_source(path: Path, index_path: Path) -> dict[str, object]:
    existing = _load_json(path)
    if existing is not None:
        return existing
    if index_path.is_file():
        from restore_build import extract_embedded_db

        embedded, _ = extract_embedded_db(index_path)
        return embedded
    return {}


def _lossy_zh(value: str) -> bool:
    return "?" in value or "\ufffd" in value


def preserve_trusted_fields(
    entries: list[dict[str, object]], previous: dict[str, object]
) -> tuple[int, list[str]]:
    old_entries = previous.get("entries", []) if isinstance(previous, dict) else []
    old_by_code = {
        str(entry.get("c")): entry
        for entry in old_entries
        if isinstance(entry, dict) and entry.get("c")
    }
    aliases = 0
    translation_fallbacks: list[str] = []

    for entry in entries:
        code = str(entry["c"])
        old = old_by_code.get(code)
        zh = str(entry["zh"])
        if _lossy_zh(zh):
            old_zh = str(old.get("zh", "")) if old else ""
            if not old_zh or _lossy_zh(old_zh):
                raise ValueError(
                    f"官方 XLSX 的 {code} 中譯含有損字元，且沒有可信舊值可保留"
                )
            entry["zh"] = old_zh
            translation_fallbacks.append(code)
        if old and old.get("ax"):
            entry["ax"] = old["ax"]
            aliases += 1

    return aliases, translation_fallbacks


def source_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def make_data(
    source_path: Path, preservation_path: Path, index_path: Path
) -> dict[str, object]:
    rows, source_updated, billable_codes = read_official_xlsx(source_path)
    entries = build(rows)
    previous = load_preservation_source(preservation_path, index_path)
    alias_count, translation_fallbacks = preserve_trusted_fields(entries, previous)

    metadata = {
        "schema": 2,
        "codeSet": "ICD-10-CM",
        "edition": "2023",
        "language": "zh-TW",
        "jurisdiction": "TW",
        "publisher": "衛生福利部中央健康保險署",
        "sourceUpdated": source_updated.isoformat(),
        "effectiveFrom": EFFECTIVE_FROM,
        "sourcePage": SOURCE_PAGE,
        "sourceFile": SOURCE_FILE_URL,
        "sourceFormat": "xlsx",
        "sourceSha256": source_sha256(source_path),
        "sourceRowCount": len(rows),
        "billableCodeCount": len(billable_codes),
        "billableCodeSetSha256": hashlib.sha256(
            "\n".join(sorted(billable_codes)).encode("utf-8")
        ).hexdigest(),
        "entryCount": len(entries),
        "alphabeticIndexAliasCount": alias_count,
        "translationFallbacks": translation_fallbacks,
    }
    return {
        "version": f"2023 ICD-10-CM 中文版（健保署 {source_updated.isoformat()} 更新）",
        "metadata": metadata,
        "seventh": SEVENTH,
        "entries": entries,
    }


def write_json_atomic(path: Path, data: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    temporary.replace(path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="健保署 XLSX")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="輸出 JSON")
    parser.add_argument(
        "--preserve-from",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="保留 ax 與有損中譯替代值的既有 JSON",
    )
    parser.add_argument(
        "--index-fallback",
        type=Path,
        default=DEFAULT_INDEX,
        help="既有 JSON 不存在時，從此單檔網站讀取可信資料",
    )
    parser.add_argument("--check", action="store_true", help="完整建置與檢查，但不寫檔")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data = make_data(args.input, args.preserve_from, args.index_fallback)
    entries = data["entries"]
    assert isinstance(entries, list)
    categories = Counter(str(entry["k"]) for entry in entries)
    metadata = data["metadata"]
    assert isinstance(metadata, dict)

    if not args.check:
        write_json_atomic(args.output, data)
    action = "檢查完成（未寫檔）" if args.check else f"輸出：{args.output}"
    print(f"總條目：{len(entries)}  分類：{dict(categories)}")
    print(
        f"來源更新：{metadata['sourceUpdated']}  "
        f"完整碼：{metadata['billableCodeCount']}  "
        f"保留 ax：{metadata['alphabeticIndexAliasCount']}  "
        f"可信中譯回退：{len(metadata['translationFallbacks'])}"
    )
    print(action)


if __name__ == "__main__":
    main()
