"""Large bathroom — silhouette fixtures (not fat boxes) + 3 straight bands."""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

SRC = Path(
    r"C:\Users\KIIT\.grok\sessions\C%3A%5CUsers%5CKIIT\019feca6-4eed-7822-bbfd-cfac6f5986bf\images\9.jpg"
)
OUT = Path(__file__).resolve().parents[1] / "public" / "2d-rooms" / "large-bathroom-b"
W, H = 1920, 1080


def save_mask(arr: np.ndarray, p: Path) -> None:
    Image.fromarray((arr.astype(np.uint8) * 255), "L").convert("RGB").save(p, optimize=True)


def roi_mask(cond: np.ndarray, y0, y1, x0, x1) -> np.ndarray:
    m = np.zeros(cond.shape[:2], np.uint8)
    m[y0:y1, x0:x1] = cond[y0:y1, x0:x1].astype(np.uint8)
    return m


def erase_mirror(bgr: np.ndarray, y0=120, y1=455, x0=650, x1=1280) -> np.ndarray:
    """Paint out the mirror by tiling wall pixels from immediately left of it."""
    out = bgr.copy()
    src_w = 90
    x_src0 = max(0, x0 - src_w)
    for y in range(y0, y1):
        src = out[y, x_src0:x0]
        if src.shape[0] < 8:
            continue
        span = x1 - x0
        reps = int(np.ceil(span / src.shape[0])) + 1
        tiled = np.tile(src, (reps, 1))[:span]
        out[y, x0:x1] = tiled
    return out


def close_open(m: np.ndarray, c=7, o=3) -> np.ndarray:
    if c:
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((c, c), np.uint8))
    if o:
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((o, o), np.uint8))
    return m


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    bgr = cv2.imread(str(SRC), cv2.IMREAD_COLOR)
    h0, w0 = bgr.shape[:2]
    wm = np.zeros((h0, w0), np.uint8)
    wm[int(h0 * 0.90) :, int(w0 * 0.78) :] = 255
    bgr = cv2.inpaint(bgr, wm, 5, cv2.INPAINT_TELEA)
    bgr = cv2.resize(bgr, (W, H), interpolation=cv2.INTER_LANCZOS4)
    bgr = erase_mirror(bgr)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    # Floor / ceiling (thin)
    floor = np.zeros((H, W), np.uint8)
    floor[852:, :] = 1
    ceiling = np.zeros((H, W), np.uint8)
    ceiling[:52, :] = 1

    # Wood vanity + shelf (brown only, inside vanity column)
    wood = cv2.inRange(hsv, (8, 45, 55), (30, 210, 220))
    wood = roi_mask(wood > 0, 620, 852, 610, 1310)
    wood = close_open(wood, 11, 5)

    # White basins on the counter
    basins = ((gray > 200) & (hsv[..., 1] < 40)).astype(np.uint8)
    basins = roi_mask(basins > 0, 575, 645, 750, 1260)
    basins = close_open(basins, 9, 3)

    # Black taps
    taps = (gray < 55).astype(np.uint8)
    taps = roi_mask(taps > 0, 525, 595, 800, 1190)
    taps = cv2.dilate(taps, np.ones((5, 5), np.uint8))

    # Toilet: white object on the right, not beige wall
    toilet = ((gray > 185) & (hsv[..., 1] < 35)).astype(np.uint8)
    toilet = roi_mask(toilet > 0, 665, 852, 1405, 1625)
    toilet = close_open(toilet, 9, 5)

    # Flush plate: dark rectangle
    flush = (gray < 70).astype(np.uint8)
    flush = roi_mask(flush > 0, 528, 600, 1425, 1550)
    flush = close_open(flush, 5, 3)

    # Shower metal only (black lines on the right)
    metal = (gray < 45).astype(np.uint8)
    metal = roi_mask(metal > 0, 50, 980, 1635, 1919)
    metal = cv2.dilate(metal, np.ones((3, 3), np.uint8))

    # White towels on the shelf
    towels = ((gray > 205) & (hsv[..., 1] < 30)).astype(np.uint8)
    towels = roi_mask(towels > 0, 740, 830, 720, 1240)
    towels = close_open(towels, 7, 3)

    fixtures = (
        ceiling
        | wood
        | basins
        | taps
        | toilet
        | flush
        | metal
        | towels
    )
    fixtures[floor > 0] = 0
    fixtures = cv2.morphologyEx(fixtures, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))

    wall = np.ones((H, W), np.uint8)
    wall[floor > 0] = 0
    wall[fixtures > 0] = 0

    # 3 bands on the photo's own herringbone
    row = gray.mean(axis=1)
    dark_rows = np.flatnonzero((np.arange(H) > 400) & (np.arange(H) < 560) & (row < 125))
    if dark_rows.size >= 8:
        feat_top, feat_bot = int(dark_rows[0]), int(dark_rows[-1] + 1)
    else:
        feat_top, feat_bot = 431, 541

    yy = np.arange(H)[:, None]
    feature = ((yy >= feat_top) & (yy < feat_bot) & (wall > 0)).astype(np.uint8)
    lower = ((yy >= feat_bot) & (wall > 0)).astype(np.uint8)
    upper = ((yy < feat_top) & (wall > 0)).astype(np.uint8)

    # 2px grow so tiles kiss fixture edges
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    claimed = (lower | feature | upper).astype(bool)
    out = {}
    for name, m in (("lower", lower), ("feature", feature), ("upper", upper)):
        extra = (cv2.dilate(m, k) > 0) & (~claimed) & (floor == 0)
        out[name] = ((m > 0) | extra).astype(np.uint8)
        claimed |= extra
    lower, feature, upper = out["lower"], out["feature"], out["upper"]
    wall = lower | feature | upper

    overlay = np.zeros((H, W, 4), np.uint8)
    overlay[..., :3] = rgb
    a = (fixtures * 255).astype(np.uint8)
    a = cv2.GaussianBlur(a, (0, 0), 0.4)
    a[wall > 0] = 0
    a[floor > 0] = 0
    overlay[..., 3] = a

    Image.fromarray(rgb).save(OUT / "base.png", quality=95)
    save_mask(floor, OUT / "mask-floor.png")
    save_mask(wall, OUT / "mask-wall.png")
    save_mask(lower, OUT / "mask-wall-lower.png")
    save_mask(feature, OUT / "mask-wall-feature.png")
    save_mask(upper, OUT / "mask-wall-upper.png")
    Image.fromarray(overlay, "RGBA").save(OUT / "overlay-locked.png")

    print("feat", feat_top, feat_bot)
    print("L/F/U", int(lower.sum()), int(feature.sum()), int(upper.sum()))
    print(
        "wood", int(wood.sum()),
        "toilet", int(toilet.sum()),
        "metal", int(metal.sum()),
        "fix", int(fixtures.sum()),
    )


if __name__ == "__main__":
    main()
