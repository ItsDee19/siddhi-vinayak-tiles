import os
import cv2
import numpy as np
from PIL import Image

swatch_dir = r"c:\sanket da\siddhi-vinayak-tiles\public\assets\catalogue\swatches"
clean_dir = r"c:\sanket da\siddhi-vinayak-tiles\public\assets\catalogue\clean_swatches"
os.makedirs(clean_dir, exist_ok=True)

files = [f for f in os.listdir(swatch_dir) if f.endswith(('.webp', '.png', '.jpg'))]
print(f"Found {len(files)} swatch files to process...")

processed = 0
for f in files:
    src_path = os.path.join(swatch_dir, f)
    dst_path = os.path.join(clean_dir, f)
    
    img = cv2.imread(src_path)
    if img is None:
        continue
        
    h, w = img.shape[:2]
    
    # 1. Crop out outer borders (remove top 5%, bottom 10% for text labels, left/right 5%)
    crop_y1 = int(h * 0.05)
    crop_y2 = int(h * 0.90)
    crop_x1 = int(h * 0.05)
    crop_x2 = int(w * 0.95)
    
    cropped = img[crop_y1:crop_y2, crop_x1:crop_x2]
    ch, cw = cropped.shape[:2]
    
    # 2. Inpaint dark text or high-contrast lines inside cropped region
    gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
    
    # Detect very dark text/line pixels (threshold < 50 or > 245)
    _, dark_mask = cv2.threshold(gray, 40, 255, cv2.THRESH_BINARY_INV)
    
    # Morphological dilation to cover text glyphs
    kernel = np.ones((3, 3), np.uint8)
    dilated_mask = cv2.dilate(dark_mask, kernel, iterations=1)
    
    # Inpaint using Telea algorithm
    inpainted = cv2.inpaint(cropped, dilated_mask, inpaintRadius=3, flags=cv2.INPAINT_TELEA)
    
    # Convert to PIL and save as high-quality WebP
    pil_img = Image.fromarray(cv2.cvtColor(inpainted, cv2.COLOR_BGR2RGB))
    pil_img.save(dst_path, "WEBP", quality=90)
    processed += 1

print(f"Successfully processed and cleaned {processed} tile swatches!")
