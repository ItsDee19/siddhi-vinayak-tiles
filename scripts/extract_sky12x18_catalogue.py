"""
Sky 12×18 wall catalogue structured extract.

Layout (product pages):
  - Top band: size 450×300 + design code (e.g. 123-L, 150-AQUA, WOOD-11-LT)
  - Right of size: GLOSSY
  - Bottom: room visual + 3 face swatches (Light / Feature / Dark)

IDs: sky12x18-c001 … c072 map to PDF pages 2..73 (page 1 = cover).

  python scripts/extract_sky12x18_catalogue.py
  python scripts/extract_sky12x18_catalogue.py --limit 5 --dpi 180
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
PDF_DEFAULT = Path(r"C:\Users\KIIT\Downloads\(12X18) SKY PDF.pdf")
OUT_SWATCH = ROOT / "public" / "assets" / "catalogue" / "clean_swatches"
OUT_CSV = ROOT / "scripts" / "sky12x18-catalogue-structured.csv"
OUT_JSON = ROOT / "scripts" / "sky12x18-catalogue-structured.json"
TESS = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
if TESS.exists():
    pytesseract.pytesseract.tesseract_cmd = str(TESS)

# Header region where size + code live (code sits under size; needs y up to ~0.20)
HEADER = (0.04, 0.01, 0.50, 0.20)
HEADER_WIDE = (0.02, 0.00, 0.98, 0.18)
# Primary face (usually top/light swatch in bottom stack area)
FACE_PRIMARY = (0.08, 0.58, 0.45, 0.78)

SIZE_RE = re.compile(r"(450)\s*[x×X]\s*(300)", re.I)
# Codes: 123-L, 150-AQUA, 1691-LT, WOOD-11-LT, ARCH-WHITE
CODE_RE = re.compile(
    r"\b((?:ARCH[-\s]?WHITE)|(?:WOOD[-\s]?\d+[-\s]?[A-Z]{0,3})|"
    r"(?:\d{2,5}[-\s]?[A-Z]{1,6}))\b",
    re.I,
)
JUNK_CODES = {"74-HIME", "74HIME", "HIME", "4002-I"}
FINISH_RE = re.compile(r"\b(GLOSSY|MATTE|MATT|CARVING|SATIN)\b", re.I)
CHROME = re.compile(
    r"^(size|finish|sky|tiles?|mm|page|glossy|matte|digital|exclusive)$", re.I
)


def ocr(img: Image.Image, psm: int = 6) -> str:
    g = ImageOps.grayscale(img)
    w, h = g.size
    if w < 10 or h < 8:
        return ""
    g = g.resize((max(w * 3, 1), max(h * 3, 1)), Image.Resampling.LANCZOS)
    g = ImageOps.autocontrast(g)
    g = ImageEnhance.Contrast(g).enhance(2.0)
    g = g.filter(ImageFilter.SHARPEN)
    try:
        return pytesseract.image_to_string(g, config=f"--psm {psm}") or ""
    except Exception as e:
        print(f"[ocr] {e}", file=sys.stderr)
        return ""


def crop_rel(img: Image.Image, box):
    w, h = img.size
    x0, y0, x1, y1 = box
    return img.crop((int(w * x0), int(h * y0), int(w * x1), int(h * y1)))


def clean_code(raw: str) -> str:
    if not raw:
        return ""
    blob = re.sub(r"\s+", " ", raw).upper()
    # Prefer codes with letter suffix after digits
    best = ""
    best_score = -1
    for m in CODE_RE.finditer(blob):
        cand = m.group(1).replace(" ", "-")
        cand = re.sub(r"-+", "-", cand).strip("-")
        if CHROME.match(cand):
            continue
        if cand in {"450X300", "450", "300"} or cand.replace(" ", "-") in JUNK_CODES:
            continue
        if re.match(r"^74-", cand):
            continue
        score = len(cand)
        if "ARCH" in cand or "WOOD" in cand:
            score += 15
        if re.search(r"\d", cand) and re.search(r"[A-Z]", cand):
            score += 10
        if "-" in cand:
            score += 5
        if re.search(r"(LT|L|DK|D|HL|AQUA|WOOD)$", cand):
            score += 3
        if score > best_score:
            best_score = score
            best = cand
    if not best:
        return ""
    # Pretty: keep code uppercase with hyphen
    return best.upper()


def process_page(page_img: Image.Image, pdf_page: int, save_faces: bool):
    # Product id: PDF page 2 → c001
    prod_index = pdf_page - 1
    if prod_index < 1:
        return [
            {
                "id": "sky12x18-c000",
                "pdfPage": pdf_page,
                "name": "",
                "sizeMm": "",
                "sizeIn": "",
                "finish": "",
                "surface": "Wall",
                "layout": "cover",
                "textureFile": "",
                "textureUrl": "",
                "nameOcrRaw": "",
                "confidence": "low",
            }
        ]

    prod_id = f"sky12x18-c{prod_index:03d}"
    header = crop_rel(page_img, HEADER)
    header_w = crop_rel(page_img, HEADER_WIDE)
    # psm 6/11 read codes reliably; psm 7 often returns empty on this catalogue
    raw = ocr(header, 6) + "\n" + ocr(header, 11) + "\n" + ocr(header_w, 6)
    code = clean_code(raw)
    size_mm = "450×300mm"
    size_in = '12"×18"'
    fin_m = FINISH_RE.search(raw) or FINISH_RE.search(
        ocr(crop_rel(page_img, (0.50, 0.0, 0.98, 0.18)), 6)
    )
    finish = fin_m.group(1).title().replace("Matt", "Matte") if fin_m else "Glossy"

    conf = "high" if code and re.search(r"\d", code) else ("medium" if code else "low")
    name = code  # catalogue uses design codes as names

    tex = f"sky12x18-p{pdf_page}-t1-clean.webp"
    if save_faces:
        face = crop_rel(page_img, FACE_PRIMARY)
        if face.size[0] > 40 and face.size[1] > 40:
            face.save(OUT_SWATCH / tex, "WEBP", quality=92, method=4)

    return [
        {
            "id": prod_id,
            "pdfPage": pdf_page,
            "name": name,
            "sizeMm": size_mm,
            "sizeIn": size_in,
            "finish": finish,
            "surface": "Wall",
            "category": "Tiles",
            "subCategory": "Wall Tiles",
            "layout": "product",
            "textureFile": tex,
            "textureUrl": f"/assets/catalogue/clean_swatches/{tex}",
            "nameOcrRaw": re.sub(r"\s+", " ", raw).strip()[:200],
            "confidence": conf,
        }
    ]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", type=Path, default=PDF_DEFAULT)
    ap.add_argument("--dpi", type=int, default=200)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--end", type=int, default=0)
    ap.add_argument("--no-faces", action="store_true")
    args = ap.parse_args()

    if not args.pdf.exists():
        print("PDF missing:", args.pdf, file=sys.stderr)
        sys.exit(1)

    print("Tesseract:", pytesseract.get_tesseract_version())
    print("PDF:", args.pdf)
    OUT_SWATCH.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(args.pdf))
    print("Pages:", doc.page_count)
    end = args.end or doc.page_count
    indices = list(range(max(0, args.start - 1), min(doc.page_count, end)))
    if args.limit:
        indices = indices[: args.limit]

    all_rows = []
    for pi in indices:
        page_1 = pi + 1
        print(f"… PDF p{page_1}")
        pix = doc[pi].get_pixmap(dpi=args.dpi, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        rows = process_page(img, page_1, save_faces=not args.no_faces)
        for r in rows:
            if r["id"] == "sky12x18-c000":
                print("   (cover)")
                continue
            print(f"   {r['id']}: {r['name'] or '—'} | {r['sizeMm']} | {r['finish']} | {r['confidence']}")
            all_rows.append(r)
        del img, pix

    # Keep only c001..c072 for catalogue alignment
    def card_num(pid: str) -> int:
        m = re.search(r"c(\d+)$", pid)
        return int(m.group(1)) if m else 0

    all_rows = [
        r
        for r in all_rows
        if r["id"].startswith("sky12x18-c") and 1 <= card_num(r["id"]) <= 72
    ]

    fields = [
        "id",
        "name",
        "sizeMm",
        "sizeIn",
        "finish",
        "surface",
        "pdfPage",
        "layout",
        "textureFile",
        "textureUrl",
        "confidence",
        "nameOcrRaw",
    ]
    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in all_rows:
            w.writerow(r)

    named = sum(1 for r in all_rows if r.get("name"))
    high = sum(1 for r in all_rows if r.get("confidence") == "high")
    OUT_JSON.write_text(
        json.dumps(
            {
                "sourcePdf": str(args.pdf),
                "productCount": len(all_rows),
                "named": named,
                "highConfidence": high,
                "products": all_rows,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"\nDone. {len(all_rows)} products, {named} named, {high} high.")
    print("CSV:", OUT_CSV)
    print("JSON:", OUT_JSON)


if __name__ == "__main__":
    main()
