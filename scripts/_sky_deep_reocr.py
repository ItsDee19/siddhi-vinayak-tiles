"""Deep re-OCR Sky weak pages + use neighbor code sequence hints."""
from __future__ import annotations

import json
import re
from pathlib import Path

import fitz
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PDF = Path(r"C:\Users\KIIT\Downloads\(12X18) SKY PDF.pdf")
EXTRACT = ROOT / "scripts/sky12x18-catalogue-structured.json"
TESS = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
if TESS.exists():
    pytesseract.pytesseract.tesseract_cmd = str(TESS)

CODE_RE = re.compile(
    r"\b((?:ARCH[-\s]?WHITE)|(?:WOOD[-\s]?\d+[-\s]?[A-Z]{0,3})|"
    r"(?:\d{2,5}[-\s]?[A-Z]{1,6})|(?:HLIME|HILME|HIME)|"
    r"(?:SPECIAL)|(?:SP[-\s]?\d{2,5}))\b",
    re.I,
)
JUNK = {"74-HIME", "74HIME", "HIME", "4002-I", "450X300", "SPECIAL", "GLOSSY", "MATTE", "MATT"}


def ocr(img: Image.Image, psm: int = 6, scale: int = 3, invert: bool = False) -> str:
    g = ImageOps.grayscale(img)
    w, h = g.size
    if w < 6 or h < 6:
        return ""
    g = g.resize((max(w * scale, 1), max(h * scale, 1)), Image.Resampling.LANCZOS)
    g = ImageOps.autocontrast(g)
    g = ImageEnhance.Contrast(g).enhance(2.4)
    g = g.filter(ImageFilter.SHARPEN)
    if invert:
        g = ImageOps.invert(g)
    # binary
    g2 = g.point(lambda x: 0 if x < 150 else 255)
    try:
        a = pytesseract.image_to_string(g, config=f"--psm {psm}") or ""
        b = pytesseract.image_to_string(g2, config=f"--psm {psm}") or ""
        return a + "\n" + b
    except Exception:
        return ""


def crop_rel(img, box):
    w, h = img.size
    x0, y0, x1, y1 = box
    return img.crop((int(w * x0), int(h * y0), int(w * x1), int(h * y1)))


def extract_code(blob: str) -> str:
    best, score = "", -1
    for m in CODE_RE.finditer(blob.upper()):
        cand = re.sub(r"\s+", "-", m.group(1).replace(" ", "-"))
        cand = re.sub(r"-+", "-", cand).strip("-")
        if cand in JUNK or cand.startswith("74-"):
            continue
        s = len(cand)
        if re.search(r"\d", cand) and re.search(r"[A-Z]", cand):
            s += 12
        if "WOOD" in cand or "ARCH" in cand:
            s += 15
        if re.search(r"(LT|L|DK|HL)$", cand):
            s += 4
        if s > score:
            score = s
            best = cand
    # spaced digits + suffix: 1 6 0 1 - L T
    spaced = re.search(r"\b(\d)\s+(\d)\s+(\d)\s+(\d)\s*[- ]?\s*([A-Z]{1,3})\b", blob.upper())
    if spaced:
        alt = f"{''.join(spaced.group(i) for i in range(1,5))}-{spaced.group(5)}"
        if score < 20:
            best = alt
    return best


def main():
    data = json.loads(EXTRACT.read_text(encoding="utf-8"))
    by_id = {p["id"]: p for p in data["products"]}
    # ordered list
    products = sorted(data["products"], key=lambda p: int(re.search(r"c(\d+)", p["id"]).group(1)))

    weak = [
        p
        for p in products
        if not p.get("name")
        or p.get("confidence") not in ("high",)
        or re.match(r"^Sky 12x18", p.get("name") or "")
    ]
    print(f"weak count {len(weak)}")

    doc = fitz.open(str(PDF))
    boxes = [
        (0.02, 0.00, 0.55, 0.25),
        (0.02, 0.00, 0.98, 0.22),
        (0.00, 0.00, 0.40, 0.18),
        (0.05, 0.10, 0.50, 0.30),
        (0.30, 0.00, 0.70, 0.15),
        (0.05, 0.85, 0.50, 0.99),  # sometimes code near bottom swatch
    ]

    fixed = 0
    for p in weak:
        page = int(p.get("pdfPage") or 0)
        if page < 1 or page > len(doc):
            continue
        # multi-dpi
        blobs = []
        for dpi in (200, 280):
            pix = doc[page - 1].get_pixmap(dpi=dpi, alpha=False)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            for box in boxes:
                c = crop_rel(img, box)
                for psm in (6, 7, 11):
                    blobs.append(ocr(c, psm=psm, scale=3, invert=False))
                    blobs.append(ocr(c, psm=psm, scale=2, invert=True))
            del img, pix
        blob = "\n".join(blobs)
        code = extract_code(blob)
        print(f"\n{p['id']} p{page}")
        print("  raw snippet:", re.sub(r"\s+", " ", blob)[:160])
        print("  code:", code or "—")
        if code:
            p["name"] = code
            p["confidence"] = "high"
            p["nameOcrRaw"] = re.sub(r"\s+", " ", blob).strip()[:220]
            fixed += 1

    # Neighbor fill: if still weak and neighbors have numeric-LT codes, leave for manual
    # Try SPECIAL COLOUR pages: name as SPECIAL-COLOUR-N
    for p in products:
        if p.get("confidence") == "high" and p.get("name"):
            continue
        raw = p.get("nameOcrRaw") or ""
        if re.search(r"SPECIAL\s*COLOUR", raw, re.I):
            # use page-based label only if nothing better
            pass

    data["named"] = sum(1 for p in data["products"] if p.get("name"))
    data["highConfidence"] = sum(
        1 for p in data["products"] if p.get("confidence") == "high" and p.get("name")
    )
    EXTRACT.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nfixed this pass: {fixed}; high now: {data['highConfidence']}")

    # print still weak with neighbors for manual
    print("\nStill weak (with neighbors):")
    for i, p in enumerate(products):
        if p.get("confidence") == "high" and p.get("name"):
            continue
        prev_n = products[i - 1].get("name") if i else None
        next_n = products[i + 1].get("name") if i + 1 < len(products) else None
        print(
            f"  {p['id']} page {p.get('pdfPage')} | prev={prev_n} | next={next_n}"
        )


if __name__ == "__main__":
    main()
