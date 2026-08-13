"""Assemble vanity-e 2D pack from user-provided base + masks. Vanity only."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

DL = Path(r"C:\Users\KIIT\Downloads")
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "2d-rooms" / "vanity-e"
OUT.mkdir(parents=True, exist_ok=True)

BASE_SRC = DL / "ChatGPT Image Aug 13, 2026, 06_16_44 PM.png"
FLOOR_MASK_SRC = DL / "image (6).png"  # white floor on black
WALL_MASK_SRC = DL / "image (4) (1).png"  # white wall, vanity cut out
VANITY_MASK_SRC = DL / "image (5) (1).png"  # white countertop (sink cutout)


def load_rgba(p: Path) -> Image.Image:
    return Image.open(p).convert("RGBA")


def to_bw_mask(im: Image.Image, thr: int = 128) -> np.ndarray:
    a = np.asarray(im)
    lum = a[..., :3].astype(np.float32).mean(axis=2)
    return ((lum >= thr).astype(np.uint8) * 255)


def clean_mask(m: np.ndarray, close: int = 3) -> np.ndarray:
    im = Image.fromarray(m, mode="L")
    if close and close >= 3:
        # odd kernel sizes for Max/MinFilter
        k = close if close % 2 == 1 else close + 1
        im = im.filter(ImageFilter.MaxFilter(k))
        im = im.filter(ImageFilter.MinFilter(k))
    arr = np.asarray(im)
    return ((arr >= 128).astype(np.uint8) * 255)


def main() -> None:
    base = load_rgba(BASE_SRC)
    w, h = base.size
    print(f"base {w}x{h}")

    floor_im = load_rgba(FLOOR_MASK_SRC).resize((w, h), Image.Resampling.NEAREST)
    wall_im = load_rgba(WALL_MASK_SRC).resize((w, h), Image.Resampling.NEAREST)
    vanity_im = load_rgba(VANITY_MASK_SRC).resize((w, h), Image.Resampling.NEAREST)

    floor_m = clean_mask(to_bw_mask(floor_im, 128), close=3)
    wall_m = clean_mask(to_bw_mask(wall_im, 128), close=3)
    vanity_m = clean_mask(to_bw_mask(vanity_im, 128), close=3)

    # Vanity counter wins over floor/wall; then floor over wall
    v = vanity_m > 0
    floor_m[v] = 0
    wall_m[v] = 0
    overlap = (floor_m > 0) & (wall_m > 0)
    if overlap.any():
        wall_m[overlap] = 0
        print(f"cleared {int(overlap.sum())} overlapping wall pixels (floor wins)")

    base_arr = np.asarray(base).astype(np.float32)
    rgb = base_arr[..., :3]
    tile = (floor_m > 0) | (wall_m > 0) | (vanity_m > 0)

    inv = (~tile).astype(np.float32) * 255.0
    inv_soft = Image.fromarray(inv.astype(np.uint8), mode="L").filter(
        ImageFilter.GaussianBlur(radius=0.8)
    )
    alpha = np.asarray(inv_soft).astype(np.float32)
    alpha[tile] = 0
    alpha = np.clip(alpha * 1.15, 0, 255)

    overlay = np.zeros((h, w, 4), dtype=np.uint8)
    overlay[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    overlay[..., 3] = alpha.astype(np.uint8)

    print(f"floor  white px: {(floor_m > 0).sum()} ({100 * (floor_m > 0).mean():.1f}%)")
    print(f"wall   white px: {(wall_m > 0).sum()} ({100 * (wall_m > 0).mean():.1f}%)")
    print(f"vanity white px: {(vanity_m > 0).sum()} ({100 * (vanity_m > 0).mean():.1f}%)")
    print(
        f"overlay opaque: {(overlay[..., 3] > 8).sum()} "
        f"({100 * (overlay[..., 3] > 8).mean():.1f}%)"
    )

    base.convert("RGB").save(OUT / "base.png", optimize=True)
    Image.fromarray(floor_m, mode="L").convert("RGB").save(OUT / "mask-floor.png", optimize=True)
    Image.fromarray(wall_m, mode="L").convert("RGB").save(OUT / "mask-wall.png", optimize=True)
    Image.fromarray(vanity_m, mode="L").convert("RGB").save(OUT / "mask-vanity.png", optimize=True)
    Image.fromarray(overlay, mode="RGBA").save(OUT / "overlay-locked.png", optimize=True)

    meta = {
        "id": "vanity-e",
        "zones": [
            {"id": "floor", "label": "Floor", "surface": "Floor"},
            {"id": "wall", "label": "Wall", "surface": "Wall"},
            {"id": "vanity", "label": "Vanity", "surface": "Both"},
        ],
        "quality": "user-pack-3zone-2026-08-13",
        "size": [w, h],
        "sources": {
            "base": BASE_SRC.name,
            "mask-floor": FLOOR_MASK_SRC.name,
            "mask-wall": WALL_MASK_SRC.name,
            "mask-vanity": VANITY_MASK_SRC.name,
            "overlay": "derived from base ∩ ¬(floor∪wall∪vanity)",
            "notes": "Three tileable zones; basin/cabinet/glass/ceiling locked in overlay.",
        },
    }
    (OUT / "pack.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    (OUT / "README.txt").write_text(
        "Room: vanity-e\n"
        "Zones: floor + wall + vanity (countertop)\n"
        "mask-floor.png · mask-wall.png · mask-vanity.png · overlay-locked.png · base.png\n"
        "Updated 2026-08-13 — three tileable zones.\n",
        encoding="utf-8",
    )
    print("Wrote pack to", OUT.resolve())


if __name__ == "__main__":
    main()
