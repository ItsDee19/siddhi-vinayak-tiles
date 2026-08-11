"""
Sunflora 2×4 catalogue structured extract.

Layout:
  - PDF pages 1–2: cover / divider (skipped as products when empty)
  - Layout A: one product/page — bold name on right under QR, specs below
  - Layout B: two products/page — left-aligned headings above each swatch stack

Outputs:
  - scripts/sunflora-catalogue-structured.csv / .json
  - public/.../clean_swatches/sunflora-pNN-tK-clean.webp (faces, re-extracted)

IDs stay page-aligned with existing catalogue: sunflora-c001 … (page number).
Dual-product pages store both names joined with " / " for the page ID.

  python scripts/extract_sunflora_catalogue.py
  python scripts/extract_sunflora_catalogue.py --limit 4 --dpi 200
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
PDF_DEFAULT = Path(r"C:\Users\KIIT\Downloads\SUNFLORA 2X4 (NEW DES).pdf")
OUT_SWATCH = ROOT / "public" / "assets" / "catalogue" / "clean_swatches"
OUT_WORK = ROOT / ".tile-name-work" / "sunflora-extract"
OUT_CSV = ROOT / "scripts" / "sunflora-catalogue-structured.csv"
OUT_JSON = ROOT / "scripts" / "sunflora-catalogue-structured.json"
TESS = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
if TESS.exists():
    pytesseract.pytesseract.tesseract_cmd = str(TESS)

# Layout A — single product name on right
LAYOUT_A_NAME = (0.54, 0.48, 0.98, 0.64)
LAYOUT_A_SPECS = (0.54, 0.58, 0.98, 0.88)
# Layout B — two stacked products (name bands)
LAYOUT_B_NAMES = [
    (0.08, 0.40, 0.60, 0.48),
    (0.08, 0.56, 0.60, 0.64),
]
LAYOUT_B_SPECS = [
    (0.08, 0.45, 0.60, 0.56),
    (0.08, 0.62, 0.60, 0.75),
]

# Face crops for visualizer (relative). Layout A: 3 horizontal faces left column.
# Layout B: one face band per product roughly.
FACE_A = [
    (0.06, 0.42, 0.52, 0.55),
    (0.06, 0.56, 0.52, 0.69),
    (0.06, 0.70, 0.52, 0.83),
]
FACE_B = [
    (0.08, 0.48, 0.55, 0.56),
    (0.08, 0.65, 0.55, 0.73),
]

CHROME = re.compile(
    r"^(tap to details?|back|size|finish|random|thickness|surface|"
    r"www\.|mozilla|exquisite surfaces|the art of elegant living|"
    r"carving|glossy|matte|matt|sparkle|punch|pos|with|granulla|"
    r"coverage|weight|approx|pcs?|kgs?|mm|page)$",
    re.I,
)
SIZE_MM_RE = re.compile(r"(\d{3,4})\s*[x×]\s*(\d{3,4})\s*mm", re.I)
SIZE_FT_RE = re.compile(r"(\d+)\s*[x×]\s*(\d+)\s*(?:ft|FT|'')?", re.I)
FINISH_RE = re.compile(
    r"\b(Carving|Glossy|Matte|Matt|Satin|Sparkle(?:\s+With\s+Granulla)?|"
    r"POS\s*\+?\s*PUNCH|Polished|Sugar|High\s*Gloss)\b",
    re.I,
)
THICK_RE = re.compile(r"(\d+(?:\.\d+)?)\s*mm", re.I)
RANDOM_RE = re.compile(r"Random\s*[:.]?\s*(\d+)", re.I)
# Product-ish: CV/SP/END prefixes or multi-word ALLCAPS
NAME_CAND = re.compile(
    r"\b((?:CV|SP|END|3D)[-\s]?[A-Z0-9][A-Z0-9 \-/&'.]{1,40}|"
    r"[A-Z][A-Z0-9]+(?:\s+[A-Z0-9&\-/]+){1,5})\b"
)


def ocr(img: Image.Image, psm: int = 6, binary: bool = False) -> str:
    g = ImageOps.grayscale(img)
    w, h = g.size
    if w < 20 or h < 10:
        return ""
    scale = 3 if max(w, h) < 900 else 2
    g = g.resize((max(w * scale, 1), max(h * scale, 1)), Image.Resampling.LANCZOS)
    g = ImageOps.autocontrast(g)
    g = ImageEnhance.Contrast(g).enhance(2.0)
    g = g.filter(ImageFilter.SHARPEN)
    if binary:
        g = g.point(lambda x: 0 if x < 160 else 255)
    # Force RGB PNG path for tesseract (avoid PIL mode quirks / disk blowups)
    g = g.convert("L")
    try:
        return pytesseract.image_to_string(g, config=f"--psm {psm}") or ""
    except Exception as e:
        print(f"[ocr] {e}", file=sys.stderr)
        return ""


def crop_rel(img: Image.Image, box):
    w, h = img.size
    x0, y0, x1, y1 = box
    return img.crop((int(w * x0), int(h * y0), int(w * x1), int(h * y1)))


def clean_name(raw: str) -> str:
    if not raw:
        return ""
    lines = []
    for ln in raw.replace("|", " ").splitlines():
        ln = re.sub(r"[^A-Za-z0-9&\-/' .]", " ", ln)
        ln = re.sub(r"\s+", " ", ln).strip()
        if not ln or len(ln) < 2:
            continue
        if CHROME.match(ln):
            continue
        if re.fullmatch(r"\d+(\.\d+)?\s*(mm)?", ln, re.I):
            continue
        if re.fullmatch(r"\d+\s*[x×]\s*\d+\s*mm", ln, re.I):
            continue
        lines.append(ln)

    blob = " ".join(lines[:4]).upper()
    blob = re.sub(r"\s+", " ", blob).strip(" -_=")
    # Prefer structured product names
    best = ""
    best_score = -1
    for m in NAME_CAND.finditer(blob):
        cand = re.sub(r"\s+", " ", m.group(1)).strip(" -")
        # Drop trailing SIZE/FINISH junk
        cand = re.split(r"\b(?:SIZE|FINISH|SURFACE|THICKNESS|RANDOM)\b", cand)[0].strip(" -")
        if len(cand) < 4:
            continue
        if CHROME.match(cand):
            continue
        score = len(cand)
        if re.match(r"^(CV|SP|END|3D)\b", cand):
            score += 12
        if " " in cand or "-" in cand:
            score += 4
        if score > best_score:
            best_score = score
            best = cand

    if not best and lines:
        # fallback first two non-chrome lines
        best = " ".join(lines[:2]).upper()
        best = re.split(r"\b(?:SIZE|FINISH|SURFACE|THICKNESS)\b", best)[0].strip()

    if not best or len(best) < 3:
        return ""

    # Title-case nicely; keep codes like 3D-1001
    parts = best.split()
    pretty = []
    for p in parts:
        if re.search(r"\d", p) and len(p) <= 8:
            pretty.append(p.upper())
        elif p in {"CV", "SP", "END", "3D", "POS"}:
            pretty.append(p)
        else:
            pretty.append(p[:1].upper() + p[1:].lower() if p else p)
    name = " ".join(pretty)
    # Normalize known prefixes spacing: "Cv Boto Grey"
    name = re.sub(r"^(Cv|Sp|End)\s+", lambda m: m.group(1).title() + " ", name)
    return name.strip(" -/")


def parse_specs(text: str) -> tuple[str, str, str, str]:
    """Return sizeMm, sizeFt, finish, thicknessMm."""
    size_mm = ""
    m = SIZE_MM_RE.search(text)
    if m:
        size_mm = f"{m.group(1)}×{m.group(2)}mm"
    size_ft = ""
    m2 = SIZE_FT_RE.search(text)
    if m2 and int(m2.group(1)) <= 8 and int(m2.group(2)) <= 12:
        size_ft = f"{m2.group(1)}×{m2.group(2)} Ft"
    if not size_ft and size_mm == "600×1200mm":
        size_ft = "2×4 Ft"
    finish = ""
    mf = FINISH_RE.search(text)
    if mf:
        finish = mf.group(1).title().replace("Matt", "Matte")
        if "granulla" in finish.lower():
            finish = "Sparkle With Granulla"
        if "punch" in finish.lower():
            finish = "POS + Punch"
    thick = ""
    # Prefer thickness near the label
    mt = re.search(r"Thickness\s*[:.]?\s*(\d+(?:\.\d+)?)\s*mm", text, re.I)
    if mt:
        thick = mt.group(1)
    return size_mm or "600×1200mm", size_ft or "2×4 Ft", finish or "Carving", thick


def name_quality(name: str) -> str:
    if not name or len(name) < 4:
        return "low"
    if re.match(r"^Sunflora\s", name, re.I):
        return "low"
    if re.search(r"(.)\1{3,}", name):
        return "low"
    letters = sum(1 for c in name if c.isalpha())
    if letters < 4:
        return "low"
    if re.match(r"^(Cv|Sp|End|3D|Subway|Sense)\b", name, re.I):
        return "high"
    if " " in name and letters >= 6:
        return "high"
    return "medium"


def detect_layout(page_img: Image.Image) -> str:
    """Return 'A', 'B', or 'empty' based on OCR hits."""
    a_raw = ocr(crop_rel(page_img, LAYOUT_A_NAME), psm=7) + "\n" + ocr(
        crop_rel(page_img, LAYOUT_A_NAME), psm=6
    )
    a_name = clean_name(a_raw)
    b_names = []
    for box in LAYOUT_B_NAMES:
        raw = ocr(crop_rel(page_img, box), psm=7) + "\n" + ocr(crop_rel(page_img, box), psm=6)
        n = clean_name(raw)
        if n:
            b_names.append(n)

    if len(b_names) >= 2:
        return "B"
    if a_name and name_quality(a_name) in ("high", "medium"):
        return "A"
    if len(b_names) == 1:
        return "B"
    if a_name:
        return "A"
    # mid-page fallback for B-style that missed tight boxes
    mid = ocr(crop_rel(page_img, (0.05, 0.38, 0.65, 0.78)), psm=6)
    hits = [clean_name(ln) for ln in mid.splitlines()]
    hits = [h for h in hits if h and name_quality(h) != "low"]
    if len(hits) >= 2:
        return "B"
    if hits:
        return "A"
    return "empty"


def process_page(page_img: Image.Image, pdf_page: int, dpi: int, save_faces: bool):
    layout = detect_layout(page_img)
    products = []

    if layout == "empty":
        return [
            {
                "id": f"sunflora-c{pdf_page:03d}",
                "pdfPage": pdf_page,
                "slot": 0,
                "layout": "empty",
                "name": "",
                "sizeMm": "",
                "sizeFt": "",
                "finish": "",
                "thicknessMm": "",
                "surface": "Floor & Wall",
                "category": "Tiles",
                "subCategory": "Floor & Wall Tiles",
                "textureFile": "",
                "textureUrl": "",
                "nameOcrRaw": "",
                "specsOcrRaw": "",
                "confidence": "low",
            }
        ]

    if layout == "A":
        name_raw = ocr(crop_rel(page_img, LAYOUT_A_NAME), psm=7)
        name_raw += "\n" + ocr(crop_rel(page_img, LAYOUT_A_NAME), psm=6, binary=True)
        specs_raw = ocr(crop_rel(page_img, LAYOUT_A_SPECS), psm=6)
        name = clean_name(name_raw)
        size_mm, size_ft, finish, thick = parse_specs(specs_raw + "\n" + name_raw)
        faces = FACE_A
        tex_files = []
        if save_faces:
            for i, box in enumerate(faces, start=1):
                face = crop_rel(page_img, box)
                if face.size[0] < 40 or face.size[1] < 30:
                    continue
                fname = f"sunflora-p{pdf_page:02d}-t{i}-clean.webp"
                face.save(OUT_SWATCH / fname, "WEBP", quality=92, method=4)
                tex_files.append(fname)
        primary = tex_files[0] if tex_files else f"sunflora-p{pdf_page:02d}-t1-clean.webp"
        products.append(
            {
                "id": f"sunflora-c{pdf_page:03d}",
                "pdfPage": pdf_page,
                "slot": 1,
                "layout": "A",
                "name": name,
                "sizeMm": size_mm,
                "sizeFt": size_ft,
                "finish": finish,
                "thicknessMm": thick,
                "surface": "Floor & Wall",
                "category": "Tiles",
                "subCategory": "Floor & Wall Tiles",
                "textureFile": primary,
                "textureUrl": f"/assets/catalogue/clean_swatches/{primary}",
                "nameOcrRaw": re.sub(r"\s+", " ", name_raw).strip()[:200],
                "specsOcrRaw": re.sub(r"\s+", " ", specs_raw).strip()[:200],
                "confidence": name_quality(name),
            }
        )
        return products

    # Layout B — two products; catalogue has one ID per page, so join names
    names = []
    specs_all = []
    for bi, box in enumerate(LAYOUT_B_NAMES):
        raw = ocr(crop_rel(page_img, box), psm=7) + "\n" + ocr(crop_rel(page_img, box), psm=6)
        n = clean_name(raw)
        if n:
            names.append(n)
        sraw = ocr(crop_rel(page_img, LAYOUT_B_SPECS[bi]), psm=6)
        specs_all.append(sraw)
        if save_faces and bi < len(FACE_B):
            face = crop_rel(page_img, FACE_B[bi])
            if face.size[0] >= 40 and face.size[1] >= 30:
                fname = f"sunflora-p{pdf_page:02d}-t{bi + 1}-clean.webp"
                face.save(OUT_SWATCH / fname, "WEBP", quality=92, method=4)

    # mid-page recovery if tight boxes failed
    if len(names) < 2:
        mid = ocr(crop_rel(page_img, (0.05, 0.38, 0.65, 0.78)), psm=6)
        for ln in mid.splitlines():
            n = clean_name(ln)
            if n and n not in names and name_quality(n) != "low":
                names.append(n)
            if len(names) >= 2:
                break

    specs_blob = "\n".join(specs_all)
    size_mm, size_ft, finish, thick = parse_specs(specs_blob)
    if len(names) >= 2:
        name = f"{names[0]} / {names[1]}"
        conf = "medium" if all(name_quality(n) != "low" for n in names[:2]) else "low"
    elif names:
        name = names[0]
        conf = name_quality(name)
    else:
        name = ""
        conf = "low"

    primary = f"sunflora-p{pdf_page:02d}-t1-clean.webp"
    products.append(
        {
            "id": f"sunflora-c{pdf_page:03d}",
            "pdfPage": pdf_page,
            "slot": 1 if len(names) <= 1 else 2,
            "layout": "B",
            "name": name,
            "altNames": " | ".join(names),
            "sizeMm": size_mm,
            "sizeFt": size_ft,
            "finish": finish,
            "thicknessMm": thick,
            "surface": "Floor & Wall",
            "category": "Tiles",
            "subCategory": "Floor & Wall Tiles",
            "textureFile": primary,
            "textureUrl": f"/assets/catalogue/clean_swatches/{primary}",
            "nameOcrRaw": re.sub(r"\s+", " ", " | ".join(names)).strip()[:200],
            "specsOcrRaw": re.sub(r"\s+", " ", specs_blob).strip()[:200],
            "confidence": conf,
        }
    )
    return products


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", type=Path, default=PDF_DEFAULT)
    ap.add_argument("--dpi", type=int, default=220)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--end", type=int, default=0, help="1-based inclusive; 0=all")
    ap.add_argument("--no-faces", action="store_true", help="skip rewriting face webps")
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
        rows = process_page(img, page_1, args.dpi, save_faces=not args.no_faces)
        for r in rows:
            print(
                f"   {r['id']} [{r['layout']}]: {r['name'] or '—'} | "
                f"{r['sizeMm'] or '?'} | {r['finish'] or '?'} | {r['confidence']}"
            )
        all_rows.extend(rows)
        # free memory
        del img, pix

    fields = [
        "id",
        "name",
        "altNames",
        "sizeMm",
        "sizeFt",
        "finish",
        "thicknessMm",
        "surface",
        "pdfPage",
        "slot",
        "layout",
        "textureFile",
        "textureUrl",
        "confidence",
        "nameOcrRaw",
        "specsOcrRaw",
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
    print(f"\nDone. {len(all_rows)} rows, {named} named, {high} high.")
    print("CSV:", OUT_CSV)
    print("JSON:", OUT_JSON)


if __name__ == "__main__":
    main()
