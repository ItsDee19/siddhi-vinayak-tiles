"""Re-crop all 72 live SKY 12x18 products from the source PDF.

Each page (page_idx 1..72, page_idx 0 is the brand cover) shows one product
on a near-uniform dark charcoal background: usually 3 stacked swatches
(Light/Highlight/Dark, e.g. "123-L"/"123-HL_1"/"123-L") in the top-left, a
large diagonal decorative render top-right, and a bathroom lifestyle photo
in the bottom half. A meaningful minority of pages carry only ONE swatch
(single-colour "elevation" style products, e.g. "3097", "ZADE BLACK") and
that swatch is NOT always in the same vertical slot -- sometimes top,
sometimes middle -- so a fixed crop box misses it on those pages.

Instead: find the swatch region by contrast against the background. Sample
the background colour from the page corner, mask pixels that differ from
it, restrict the search to the left half (x < 0.5) above the lifestyle
photo's divider (y < 0.93) to exclude the diagonal render and room photo,
find connected regions with a tile-like aspect ratio, and take the
topmost one -- matching the "Light"/first-listed variant convention used
for every other family in this session.
"""

import os
import cv2
import fitz
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = r"C:\Users\KIIT\Downloads\(12X18) SKY PDF.pdf"
OUT_DIR = os.path.join(ROOT, "public/assets/catalogue/clean_swatches_v2")
DPI = 400
SCALE = DPI / 72

N_PRODUCTS = 72
SEARCH = (0.03, 0.03, 0.49, 0.93)  # x0,y0,x1,y1 fraction of page


def page_to_cv(page):
    mat = fitz.Matrix(SCALE, SCALE)
    pix = page.get_pixmap(matrix=mat)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def find_swatch_box(img):
    h, w = img.shape[:2]
    x0, y0, x1, y1 = SEARCH
    region = img[int(h * y0) : int(h * y1), int(w * x0) : int(w * x1)]
    rh, rw = region.shape[:2]

    bg = region[5:15, 5:15].reshape(-1, 3).mean(axis=0)
    diff = np.abs(region.astype(np.int32) - bg.astype(np.int32)).sum(axis=2)
    mask = (diff > 40).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    for c in contours:
        x, y, bw, bh = cv2.boundingRect(c)
        if bw < rw * 0.35 or bh < rh * 0.06:
            continue
        aspect = bw / float(bh)
        if not (1.15 <= aspect <= 2.1):
            continue
        candidates.append((y, x, bw, bh))

    if not candidates:
        return None
    candidates.sort(key=lambda c: c[0])  # topmost first
    y, x, bw, bh = candidates[0]
    return (
        int(w * x0) + x,
        int(h * y0) + y,
        bw,
        bh,
    )


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
    failed = []
    for cid in range(1, N_PRODUCTS + 1):
        page_idx = cid  # page 0 = cover, page 1..72 = c001..c072
        img = page_to_cv(doc[page_idx])
        box = find_swatch_box(img)
        if box is None:
            failed.append(cid)
            print(f"c{cid:03d}: page {page_idx + 1} -- NO BOX FOUND")
            continue
        x, y, bw, bh = box
        pad_x, pad_y = int(bw * 0.04), int(bh * 0.04)
        crop = img[y + pad_y : y + bh - pad_y, x + pad_x : x + bw - pad_x]
        crop = autocrop_border(crop)
        out = os.path.join(OUT_DIR, f"sky12x18-c{cid:03d}-swatch.webp")
        save(crop, out)
        print(f"c{cid:03d}: page {page_idx + 1}, box=({x},{y},{bw},{bh}) -> {crop.shape[1]}x{crop.shape[0]}")
        written += 1
    doc.close()
    print(f"\nwritten: {written}/{N_PRODUCTS}, failed: {failed}")


if __name__ == "__main__":
    main()
