"""
Recovery pass for gt2025 ids on the "chip column + room photo" page template
(confirmed on pages 16+: each quadrant shows 4 small stacked swatch chips
--L/-HL/-D/-F variants -- on the left of one big room photo). The main
extract_tile_swatch_v2.py detector was tuned for a different gt2025 page
style (one big corner label) and never finds these narrower chip columns at
all -- they don't pass its region size filters, so ~60 consecutive pages
came back as pure fallback.

This targets the fixed, consistently-positioned TOP chip ("-L" variant) in
each of the 4 quadrants directly, since the template repeats reliably
across this whole page range.

Usage:
    python scripts/recrop_gt2025_chipcolumn.py --ids 199,201,203,... (or omit --ids to do all still-missing)
"""

import argparse
import os

import cv2
import fitz
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public/assets/catalogue/clean_swatches_v2")
PDF = r"C:\Users\KIIT\Downloads\GLOBAL TILES 2025 CATALOGUE.pdf"
DPI = 400
SCALE = DPI / 72
START_PAGE = 2  # 0-indexed
ID_START = 141

# top ("-L") chip position within each quadrant, fraction of full spread
QUADRANT_BOXES = {
    0: (0.011, 0.128, 0.100, 0.192),  # top-left
    1: (0.011, 0.540, 0.100, 0.604),  # bottom-left
    2: (0.530, 0.128, 0.605, 0.192),  # top-right
    3: (0.530, 0.540, 0.605, 0.604),  # bottom-right
}


def id_to_page_quadrant(cid):
    n = cid - ID_START
    page_idx = START_PAGE + n // 4
    quadrant = n % 4
    return page_idx, quadrant


def page_to_cv(page):
    mat = fitz.Matrix(SCALE, SCALE)
    pix = page.get_pixmap(matrix=mat)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def autocrop_border(bgr):
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float64)
    h, w = gray.shape
    if h < 20 or w < 20:
        return bgr
    core = gray[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4]
    core_mean = core.mean()

    def row_ok(y):
        row = gray[y, :: max(1, w // 128)]
        return not (row.std() < 8 and abs(row.mean() - core_mean) > 26)

    def col_ok(x):
        col = gray[:: max(1, h // 128), x]
        return not (col.std() < 8 and abs(col.mean() - core_mean) > 26)

    top = bottom = left = right = 0
    max_v, max_h = int(h * 0.15), int(w * 0.15)
    while top < max_v and not row_ok(top):
        top += 1
    while bottom < max_v and not row_ok(h - 1 - bottom):
        bottom += 1
    while left < max_h and not col_ok(left):
        left += 1
    while right < max_h and not col_ok(w - 1 - right):
        right += 1
    if top + bottom >= h - 10 or left + right >= w - 10:
        return bgr
    return bgr[top : h - bottom, left : w - right]


def save(bgr, path):
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    Image.fromarray(rgb).save(path, "WEBP", quality=95, method=6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", type=str, default=None, help="comma-separated ids; omit for all still-missing 141-432")
    args = ap.parse_args()

    if args.ids:
        ids = [int(x) for x in args.ids.split(",")]
    else:
        have = set()
        for f in os.listdir(OUT_DIR):
            if f.startswith("gt2025") and f.endswith(".webp"):
                have.add(int(f.split("gt2025-c")[1].split("-")[0]))
        ids = [i for i in range(141, 433) if i not in have]

    doc = fitz.open(PDF)
    page_cache = {}
    written = 0
    for cid in ids:
        page_idx, quadrant = id_to_page_quadrant(cid)
        if page_idx not in page_cache:
            page_cache[page_idx] = page_to_cv(doc[page_idx])
        img = page_cache[page_idx]
        h, w = img.shape[:2]
        x0f, y0f, x1f, y1f = QUADRANT_BOXES[quadrant]
        crop = img[int(h * y0f) : int(h * y1f), int(w * x0f) : int(w * x1f)]
        if crop.size == 0:
            continue
        crop = autocrop_border(crop)
        if crop.shape[0] < 30 or crop.shape[1] < 30:
            continue
        out_path = os.path.join(OUT_DIR, f"gt2025-c{cid:03d}-swatch.webp")
        save(crop, out_path)
        written += 1

    doc.close()
    print(f"written: {written} of {len(ids)} requested")


if __name__ == "__main__":
    main()
