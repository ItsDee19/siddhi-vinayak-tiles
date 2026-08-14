"""Split bathroom-01 / large-bathroom-b walls into PRD 3-band strips.

Straight *horizontal* cuts — fixtures stay punched out, bands do not wrap
around vanity/mirror. Floor, overlay, and other rooms are not touched.

  Model A: 3-2-3 of 8 ft  → lower 3, feature 2, upper 3
  Model B: 2-4-2 of 8 ft  → lower 2, feature 4, upper 2
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "2d-rooms"

ROOMS = {
    "bathroom-01": (3, 2, 3),
    "large-bathroom-b": (2, 4, 2),
}


def load_mask(path: Path) -> np.ndarray:
    im = Image.open(path).convert("L")
    return (np.asarray(im) >= 128).astype(np.uint8)


def close_fixture_holes(wall: np.ndarray) -> np.ndarray:
    """Fill interior fixture holes so band height ignores vanity/mirror cutouts."""
    h, w = wall.shape
    # Close mid-size gaps, then fill any remaining interior holes.
    k = max(31, (min(h, w) // 18) | 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    closed = cv2.morphologyEx(wall * 255, cv2.MORPH_CLOSE, kernel)
    # Flood-fill from the border on the inverse → leftover zeros are holes
    inv = (closed == 0).astype(np.uint8)
    ff = inv.copy()
    mask = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(ff, mask, (0, 0), 2)
    holes = (ff == 0) & (wall == 0)
    filled = ((closed > 0) | holes).astype(np.uint8)
    return filled


def split_global(wall: np.ndarray, filled: np.ndarray, weights: tuple[int, int, int]):
    """Global horizontal cuts from the filled-wall bbox (perfectly straight lines)."""
    ys = np.flatnonzero(filled.any(axis=1))
    if ys.size < 8:
        raise RuntimeError("filled wall has no rows")
    y_top = int(ys.min())
    y_bot = int(ys.max())
    span = max(1, y_bot - y_top)
    total = float(sum(weights))
    t1 = weights[0] / total
    t2 = (weights[0] + weights[1]) / total
    y_lower_top = int(round(y_bot - t1 * span))
    y_feat_top = int(round(y_bot - t2 * span))

    yy = np.arange(wall.shape[0])[:, None]
    lower = ((yy >= y_lower_top) & (yy <= y_bot) & (wall > 0)).astype(np.uint8)
    feature = ((yy >= y_feat_top) & (yy < y_lower_top) & (wall > 0)).astype(np.uint8)
    upper = ((yy >= y_top) & (yy < y_feat_top) & (wall > 0)).astype(np.uint8)
    return {
        "lower": lower,
        "feature": feature,
        "upper": upper,
        "meta": {
            "mode": "global",
            "y_top": y_top,
            "y_bot": y_bot,
            "y_lower_top": y_lower_top,
            "y_feat_top": y_feat_top,
        },
    }


def split_envelope(wall: np.ndarray, filled: np.ndarray, weights: tuple[int, int, int]):
    """Straight bands between smoothed top/bottom wall edges (perspective rooms)."""
    h, w = filled.shape
    y_top = np.full(w, -1, np.int32)
    y_bot = np.full(w, -1, np.int32)
    for x in range(w):
        ys = np.flatnonzero(filled[:, x])
        if ys.size < 6:
            continue
        y_top[x] = int(ys.min())
        y_bot[x] = int(ys.max())

    valid = y_bot >= 0
    if not valid.any():
        raise RuntimeError("no filled columns")

    # Median-filter envelopes so vanity bays do not pull the floor line up.
    from scipy.ndimage import median_filter

    win = max(21, (w // 16) | 1)
    top_fill = float(np.median(y_top[valid]))
    bot_fill = float(np.median(y_bot[valid]))
    top_s = median_filter(np.where(valid, y_top, top_fill).astype(np.float32), size=win)
    bot_s = median_filter(np.where(valid, y_bot, bot_fill).astype(np.float32), size=win)

    total = float(sum(weights))
    t1 = weights[0] / total
    t2 = (weights[0] + weights[1]) / total

    lower = np.zeros_like(wall)
    feature = np.zeros_like(wall)
    upper = np.zeros_like(wall)
    yy = np.arange(h)
    for x in range(w):
        if not valid[x]:
            continue
        yt = float(top_s[x])
        yb = float(bot_s[x])
        span = yb - yt
        if span < 8:
            continue
        y_lower_top = yb - t1 * span
        y_feat_top = yb - t2 * span
        col = wall[:, x] > 0
        lower[:, x] = col & (yy >= y_lower_top) & (yy <= yb)
        feature[:, x] = col & (yy >= y_feat_top) & (yy < y_lower_top)
        upper[:, x] = col & (yy >= yt) & (yy < y_feat_top)

    return {
        "lower": lower,
        "feature": feature,
        "upper": upper,
        "meta": {"mode": "envelope", "win": win},
    }


def save_mask(arr: np.ndarray, dest: Path) -> None:
    img = Image.fromarray((arr * 255).astype(np.uint8), mode="L").convert("RGB")
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, optimize=True)


def main() -> None:
    for room, weights in ROOMS.items():
        src = ROOT / room / "mask-wall.png"
        if not src.exists():
            print("skip missing", src)
            continue
        wall = load_mask(src)
        filled = close_fixture_holes(wall)
        # Frontal small bath: perfectly horizontal cuts.
        # Large bath (perspective): parallel bands between smoothed wall edges.
        # Both rooms: straight horizontal cuts. Filled bbox ignores fixture holes
        # so bands do not wrap around vanity/mirror.
        out = split_global(wall, filled, weights)
        meta = out.pop("meta")
        wall_px = int(wall.sum())
        print(f"{room} wall={wall_px} weights={weights} {meta}")
        covered = 0
        for name, arr in out.items():
            n = int(arr.sum())
            covered += n
            dest = ROOT / room / f"mask-wall-{name}.png"
            save_mask(arr, dest)
            print(f"  {name}: {n} ({100 * n / max(1, wall_px):.1f}%) → {dest.name}")
        print(f"  covered {100 * covered / max(1, wall_px):.1f}% of original wall")


if __name__ == "__main__":
    main()
