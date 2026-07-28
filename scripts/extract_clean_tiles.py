"""
Clean Tile Swatch Re-Extraction Script
=======================================
Re-extracts swatch images from all 5 PDF catalogues at 300 DPI (vs old 150 DPI),
then uses OpenCV to detect and remove text overlays (tile codes, size labels)
via inpainting. Outputs clean WebP files at quality 95.

Usage:
    python scripts/extract_clean_tiles.py

Requirements:
    pip install pymupdf Pillow opencv-python-headless numpy
"""

import fitz  # PyMuPDF
import os
import sys
import numpy as np
from PIL import Image
import io

try:
    import cv2
except ImportError:
    print("ERROR: opencv-python-headless not installed. Run: pip install opencv-python-headless")
    sys.exit(1)

# ─── Config ──────────────────────────────────────────────────────────────

DPI = 300
SCALE = DPI / 72  # 4.167x zoom
WEBP_QUALITY = 95
SWATCH_DIR = os.path.join('public', 'assets', 'catalogue', 'swatches')

PDF_PATHS = {
    'pdf1': r'C:\Users\KIIT\Downloads\GLOBAL TILES FLOOR CATALOGUE.pdf',
    'pdf2': r'C:\Users\KIIT\Downloads\GLOBAL TILES 2025 CATALOGUE.pdf',
    'pdf3': r'C:\Users\KIIT\Downloads\SKYPE  (2X4).pdf',
    'pdf4': r'C:\Users\KIIT\Downloads\SUNFLORA 2X4 (NEW DES).pdf',
    'pdf5': r'C:\Users\KIIT\Downloads\(12X18) SKY PDF.pdf',
}

os.makedirs(SWATCH_DIR, exist_ok=True)


def remove_text_overlay(img_np):
    """
    Detect text/code overlays on tile swatch and inpaint them away.
    """
    gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    
    if h < 50 or w < 50:
        return img_np
    
    # Detect VERY bright text (white text on tile)
    _, white_mask = cv2.threshold(gray, 235, 255, cv2.THRESH_BINARY)
    
    # Detect VERY dark text (black text on light tile)
    _, dark_mask = cv2.threshold(gray, 20, 255, cv2.THRESH_BINARY_INV)
    
    combined = cv2.bitwise_or(white_mask, dark_mask)
    
    kernel = np.ones((3, 3), np.uint8)
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=2)
    combined = cv2.dilate(combined, kernel, iterations=1)
    
    # Filter: only keep small connected components (text, not tile features)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(combined, connectivity=8)
    final_mask = np.zeros_like(combined)
    img_area = h * w
    
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        comp_w = stats[i, cv2.CC_STAT_WIDTH]
        comp_h = stats[i, cv2.CC_STAT_HEIGHT]
        
        if area < img_area * 0.05 and comp_w < w * 0.4 and comp_h < h * 0.4:
            final_mask[labels == i] = 255
    
    if np.sum(final_mask) == 0:
        return img_np
    
    result = cv2.inpaint(img_np, final_mask, inpaintRadius=5, flags=cv2.INPAINT_TELEA)
    return result


def page_to_image(page):
    """Render a PDF page at 300 DPI and return as PIL Image."""
    mat = fitz.Matrix(SCALE, SCALE)
    pix = page.get_pixmap(matrix=mat)
    return Image.frombytes("RGB", [pix.width, pix.height], pix.samples)


def save_clean_swatch(pil_img, output_path):
    """Clean text overlay and save as high-quality WebP."""
    img_np = np.array(pil_img)
    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
    cleaned = remove_text_overlay(img_bgr)
    cleaned_rgb = cv2.cvtColor(cleaned, cv2.COLOR_BGR2RGB)
    cleaned_pil = Image.fromarray(cleaned_rgb)
    cleaned_pil.save(output_path, "WEBP", quality=WEBP_QUALITY)


def extract_pdf1():
    pdf_path = PDF_PATHS['pdf1']
    if not os.path.exists(pdf_path):
        print(f"  SKIP: {pdf_path} not found")
        return
    doc = fitz.open(pdf_path)
    count = 0
    card_counter = 1
    for page_idx in range(2, len(doc)):
        page = doc[page_idx]
        img = page_to_image(page)
        w, h = img.size
        left_swatch = img.crop((int(0.08*w), int(0.12*h), int(0.46*w), int(0.33*h)))
        left_id = f"gt-floor-c{card_counter:03d}"
        save_clean_swatch(left_swatch, os.path.join(SWATCH_DIR, f"{left_id}-swatch.webp"))
        card_counter += 1
        count += 1
        right_swatch = img.crop((int(0.54*w), int(0.12*h), int(0.92*w), int(0.33*h)))
        right_id = f"gt-floor-c{card_counter:03d}"
        save_clean_swatch(right_swatch, os.path.join(SWATCH_DIR, f"{right_id}-swatch.webp"))
        card_counter += 1
        count += 1
    doc.close()
    print(f"  PDF 1: Extracted {count} clean swatches")


def extract_pdf2():
    pdf_path = PDF_PATHS['pdf2']
    if not os.path.exists(pdf_path):
        print(f"  SKIP: {pdf_path} not found")
        return
    doc = fitz.open(pdf_path)
    count = 0
    card_index = 141
    for page_num in range(2, min(75, len(doc))):
        page = doc[page_num]
        img = page_to_image(page)
        w, h = img.size
        quadrants = [
            (int(0.02*w), int(0.11*h), int(0.17*w), int(0.17*h)),
            (int(0.02*w), int(0.53*h), int(0.17*w), int(0.59*h)),
            (int(0.52*w), int(0.11*h), int(0.67*w), int(0.17*h)),
            (int(0.52*w), int(0.53*h), int(0.67*w), int(0.59*h)),
        ]
        for box in quadrants:
            try:
                swatch = img.crop(box)
                sw, sh = swatch.size
                if sw > 20 and sh > 20:
                    cid = f"gt2025-c{card_index:03d}"
                    save_clean_swatch(swatch, os.path.join(SWATCH_DIR, f"{cid}-swatch.webp"))
                    count += 1
                card_index += 1
            except Exception as e:
                print(f"    Warning: page {page_num+1}: {e}")
                card_index += 1
    doc.close()
    print(f"  PDF 2: Extracted {count} clean swatches")


def extract_pdf3():
    pdf_path = PDF_PATHS['pdf3']
    if not os.path.exists(pdf_path):
        print(f"  SKIP: {pdf_path} not found")
        return
    doc = fitz.open(pdf_path)
    count = 0
    card_counter = 1
    for page_idx in range(0, len(doc), 2):
        page = doc[page_idx]
        img = page_to_image(page)
        w, h = img.size
        swatch = img.crop((int(0.05*w), int(0.05*h), int(0.95*w), int(0.85*h)))
        cid = f"skype-c{card_counter:03d}"
        save_clean_swatch(swatch, os.path.join(SWATCH_DIR, f"{cid}-swatch.webp"))
        card_counter += 1
        count += 1
    doc.close()
    print(f"  PDF 3: Extracted {count} clean swatches")


def extract_pdf4():
    pdf_path = PDF_PATHS['pdf4']
    if not os.path.exists(pdf_path):
        print(f"  SKIP: {pdf_path} not found")
        return
    doc = fitz.open(pdf_path)
    count = 0
    card_counter = 1
    for page_idx in range(0, len(doc)):
        page = doc[page_idx]
        img = page_to_image(page)
        w, h = img.size
        swatch = img.crop((int(0.55*w), int(0.05*h), int(0.95*w), int(0.45*h)))
        sw, sh = swatch.size
        if sw > 50 and sh > 50:
            cid = f"sunflora-c{card_counter:03d}"
            save_clean_swatch(swatch, os.path.join(SWATCH_DIR, f"{cid}-swatch.webp"))
            card_counter += 1
            count += 1
    doc.close()
    print(f"  PDF 4: Extracted {count} clean swatches")


def extract_pdf5():
    pdf_path = PDF_PATHS['pdf5']
    if not os.path.exists(pdf_path):
        print(f"  SKIP: {pdf_path} not found")
        return
    doc = fitz.open(pdf_path)
    count = 0
    card_counter = 1
    for page_idx in range(0, len(doc)):
        page = doc[page_idx]
        img = page_to_image(page)
        w, h = img.size
        left_swatch = img.crop((int(0.05*w), int(0.08*h), int(0.48*w), int(0.80*h)))
        cid = f"sky12x18-c{card_counter:03d}"
        save_clean_swatch(left_swatch, os.path.join(SWATCH_DIR, f"{cid}-swatch.webp"))
        card_counter += 1
        count += 1
        right_swatch = img.crop((int(0.52*w), int(0.08*h), int(0.95*w), int(0.80*h)))
        cid = f"sky12x18-c{card_counter:03d}"
        save_clean_swatch(right_swatch, os.path.join(SWATCH_DIR, f"{cid}-swatch.webp"))
        card_counter += 1
        count += 1
    doc.close()
    print(f"  PDF 5: Extracted {count} clean swatches")


if __name__ == '__main__':
    print("=" * 60)
    print("Clean Tile Swatch Re-Extraction (300 DPI + Text Removal)")
    print("=" * 60)
    missing = [k for k, v in PDF_PATHS.items() if not os.path.exists(v)]
    if missing:
        print(f"\nWARNING: Missing PDFs: {', '.join(missing)}")
    print(f"\nOutput: {os.path.abspath(SWATCH_DIR)}")
    print(f"DPI: {DPI}  |  WebP Quality: {WEBP_QUALITY}\n")
    extract_pdf1()
    extract_pdf2()
    extract_pdf3()
    extract_pdf4()
    extract_pdf5()
    print("\nDone! All clean swatches saved.")
