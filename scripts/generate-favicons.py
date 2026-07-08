"""
One-time script to generate favicon-192.png and favicon.ico from the
SVT monogram using PIL. Mirrors the design in public/favicon.svg.
Run:  python scripts/generate-favicons.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "..", "public")
DARK = (44, 26, 14)      # --bg-primary
GOLD = (196, 154, 60)    # --accent-gold
GOLD_FAINT = (196, 154, 60, 76)  # 0.3 alpha


def draw_icon(size: int) -> Image.Image:
    """Render the SVT tile-grid monogram at the given pixel size."""
    img = Image.new("RGBA", (size, size), DARK + (255,))
    d = ImageDraw.Draw(img)
    # outer rounded square
    r = max(2, size // 8)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=DARK + (255,))
    # 4 corner tile squares
    pad = max(1, size // 12)
    cell = (size - 2 * pad) // 2 - pad
    corners = [
        (pad, pad),
        (size - pad - cell, pad),
        (pad, size - pad - cell),
        (size - pad - cell, size - pad - cell),
    ]
    line = max(1, size // 32)
    for (x, y) in corners:
        d.rectangle((x, y, x + cell, y + cell), outline=GOLD_FAINT, width=line)
    # SVT text centered
    try:
        font = ImageFont.truetype("arialbd.ttf", int(size * 0.34))
    except Exception:
        font = ImageFont.load_default()
    text = "SVT"
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(
        ((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1]),
        text,
        font=font,
        fill=GOLD + (255,),
    )
    return img


def main() -> None:
    # 192x192 PNG
    img192 = draw_icon(192)
    img192.save(os.path.join(OUT, "favicon-192.png"), "PNG", optimize=True)
    print("wrote favicon-192.png")

    # multi-resolution ICO. PIL's `sizes=` keyword auto-resamples the source
    # image at each size and embeds all of them. Pass a single high-res
    # source rather than appending a list.
    img256 = draw_icon(256)
    img256.save(
        os.path.join(OUT, "favicon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print("wrote favicon.ico (sizes: 16, 32, 48, 64, 128, 256)")


if __name__ == "__main__":
    main()
