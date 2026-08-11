"""
Fix wall size OCR glitch: 73×300mm → 75×300mm (3\"×12\" subway).

Affects gt2025-c141..c144 on PDF page 3 (headers/footers show 3\"x12\").
Updates structured JSON/CSV, wallSizeCalculator.json, importedCatalogue.js.
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BAD = "73×300mm"
GOOD = "75×300mm"
GOOD_IN = '3"×12"'
IDS = {"gt2025-c141", "gt2025-c142", "gt2025-c143", "gt2025-c144"}


def fix_structured():
    path = ROOT / "scripts/gt2025-catalogue-structured.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    n = 0
    for p in data["products"]:
        if p["id"] in IDS or (p.get("sizeMm") or "").replace("x", "×") == BAD.replace("x", "×"):
            if "73" in (p.get("sizeMm") or ""):
                p["sizeMm"] = GOOD
                p["sizeIn"] = GOOD_IN
                n += 1
                print(f"  structured {p['id']}: {GOOD}")
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # CSV
    csv_path = ROOT / "scripts/gt2025-catalogue-structured.csv"
    if csv_path.exists():
        rows = list(csv.DictReader(csv_path.open(encoding="utf-8")))
        fields = list(rows[0].keys()) if rows else []
        for r in rows:
            if r.get("id") in IDS or "73" in (r.get("sizeMm") or ""):
                r["sizeMm"] = GOOD
                if "sizeIn" in r:
                    r["sizeIn"] = GOOD_IN
        with csv_path.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
            w.writeheader()
            w.writerows(rows)
    return n


def fix_calculator():
    path = ROOT / "src/data/wallSizeCalculator.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    n = 0
    for p in data.get("products", []):
        sm = p.get("sizeMm") or ""
        if "73" in sm or p.get("id") in IDS and "75" not in sm:
            if "73" in sm or p.get("id") in IDS:
                p["sizeMm"] = GOOD
                p["sizeIn"] = GOOD_IN
                n += 1
                print(f"  calc {p['id']}: {GOOD}")
    # rebuild histogram
    hist = {}
    for p in data.get("products", []):
        k = p.get("sizeMm") or ""
        hist[k] = hist.get(k, 0) + 1
    data["sizeHistogram"] = hist
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print("  histogram:", hist)
    return n


def fix_catalogue():
    path = ROOT / "src/data/importedCatalogue.js"
    src = path.read_text(encoding="utf-8")
    n = 0
    for pid in sorted(IDS):
        # replace size within this product object only
        pat = re.compile(
            rf'("id":\s*"{re.escape(pid)}"[\s\S]*?"size":\s*")([^"]*)(")',
        )
        m = pat.search(src)
        if m and "73" in m.group(2):
            src = pat.sub(rf"\g<1>{GOOD}\g<3>", src, count=1)
            n += 1
            print(f"  catalogue {pid}: {GOOD}")
    path.write_text(src, encoding="utf-8")
    return n


def harden_extract_parser():
    """Prevent 73x300 from being accepted when inch size is 3x12."""
    path = ROOT / "scripts/extract_gt2025_catalogue.py"
    if not path.exists():
        return
    text = path.read_text(encoding="utf-8")
    if "normalize_wall_size" in text:
        return
    old = '''def parse_size(header: str, footer: str) -> tuple[str, str]:
    blob = f"{header} {footer}"
    mm = SIZE_MM_RE.search(blob)
    size_mm = f"{mm.group(1)}×{mm.group(2)}mm" if mm else ""
    # inches often like 3"x12" or 12"x12"
    size_in = ""
    m = re.search(r'(\\d+)\\s*"\\s*[x×]\\s*(\\d+)\\s*"', blob)
    if m:
        size_in = f'{m.group(1)}"×{m.group(2)}"'
    if not size_mm and "300" in blob and "300" in blob:
        size_mm = "300×300mm"
    return size_mm or "300×300mm", size_in
'''
    new = '''def parse_size(header: str, footer: str) -> tuple[str, str]:
    blob = f"{header} {footer}"
    mm = SIZE_MM_RE.search(blob)
    size_mm = f"{mm.group(1)}×{mm.group(2)}mm" if mm else ""
    # inches often like 3"x12" or 12"x12"
    size_in = ""
    m = re.search(r'(\\d+)\\s*"\\s*[x×]\\s*(\\d+)\\s*"', blob)
    if m:
        size_in = f'{m.group(1)}"×{m.group(2)}"'
    # OCR often misreads 75x300 as 73x300 on 3"x12" subway pages
    if size_mm in {"73×300mm", "73x300mm"} or (
        size_in in {'3"×12"', '3"x12"'} and size_mm and "300" in size_mm
    ):
        if size_in in {'3"×12"', '3"x12"'} or re.search(r'3\\s*"\\s*[x×]\\s*12', blob):
            size_mm = "75×300mm"
            size_in = '3"×12"'
    if not size_mm and "300" in blob and "300" in blob:
        size_mm = "300×300mm"
    return size_mm or "300×300mm", size_in
'''
    if old in text:
        path.write_text(text.replace(old, new), encoding="utf-8")
        print("  extract parser hardened against 73×300")
    else:
        print("  extract parser: pattern not found (skip harden)")


def main():
    print("Fixing 73×300mm → 75×300mm (3\"×12\")…")
    a = fix_structured()
    b = fix_calculator()
    c = fix_catalogue()
    harden_extract_parser()
    print(f"Done. structured={a} calc={b} catalogue={c}")


if __name__ == "__main__":
    main()
