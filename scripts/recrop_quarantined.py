"""One-off manual re-crop for the 9 gt-floor ids that had no independent
swatch thumbnail on their source page (right half is a full-bleed room
photo with no separate small image). Hand-picked furniture-free regions,
verified by rendering before finalizing.
"""

import os
import cv2
import fitz
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = r"C:\Users\KIIT\Downloads\GLOBAL TILES FLOOR CATALOGUE.pdf"
OUT_DIR = os.path.join(ROOT, "public/assets/catalogue/clean_swatches_v2")
DPI = 400
SCALE = DPI / 72

# (page_idx 0-based, x0,y0,x1,y1 as fraction of full two-page spread)
JOBS = {
    "c032": (17, 0.72, 0.80, 0.92, 0.95),
    "c040": (21, 0.53, 0.10, 0.68, 0.22),
    "c046": (24, 0.75, 0.85, 0.95, 0.97),
    "c048": (25, 0.53, 0.75, 0.68, 0.90),
    "c050": (26, 0.85, 0.06, 0.97, 0.18),
    "c054": (28, 0.85, 0.06, 0.97, 0.20),
    "c072": (37, 0.55, 0.85, 0.75, 0.97),
    "c082": (42, 0.55, 0.85, 0.68, 0.97),
    "c130": (66, 0.10, 0.24, 0.235, 0.79),  # left-side panel, not the right photo
}


def page_to_cv(page):
    mat = fitz.Matrix(SCALE, SCALE)
    pix = page.get_pixmap(matrix=mat)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def save(bgr, path):
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    Image.fromarray(rgb).save(path, "WEBP", quality=95, method=6)


def main():
    doc = fitz.open(PDF)
    for cid, (pidx, x0, y0, x1, y1) in JOBS.items():
        img = page_to_cv(doc[pidx])
        h, w = img.shape[:2]
        crop = img[int(h * y0) : int(h * y1), int(w * x0) : int(w * x1)]
        out = os.path.join(OUT_DIR, f"gt-floor-{cid}-swatch.webp")
        save(crop, out)
        print(f"{cid}: page {pidx + 1}, {crop.shape[1]}x{crop.shape[0]} -> {os.path.relpath(out, ROOT)}")
    doc.close()


if __name__ == "__main__":
    main()
