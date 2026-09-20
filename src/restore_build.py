#!/usr/bin/env python3
"""從已版控的單檔 ``index.html`` 還原建置輸入。

乾淨 clone 不需要先下載外部資料即可執行搜尋測試與 HTML 建置。預設只補回
缺少的檔案，不覆寫現有工作成果；需要強制重建時才使用 ``--force``。
"""

from __future__ import annotations

import argparse
import base64
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INDEX = ROOT / "index.html"
DEFAULT_DATA = ROOT / "build" / "icd_data.json"
DEFAULT_DESIGN = ROOT / "design"
PNG_NAMES = ("chart_front_final.png", "chart_back_final.png")
_DATA_MARKER = re.compile(r"\bconst\s+DB\s*=\s*")


def extract_embedded_db(index_path: Path) -> tuple[dict[str, object], str]:
    html = index_path.read_text(encoding="utf-8")
    marker = _DATA_MARKER.search(html)
    if not marker:
        raise ValueError(f"{index_path} 找不到 'const DB =' 內嵌資料")
    decoder = json.JSONDecoder()
    value, consumed = decoder.raw_decode(html[marker.end():])
    if not isinstance(value, dict) or not isinstance(value.get("entries"), list):
        raise ValueError("index.html 的 DB 結構不完整")
    raw = html[marker.end():marker.end() + consumed]
    return value, raw


def extract_embedded_pngs(index_path: Path) -> list[bytes]:
    html = index_path.read_text(encoding="utf-8")
    encoded: list[str] = []
    for label in ("Body front", "Body back"):
        match = re.search(
            rf'<svg\b[^>]*aria-label=["\']{re.escape(label)}["\'][^>]*>'
            rf'.*?<image\b[^>]*href=["\']data:image/png;base64,'
            rf'([A-Za-z0-9+/=]+)["\']',
            html,
            flags=re.S,
        )
        if not match:
            raise ValueError(f"{index_path} 找不到 {label} 的內嵌 PNG")
        encoded.append(match.group(1))
    images = [base64.b64decode(value, validate=True) for value in encoded]
    if any(not image.startswith(b"\x89PNG\r\n\x1a\n") for image in images):
        raise ValueError("index.html 內嵌圖片不是有效 PNG")
    return images


def _write_text_atomic(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(value, encoding="utf-8")
    temporary.replace(path)


def _write_bytes_atomic(path: Path, value: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_bytes(value)
    temporary.replace(path)


def restore_from_index(
    index_path: Path = DEFAULT_INDEX,
    data_path: Path = DEFAULT_DATA,
    design_dir: Path = DEFAULT_DESIGN,
    force: bool = False,
) -> list[tuple[Path, str]]:
    if not index_path.is_file():
        raise FileNotFoundError(f"找不到已版控單檔：{index_path}")

    results: list[tuple[Path, str]] = []
    if force or not data_path.is_file():
        _, raw = extract_embedded_db(index_path)
        _write_text_atomic(data_path, raw)
        results.append((data_path, "還原"))
    else:
        results.append((data_path, "保留"))

    image_paths = [design_dir / name for name in PNG_NAMES]
    missing_images = [path for path in image_paths if force or not path.is_file()]
    if missing_images:
        images = extract_embedded_pngs(index_path)
        for path, image in zip(image_paths, images):
            if force or not path.is_file():
                _write_bytes_atomic(path, image)
                results.append((path, "還原"))
            else:
                results.append((path, "保留"))
    else:
        results.extend((path, "保留") for path in image_paths)
    return results


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--index", type=Path, default=DEFAULT_INDEX)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--design-dir", type=Path, default=DEFAULT_DESIGN)
    parser.add_argument("--force", action="store_true", help="覆寫已存在的還原目標")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    for path, action in restore_from_index(
        args.index, args.data, args.design_dir, force=args.force
    ):
        print(f"{action}：{path}")


if __name__ == "__main__":
    main()
