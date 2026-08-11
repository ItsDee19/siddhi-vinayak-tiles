"""
Re-OCR weak floor catalogue name slots with tighter crops + multi-pass Tesseract.
Updates scripts/floor-catalogue-structured.json and CSV.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

import fitz
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PDF = Path(r"C:\Users\KIIT\Downloads\GLOBAL TILES FLOOR CATALOGUE.pdf")
JSON_PATH = ROOT / "scripts" / "floor-catalogue-structured.json"
CSV_PATH = ROOT / "scripts" / "floor-catalogue-structured.csv"
TESS = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
if TESS.exists():
    pytesseract.pytesseract.tesseract_cmd = str(TESS)

CODE_RE = re.compile(r"\b([A-Z]-?\d{4,6})\b", re.I)
NAME_FINISH_RE = re.compile(
    r"([A-Z][A-Z0-9 \-/'&.]{1,42}?)\s*\(\s*(Glossy|Matte|Matt|Satin|Carving|Polished|Sugar)\s*\)",
    re.I,
)
CHROME = re.compile(
    r"^(size|glossy|matte|matt|vitrified|tiles?|global|packing|weight|approx|pcs?|kg\.?|"
    r"page|digital|exclusive|finish|coverage|area|net|white|ivory|grey|gray)$",
    re.I,
)
JUNK_NAME = re.compile(
    r"coverage\s*area|net\s*weight|page[- ]?\d|^\W+$|^—$|"
    r"^se el$|^est$|^wet$|^aol$|^ied$|^dee$|^take$|^rny$|^ane$|^qaa$|^aad$|^lam$",
    re.I,
)


def is_good(name: str) -> bool:
    if not name or len(name) < 2 or len(name) > 48:
        return False
    if JUNK_NAME.search(name.strip()):
        return False
    # Product codes are valid "names"
    if CODE_RE.fullmatch(name.replace(" ", "")):
        return True
    letters = sum(c.isalpha() for c in name)
    if letters < 3:
        return False
    bad = sum(1 for c in name if c not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -()'/.")
    if bad > 2:
        return False
    if not any(c.isalpha() for c in name):
        return False
    # reject mostly punctuation / single short garbage
    if len(name) <= 3 and not CODE_RE.search(name):
        return False
    return True


def title_name(base: str) -> str:
    base = re.sub(r"\s+", " ", base).strip(" -•·|")
    if CODE_RE.fullmatch(base.replace(" ", "")):
        return CODE_RE.fullmatch(base.replace(" ", "")).group(1).upper()
    return " ".join(
        p.upper() if CODE_RE.fullmatch(p) else p.title()
        for p in base.split()
    )


def clean_name(raw: str) -> str:
    if not raw:
        return ""
    # Prefer NAME (Finish)
    m = NAME_FINISH_RE.search(raw)
    if m:
        base = re.sub(r"\s+", " ", m.group(1)).strip(" -•·|")
        base = re.sub(r"^[^A-Za-z0-9]+", "", base)
        if base and not CHROME.match(base) and is_good(title_name(base)):
            return title_name(base)

    # Standalone code
    codes = CODE_RE.findall(raw)
    if codes:
        # Prefer longer code
        code = max(codes, key=len).upper().replace(" ", "")
        if len(code) >= 5:
            return code

    # Line scoring
    best, best_score = "", -1
    for ln in raw.replace("|", " ").splitlines():
        ln2 = re.sub(r"\s+", " ", ln).strip(" -•·")
        base = re.sub(r"\s*\([^)]*\)\s*$", "", ln2).strip()
        if not base or CHROME.match(base):
            continue
        if re.search(r"\d{2,4}\s*[x×]\s*\d", base, re.I):
            continue
        if re.search(r"kgs?|packing|coverage|weight|page\s*\d", base, re.I):
            continue
        score = 0
        if re.search(r"\((Glossy|Matte|Matt|Carving)\)", ln2, re.I):
            score += 10
        letters = sum(c.isalpha() for c in base)
        score += min(letters, 12)
        if 4 <= len(base) <= 40:
            score += 2
        if re.search(r"[\\|_~`]{2,}", base):
            score -= 5
        if letters < 3:
            score -= 6
        if score > best_score:
            best_score = score
            best = base
    if best and best_score >= 6:
        t = title_name(best)
        return t if is_good(t) else ""
    return ""


def ocr_variants(img: Image.Image) -> list[str]:
    results = []
    w, h = img.size
    # middle strip only
    mid = img.crop((0, int(h * 0.15), w, int(h * 0.85)))
    for crop in (mid, img):
        g = ImageOps.grayscale(crop)
        g = g.resize((g.width * 3, g.height * 3), Image.Resampling.LANCZOS)
        g = ImageOps.autocontrast(g)
        g = ImageEnhance.Contrast(g).enhance(2.2)
        g = g.filter(ImageFilter.SHARPEN)
        bin_img = g.point(lambda x: 0 if x < 170 else 255)
        for im, psm in ((bin_img, 6), (bin_img, 7), (bin_img, 11), (g, 6)):
            try:
                t = pytesseract.image_to_string(im, config=f"--psm {psm}")
                if t and t.strip():
                    results.append(t)
            except Exception:
                pass
    return results


def crop_rel(img, x0, y0, x1, y1):
    w, h = img.size
    return img.crop((int(w * x0), int(h * y0), int(w * x1), int(h * y1)))


def reocr_product(page_img: Image.Image, side: str) -> tuple[str, str]:
    """Return (name, raw) for L or R column."""
    if side == "L":
        x0, x1 = 0.06, 0.48
    else:
        x0, x1 = 0.52, 0.94

    # Multiple vertical bands around the label
    bands = [
        crop_rel(page_img, x0, 0.315, x1, 0.38),
        crop_rel(page_img, x0, 0.325, x1, 0.39),
        crop_rel(page_img, x0, 0.30, x1, 0.40),
        crop_rel(page_img, x0, 0.33, x1, 0.37),
    ]
    best_name, best_raw, best_score = "", "", -1
    for band in bands:
        for raw in ocr_variants(band):
            name = clean_name(raw)
            score = 0
            if name:
                score += 10 + len(name)
            if re.search(r"\((Glossy|Matte|Carving)\)", raw, re.I):
                score += 5
            if CODE_RE.search(raw):
                score += 3
            if score > best_score and name:
                best_score = score
                best_name = name
                best_raw = re.sub(r"\s+", " ", raw).strip()[:200]
    return best_name, best_raw


def main():
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    products = data["products"]
    weak_ids = [p["id"] for p in products if not is_good(p.get("name") or "")]
    print(f"Weak before: {len(weak_ids)} / {len(products)}")

    # Group weak by pdf page
    by_page: dict[int, list] = {}
    for p in products:
        if p["id"] in weak_ids:
            by_page.setdefault(p["pdfPage"], []).append(p)

    doc = fitz.open(str(PDF))
    fixed = 0
    still = []

    for pdf_page, plist in sorted(by_page.items()):
        idx = pdf_page - 1
        if idx < 0 or idx >= doc.page_count:
            continue
        print(f"Re-OCR PDF p{pdf_page} ({len(plist)} weak)…")
        pix = doc[idx].get_pixmap(dpi=280, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        for p in plist:
            name, raw = reocr_product(img, p.get("side") or "L")
            if name and is_good(name):
                old = p.get("name") or ""
                p["name"] = name
                p["nameOcrRaw"] = raw or p.get("nameOcrRaw") or ""
                p["confidence"] = "high"
                # code from name if present
                m = CODE_RE.search(name)
                if m:
                    p["code"] = m.group(1).upper()
                print(f"  {p['id']}: {old!r} → {name!r}")
                fixed += 1
            else:
                still.append(p["id"])
                print(f"  {p['id']}: still weak ({(name or raw or '')[:60]!r})")

    # Final weak list with is_good (includes accepting codes)
    weak_after = [p for p in products if not is_good(p.get("name") or "")]
    # Mark empty / back-matter
    for p in products:
        if p["id"] in ("gt-floor-c138", "gt-floor-c140") or (
            p.get("nameOcrRaw") and re.search(r"coverage\s*area|net\s*weight", p["nameOcrRaw"], re.I)
        ):
            p["confidence"] = "skip"
            p["name"] = p.get("name") if is_good(p.get("name") or "") else ""
            p["note"] = "likely non-product page"

    data["products"] = products
    data["named"] = sum(1 for p in products if is_good(p.get("name") or ""))
    data["weak"] = sum(1 for p in products if not is_good(p.get("name") or ""))
    JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # CSV rewrite
    fields = [
        "id", "name", "code", "sizeMm", "sizeFt", "finish", "pcsPerBox", "boxWeightKg",
        "surface", "bodyType", "cataloguePage", "pdfPage", "variant", "side",
        "textureFile", "textureUrl", "confidence", "nameOcrRaw", "headerOcrRaw", "footerOcrRaw",
    ]
    with CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in products:
            w.writerow(r)

    print(f"\nFixed this pass: {fixed}")
    print(f"Good now: {data['named']} / {len(products)}")
    print(f"Still weak: {data['weak']}")
    if still:
        print("Remaining weak IDs:")
        for i in still:
            print(" ", i)


if __name__ == "__main__":
    main()
