"""Re-OCR weak Sunflora pages with larger, multi-pass crops."""
from __future__ import annotations

import json
import re
from pathlib import Path

import fitz
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PDF = Path(r"C:\Users\KIIT\Downloads\SUNFLORA 2X4 (NEW DES).pdf")
EXTRACT = ROOT / "scripts" / "sunflora-catalogue-structured.json"
TESS = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
if TESS.exists():
    pytesseract.pytesseract.tesseract_cmd = str(TESS)

# Pages that still look wrong after merge
WEAK_PAGES = [14, 19, 21, 22, 23, 24, 25, 26, 27, 28, 35, 36]

CHROME = re.compile(
    r"size|finish|random|thickness|surface|carving|glossy|matte|mm|pcs|"
    r"collection|exquisite|mozilla|elegant|tap to|www",
    re.I,
)
PREFIX = re.compile(
    r"\b((?:CV|SP|END|3D|SUBWAY|SENSE|PRESTIGE|MONOSTONE|MOZO|MOZLO|FORT|"
    r"DIAMOND|ENDLESS)\s+[A-Z0-9][A-Z0-9 \-/&']{2,40})",
    re.I,
)


def ocr(img: Image.Image, psm: int = 6) -> str:
    g = ImageOps.grayscale(img)
    w, h = g.size
    g = g.resize((w * 3, h * 3), Image.Resampling.LANCZOS)
    g = ImageOps.autocontrast(g)
    g = ImageEnhance.Contrast(g).enhance(2.2)
    g = g.filter(ImageFilter.SHARPEN)
    try:
        return pytesseract.image_to_string(g, config=f"--psm {psm}") or ""
    except Exception:
        return ""


def candidates(text: str) -> list[str]:
    out = []
    blob = re.sub(r"\s+", " ", text).upper()
    for m in PREFIX.finditer(blob):
        cand = m.group(1).strip()
        cand = re.split(r"\b(?:SIZE|FINISH|SURFACE|THICKNESS|RANDOM)\b", cand)[0].strip()
        if CHROME.search(cand):
            continue
        if len(cand) < 6:
            continue
        # title
        parts = []
        for w in cand.split():
            if re.search(r"\d", w):
                parts.append(w)
            else:
                parts.append(w[:1] + w[1:].lower())
        pretty = " ".join(parts)
        if pretty not in out:
            out.append(pretty)
    return out


def score(n: str) -> int:
    if not n:
        return -1
    letters = sum(c.isalpha() for c in n)
    toks = n.split()
    s = letters
    if re.match(r"^(Cv|Sp|End|Subway|Sense|Prestige|Monostone|Fort|Mozo|Diamond|3D)\b", n, re.I):
        s += 15
    if any(len(t) <= 1 for t in toks):
        s -= 10
    if re.search(r"(.)\1{3,}", n):
        s -= 20
    return s


def main():
    data = json.loads(EXTRACT.read_text(encoding="utf-8"))
    by_page = {p["pdfPage"]: p for p in data["products"]}
    doc = fitz.open(str(PDF))

    for page in WEAK_PAGES:
        if page not in by_page:
            continue
        pix = doc[page - 1].get_pixmap(dpi=260, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        W, H = img.size
        regions = [
            img.crop((int(W * 0.50), int(H * 0.45), int(W * 0.98), int(H * 0.70))),
            img.crop((int(W * 0.05), int(H * 0.38), int(W * 0.62), int(H * 0.50))),
            img.crop((int(W * 0.05), int(H * 0.55), int(W * 0.62), int(H * 0.68))),
            img.crop((int(W * 0.05), int(H * 0.38), int(W * 0.65), int(H * 0.80))),
        ]
        found = []
        for reg in regions:
            raw = ocr(reg, 6) + "\n" + ocr(reg, 7)
            for c in candidates(raw):
                if c not in found:
                    found.append(c)
        found = sorted(found, key=score, reverse=True)
        p = by_page[page]
        if len(found) >= 2 and score(found[0]) > 10 and score(found[1]) > 10:
            # avoid near-duplicates
            a, b = found[0], found[1]
            if a.lower() not in b.lower() and b.lower() not in a.lower():
                name = f"{a} / {b}"
            else:
                name = a
            p["name"] = name
            p["confidence"] = "high"
            p["layout"] = "B" if "/" in name else p.get("layout", "A")
        elif found and score(found[0]) > 10:
            p["name"] = found[0]
            p["confidence"] = "high"
        print(f"p{page}: {p['name'] or '—'}  candidates={found[:4]}")

    # normalize END → End
    for p in data["products"]:
        if p.get("name"):
            p["name"] = re.sub(r"^END\b", "End", p["name"])
            p["name"] = re.sub(r"^SP\b", "Sp", p["name"])
            p["name"] = re.sub(r"^CV\b", "Cv", p["name"])
            # drop trailing garbage after dual slash
            if " / " in p["name"]:
                left, right = p["name"].split(" / ", 1)
                if score(right) < 8:
                    p["name"] = left.strip()
                    p["confidence"] = "medium" if score(left) > 10 else "low"

    data["named"] = sum(1 for p in data["products"] if p.get("name"))
    data["highConfidence"] = sum(1 for p in data["products"] if p.get("confidence") == "high")
    EXTRACT.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nnamed={data['named']} high={data['highConfidence']}")


if __name__ == "__main__":
    main()
