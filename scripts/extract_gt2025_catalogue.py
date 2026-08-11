"""
Global Tiles 2025 wall catalogue extract (Part-1).

Layout: product spreads PDF p3..end, 4 tiles per page (2x2).
IDs: gt2025-c141 … (140 + index) to match existing catalogue.

  python scripts/extract_gt2025_catalogue.py
  python scripts/extract_gt2025_catalogue.py --limit 3 --dpi 220
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

import fitz
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PDF_DEFAULT = Path(r"C:\Users\KIIT\Downloads\GLOBAL TILES 2025 CATALOGUE.pdf")
OUT_SWATCH = ROOT / "public" / "assets" / "catalogue" / "clean_swatches"
OUT_WORK = ROOT / ".tile-name-work" / "gt2025-extract"
OUT_CSV = ROOT / "scripts" / "gt2025-catalogue-structured.csv"
OUT_JSON = ROOT / "scripts" / "gt2025-catalogue-structured.json"
TESS = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
if TESS.exists():
    pytesseract.pytesseract.tesseract_cmd = str(TESS)

# Four tile chips per spread (normalized). Larger than old script for better faces.
# Order: TL, BL, TR, BR  (matches previous t1..t4 order: TL, BL, TR, BR)
CHIP_BOXES = [
    # (x0, y0, x1, y1) face
    (0.02, 0.10, 0.22, 0.28),  # TL
    (0.02, 0.50, 0.22, 0.68),  # BL
    (0.52, 0.10, 0.72, 0.28),  # TR
    (0.52, 0.50, 0.72, 0.68),  # BR
]
# Name band relative to each chip (below chip)
NAME_DY0, NAME_DY1 = 0.0, 0.06  # added to face y1

SIZE_MM_RE = re.compile(r"(\d{2,4})\s*[x×]\s*(\d{2,4})\s*mm", re.I)
SIZE_IN_RE = re.compile(r'(\d+(?:\.\d+)?)\s*[x×"”]\s*(\d+(?:\.\d+)?)\s*"?', re.I)
PCS_RE = re.compile(r"(\d+)\s*Pcs?", re.I)
WEIGHT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*Kgs?", re.I)
COV_RE = re.compile(r"(\d+(?:\.\d+)?)\s*Sq\.?\s*Ft", re.I)
NAME_RE = re.compile(
    r"\b([A-Z][A-Z0-9]+(?:[-/][A-Z0-9]+)*)\b(?:\s*\(([^)]+)\))?",
)


def ocr(img: Image.Image, psm: int = 6, binary: bool = True) -> str:
    g = ImageOps.grayscale(img)
    w, h = g.size
    g = g.resize((max(w * 3, 1), max(h * 3, 1)), Image.Resampling.LANCZOS)
    g = ImageOps.autocontrast(g)
    g = ImageEnhance.Contrast(g).enhance(2.0)
    g = g.filter(ImageFilter.SHARPEN)
    if binary:
        g = g.point(lambda x: 0 if x < 165 else 255)
    try:
        return pytesseract.image_to_string(g, config=f"--psm {psm}") or ""
    except Exception as e:
        print(f"[ocr] {e}", file=sys.stderr)
        return ""


def clean_name(raw: str) -> str:
    if not raw:
        return ""
    # Prefer ALLCAPS product codes like BRIKO-CARROT, STONY-11, CROSSY-CARROT
    best = ""
    best_score = -1
    for ln in raw.replace("|", " ").splitlines():
        ln = re.sub(r"\s+", " ", ln).strip()
        for m in NAME_RE.finditer(ln.upper()):
            base = m.group(1)
            if base in {
                "GLOBAL", "TILES", "ITALIAN", "DIGITAL", "WALL", "EXCLUSIVE",
                "COLLECTION", "SIZE", "DESIGN", "GLOSSY", "MATT", "MATTE",
                "THERMOCOL", "PACKING", "COVERAGE", "WEIGHT", "APPROX",
                "RANDOM", "PAGE",
            }:
                continue
            if len(base) < 3:
                continue
            score = len(base)
            if "-" in base:
                score += 5
            if re.search(r"\d", base):
                score += 2
            if m.group(2):
                score += 1
            if score > best_score:
                best_score = score
                suffix = f" ({m.group(2).title()})" if m.group(2) else ""
                # Title-ish for multi segment
                parts = base.split("-")
                pretty = "-".join(
                    p if re.search(r"\d", p) else p.title() for p in parts
                )
                best = pretty + suffix
    return best


def parse_size(header: str, footer: str) -> tuple[str, str]:
    blob = f"{header} {footer}"
    mm = SIZE_MM_RE.search(blob)
    size_mm = f"{mm.group(1)}×{mm.group(2)}mm" if mm else ""
    # inches often like 3"x12" or 12"x12"
    size_in = ""
    m = re.search(r'(\d+)\s*"\s*[x×]\s*(\d+)\s*"', blob)
    if m:
        size_in = f'{m.group(1)}"×{m.group(2)}"'
    # OCR often misreads 75x300 as 73x300 on 3"x12" subway pages
    if size_mm in {"73×300mm", "73x300mm"} or (
        size_in in {'3"×12"', '3"x12"'} and size_mm and "300" in size_mm
    ):
        if size_in in {'3"×12"', '3"x12"'} or re.search(r'3\s*"\s*[x×]\s*12', blob):
            size_mm = "75×300mm"
            size_in = '3"×12"'
    if not size_mm and "300" in blob and "300" in blob:
        size_mm = "300×300mm"
    return size_mm or "300×300mm", size_in


def parse_packing(footer: str) -> tuple[str, str, str]:
    pcs = PCS_RE.search(footer)
    w = WEIGHT_RE.search(footer)
    cov = COV_RE.search(footer)
    return (
        pcs.group(1) if pcs else "",
        w.group(1) if w else "",
        cov.group(1) if cov else "",
    )


def crop_rel(img: Image.Image, box):
    w, h = img.size
    x0, y0, x1, y1 = box
    return img.crop((int(w * x0), int(h * y0), int(w * x1), int(h * y1)))


def process_page(page_img: Image.Image, pdf_page_1based: int, dpi: int):
    rows = []
    w, h = page_img.size
    # Header half for left/right size
    header_l = page_img.crop((0, 0, w // 2, int(h * 0.10)))
    header_r = page_img.crop((w // 2, 0, w, int(h * 0.10)))
    footer_l = page_img.crop((0, int(h * 0.92), w // 2, h))
    footer_r = page_img.crop((w // 2, int(h * 0.92), w, h))
    header_l_t = ocr(header_l, psm=6, binary=False)
    header_r_t = ocr(header_r, psm=6, binary=False)
    footer_l_t = ocr(footer_l, psm=6, binary=True)
    footer_r_t = ocr(footer_r, psm=6, binary=True)

    for variant, face_box in enumerate(CHIP_BOXES, start=1):
        x0, y0, x1, y1 = face_box
        face = crop_rel(page_img, face_box)
        # name under chip
        name_box = (x0, y1, x1, min(1.0, y1 + NAME_DY1 + 0.02))
        # also try slightly larger name band
        name_band = crop_rel(page_img, (x0 - 0.01, y1 - 0.01, min(1.0, x1 + 0.05), min(1.0, y1 + 0.08)))
        name_raw = ocr(name_band, psm=7, binary=True) + "\n" + ocr(name_band, psm=6, binary=True)
        # sometimes name is printed on chip bottom
        name_raw += "\n" + ocr(face, psm=6, binary=True)
        name = clean_name(name_raw)

        left_col = variant in (1, 2)
        header_t = header_l_t if left_col else header_r_t
        footer_t = footer_l_t if left_col else footer_r_t
        size_mm, size_in = parse_size(header_t, footer_t)
        pcs, weight, coverage = parse_packing(footer_t)

        # ID scheme: gt2025-c141 is first product
        # page_index 2 (pdf p3) variant 1 → 141
        prod_index = 140 + (pdf_page_1based - 3) * 4 + variant
        prod_id = f"gt2025-c{prod_index:03d}"
        page_number = pdf_page_1based - 1  # matches old extract naming
        face_name = f"gt-2025-p{page_number:02d}-t{variant}-clean.webp"
        face_path = OUT_SWATCH / face_name
        face.save(face_path, "WEBP", quality=95, method=6)

        dbg = OUT_WORK / "crops" / prod_id
        dbg.mkdir(parents=True, exist_ok=True)
        face.save(dbg / "face.webp", "WEBP", quality=90)
        name_band.save(dbg / "name.png")

        rows.append(
            {
                "id": prod_id,
                "variant": variant,
                "quadrant": ["TL", "BL", "TR", "BR"][variant - 1],
                "pdfPage": pdf_page_1based,
                "name": name,
                "sizeMm": size_mm,
                "sizeIn": size_in,
                "finish": "Glossy",
                "pcsPerBox": pcs or "",
                "boxWeightKg": weight or "",
                "coverageSqFt": coverage or "",
                "surface": "Wall",
                "category": "Tiles",
                "subCategory": "Wall Tiles",
                "textureFile": face_name,
                "textureUrl": f"/assets/catalogue/clean_swatches/{face_name}",
                "nameOcrRaw": re.sub(r"\s+", " ", name_raw).strip()[:200],
                "headerOcrRaw": re.sub(r"\s+", " ", header_t).strip()[:160],
                "footerOcrRaw": re.sub(r"\s+", " ", footer_t).strip()[:160],
                "confidence": "high" if name and len(name) >= 3 else "low",
            }
        )
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", type=Path, default=PDF_DEFAULT)
    ap.add_argument("--dpi", type=int, default=240)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--start", type=int, default=3)
    ap.add_argument("--end", type=int, default=75, help="1-based inclusive end page")
    args = ap.parse_args()

    if not args.pdf.exists():
        print("PDF missing:", args.pdf, file=sys.stderr)
        sys.exit(1)

    print("Tesseract:", pytesseract.get_tesseract_version())
    print("PDF:", args.pdf)
    OUT_SWATCH.mkdir(parents=True, exist_ok=True)
    OUT_WORK.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(args.pdf))
    print("Pages:", doc.page_count)

    start_idx = max(0, args.start - 1)
    end_idx = min(doc.page_count - 1, args.end - 1)
    indices = list(range(start_idx, end_idx + 1))
    if args.limit:
        indices = indices[: args.limit]

    all_rows = []
    for pi in indices:
        page_1 = pi + 1
        print(f"… PDF p{page_1}")
        pix = doc[pi].get_pixmap(dpi=args.dpi, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        rows = process_page(img, page_1, args.dpi)
        for r in rows:
            print(
                f"   {r['id']}: {r['name'] or '—'} | {r['sizeMm']} | "
                f"{r['pcsPerBox'] or '?'}pcs / {r['boxWeightKg'] or '?'}kg"
            )
        all_rows.extend(rows)

    fields = [
        "id", "name", "sizeMm", "sizeIn", "finish", "pcsPerBox", "boxWeightKg",
        "coverageSqFt", "surface", "pdfPage", "variant", "quadrant",
        "textureFile", "textureUrl", "confidence", "nameOcrRaw",
        "headerOcrRaw", "footerOcrRaw",
    ]
    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in all_rows:
            w.writerow(r)

    named = sum(1 for r in all_rows if r["name"])
    OUT_JSON.write_text(
        json.dumps(
            {
                "sourcePdf": str(args.pdf),
                "productCount": len(all_rows),
                "named": named,
                "products": all_rows,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"\nDone. {len(all_rows)} products, {named} named.")
    print("CSV:", OUT_CSV)
    print("JSON:", OUT_JSON)


if __name__ == "__main__":
    main()
