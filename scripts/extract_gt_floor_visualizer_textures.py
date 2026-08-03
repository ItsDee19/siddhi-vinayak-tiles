"""Extract both 2x4 floor-tile faces from every Global Tiles floor spread."""

import os
import fitz
from PIL import Image

PDF_PATH = r"C:\Users\KIIT\Downloads\GLOBAL TILES FLOOR CATALOGUE.pdf"
OUT_DIR = r"C:\sanket da\siddhi-vinayak-tiles\public\assets\catalogue\clean_swatches"


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    doc = fitz.open(PDF_PATH)
    written = 0

    # Pages 3-72 are the 70 numbered 2x4ft product spreads.
    for page_index in range(2, len(doc)):
        page_number = page_index - 1
        pix = doc[page_index].get_pixmap(dpi=300, alpha=False)
        image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        width, height = image.size
        for variant, (x0, x1) in enumerate(((0.08, 0.46), (0.54, 0.92)), start=1):
            face = image.crop((
                int(width * x0), int(height * 0.12),
                int(width * x1), int(height * 0.33),
            ))
            path = os.path.join(
                OUT_DIR, f"gt-floor-2025-p{page_number:02d}-t{variant}-clean.webp"
            )
            face.save(path, "WEBP", quality=95, method=6)
            written += 1

    print(f"Extracted {written} Global Tiles floor swatches.")


if __name__ == "__main__":
    main()
