"""
Automated recovery for gt-floor ids whose page has no separate swatch
thumbnail at all -- only a room-install photo. This generalizes the manual
technique used earlier: find the largest, furniture-free patch of the
photo (almost always the floor, lower portion of the frame) and crop it.

Approach per (page, side):
  1. Render at high DPI.
  2. Find the biggest photographic region on that half of the page (the
     hero/room photo) via the same contour detector used elsewhere.
  3. Search the BOTTOM band of that region (floor is normally there) with a
     sliding window across several sizes/positions.
  4. Score each window by how UNIFORM it is across sub-patches (real tile
     floor, even with grout lines and veining, has close patch-to-patch
     brightness; a window crossing furniture/legs/rugs does not) --
     reusing the patch_mean_std metric from the main pipeline. Prefer
     larger windows when scores are close.
  5. Autocrop any residual border, save.

This is a heuristic, not a certainty -- every output should still be
eyeballed before shipping (some pages have zero clean floor left after
furniture, and will need manual attention or to stay missing).

Usage:
    python scripts/recrop_floor_patches.py --ids 44,52,66,68,70,76,94,96,98,100,102,114,120,122,124,128,132,134
"""

import argparse
import os

import cv2
import fitz
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public/assets/catalogue/clean_swatches_v2")
QA_DIR = os.path.join(ROOT, ".tile-qa")
PDF = r"C:\Users\KIIT\Downloads\GLOBAL TILES FLOOR CATALOGUE.pdf"
DPI = 400
SCALE = DPI / 72
START_PAGE = 2  # 0-indexed, matches the rest of the pipeline


def id_to_page_side(cid):
    page_idx = START_PAGE + (cid - 1) // 2
    side = "left" if cid % 2 == 1 else "right"
    return page_idx, side


def page_to_cv(page):
    mat = fitz.Matrix(SCALE, SCALE)
    pix = page.get_pixmap(matrix=mat)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def find_hero_region(img, side):
    """Biggest photographic region on the given half of the page -- the
    room/install photo, not a small swatch thumbnail."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 30, 110)
    dilated = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=2)
    contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    h, w = img.shape[:2]
    half_w = w / 2
    x_lo = 0 if side == "left" else half_w
    x_hi = half_w if side == "left" else w

    best = None
    best_area = 0
    for c in contours:
        x, y, bw, bh = cv2.boundingRect(c)
        cx = x + bw / 2
        if not (x_lo <= cx <= x_hi):
            continue
        if bw < w * 0.25 or bh < h * 0.25:
            continue
        area = bw * bh
        if area > best_area:
            best_area = area
            best = (x, y, bw, bh)
    return best


def patch_mean_std(gray_region, grid=4):
    h, w = gray_region.shape
    ph, pw = max(1, h // grid), max(1, w // grid)
    means = []
    for i in range(grid):
        for j in range(grid):
            patch = gray_region[i * ph : (i + 1) * ph, j * pw : (j + 1) * pw]
            if patch.size:
                means.append(patch.mean())
    return float(np.std(means)) if means else 1e9


def best_floor_window(img, hero_box):
    """Slide windows across the bottom band of the hero region, score by
    uniformity, prefer larger windows among similarly-uniform candidates."""
    x, y, bw, bh = hero_box
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # floor is normally the bottom 45% of the hero photo
    band_y0 = y + int(bh * 0.55)
    band_y1 = y + bh
    band_h = band_y1 - band_y0
    if band_h < 100:
        return None

    candidates = []
    for win_frac in (0.55, 0.4, 0.28):
        win_w = int(bw * win_frac)
        win_h = int(band_h * min(1.0, win_frac + 0.15))
        if win_w < 150 or win_h < 100:
            continue
        step_x = max(20, win_w // 4)
        step_y = max(20, win_h // 4)
        for wy in range(band_y0, band_y1 - win_h, step_y):
            for wx in range(x, x + bw - win_w, step_x):
                region = gray[wy : wy + win_h, wx : wx + win_w]
                score = patch_mean_std(region)
                candidates.append((score, win_w * win_h, wx, wy, win_w, win_h))

    if not candidates:
        return None

    # normalize: lower std is better, bigger area is better -- rank by
    # std first (uniformity is the correctness signal), area breaks ties
    candidates.sort(key=lambda c: (c[0], -c[1]))
    top = candidates[: max(1, len(candidates) // 20)]  # best 5% by uniformity
    top.sort(key=lambda c: -c[1])  # among those, biggest wins
    score, area, wx, wy, win_w, win_h = top[0]
    return (wx, wy, win_w, win_h), score


def autocrop_border(bgr):
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float64)
    h, w = gray.shape
    if h < 20 or w < 20:
        return bgr
    core = gray[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4]
    core_mean = core.mean()

    def row_ok(yy):
        row = gray[yy, :: max(1, w // 128)]
        return not (row.std() < 8 and abs(row.mean() - core_mean) > 26)

    def col_ok(xx):
        col = gray[:: max(1, h // 128), xx]
        return not (col.std() < 8 and abs(col.mean() - core_mean) > 26)

    top = bottom = left = right = 0
    max_v, max_h = int(h * 0.2), int(w * 0.2)
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
    ap.add_argument("--ids", required=True, help="comma-separated gt-floor ids, e.g. 44,52,66")
    args = ap.parse_args()
    ids = [int(x) for x in args.ids.split(",")]

    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(QA_DIR, exist_ok=True)
    doc = fitz.open(PDF)

    results = []
    for cid in ids:
        page_idx, side = id_to_page_side(cid)
        img = page_to_cv(doc[page_idx])
        hero = find_hero_region(img, side)
        if hero is None:
            results.append((cid, page_idx + 1, "no hero region found"))
            continue

        found = best_floor_window(img, hero)
        if found is None:
            results.append((cid, page_idx + 1, "no floor window found"))
            continue

        (wx, wy, ww, wh), score = found
        crop = img[wy : wy + wh, wx : wx + ww]
        crop = autocrop_border(crop)
        out_path = os.path.join(OUT_DIR, f"gt-floor-c{cid:03d}-swatch.webp")
        save(crop, out_path)
        results.append((cid, page_idx + 1, f"OK uniformity_score={score:.1f} size={crop.shape[1]}x{crop.shape[0]}"))

    doc.close()
    print(f"\n{'id':>5}  {'page':>5}  result")
    for cid, pg, msg in results:
        print(f"c{cid:03d}  {pg:>5}  {msg}")


if __name__ == "__main__":
    main()
