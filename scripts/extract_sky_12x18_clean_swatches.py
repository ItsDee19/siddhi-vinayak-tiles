import os
import fitz
import cv2
import numpy as np
from PIL import Image

pdf_path = r"C:\Users\KIIT\Downloads\(12X18) SKY PDF.pdf"
out_dir = r"c:\sanket da\siddhi-vinayak-tiles\public\assets\catalogue\clean_swatches"
os.makedirs(out_dir, exist_ok=True)

print("=== Extracting High-DPI Clean Single-Tile Textures from (12X18) SKY PDF ===")

doc = fitz.open(pdf_path)
print(f"Opened PDF with {len(doc)} pages.")

extracted_count = 0

for page_idx in range(len(doc)):
    page = doc[page_idx]
    # Render page at 300 DPI (super crisp)
    pix = page.get_pixmap(dpi=300)
    img_bytes = pix.tobytes('png')
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        continue
        
    h, w = img.shape[:2]
    
    # In Sky 12x18 PDF pages, the bottom 40% contains the individual tile swatches (Light, Feature, Dark)
    bottom_crop = img[int(h * 0.55):int(h * 0.98), int(w * 0.05):int(w * 0.95)]
    bh, bw = bottom_crop.shape[:2]
    
    # Detect rectangular tile boxes using edge detection
    gray = cv2.cvtColor(bottom_crop, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 40, 120)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    boxes = []
    for c in contours:
        x, y, box_w, box_h = cv2.boundingRect(c)
        aspect = box_w / float(box_h)
        # 12x18 tile swatches have aspect ratio ~1.2 to 2.2 and size > 300px
        if 1.2 <= aspect <= 2.5 and box_w > 300 and box_h > 150:
            boxes.append((x, y, box_w, box_h))
            
    # Sort boxes top to bottom
    boxes = sorted(boxes, key=lambda b: (b[1], b[0]))
    
    if len(boxes) == 0:
        # Fallback: slice central tile region
        tile_crop = bottom_crop[int(bh*0.1):int(bh*0.9), int(bw*0.1):int(bw*0.9)]
        boxes = [(0, 0, tile_crop.shape[1], tile_crop.shape[0])]
    else:
        tile_crop = bottom_crop
        
    for b_idx, (bx, by, bw_i, bh_i) in enumerate(boxes[:3]): # Light, Feature, Dark
        # Crop inner 90% of tile face to eliminate border lines
        pad_x = int(bw_i * 0.05)
        pad_y = int(bh_i * 0.05)
        
        tile_face = tile_crop[by + pad_y : by + bh_i - pad_y, bx + pad_x : bx + bw_i - pad_x]
        if tile_face.size == 0:
            continue
            
        # Inpaint any dark text labels
        gray_tf = cv2.cvtColor(tile_face, cv2.COLOR_BGR2GRAY)
        _, dark_mask = cv2.threshold(gray_tf, 35, 255, cv2.THRESH_BINARY_INV)
        kernel = np.ones((3, 3), np.uint8)
        dilated_mask = cv2.dilate(dark_mask, kernel, iterations=1)
        inpainted_tf = cv2.inpaint(tile_face, dilated_mask, inpaintRadius=3, flags=cv2.INPAINT_TELEA)
        
        # Save clean single tile WebP
        tile_name = f"sky12x18-p{page_idx+1}-t{b_idx+1}-clean.webp"
        save_path = os.path.join(out_dir, tile_name)
        
        pil_img = Image.fromarray(cv2.cvtColor(inpainted_tf, cv2.COLOR_BGR2RGB))
        pil_img.save(save_path, "WEBP", quality=95)
        extracted_count += 1

print(f"Successfully extracted {extracted_count} pristine 300 DPI single-tile textures for 12X18 Sky PDF!")
