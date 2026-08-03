"""Extract the four clean tile swatches from each Global Tiles 2025 spread."""

import os
import fitz
from PIL import Image

PDF_PATH = r"C:\Users\KIIT\Downloads\GLOBAL TILES 2025 CATALOGUE.pdf"
OUT_DIR = r"C:\sanket da\siddhi-vinayak-tiles\public\assets\catalogue\clean_swatches"


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    doc = fitz.open(PDF_PATH)
    written = 0

    # PDF pages 3-75 are catalogue spreads; pages 1-2 are cover/index.
    for page_index in range(2, min(75, len(doc))):
        page_number = page_index - 1  # printed/internal page number
        pix = doc[page_index].get_pixmap(dpi=300, alpha=False)
        image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        width, height = image.size
        boxes = [
            (0.02, 0.11, 0.17, 0.17),
            (0.02, 0.53, 0.17, 0.59),
            (0.52, 0.11, 0.67, 0.17),
            (0.52, 0.53, 0.67, 0.59),
        ]
        for variant, (x0, y0, x1, y1) in enumerate(boxes, start=1):
            face = image.crop((
                int(width * x0), int(height * y0),
                int(width * x1), int(height * y1),
            ))
            path = os.path.join(
                OUT_DIR, f"gt-2025-p{page_number:02d}-t{variant}-clean.webp"
            )
            face.save(path, "WEBP", quality=95, method=6)
            written += 1

    print(f"Extracted {written} Global Tiles 2025 swatches.")


if __name__ == "__main__":
    main()
