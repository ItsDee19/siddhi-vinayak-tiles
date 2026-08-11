"""
Skype 2×4 catalogue structured extract.

Product sheets are odd pages after a 2-page cover: PDF p3,5,7,...,33 → skype-c001..c016.
Lifestyle/room pages (even) are skipped.

  python scripts/extract_skype_catalogue.py
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
PDF_DEFAULT = Path(r"C:\Users\KIIT\Downloads\SKYPE  (2X4).pdf")
OUT_CSV = ROOT / "scripts" / "skype-catalogue-structured.csv"
OUT_JSON = ROOT / "scripts" / "skype-catalogue-structured.json"
OUT_SWATCH = ROOT / "public" / "assets" / "catalogue" / "clean_swatches"
TESS = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
if TESS.exists():
    pytesseract.pytesseract.tesseract_cmd = str(TESS)

CODE_RE = re.compile(r"(?:Name\s*[:.]?\s*)?(\d{4})\b", re.I)
SIZE_RE = re.compile(r"(600)\s*[x×]\s*(1200)|2\s*[x×]\s*4", re.I)
FINISH_RE = re.compile(r"\b(Glossy|Matte|Matt|Carving|Polished|Sugar)\b", re.I)
FACE = (0.065, 0.14, 0.355, 0.95)


def ocr(img: Image.Image, psm: int = 6) -> str:
    g = ImageOps.grayscale(img)
    w, h = g.size
    if w < 10 or h < 8:
        return ""
    g = g.resize((w * 2, h * 2), Image.Resampling.LANCZOS)
    g = ImageOps.autocontrast(g)
    g = ImageEnhance.Contrast(g).enhance(2.0)
    g = g.filter(ImageFilter.SHARPEN)
    try:
        return pytesseract.image_to_string(g, config=f"--psm {psm}") or ""
    except Exception as e:
        print(f"[ocr] {e}", file=sys.stderr)
        return ""


def crop_rel(img, box):
    w, h = img.size
    x0, y0, x1, y1 = box
    return img.crop((int(w * x0), int(h * y0), int(w * x1), int(h * y1)))


def process_page(page_img: Image.Image, pdf_page: int, prod_index: int, save_faces: bool):
    prod_id = f"skype-c{prod_index:03d}"
    top = crop_rel(page_img, (0.0, 0.0, 1.0, 0.16))
    raw = ocr(top, 6) + "\n" + ocr(top, 11)
    code = ""
    for m in CODE_RE.finditer(raw):
        n = m.group(1)
        # Skype design codes cluster 25xx–26xx in this book
        if 2400 <= int(n) <= 2900:
            code = n
            break
    if not code:
        # spaced OCR: "2 5 5 1"
        spaced = re.search(r"\b(\d)\s+(\d)\s+(\d)\s+(\d)\b", raw)
        if spaced:
            code = "".join(spaced.groups())

    name = f"Skype {code}" if code else ""
    size_mm = "600×1200mm"
    size_ft = "2×4 Ft"
    fin = FINISH_RE.search(raw)
    finish = fin.group(1).title().replace("Matt", "Matte") if fin else "Glossy"

    tex = f"skype-2x4-p{pdf_page:02d}-t1-clean.webp"
    if save_faces:
        face = crop_rel(page_img, FACE)
        if face.size[0] > 40:
            OUT_SWATCH.mkdir(parents=True, exist_ok=True)
            face.save(OUT_SWATCH / tex, "WEBP", quality=92, method=4)

    conf = "high" if code else "low"
    return {
        "id": prod_id,
        "pdfPage": pdf_page,
        "name": name,
        "code": code,
        "sizeMm": size_mm,
        "sizeFt": size_ft,
        "finish": finish,
        "surface": "Floor & Wall",
        "textureFile": tex,
        "textureUrl": f"/assets/catalogue/clean_swatches/{tex}",
        "nameOcrRaw": re.sub(r"\s+", " ", raw).strip()[:200],
        "confidence": conf,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", type=Path, default=PDF_DEFAULT)
    ap.add_argument("--dpi", type=int, default=200)
    ap.add_argument("--no-faces", action="store_true")
    args = ap.parse_args()

    if not args.pdf.exists():
        print("PDF missing:", args.pdf, file=sys.stderr)
        sys.exit(1)

    print("Tesseract:", pytesseract.get_tesseract_version())
    doc = fitz.open(str(args.pdf))
    print("Pages:", doc.page_count)

    # Odd product pages after 2-page cover
    product_pages = list(range(3, doc.page_count, 2))
    # last page if odd might be back cover — cap at 16 products
    all_rows = []
    for i, page_1 in enumerate(product_pages, start=1):
        if i > 16:
            break
        print(f"… PDF p{page_1} → skype-c{i:03d}")
        pix = doc[page_1 - 1].get_pixmap(dpi=args.dpi, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        row = process_page(img, page_1, i, save_faces=not args.no_faces)
        print(f"   {row['id']}: {row['name'] or '—'} | {row['sizeMm']} | {row['confidence']}")
        all_rows.append(row)
        del img, pix

    fields = [
        "id", "name", "code", "sizeMm", "sizeFt", "finish", "surface",
        "pdfPage", "textureFile", "textureUrl", "confidence", "nameOcrRaw",
    ]
    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in all_rows:
            w.writerow(r)

    named = sum(1 for r in all_rows if r.get("name"))
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
    print(OUT_CSV)
    print(OUT_JSON)


if __name__ == "__main__":
    main()
