"""Re-crop all 34 live SUNFLORA 2X4 products from the source PDF.

Page mapping verified against the 15 already-real-named catalogue entries
(e.g. c003="Cv Boto Grey" matches page_idx 2, c029="End Strom Grey" matches
page_idx 28): page_idx = cid - 1. Pages 0-1 are a cover + spec diagram with
no tile content at all (these became live c001/c002, which are garbage --
a logo crop and a line-drawing crop). Every other page (2-33) carries one,
two, or three stacked products; for multi-product pages we take the first
(top) product's swatch, matching the convention the catalogue's ids already
follow for those slots.

Two crop boxes cover every page in the catalogue:
  - SINGLE: one product per page, 3 stacked full-bleed variant crops in the
    bottom-left column. We take the top ("t1") variant.
  - MULTI: two or three products stacked per page, each with its own main
    swatch + a small 4-grid of variants. We take the first product's main
    swatch (same y-band as SINGLE's top, narrower x since no 3-stack here).
"""

import os
import cv2
import fitz
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = r"C:\Users\KIIT\Downloads\SUNFLORA 2X4 (NEW DES).pdf"
OUT_DIR = os.path.join(ROOT, "public/assets/catalogue/clean_swatches_v2")
DPI = 400
SCALE = DPI / 72

SINGLE_BOX = (0.125, 0.452, 0.556, 0.585)
MULTI_BOX = (0.125, 0.465, 0.469, 0.573)

# cid -> page_idx (0-based) template ('single' or 'multi')
# c001/c002 (cover + diagram) carry no tile content -- omitted, non-recoverable.
PAGES = {
    3: (2, "single"), 4: (3, "multi"), 5: (4, "single"), 6: (5, "single"),
    7: (6, "single"), 8: (7, "single"), 9: (8, "single"), 10: (9, "single"),
    11: (10, "multi"), 12: (11, "single"), 13: (12, "single"), 14: (13, "single"),
    15: (14, "single"), 16: (15, "single"), 17: (16, "single"), 18: (17, "multi"),
    19: (18, "multi"), 20: (19, "multi"), 21: (20, "multi"), 22: (21, "multi"),
    23: (22, "multi"), 24: (23, "multi"), 25: (24, "multi"), 26: (25, "multi"),
    27: (26, "multi"),
    # 28 = page_idx 27, "ENDLESS COLLECTION" divider -- no tile content.
    29: (28, "single"), 30: (29, "single"), 31: (30, "single"), 32: (31, "single"),
    33: (32, "multi"), 34: (33, "multi"),
}


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
    max_v, max_h = int(h * 0.12), int(w * 0.12)
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
    os.makedirs(OUT_DIR, exist_ok=True)
    doc = fitz.open(PDF)
    written = 0
    for cid, (pidx, template) in PAGES.items():
        x0, y0, x1, y1 = SINGLE_BOX if template == "single" else MULTI_BOX
        img = page_to_cv(doc[pidx])
        h, w = img.shape[:2]
        crop = img[int(h * y0) : int(h * y1), int(w * x0) : int(w * x1)]
        crop = autocrop_border(crop)
        out = os.path.join(OUT_DIR, f"sunflora-c{cid:03d}-swatch.webp")
        save(crop, out)
        print(f"c{cid:03d}: page {pidx + 1} ({template}), {crop.shape[1]}x{crop.shape[0]} -> {os.path.relpath(out, ROOT)}")
        written += 1
    doc.close()
    print(f"\nwritten: {written}/34 (c001, c002, c028 have no tile content -- non-recoverable)")


if __name__ == "__main__":
    main()
