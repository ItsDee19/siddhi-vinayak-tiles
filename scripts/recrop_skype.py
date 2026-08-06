"""Re-crop all 16 live SKYPE (2X4) products from the source PDF.

The catalogue mixes 4 different page templates (EXTENSIVE, SUPREMA, Porcelux
"Design Name", ENDLESS) plus lifestyle-only collection-divider pages with no
isolated swatch at all. The original extractor (extract_skype_visualizer_
textures.py) used ONE fixed left-column crop box for every page, which is
only correct for the EXTENSIVE template -- on SUPREMA/Porcelux pages that box
grabs background/whitespace, and on divider pages it grabs a room photo.

Verified page-by-page by rendering each of the 16 target pages (see session
notes). Two crop strategies:
  - FIXED: a template-specific box known to contain the clean tile face.
  - FLOOR: no isolated swatch exists on the page (pure lifestyle divider) --
    hand-picked a clean, furniture-free patch of the visible tile surface.
"""

import os
import cv2
import fitz
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = r"C:\Users\KIIT\Downloads\SKYPE  (2X4).pdf"
OUT_DIR = os.path.join(ROOT, "public/assets/catalogue/clean_swatches_v2")
DPI = 400
SCALE = DPI / 72

# id -> (page_idx 0-based, x0,y0,x1,y1 fraction of page)
JOBS = {
    "c001": (2, 0.075, 0.145, 0.350, 0.940),   # EXTENSIVE 2551
    "c002": (4, 0.075, 0.145, 0.350, 0.940),   # EXTENSIVE 2547
    "c003": (6, 0.020, 0.080, 0.150, 0.440),   # lifestyle divider, clean wall strip (above stool/bottle)
    "c004": (8, 0.536, 0.216, 0.724, 0.750),   # Design Name 3633, right panel
    "c005": (10, 0.020, 0.050, 0.160, 0.400),  # lifestyle divider, clean wall
    "c006": (12, 0.696, 0.093, 0.990, 0.860),  # SUPREMA 1803, right hero
    "c007": (14, 0.696, 0.093, 0.990, 0.930),  # SUPREMA 1826, right hero
    "c008": (16, 0.300, 0.160, 0.550, 0.300),  # lifestyle divider, wall above headboard
    "c009": (18, 0.075, 0.145, 0.350, 0.940),  # EXTENSIVE 2538
    "c010": (20, 0.368, 0.228, 0.551, 0.738),  # Porcelux 3571, centered hero
    "c011": (22, 0.550, 0.620, 0.980, 0.970),  # lifestyle w/code 2590, clean floor
    "c012": (24, 0.051, 0.165, 0.309, 0.903),  # ENDLESS 2650
    "c013": (26, 0.051, 0.165, 0.309, 0.903),  # ENDLESS 2659
    "c014": (28, 0.051, 0.165, 0.309, 0.903),  # ENDLESS 2666
    "c015": (30, 0.051, 0.165, 0.309, 0.903),  # ENDLESS 2681
    "c016": (32, 0.051, 0.165, 0.309, 0.903),  # ENDLESS 2682
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
    for cid, (pidx, x0, y0, x1, y1) in JOBS.items():
        img = page_to_cv(doc[pidx])
        h, w = img.shape[:2]
        crop = img[int(h * y0) : int(h * y1), int(w * x0) : int(w * x1)]
        crop = autocrop_border(crop)
        out = os.path.join(OUT_DIR, f"skype-{cid}-swatch.webp")
        save(crop, out)
        print(f"{cid}: page {pidx + 1}, {crop.shape[1]}x{crop.shape[0]} -> {os.path.relpath(out, ROOT)}")
        written += 1
    doc.close()
    print(f"\nwritten: {written}/16")


if __name__ == "__main__":
    main()
