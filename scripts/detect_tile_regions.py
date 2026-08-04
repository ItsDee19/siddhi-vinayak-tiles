"""
Locate the real swatch photo and its nearby text label for every live tile
product in the three "hard" catalogues (gt2025, sky12x18, sunflora), whose
page layouts vary too much for a fixed crop box to work reliably.

Approach, per product id (e.g. "gt2025-c141"):
  1. Recompute which page + reference point that id was sampled from, using
     the EXACT same page range / counter logic as the live extractor in
     scripts/extract_clean_tiles.py, so ids line up 1:1 with importedCatalogue.js.
  2. Detect all photo-like rectangles on that page via OpenCV contours.
  3. Find whichever detected rectangle contains (or is nearest) the reference
     point -- that is the real swatch region the original extractor was aiming
     at, however wrong its own crop box may have been.
  4. Crop a label-candidate band directly BELOW that region, and a second one
     directly ABOVE it (labels sit in either place depending on family/page).
  5. Save both crops + a debug overlay. OCR happens separately in Node
     (scripts/ocr_tile_names.mjs) since no tesseract binary is installed here.

Nothing is written to importedCatalogue.js by this script or its OCR partner.

Usage:
    python scripts/detect_tile_regions.py --family gt2025 [--limit 20]
    python scripts/detect_tile_regions.py --family sky12x18
    python scripts/detect_tile_regions.py --family sunflora
"""

import argparse
import json
import os

import cv2
import fitz
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK_DIR = os.path.join(ROOT, ".tile-name-work")
DPI = 300
SCALE = DPI / 72

PDF_PATHS = {
    "gt2025": r"C:\Users\KIIT\Downloads\GLOBAL TILES 2025 CATALOGUE.pdf",
    "sky12x18": r"C:\Users\KIIT\Downloads\(12X18) SKY PDF.pdf",
    "sunflora": r"C:\Users\KIIT\Downloads\SUNFLORA 2X4 (NEW DES).pdf",
}


def page_to_cv(page):
    mat = fitz.Matrix(SCALE, SCALE)
    pix = page.get_pixmap(matrix=mat)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def detect_photo_regions(img):
    """Find rectangular photo-like regions anywhere on the page.

    A tile swatch photo has real texture (lots of edges close together);
    text and flat background do not. Contour on Canny edges, then keep
    boxes whose internal edge density looks photographic.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 30, 110)
    dilated = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=2)
    contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    h, w = img.shape[:2]
    boxes = []
    for c in contours:
        x, y, bw, bh = cv2.boundingRect(c)
        if bw < w * 0.03 or bh < h * 0.02:
            continue
        if bw > w * 0.65 or bh > h * 0.65:
            continue
        aspect = bw / float(bh or 1)
        if not (0.4 <= aspect <= 4.5):
            continue
        region = gray[y : y + bh, x : x + bw]
        # Photographic content has high local edge density; flat UI chrome/text
        # blocks are mostly blank with a few thin strokes.
        density = cv2.Canny(region, 30, 110).mean()
        if density < 8:
            continue
        boxes.append((x, y, bw, bh, density))

    # Dedupe heavily-overlapping boxes, prefer higher texture density.
    boxes.sort(key=lambda b: -b[4])
    kept = []
    for b in boxes:
        x, y, bw, bh, _ = b
        overlap = False
        for kx, ky, kw, kh, _ in kept:
            ix0, iy0 = max(x, kx), max(y, ky)
            ix1, iy1 = min(x + bw, kx + kw), min(y + bh, ky + kh)
            iw, ih = max(0, ix1 - ix0), max(0, iy1 - iy0)
            if iw * ih > 0.6 * min(bw * bh, kw * kh):
                overlap = True
                break
        if not overlap:
            kept.append(b)
    return [(x, y, bw, bh) for x, y, bw, bh, _ in kept]


def crop_fixed_label_bands(img, x0, y0, x1, y1):
    """Bands directly below/above the family's OWN fixed reference box
    (widened generously) -- this is the primary, reliable path. Spot checks
    against real rendered pages show the original extractor's fixed boxes
    already bound the true swatch reasonably well on most single-swatch
    layouts; what varies is exactly how far below the label sits, so the
    search band is generous and OCR + regex do the rest downstream."""
    H, W = img.shape[:2]
    bx0, by0, bx1, by1 = int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)
    bw = bx1 - bx0
    band_h = int(H * 0.10)
    pad = int(bw * 0.15)

    below = img[min(H, by1) : min(H, by1 + band_h), max(0, bx0 - pad) : min(W, bx1 + pad)]
    above = img[max(0, by0 - band_h) : by0, max(0, bx0 - pad) : min(W, bx1 + pad)]
    return below, above


def find_region_at_point(regions, px, py):
    """Region containing the point, else the nearest one."""
    containing = [r for r in regions if r[0] <= px <= r[0] + r[2] and r[1] <= py <= r[1] + r[3]]
    if containing:
        return min(containing, key=lambda r: r[2] * r[3])
    if not regions:
        return None

    def dist(r):
        x, y, w, h = r
        cx, cy = x + w / 2, y + h / 2
        return (cx - px) ** 2 + (cy - py) ** 2

    return min(regions, key=dist)


def crop_label_bands(img, region):
    """Bands directly below and above a detected swatch region."""
    x, y, w, h = region
    H, W = img.shape[:2]
    band_h = max(24, int(h * 0.28))

    below = img[min(H, y + h) : min(H, y + h + band_h), max(0, x - int(w * 0.1)) : min(W, x + w + int(w * 0.1))]
    above_y0 = max(0, y - band_h)
    above = img[above_y0:y, max(0, x - int(w * 0.1)) : min(W, x + w + int(w * 0.1))]
    return below, above


# ── Per-family reference-point generators, mirroring extract_clean_tiles.py ──


def refs_gt2025(doc):
    """Yields (id, page_index, box) for every gt2025-cNNN, matching the
    live extractor's fixed quadrant scheme and card_index counting exactly."""
    quadrants = [
        (0.02, 0.11, 0.17, 0.17),
        (0.02, 0.53, 0.17, 0.59),
        (0.52, 0.11, 0.67, 0.17),
        (0.52, 0.53, 0.67, 0.59),
    ]
    card_index = 141
    for page_num in range(2, min(75, len(doc))):
        for box in quadrants:
            cid = f"gt2025-c{card_index:03d}"
            yield cid, page_num, box
            card_index += 1


def refs_sky12x18(doc):
    # Mirrors extract_pdf5's own live box exactly: (0.05,0.08)-(0.48,0.80) and
    # (0.52,0.08)-(0.95,0.80). That box spans the whole stacked column, so the
    # label search additionally checks a slice under the TOP THIRD of it
    # (where the first, most-often-referenced swatch in a stack sits).
    card_counter = 1
    for page_idx in range(0, len(doc)):
        for x0, x1 in [(0.05, 0.48), (0.52, 0.95)]:
            cid = f"sky12x18-c{card_counter:03d}"
            yield cid, page_idx, (x0, 0.08, x1, 0.34)
            card_counter += 1


def refs_sunflora(doc):
    # Live box (0.55,0.05)-(0.95,0.45) turned out to miss the swatch entirely
    # on 2-product pages (verified against a real rendered page); search the
    # label band under BOTH the original box and mirrored left-side box,
    # since some pages place the swatch on the left instead.
    card_counter = 1
    for page_idx in range(0, len(doc)):
        cid = f"sunflora-c{card_counter:03d}"
        yield cid, page_idx, (0.55, 0.05, 0.95, 0.45)
        card_counter += 1


REF_GENERATORS = {"gt2025": refs_gt2025, "sky12x18": refs_sky12x18, "sunflora": refs_sunflora}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--family", required=True, choices=list(PDF_PATHS.keys()))
    ap.add_argument("--limit", type=int, default=None, help="stop after N ids, for quick testing")
    args = ap.parse_args()

    pdf_path = PDF_PATHS[args.family]
    out_dir = os.path.join(WORK_DIR, args.family)
    os.makedirs(out_dir, exist_ok=True)

    doc = fitz.open(pdf_path)
    gen = REF_GENERATORS[args.family](doc)

    page_cache = {}
    entries = []
    n = 0
    for cid, page_idx, box in gen:
        if args.limit and n >= args.limit:
            break
        n += 1
        if page_idx not in page_cache:
            page_cache.clear()  # keep memory bounded; pages are visited in order
            page_cache[page_idx] = page_to_cv(doc[page_idx])
        img = page_cache[page_idx]
        h, w = img.shape[:2]
        x0, y0, x1, y1 = box
        px, py = (x0 + x1) / 2 * w, (y0 + y1) / 2 * h

        candidates = {}

        # Primary path: generous band directly under/over the family's own
        # fixed reference box (verified against real pages to usually bound
        # the true swatch reasonably; label distance below it is what varies).
        fb, fa = crop_fixed_label_bands(img, x0, y0, x1, y1)
        candidates["fixed_below"] = fb
        candidates["fixed_above"] = fa

        # Secondary path: mirrored box on the opposite side of the page --
        # some sunflora pages place the swatch on the left instead of right.
        mx0, mx1 = 1 - x1, 1 - x0
        mfb, mfa = crop_fixed_label_bands(img, mx0, y0, mx1, y1)
        candidates["mirrored_below"] = mfb
        candidates["mirrored_above"] = mfa

        # Fallback path: detected photo region nearest the reference point,
        # for pages where the fixed box misses badly.
        regions = detect_photo_regions(img)
        region = find_region_at_point(regions, px, py)
        if region is not None:
            rb, ra = crop_label_bands(img, region)
            candidates["region_below"] = rb
            candidates["region_above"] = ra

        entry = {"id": cid, "page": page_idx + 1, "status": "ok", "crops": {}}
        for name, crop in candidates.items():
            if crop is None or crop.size == 0 or crop.shape[0] <= 4 or crop.shape[1] <= 4:
                continue
            path = os.path.join(out_dir, f"{cid}__{name}.png")
            cv2.imwrite(path, crop)
            entry["crops"][name] = os.path.relpath(path, ROOT)
        entries.append(entry)

    manifest_path = os.path.join(out_dir, "regions.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=1)

    ok = sum(1 for e in entries if e["status"] == "ok")
    print(f"{args.family}: {len(entries)} ids processed, {ok} matched a photo region")
    print(f"manifest: {os.path.relpath(manifest_path, ROOT)}")


if __name__ == "__main__":
    main()
