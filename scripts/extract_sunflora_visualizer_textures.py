"""Extract clean 2x4 tile-face textures from the Sunflora PDF for the 3D picker."""

import os
import cv2
import fitz
import numpy as np
from PIL import Image

PDF_PATH = r"C:\Users\KIIT\Downloads\SUNFLORA 2X4 (NEW DES).pdf"
OUT_DIR = r"C:\sanket da\siddhi-vinayak-tiles\public\assets\catalogue\clean_swatches"


def dedupe_boxes(boxes):
    """Keep the largest non-overlapping candidate rectangles."""
    result = []
    for box in sorted(boxes, key=lambda b: b[2] * b[3], reverse=True):
        x, y, w, h = box
        if any(
            x < ox + ow * 0.92 and ox < x + w * 0.92 and
            y < oy + oh * 0.92 and oy < y + h * 0.92
            for ox, oy, ow, oh in result
        ):
            continue
        result.append(box)
    return sorted(result, key=lambda b: (b[1], b[0]))


def detect_faces(img):
    height, width = img.shape[:2]
    # Product tile panels sit below the room visual and above the footer.
    # Keep the face column separate from the product name/specification text.
    x0, x1 = int(width * 0.06), int(width * 0.56)
    y0, y1 = int(height * 0.40), int(height * 0.91)
    region = img[y0:y1, x0:x1]
    gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 35, 120)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    boxes = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        aspect = w / float(h or 1)
        if w >= width * 0.18 and h >= height * 0.045 and 1.15 <= aspect <= 4.8:
            boxes.append((x, y, w, h))

    boxes = dedupe_boxes(boxes)
    if not boxes:
        # Stable fallback for an unusually clean/vector page.
        panel = region[int(region.shape[0] * 0.12):int(region.shape[0] * 0.90)]
        step = panel.shape[0] // 3
        boxes = [(0, i * step, panel.shape[1], step) for i in range(3)]
        x0, y0 = 0, 0
        region = panel

    faces = []
    for x, y, w, h in boxes[:3]:
        pad_x, pad_y = max(4, int(w * 0.025)), max(4, int(h * 0.035))
        face = region[y + pad_y:y + h - pad_y, x + pad_x:x + w - pad_x]
        if face.size and face.shape[1] > 100 and face.shape[0] > 70:
            faces.append(face)
    return faces


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    doc = fitz.open(PDF_PATH)
    written = 0
    # Pages 1-2 are the cover/collection divider; product pages start at 3.
    for page_number in range(3, len(doc) + 1):
        page = doc[page_number - 1]
        pix = page.get_pixmap(dpi=300, alpha=False)
        img = cv2.imdecode(np.frombuffer(pix.tobytes("png"), np.uint8), cv2.IMREAD_COLOR)
        for face_number, face in enumerate(detect_faces(img), start=1):
            path = os.path.join(
                OUT_DIR, f"sunflora-p{page_number:02d}-t{face_number}-clean.webp"
            )
            Image.fromarray(cv2.cvtColor(face, cv2.COLOR_BGR2RGB)).save(
                path, "WEBP", quality=95, method=6
            )
            written += 1
    print(f"Extracted {written} Sunflora visualizer textures from {len(doc) - 2} product pages.")


if __name__ == "__main__":
    main()
