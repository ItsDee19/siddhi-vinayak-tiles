"""
Weak-name review pass across all catalogue families.

1. Sunflora: mark cover/divider as non-product
2. Sky: multi-pass re-OCR of remaining weak pages
3. Wall (gt2025): salvage good ocrName codes from weak CSV + re-OCR subset
4. Floor: multi-pass re-OCR of placeholder slots

Updates structured JSON files (not catalogue JS — run apply_* after).

  python scripts/review_weak_names.py
  python scripts/review_weak_names.py --family sky
  python scripts/review_weak_names.py --family wall --limit 20
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
TESS = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
if TESS.exists():
    pytesseract.pytesseract.tesseract_cmd = str(TESS)

PDFS = {
    "sunflora": Path(r"C:\Users\KIIT\Downloads\SUNFLORA 2X4 (NEW DES).pdf"),
    "sky": Path(r"C:\Users\KIIT\Downloads\(12X18) SKY PDF.pdf"),
    "wall": Path(r"C:\Users\KIIT\Downloads\GLOBAL TILES 2025 CATALOGUE.pdf"),
    "floor": Path(r"C:\Users\KIIT\Downloads\GLOBAL TILES FLOOR CATALOGUE.pdf"),
}

CHROME = re.compile(
    r"^(size|finish|glossy|matte|matt|tiles?|global|packing|weight|approx|"
    r"pcs?|kg|page|digital|exclusive|coverage|area|net|white|grey|gray|"
    r"premium|dimension|pull-out|mrp|with|riser|plain|user|suspect|"
    r"collection|carving|random|thickness|surface)$",
    re.I,
)
WALL_CODE = re.compile(r"\b([A-Z]{1,3}-?\d{1,4}[A-Z]?|\d{3,5}-?[A-Z]{1,3})\b", re.I)
WALL_NAME = re.compile(r"\b([A-Z][A-Za-z0-9]+(?:[-/][A-Za-z0-9]+){0,3})\b")
FLOOR_CODE = re.compile(r"\b([A-Z]-?\d{4,6})\b", re.I)
FLOOR_NAME_FIN = re.compile(
    r"([A-Z][A-Z0-9 \-/'&.]{2,40}?)\s*\(\s*(Glossy|Matte|Matt|Carving|Polished)\s*\)",
    re.I,
)
SKY_CODE = re.compile(
    r"\b((?:ARCH[-\s]?WHITE)|(?:WOOD[-\s]?\d+[-\s]?[A-Z]{0,3})|"
    r"(?:\d{2,5}[-\s]?[A-Z]{1,6}))\b",
    re.I,
)
JUNK_SKY = {"74-HIME", "74HIME", "HIME", "4002-I"}


def ocr(img: Image.Image, psm: int = 6, scale: int = 3) -> str:
    g = ImageOps.grayscale(img)
    w, h = g.size
    if w < 8 or h < 6:
        return ""
    g = g.resize((max(w * scale, 1), max(h * scale, 1)), Image.Resampling.LANCZOS)
    g = ImageOps.autocontrast(g)
    g = ImageEnhance.Contrast(g).enhance(2.0)
    g = g.filter(ImageFilter.SHARPEN)
    try:
        return pytesseract.image_to_string(g, config=f"--psm {psm}") or ""
    except Exception:
        return ""


def crop_rel(img: Image.Image, box):
    w, h = img.size
    x0, y0, x1, y1 = box
    return img.crop((int(w * x0), int(h * y0), int(w * x1), int(h * y1)))


def title_name(s: str) -> str:
    parts = []
    for w in re.split(r"[\s]+", s.strip()):
        if not w:
            continue
        if re.search(r"\d", w) and len(w) <= 10:
            parts.append(w.upper())
        else:
            parts.append(w[:1].upper() + w[1:].lower())
    return " ".join(parts)


def is_good_product_name(name: str, family: str) -> bool:
    if not name or len(name) < 3 or len(name) > 48:
        return False
    if CHROME.match(name):
        return False
    if re.match(r"^(Global|Sunflora|Sky 12x18|Skype Tile)\b", name, re.I):
        return False
    if re.search(r"(.)\1{3,}", name):
        return False
    if family == "sky":
        n = name.upper().replace(" ", "-")
        if n in JUNK_SKY or n.startswith("74-"):
            return False
        return bool(SKY_CODE.fullmatch(n.replace("--", "-")))
    if family == "wall":
        if re.match(r"^Hl-\d", name, re.I):
            return False
        if re.match(r"^(Parken|Eevee|Fated)$", name, re.I):
            return True
        if WALL_CODE.fullmatch(name.replace(" ", "")):
            return True
        letters = sum(c.isalpha() for c in name)
        return letters >= 4 and len(name) <= 28 and not re.search(r"[^A-Za-z0-9 \-/]", name)
    if family == "floor":
        if FLOOR_CODE.fullmatch(name.replace(" ", "")):
            return True
        letters = sum(c.isalpha() for c in name)
        return letters >= 4 and not re.search(r"coverage|weight|page", name, re.I)
    return True


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: dict):
    data["named"] = sum(1 for p in data.get("products", []) if p.get("name"))
    data["highConfidence"] = sum(
        1 for p in data.get("products", []) if p.get("confidence") == "high"
    )
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def rewrite_csv_from_json(json_path: Path, csv_path: Path):
    data = load_json(json_path)
    products = data.get("products") or []
    if not products:
        return
    fields = list(products[0].keys())
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for p in products:
            w.writerow(p)


# ── Sunflora ──────────────────────────────────────────────────────────────


def review_sunflora():
    path = ROOT / "scripts/sunflora-catalogue-structured.json"
    data = load_json(path)
    changed = 0
    for p in data["products"]:
        if p["id"] in ("sunflora-c001", "sunflora-c002"):
            p["name"] = ""
            p["confidence"] = "non_product"
            p["layout"] = "empty"
            p["note"] = "cover/divider page — not a product"
            changed += 1
        elif p.get("confidence") == "low" and not p.get("name"):
            p["confidence"] = "placeholder"
    save_json(path, data)
    rewrite_csv_from_json(path, ROOT / "scripts/sunflora-catalogue-structured.csv")
    print(f"[sunflora] marked covers non_product (touched {changed})")


# ── Sky ───────────────────────────────────────────────────────────────────


def extract_sky_code(raw: str) -> str:
    best, score = "", -1
    for m in SKY_CODE.finditer(raw.upper()):
        cand = m.group(1).replace(" ", "-")
        cand = re.sub(r"-+", "-", cand).strip("-")
        if cand in JUNK_SKY or cand.startswith("74-") or cand == "450X300":
            continue
        s = len(cand)
        if "ARCH" in cand or "WOOD" in cand:
            s += 12
        if re.search(r"\d", cand) and re.search(r"[A-Z]", cand):
            s += 8
        if s > score:
            score = s
            best = cand
    return best


def review_sky(limit: int = 0):
    path = ROOT / "scripts/sky12x18-catalogue-structured.json"
    data = load_json(path)
    weak_csv = ROOT / "scripts/sky12x18-weak-slots-remaining.csv"
    weak_ids = set()
    if weak_csv.exists():
        with weak_csv.open(encoding="utf-8") as f:
            for r in csv.DictReader(f):
                weak_ids.add(r["id"])
    # also any without good name
    for p in data["products"]:
        if not is_good_product_name(p.get("name") or "", "sky"):
            weak_ids.add(p["id"])

    pdf = PDFS["sky"]
    if not pdf.exists():
        print("[sky] PDF missing")
        return
    doc = fitz.open(str(pdf))
    fixed = 0
    boxes = [
        (0.03, 0.01, 0.55, 0.22),
        (0.02, 0.00, 0.98, 0.18),
        (0.05, 0.08, 0.48, 0.28),
        (0.50, 0.00, 0.98, 0.20),
    ]
    targets = [p for p in data["products"] if p["id"] in weak_ids]
    if limit:
        targets = targets[:limit]
    print(f"[sky] re-OCR {len(targets)} weak slots…")
    for p in targets:
        page = int(p.get("pdfPage") or 0)
        if page < 1 or page > len(doc):
            continue
        pix = doc[page - 1].get_pixmap(dpi=240, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        raws = []
        for box in boxes:
            c = crop_rel(img, box)
            raws.append(ocr(c, 6, scale=3))
            raws.append(ocr(c, 11, scale=2))
        blob = "\n".join(raws)
        code = extract_sky_code(blob)
        # ARCH-WHITE special from full blob
        if not code and re.search(r"ARCH[-\s]?WHITE", blob, re.I):
            code = "ARCH-WHITE"
        if code and is_good_product_name(code, "sky"):
            p["name"] = code
            p["confidence"] = "high"
            p["nameOcrRaw"] = re.sub(r"\s+", " ", blob).strip()[:200]
            fixed += 1
            print(f"  {p['id']}: {code}")
        else:
            p["name"] = ""
            p["confidence"] = "placeholder"
            p["nameOcrRaw"] = re.sub(r"\s+", " ", blob).strip()[:200]
            print(f"  {p['id']}: still weak | {blob[:80]!r}")
        del img, pix
    save_json(path, data)
    rewrite_csv_from_json(path, ROOT / "scripts/sky12x18-catalogue-structured.csv")
    print(f"[sky] fixed {fixed}/{len(targets)}")


# ── Wall ──────────────────────────────────────────────────────────────────


def salvage_wall_name(ocr: str) -> str:
    if not ocr:
        return ""
    ocr = ocr.strip()
    # Prefer product codes
    codes = WALL_CODE.findall(ocr)
    for c in sorted(codes, key=len, reverse=True):
        c2 = c.upper() if re.search(r"\d", c) else title_name(c)
        # normalize Lx-66 style
        c2 = re.sub(r"^([A-Za-z]+)-?(\d+)", lambda m: f"{m.group(1).title()}-{m.group(2)}", c2)
        if is_good_product_name(c2, "wall"):
            return c2
    # word names
    for m in WALL_NAME.finditer(ocr):
        cand = title_name(m.group(1))
        if is_good_product_name(cand, "wall") and len(cand) >= 5:
            return cand
    if is_good_product_name(title_name(ocr), "wall"):
        return title_name(ocr)
    return ""


def review_wall(limit: int = 0, reocr: bool = True):
    path = ROOT / "scripts/gt2025-catalogue-structured.json"
    data = load_json(path)
    by_id = {p["id"]: p for p in data["products"]}
    weak_csv = ROOT / "scripts/gt2025-weak-slots-remaining.csv"
    salvaged = 0
    still = []

    if weak_csv.exists():
        with weak_csv.open(encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
    else:
        rows = [
            {"id": p["id"], "ocrName": p.get("name") or p.get("nameOcrRaw", "")}
            for p in data["products"]
            if p.get("confidence") != "high"
        ]

    # First pass: salvage ocrName from weak CSV
    for r in rows:
        pid = r["id"]
        p = by_id.get(pid)
        if not p:
            continue
        ocr_n = r.get("ocrName") or p.get("name") or p.get("nameOcrRaw") or ""
        name = salvage_wall_name(ocr_n)
        if name:
            p["name"] = name
            p["confidence"] = "high"
            salvaged += 1
            print(f"  salvage {pid}: {name}")
        else:
            still.append(p)

    # Second pass: re-OCR remaining with face name band
    if reocr and still and PDFS["wall"].exists():
        doc = fitz.open(str(PDFS["wall"]))
        # chip order TL, BL, TR, BR — name under chip
        chips = [
            (0.02, 0.28, 0.22, 0.36),
            (0.02, 0.68, 0.22, 0.76),
            (0.52, 0.28, 0.72, 0.36),
            (0.52, 0.68, 0.72, 0.76),
        ]
        targets = still[: limit or len(still)]
        print(f"[wall] re-OCR {len(targets)} remaining…")
        for p in targets:
            page = int(p.get("pdfPage") or 0)
            variant = int(p.get("variant") or 1)
            if page < 1 or page > len(doc):
                continue
            pix = doc[page - 1].get_pixmap(dpi=260, alpha=False)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            box = chips[min(max(variant - 1, 0), 3)]
            # also slightly larger band
            bands = [
                box,
                (box[0] - 0.01, box[1] - 0.02, box[2] + 0.06, box[3] + 0.04),
                (box[0], box[1] - 0.08, box[2] + 0.08, box[3]),  # on-chip bottom
            ]
            raw = ""
            for b in bands:
                c = crop_rel(img, b)
                raw += "\n" + ocr(c, 7) + "\n" + ocr(c, 6)
            name = salvage_wall_name(raw)
            if name:
                p["name"] = name
                p["confidence"] = "high"
                p["nameOcrRaw"] = re.sub(r"\s+", " ", raw).strip()[:200]
                salvaged += 1
                print(f"  reocr {p['id']}: {name}")
            else:
                p["confidence"] = "placeholder"
                if not re.match(r"^Global Wall", p.get("name") or ""):
                    # keep empty for placeholder apply
                    pass
            del img, pix

    save_json(path, data)
    rewrite_csv_from_json(path, ROOT / "scripts/gt2025-catalogue-structured.csv")
    high = sum(1 for p in data["products"] if p.get("confidence") == "high" and p.get("name"))
    print(f"[wall] salvaged/reocr total high-ish now {high}; this pass +{salvaged}")


# ── Floor ─────────────────────────────────────────────────────────────────


def clean_floor_name(raw: str) -> str:
    if not raw:
        return ""
    m = FLOOR_NAME_FIN.search(raw)
    if m:
        base = re.sub(r"\s+", " ", m.group(1)).strip(" -")
        if base and not CHROME.match(base):
            return title_name(base)
    codes = FLOOR_CODE.findall(raw)
    if codes:
        return max(codes, key=len).upper()
    best, score = "", -1
    for ln in raw.splitlines():
        ln = re.sub(r"\s+", " ", ln).strip(" -•")
        if not ln or CHROME.match(ln):
            continue
        if re.search(r"\d{2,4}\s*[x×]\s*\d|kgs?|packing|coverage|weight", ln, re.I):
            continue
        letters = sum(c.isalpha() for c in ln)
        if letters < 4:
            continue
        s = letters
        if re.search(r"\((Glossy|Matte|Carving)\)", ln, re.I):
            s += 10
        if s > score:
            score = s
            best = re.sub(r"\s*\([^)]*\)\s*$", "", ln).strip()
    if best and score >= 6:
        t = title_name(best)
        if is_good_product_name(t, "floor"):
            return t
    return ""


def review_floor(limit: int = 0):
    path = ROOT / "scripts/floor-catalogue-structured.json"
    data = load_json(path)
    weak = [
        p
        for p in data["products"]
        if p.get("confidence") == "placeholder"
        or not is_good_product_name(p.get("name") or "", "floor")
        or re.match(r"^Global Floor", p.get("name") or "", re.I)
    ]
    if limit:
        weak = weak[:limit]
    pdf = PDFS["floor"]
    if not pdf.exists():
        print("[floor] PDF missing")
        return
    doc = fitz.open(str(pdf))
    print(f"[floor] re-OCR {len(weak)} weak slots…")
    fixed = 0
    # Floor layout: L/R products — name near top of each half
    for p in weak:
        page = int(p.get("pdfPage") or p.get("cataloguePage") or 0)
        side = (p.get("side") or "L").upper()
        if page < 1:
            # try derive from id
            n = int(re.search(r"c(\d+)$", p["id"]).group(1))
            # floor mapping often catalogue page ≈ id
            page = n
        if page < 1 or page > len(doc):
            continue
        # product spreads start pdf page 3 ≈ catalogue 1; heuristic from existing
        # Prefer pdfPage field from extract
        pdf_page = int(p.get("pdfPage") or 0)
        if not pdf_page:
            # floor extract used pdf page = catalogue index mapping
            pdf_page = page
        if pdf_page > len(doc):
            continue
        pix = doc[pdf_page - 1].get_pixmap(dpi=240, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        W, H = img.size
        if side == "R":
            boxes = [
                (0.52, 0.08, 0.98, 0.22),
                (0.52, 0.12, 0.95, 0.28),
                (0.55, 0.18, 0.95, 0.35),
            ]
        else:
            boxes = [
                (0.02, 0.08, 0.48, 0.22),
                (0.05, 0.12, 0.48, 0.28),
                (0.05, 0.18, 0.45, 0.35),
            ]
        raw = ""
        for b in boxes:
            c = crop_rel(img, b)
            raw += "\n" + ocr(c, 6) + "\n" + ocr(c, 7)
        name = clean_floor_name(raw)
        if name and is_good_product_name(name, "floor"):
            p["name"] = name
            p["confidence"] = "high"
            p["nameOcrRaw"] = re.sub(r"\s+", " ", raw).strip()[:200]
            fixed += 1
            print(f"  {p['id']}: {name}")
        else:
            # keep placeholder
            if not re.match(r"^Global Floor", p.get("name") or ""):
                p["confidence"] = "placeholder"
            print(f"  {p['id']}: still weak")
        del img, pix
    save_json(path, data)
    rewrite_csv_from_json(path, ROOT / "scripts/floor-catalogue-structured.csv")
    print(f"[floor] fixed {fixed}/{len(weak)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--family",
        choices=["all", "sunflora", "sky", "wall", "floor"],
        default="all",
    )
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--no-wall-reocr", action="store_true")
    args = ap.parse_args()

    print("Tesseract:", pytesseract.get_tesseract_version())
    fam = args.family
    if fam in ("all", "sunflora"):
        review_sunflora()
    if fam in ("all", "sky"):
        review_sky(limit=args.limit)
    if fam in ("all", "wall"):
        review_wall(limit=args.limit, reocr=not args.no_wall_reocr)
    if fam in ("all", "floor"):
        review_floor(limit=args.limit)
    print("\nDone. Run apply_* scripts to push into catalogue + calculator seeds.")


if __name__ == "__main__":
    main()
