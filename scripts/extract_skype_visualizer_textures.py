"""Extract the primary 600x1200 tile faces from the SKYPE 2x4 PDF."""

import os
import fitz
from PIL import Image

PDF_PATH = r"C:\Users\KIIT\Downloads\SKYPE  (2X4).pdf"
OUT_DIR = r"C:\sanket da\siddhi-vinayak-tiles\public\assets\catalogue\clean_swatches"


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    doc = fitz.open(PDF_PATH)
    written = 0

    # Product sheets occupy the odd-numbered pages after the two-page cover.
    for page_index in range(2, len(doc) - 1, 2):
        page_number = page_index + 1
        page = doc[page_index]
        pix = page.get_pixmap(dpi=300, alpha=False)
        image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        width, height = image.size

        # The large, clean primary tile face sits in the left column. This
        # excludes the logo, specifications, QR code, and room render.
        face = image.crop((
            int(width * 0.065), int(height * 0.14),
            int(width * 0.355), int(height * 0.95),
        ))
        path = os.path.join(
            OUT_DIR, f"skype-2x4-p{page_number:02d}-t1-clean.webp"
        )
        face.save(path, "WEBP", quality=95, method=6)
        written += 1

    print(f"Extracted {written} SKYPE primary tile textures from the PDF.")


if __name__ == "__main__":
    main()
