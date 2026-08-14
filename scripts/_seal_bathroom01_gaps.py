"""Close halo gaps around mirror/basin on bathroom-01.

Grow the wall masks a few pixels into the overlay (original-photo halo),
then punch overlay alpha back so tiles meet the fixtures cleanly.
Does not change floor, other rooms, or band proportions (except a 4px grow).
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

DIR = Path(__file__).resolve().parents[1] / "public" / "2d-rooms" / "bathroom-01"
GROW_PX = 5


def load_l(p: Path) -> np.ndarray:
    return (np.asarray(Image.open(p).convert("L")) >= 128).astype(np.uint8)


def save_rgb_mask(arr: np.ndarray, p: Path) -> None:
    Image.fromarray((arr * 255).astype(np.uint8), "L").convert("RGB").save(p, optimize=True)


def main() -> None:
    floor = load_l(DIR / "mask-floor.png")
    lower = load_l(DIR / "mask-wall-lower.png")
    feat = load_l(DIR / "mask-wall-feature.png")
    upper = load_l(DIR / "mask-wall-upper.png")
    ov = np.array(Image.open(DIR / "overlay-locked.png").convert("RGBA"), copy=True)

    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (GROW_PX * 2 + 1, GROW_PX * 2 + 1))
    grown = {}
    for name, m in (("lower", lower), ("feature", feat), ("upper", upper)):
        g = cv2.dilate(m, k)
        # do not eat the floor
        g = np.where(floor > 0, 0, g)
        grown[name] = g

    # resolve grow overlaps: keep original owner, then lower < feature < upper on new pixels
    orig = {"lower": lower, "feature": feat, "upper": upper}
    claimed = (lower | feat | upper).astype(bool)
    final = {}
    for name in ("lower", "feature", "upper"):
        extra = (grown[name] > 0) & (~claimed)
        final[name] = np.where(orig[name] > 0, 1, np.where(extra, 1, 0)).astype(np.uint8)
        claimed |= extra

    wall_all = final["lower"] | final["feature"] | final["upper"]
    # Overlay: kill alpha on expanded wall so tiles show through to fixture edge
    alpha = ov[..., 3].astype(np.int16)
    # shrink overlay a bit more at the wall/overlay contact for a tight seal
    contact = cv2.dilate(wall_all, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    alpha[contact > 0] = 0
    ov[..., 3] = np.clip(alpha, 0, 255).astype(np.uint8)

    for name in ("lower", "feature", "upper"):
        dest = DIR / f"mask-wall-{name}.png"
        save_rgb_mask(final[name], dest)
        print(name, int(final[name].sum()), "was", int(orig[name].sum()))

    Image.fromarray(ov, "RGBA").save(DIR / "overlay-locked.png", optimize=True)
    print("overlay alpha>8", int((ov[..., 3] > 8).sum()))


if __name__ == "__main__":
    main()
