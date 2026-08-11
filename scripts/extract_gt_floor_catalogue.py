"""
Global Tiles FLOOR catalogue extract (2025-26 Part-2).

- Rasterizes product spreads (PDF pages 3..end)
- Crops left/right tile faces → clean_swatches WebP
- OCR name / size / finish / packing via system Tesseract
- Writes structured CSV + JSON for size calculator + catalogue apply

Usage:
  python scripts/extract_gt_floor_catalogue.py
  python scripts/extract_gt_floor_catalogue.py --dpi 280 --limit 4   # smoke
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from pathlib import Path

import fitz
import pytesseract
from PIL import Image, ImageOps, ImageFilter

# --- paths ---
ROOT = Path(__file__).resolve().parents[1]
PDF_DEFAULT = Path(r"C:\Users\KIIT\Downloads\GLOBAL TILES FLOOR CATALOGUE.pdf")
OUT_SWATCH = ROOT / "public" / "assets" / "catalogue" / "clean_swatches"
OUT_WORK = ROOT / ".tile-name-work" / "gt-floor-extract"
OUT_CSV = ROOT / "scripts" / "floor-catalogue-structured.csv"
OUT_JSON = ROOT / "scripts" / "floor-catalogue-structured.json"
TESS = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")

if TESS.exists():
    pytesseract.pytesseract.tesseract_cmd = str(TESS)

# Chrome / junk phrases to drop from OCR names
CHROME = re.compile(
    r"^(size|glossy|matte|matt|vitrified|tiles?|global|packing|weight|"
    r"approx|pcs?|kg\.?|page[- ]?\d+|digital|exclusive|finish)$",
    re.I,
)
SIZE_RE = re.compile(
    r"(?P<ft>\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\s*(?:ft|FT)?)"
    r".{0,12}?"
    r"(?P<mm>\d{2,4}\s*[x×]\s*\d{3,4}\s*mm)?",
    re.I,
)
SIZE_MM_RE = re.compile(r"(\d{2,4})\s*[x×]\s*(\d{3,4})\s*mm", re.I)
SIZE_FT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:ft|FT)?", re.I)
WEIGHT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*Kgs?", re.I)
PCS_RE = re.compile(r"(\d+)\s*Pcs?", re.I)
CODE_RE = re.compile(r"\b([A-Z]-?\d{4,6})\b", re.I)
FINISH_RE = re.compile(r"\b(Glossy|Matte|Matt|Satin|Carving|Sugar|Polished|Rough)\b", re.I)
NAME_RE = re.compile(
    r"^([A-Z0-9][A-Z0-9 \-/'&.]{1,48}?)\s*(?:\(|$)",
    re.I,
)


def ocr_image(img: Image.Image, psm: int = 6, binary: bool = False) -> str:
    """OCR a PIL image; light preprocess for catalogue type."""
    from PIL import ImageEnhance

    g = ImageOps.grayscale(img)
    w, h = g.size
    # Upscale small label strips
    scale = 3 if max(w, h) < 1200 else 2
    g = g.resize((w * scale, h * scale), Image.Resampling.LANCZOS)
    g = ImageOps.autocontrast(g)
    g = ImageEnhance.Contrast(g).enhance(1.8)
    g = g.filter(ImageFilter.SHARPEN)
    if binary:
        g = g.point(lambda x: 0 if x < 165 else 255)
    cfg = f"--psm {psm} -c preserve_interword_spaces=1"
    try:
        return pytesseract.image_to_string(g, config=cfg) or ""
    except Exception as e:
        print(f"[ocr] fail: {e}", file=sys.stderr)
        return ""


def ocr_name_band(img: Image.Image) -> str:
    """OCR name strip with several strategies; return best raw text."""
    w, h = img.size
    # Focus on middle horizontal band where labels sit (avoid room photo).
    tight = img.crop((0, int(h * 0.22), w, int(h * 0.78)))
    candidates = [
        ocr_image(tight, psm=6, binary=True),
        ocr_image(tight, psm=11, binary=True),
        ocr_image(tight, psm=7, binary=True),
        ocr_image(img, psm=6, binary=False),
    ]
    # Prefer candidate that already contains (Glossy)/(Matte)
    for c in candidates:
        if re.search(r"\((Glossy|Matte|Matt|Satin)\)", c, re.I):
            return c
    # Else longest alnum-rich candidate
    return max(candidates, key=lambda t: sum(ch.isalpha() for ch in t))


def clean_name(raw: str) -> str:
    if not raw:
        return ""
    # Direct regex for "NAME (Finish)" anywhere in blob
    m = re.search(
        r"([A-Z][A-Z0-9 \-/'&.]{1,40}?)\s*\(\s*(Glossy|Matte|Matt|Satin|Carving|Polished)\s*\)",
        raw,
        re.I,
    )
    if m:
        base = re.sub(r"\s+", " ", m.group(1)).strip(" -•·|")
        # drop leading garbage tokens
        base = re.sub(r"^[^A-Za-z0-9]+", "", base)
        if base and not CHROME.match(base):
            return title_name(base)

    lines = [ln.strip() for ln in raw.replace("|", " ").splitlines() if ln.strip()]
    best = ""
    best_score = -1
    for ln in lines:
        ln2 = re.sub(r"\s+", " ", ln).strip(" -•·")
        base = re.sub(r"\s*\([^)]*\)\s*$", "", ln2).strip()
        if not base or CHROME.match(base):
            continue
        if re.search(r"\d{2,4}\s*[x×]\s*\d", base, re.I):
            continue
        if re.search(r"kgs?|packing|page|size\s*:", base, re.I):
            continue
        score = 0
        if re.search(r"\((Glossy|Matte|Matt)\)", ln2, re.I):
            score += 8
        if 3 <= len(base) <= 42:
            score += 2
        if re.match(r"^[A-Za-z0-9]", base):
            score += 1
        letters = sum(c.isalpha() for c in base)
        if letters < 3:
            score -= 5
        junk = sum(1 for c in base if c in r"\|_~`")
        score -= junk * 2
        if score > best_score:
            best_score = score
            best = base
    if not best or best_score < 2:
        return ""
    return title_name(best)


def title_name(best: str) -> str:
    if CODE_RE.fullmatch(best.replace(" ", "")):
        return CODE_RE.fullmatch(best.replace(" ", "")).group(1).upper()
    name = " ".join(
        p if re.match(r"^[A-Z]-?\d", p, re.I) else p.title()
        for p in re.sub(r"\s+", " ", best).split()
    )
    return name.strip(" -")


def parse_size(text: str) -> tuple[str, str]:
    """Return (sizeMm display, sizeFt display)."""
    mm = SIZE_MM_RE.search(text or "")
    ft = SIZE_FT_RE.search(text or "")
    size_mm = ""
    size_ft = ""
    if mm:
        a, b = mm.group(1), mm.group(2)
        size_mm = f"{a}×{b}mm"
    if ft:
        # Prefer ft when unit nearby or values small
        a, b = ft.group(1), ft.group(2)
        try:
            fa, fb = float(a), float(b)
            if fa <= 12 and fb <= 12:
                size_ft = f"{a}×{b} Ft"
        except ValueError:
            pass
    # Default for this catalogue section
    if not size_mm and "600" in (text or "") and "1200" in (text or ""):
        size_mm = "600×1200mm"
    if not size_ft and size_mm == "600×1200mm":
        size_ft = "2×4 Ft"
    if not size_mm:
        size_mm = "600×1200mm"
    if not size_ft:
        size_ft = "2×4 Ft"
    return size_mm, size_ft


def parse_finish(text: str) -> str:
    m = FINISH_RE.search(text or "")
    if not m:
        return "Glossy"
    f = m.group(1).title()
    if f.lower() == "matt":
        f = "Matte"
    return f


def parse_packing(text: str) -> tuple[str, str]:
    pcs = PCS_RE.search(text or "")
    w = WEIGHT_RE.search(text or "")
    return (pcs.group(1) if pcs else "2"), (w.group(1) if w else "27.00")


def parse_code(name: str, raw: str) -> str:
    for src in (name, raw):
        m = CODE_RE.search(src or "")
        if m:
            return m.group(1).upper().replace(" ", "")
    return ""


def crop_rel(img: Image.Image, x0, y0, x1, y1) -> Image.Image:
    w, h = img.size
    return img.crop((int(w * x0), int(h * y0), int(w * x1), int(h * y1)))


def process_page(page_img: Image.Image, pdf_page_1based: int, catalogue_page_left: int, dpi: int):
    """Return two product dicts for left/right columns."""
    rows = []
    # Column windows (normalized) — matches prior floor extract script.
    columns = (
        ("L", 0.06, 0.48),
        ("R", 0.52, 0.94),
    )
    for col_i, (side, x0, x1) in enumerate(columns):
        variant = col_i + 1
        # Face swatch (hero tile image at top of each column) — stop above name
        face = crop_rel(page_img, x0, 0.11, x1, 0.325)
        # Name strip under face (tight on the white label row)
        name_band = crop_rel(page_img, x0, 0.32, x1, 0.385)
        # Header size/finish
        header = crop_rel(page_img, x0, 0.02, x1, 0.11)
        # Footer packing
        footer = crop_rel(page_img, x0, 0.92, x1, 0.995)

        name_raw = ocr_name_band(name_band)
        header_raw = ocr_image(header, psm=6, binary=False)
        footer_raw = ocr_image(footer, psm=6, binary=True)

        name = clean_name(name_raw)
        if not name:
            # one more try: slightly lower band
            name_raw = ocr_name_band(crop_rel(page_img, x0, 0.33, x1, 0.40))
            name = clean_name(name_raw)
        size_mm, size_ft = parse_size(header_raw + " " + name_raw)
        finish = parse_finish(header_raw + " " + name_raw)
        pcs, weight = parse_packing(footer_raw)
        code = parse_code(name, name_raw)

        # Catalogue product index: first product spread PDF page 3 → c001/c002
        # pdf_page_1based starts at 3 for first product page
        prod_index = (pdf_page_1based - 3) * 2 + variant  # 1-based
        prod_id = f"gt-floor-c{prod_index:03d}"
        swatch_stem = f"gt-floor-2025-p{catalogue_page_left + col_i:02d}-t{variant}-clean"
        # Use catalogue page numbers printed on spread (left page no / right page no)
        cat_page = catalogue_page_left + col_i

        face_name = f"{swatch_stem}.webp"
        face_path = OUT_SWATCH / face_name
        face.save(face_path, "WEBP", quality=95, method=6)

        # Debug crops
        dbg = OUT_WORK / "crops" / prod_id
        dbg.mkdir(parents=True, exist_ok=True)
        name_band.save(dbg / "name.png")
        header.save(dbg / "header.png")
        footer.save(dbg / "footer.png")
        face.save(dbg / "face.webp", "WEBP", quality=90)

        rows.append(
            {
                "id": prod_id,
                "side": side,
                "pdfPage": pdf_page_1based,
                "cataloguePage": cat_page,
                "variant": variant,
                "name": name,
                "code": code,
                "sizeMm": size_mm,
                "sizeFt": size_ft,
                "finish": finish,
                "pcsPerBox": pcs,
                "boxWeightKg": weight,
                "surface": "Floor",
                "category": "Tiles",
                "subCategory": "Floor Tiles",
                "bodyType": "PGVT",
                "textureFile": face_name,
                "textureUrl": f"/assets/catalogue/clean_swatches/{face_name}",
                "nameOcrRaw": re.sub(r"\s+", " ", name_raw).strip()[:200],
                "headerOcrRaw": re.sub(r"\s+", " ", header_raw).strip()[:200],
                "footerOcrRaw": re.sub(r"\s+", " ", footer_raw).strip()[:120],
                "confidence": "high" if name and len(name) >= 3 else "low",
            }
        )
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", type=Path, default=PDF_DEFAULT)
    ap.add_argument("--dpi", type=int, default=260)
    ap.add_argument("--limit", type=int, default=0, help="Max product PDF pages (0=all)")
    ap.add_argument("--start", type=int, default=3, help="1-based PDF page to start (default 3)")
    args = ap.parse_args()

    if not args.pdf.exists():
        print(f"PDF not found: {args.pdf}", file=sys.stderr)
        sys.exit(1)

    print(f"Tesseract: {pytesseract.get_tesseract_version()}")
    print(f"PDF: {args.pdf}")
    OUT_SWATCH.mkdir(parents=True, exist_ok=True)
    OUT_WORK.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(args.pdf))
    print(f"Pages: {doc.page_count}")

    all_rows = []
    # Product spreads: PDF page 3 .. end (1-based). Cover=1, inner=2, products start 3.
    start_idx = max(0, args.start - 1)
    page_indices = list(range(start_idx, doc.page_count))
    if args.limit:
        page_indices = page_indices[: args.limit]

    for pi in page_indices:
        page_1based = pi + 1
        # Printed catalogue page numbers on first product spread are 01|02
        catalogue_page_left = (page_1based - 3) * 2 + 1
        print(f"… PDF p{page_1based} (catalogue ~{catalogue_page_left}-{catalogue_page_left+1})")
        pix = doc[pi].get_pixmap(dpi=args.dpi, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        rows = process_page(img, page_1based, catalogue_page_left, args.dpi)
        for r in rows:
            print(f"   {r['id']}: {r['name'] or '—'} | {r['sizeMm']} | {r['finish']} | {r['pcsPerBox']}pcs/{r['boxWeightKg']}kg")
        all_rows.extend(rows)

    # CSV
    fields = [
        "id", "name", "code", "sizeMm", "sizeFt", "finish", "pcsPerBox", "boxWeightKg",
        "surface", "bodyType", "cataloguePage", "pdfPage", "variant", "side",
        "textureFile", "textureUrl", "confidence", "nameOcrRaw", "headerOcrRaw", "footerOcrRaw",
    ]
    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in all_rows:
            w.writerow(r)

    with OUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(
            {
                "sourcePdf": str(args.pdf),
                "productCount": len(all_rows),
                "named": sum(1 for r in all_rows if r["name"]),
                "products": all_rows,
            },
            f,
            indent=2,
            ensure_ascii=False,
        )

    named = sum(1 for r in all_rows if r["name"])
    print(f"\nDone. {len(all_rows)} products, {named} named.")
    print(f"CSV:  {OUT_CSV}")
    print(f"JSON: {OUT_JSON}")
    print(f"Faces: {OUT_SWATCH}")


if __name__ == "__main__":
    main()
