"""
Build PRD Models B–E as 2D room packs (NOT 3D).

Keeps bathroom-01 as Model A (already Photopea-quality).
Outputs only under public/2d-rooms/{large-bathroom-b,staircase-c,feature-wall-d,vanity-e}/

Auto-masks are geometry + colour heuristics for review. They will NOT fully match
bathroom-01 Photopea precision — user may refine masks in Photopea after review.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "2d-rooms"
SESSION = Path(
    r"C:\Users\KIIT\.grok\sessions\C%3A%5CUsers%5CKIIT\019feca6-4eed-7822-bbfd-cfac6f5986bf\images"
)
TARGET_W = 2560  # long side; matches ~16:9 upscale from AI bases


def load_bgr(path: Path) -> np.ndarray:
    im = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if im is None:
        raise FileNotFoundError(path)
    return im


def resize_long(bgr: np.ndarray, long_side: int = TARGET_W) -> np.ndarray:
    h, w = bgr.shape[:2]
    scale = long_side / max(h, w)
    nh, nw = int(round(h * scale)), int(round(w * scale))
    interp = cv2.INTER_CUBIC if scale > 1 else cv2.INTER_AREA
    return cv2.resize(bgr, (nw, nh), interpolation=interp)


def white_on_black(mask: np.ndarray) -> np.ndarray:
    m = (mask > 127).astype(np.uint8) * 255
    return m


def clean_mask(m: np.ndarray, close=5, open_=3) -> np.ndarray:
    m = white_on_black(m)
    if close:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close, close))
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k)
    if open_:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (open_, open_))
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k)
    return m


def overlay_from_masks(bgr: np.ndarray, tile_masks: list[np.ndarray]) -> np.ndarray:
    h, w = bgr.shape[:2]
    tile = np.zeros((h, w), np.uint8)
    for m in tile_masks:
        tile = cv2.bitwise_or(tile, white_on_black(m))
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    tile = cv2.dilate(tile, k, iterations=1)
    fixture = cv2.bitwise_not(tile)
    alpha = cv2.GaussianBlur(fixture, (0, 0), 1.5)
    _, ab = cv2.threshold(alpha, 32, 255, cv2.THRESH_BINARY)
    alpha = cv2.bitwise_and(alpha, ab)
    bgra = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = alpha
    bgra[alpha < 10, :3] = 0
    return bgra


def write_pack(
    room_id: str,
    name: str,
    blurb: str,
    width_mm: int,
    bgr: np.ndarray,
    zones: dict[str, np.ndarray],
    zone_meta: list[dict],
):
    """zones: id -> binary mask"""
    out = OUT / room_id
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    cv2.imwrite(str(out / "base.png"), bgr)
    masks = []
    for zid, mask in zones.items():
        m = clean_mask(mask)
        # ensure same size
        if m.shape[:2] != bgr.shape[:2]:
            m = cv2.resize(m, (bgr.shape[1], bgr.shape[0]), interpolation=cv2.INTER_NEAREST)
        m = white_on_black(m)
        fname = f"mask-{zid}.png"
        cv2.imwrite(str(out / fname), m)
        masks.append(m)

    ov = overlay_from_masks(bgr, masks)
    cv2.imwrite(str(out / "overlay-locked.png"), ov)

    readme_lines = [
        f"Room name: {room_id}",
        f"Display name: {name}",
        f"PRD model: {blurb}",
        f"Room width MM: {width_mm}",
        f"Resolution: {bgr.shape[1]}x{bgr.shape[0]}",
        "",
        "Zones:",
    ]
    for zm in zone_meta:
        readme_lines.append(
            f"- {zm['id']:16} surface: {zm['surface']:12} mask: mask-{zm['id']}.png"
        )
    readme_lines += [
        "",
        "Files: base.png, mask-*.png, overlay-locked.png",
        "Status: AUTO-MASK DRAFT — refine in Photopea to match bathroom-01 quality.",
        "Do not ship until masks isolate tile zones cleanly under fixtures.",
    ]
    (out / "README.txt").write_text("\n".join(readme_lines) + "\n", encoding="utf-8")

    # rooms2d snippet
    zone_js = ",\n".join(
        f"      {{ id: '{zm['id']}', label: '{zm['label']}', surface: '{zm['surface']}', "
        f"maskUrl: '/2d-rooms/{room_id}/mask-{zm['id']}.png' }}"
        for zm in zone_meta
    )
    snippet = f"""  {{
    id: '{room_id}',
    name: '{name}',
    blurb: '{blurb}',
    baseUrl: '/2d-rooms/{room_id}/base.png',
    overlayUrl: '/2d-rooms/{room_id}/overlay-locked.png',
    roomWidthMM: {width_mm},
    maskFeatherPx: 1.5,
    grout: {{ enabled: false, color: '#d4cdc0' }},
    zones: [
{zone_js}
    ],
  }},
"""
    (out / "rooms2d-snippet.js").write_text(snippet, encoding="utf-8")
    (out / "pack.json").write_text(
        json.dumps(
            {
                "id": room_id,
                "name": name,
                "width": bgr.shape[1],
                "height": bgr.shape[0],
                "zones": zone_meta,
                "quality": "auto-mask-draft",
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"OK {room_id} → {out} ({bgr.shape[1]}x{bgr.shape[0]}, {len(zones)} zones)")
    return snippet


# ── Model-specific mask builders ──────────────────────────────────────────


def masks_model_b_bathroom(bgr: np.ndarray) -> tuple[dict, list]:
    """
    Large bathroom: floor + wall lower/feature/upper (2-4-2 on wall height in image space).
    Floor = lower ~42% of frame (perspective room).
    Wall tiles = remaining upper tile regions minus ceiling-ish top strip.
    """
    h, w = bgr.shape[:2]
    floor = np.zeros((h, w), np.uint8)
    # Perspective floor polygon (trapezoid)
    pts = np.array(
        [
            [int(w * 0.02), h - 1],
            [int(w * 0.98), h - 1],
            [int(w * 0.88), int(h * 0.52)],
            [int(w * 0.12), int(h * 0.52)],
        ],
        np.int32,
    )
    cv2.fillPoly(floor, [pts], 255)

    wall_all = np.zeros((h, w), np.uint8)
    # Left wall + back + right roughly
    left = np.array(
        [[0, int(h * 0.08)], [int(w * 0.18), int(h * 0.52)], [int(w * 0.12), int(h * 0.52)], [0, h - 1]],
        np.int32,
    )
    back = np.array(
        [
            [int(w * 0.12), int(h * 0.52)],
            [int(w * 0.88), int(h * 0.52)],
            [int(w * 0.82), int(h * 0.10)],
            [int(w * 0.18), int(h * 0.10)],
        ],
        np.int32,
    )
    right = np.array(
        [
            [w - 1, int(h * 0.08)],
            [w - 1, h - 1],
            [int(w * 0.88), int(h * 0.52)],
            [int(w * 0.82), int(h * 0.10)],
        ],
        np.int32,
    )
    cv2.fillPoly(wall_all, [left, back, right], 255)
    wall_all = cv2.bitwise_and(wall_all, cv2.bitwise_not(floor))

    # Horizontal bands in IMAGE Y over wall bbox (approx world 2-4-2)
    ys, xs = np.where(wall_all > 0)
    if len(ys) == 0:
        y0, y1 = int(h * 0.1), int(h * 0.55)
    else:
        y0, y1 = int(ys.min()), int(ys.max())
    span = max(1, y1 - y0)
    # lower 2/8 of wall height from bottom of wall region
    # In image, bottom of wall is higher y. So from y1 upward:
    # lower band: bottom 25% of wall region (2/8)
    # feature: next 50% (4/8)
    # upper: top 25% (2/8)
    y_lower_top = y1 - int(span * 0.25)
    y_feat_top = y1 - int(span * 0.75)

    def band(y_hi, y_lo):
        m = np.zeros((h, w), np.uint8)
        m[y_hi:y_lo, :] = 255
        return cv2.bitwise_and(m, wall_all)

    # Full wall only (no lower / feature / upper bands) — matches bathroom-01 contract
    wall = wall_all

    zones = {
        "floor": floor,
        "wall": wall,
    }
    meta = [
        {"id": "floor", "label": "Floor", "surface": "Floor"},
        {"id": "wall", "label": "Wall", "surface": "Wall"},
    ]
    return zones, meta


def masks_model_c_stairs(bgr: np.ndarray) -> tuple[dict, list]:
    """
    Staircase: colour-cluster grey concrete steps vs white walls.
    Landing ≈ mid-left platform; treads ≈ brighter top faces; risers ≈ darker vertical.
    """
    h, w = bgr.shape[:2]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    L = lab[:, :, 0]
    # Grey concrete: low saturation, mid lightness
    sat = hsv[:, :, 1]
    concrete = ((sat < 45) & (L > 70) & (L < 200)).astype(np.uint8) * 255
    # Exclude pure white walls (very high L)
    concrete = cv2.bitwise_and(concrete, ((L < 185) | (sat > 15)).astype(np.uint8) * 255)
    concrete = clean_mask(concrete, 7, 5)

    # Landing: large connected region left-center mid height
    landing = np.zeros((h, w), np.uint8)
    # approximate platform box
    cv2.rectangle(
        landing,
        (int(w * 0.08), int(h * 0.38)),
        (int(w * 0.48), int(h * 0.58)),
        255,
        -1,
    )
    landing = cv2.bitwise_and(landing, concrete)

    # Risers: stronger vertical gradients in concrete
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    vert = (np.abs(gy) > np.abs(gx) * 1.1) & (np.abs(gy) > 12)
    risers = (vert.astype(np.uint8) * 255)
    risers = cv2.bitwise_and(risers, concrete)
    risers = cv2.bitwise_and(risers, cv2.bitwise_not(landing))
    risers = clean_mask(risers, 3, 2)

    treads = cv2.bitwise_and(concrete, cv2.bitwise_not(landing))
    treads = cv2.bitwise_and(treads, cv2.bitwise_not(risers))
    treads = clean_mask(treads, 5, 3)

    # If too empty, fallback geometry
    if treads.mean() < 2:
        treads = np.zeros((h, w), np.uint8)
        # right flight steps approx
        for i in range(12):
            y = int(h * 0.85 - i * h * 0.045)
            x0 = int(w * 0.45 + i * w * 0.02)
            cv2.rectangle(treads, (x0, y - 8), (min(w - 1, x0 + int(w * 0.4)), y + 4), 255, -1)
        for i in range(8):
            y = int(h * 0.72 - i * h * 0.04)
            x1 = int(w * 0.42 - i * w * 0.015)
            cv2.rectangle(treads, (int(w * 0.05), y - 6), (x1, y + 3), 255, -1)

    zones = {"treads": treads, "risers": risers, "landing": landing}
    meta = [
        {"id": "treads", "label": "Treads", "surface": "Floor"},
        {"id": "risers", "label": "Risers", "surface": "Wall"},
        {"id": "landing", "label": "Landing", "surface": "Floor"},
    ]
    return zones, meta


def masks_model_d_wall(bgr: np.ndarray) -> tuple[dict, list]:
    """Feature wall: main wall face vs sky/background."""
    h, w = bgr.shape[:2]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    # Sky-ish blues / bright top
    sky = (
        ((hsv[:, :, 0] > 80) & (hsv[:, :, 0] < 130) & (hsv[:, :, 1] > 20) & (hsv[:, :, 2] > 120))
        | ((hsv[:, :, 1] < 40) & (hsv[:, :, 2] > 200) & (np.linspace(0, 1, h)[:, None] < 0.35))
    )
    # Green foliage
    green = (hsv[:, :, 0] > 35) & (hsv[:, :, 0] < 95) & (hsv[:, :, 1] > 40)
    bg = (sky | green).astype(np.uint8) * 255
    bg = clean_mask(bg, 9, 5)
    wall = cv2.bitwise_not(bg)
    # Keep central mass
    wall[: int(h * 0.02), :] = 0
    wall = clean_mask(wall, 11, 5)

    # Optional lower/upper split for PRD layout mode "horizontal bands"
    ys, _ = np.where(wall > 0)
    if len(ys):
        y0, y1 = ys.min(), ys.max()
        mid = y0 + int((y1 - y0) * 0.4)  # lower 0-4ft of 10ft ≈ 40%
    else:
        mid = int(h * 0.55)
    lower = wall.copy()
    lower[:mid, :] = 0
    upper = wall.copy()
    upper[mid:, :] = 0

    zones = {"wall": wall, "wall-lower": lower, "wall-upper": upper}
    meta = [
        {"id": "wall", "label": "Full Wall", "surface": "Wall"},
        {"id": "wall-lower", "label": "Lower Band", "surface": "Wall"},
        {"id": "wall-upper", "label": "Upper Band", "surface": "Wall"},
    ]
    return zones, meta


def masks_model_e_vanity(bgr: np.ndarray) -> tuple[dict, list]:
    """
    Vanity: colour segments.
    - wall: white subway tiles
    - counter: bright white marble top
    - fascia: blue cabinets
    """
    h, w = bgr.shape[:2]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    L, a, b = lab[:, :, 0], lab[:, :, 1], lab[:, :, 2]

    # Blue cabinets (fascia)
    blue = (
        (hsv[:, :, 0] > 90)
        & (hsv[:, :, 0] < 140)
        & (hsv[:, :, 1] > 40)
        & (hsv[:, :, 2] > 40)
        & (hsv[:, :, 2] < 200)
    ).astype(np.uint8) * 255
    blue = clean_mask(blue, 7, 3)

    # Counter: high L, low sat, mid height band
    counter = (
        (L > 175)
        & (hsv[:, :, 1] < 50)
        & (np.arange(h)[:, None] > int(h * 0.38))
        & (np.arange(h)[:, None] < int(h * 0.58))
    ).astype(np.uint8) * 255
    counter = cv2.bitwise_and(counter, cv2.bitwise_not(blue))
    counter = clean_mask(counter, 5, 3)

    # Wall: white tiles above counter region
    wall = (
        (L > 160)
        & (hsv[:, :, 1] < 55)
        & (np.arange(h)[:, None] < int(h * 0.52))
    ).astype(np.uint8) * 255
    wall = cv2.bitwise_and(wall, cv2.bitwise_not(counter))
    # remove mirror (very uniform gray rectangle mid-top) — high L low variance later
    wall = clean_mask(wall, 5, 3)

    # Floor strip at bottom (optional grey tiles)
    floor = (
        (np.arange(h)[:, None] > int(h * 0.88))
        & (L > 100)
        & (L < 200)
        & (hsv[:, :, 1] < 40)
    ).astype(np.uint8) * 255
    floor = clean_mask(floor, 5, 3)

    zones = {
        "wall": wall,
        "counter": counter,
        "fascia": blue,
        "floor": floor,
    }
    meta = [
        {"id": "wall", "label": "Back Wall", "surface": "Wall"},
        {"id": "counter", "label": "Counter Top", "surface": "Countertop"},
        {"id": "fascia", "label": "Front Panel", "surface": "Wall"},
        {"id": "floor", "label": "Floor", "surface": "Floor"},
    ]
    return zones, meta


def main():
    # Map session images (from this conversation generation)
    sources = {
        "large-bathroom-b": SESSION / "7.jpg",  # corner master bath
        "staircase-c": SESSION / "8.jpg",
        "feature-wall-d": SESSION / "5.jpg",
        "vanity-e": SESSION / "6.jpg",
    }
    builders = {
        "large-bathroom-b": (
            "Large Bathroom",
            "PRD Model B · 10×10 corner · 2-4-2 wall bands",
            3048,  # ~10 ft in mm
            masks_model_b_bathroom,
        ),
        "staircase-c": (
            "Staircase",
            "PRD Model C · 22 steps + landing",
            1220,
            masks_model_c_stairs,
        ),
        "feature-wall-d": (
            "Feature Wall",
            "PRD Model D · 30×10 ft wall",
            9144,
            masks_model_d_wall,
        ),
        "vanity-e": (
            "Vanity Counter",
            "PRD Model E · wall + counter + fascia",
            3048,
            masks_model_e_vanity,
        ),
    }

    snippets = []
    for room_id, src in sources.items():
        if not src.exists():
            print(f"MISSING source for {room_id}: {src}")
            continue
        name, blurb, width_mm, builder = builders[room_id]
        bgr = resize_long(load_bgr(src), TARGET_W)
        zones, meta = builder(bgr)
        sn = write_pack(room_id, name, blurb, width_mm, bgr, zones, meta)
        snippets.append(sn)

    # Write combined snippet file for rooms2d.js merge (manual review)
    combined = OUT / "_prd_b_e_rooms2d_snippet.js"
    combined.write_text(
        "// Paste after bathroom-01 in rooms2d.js (Models B–E)\n" + "\n".join(snippets),
        encoding="utf-8",
    )
    print(f"\nSnippets → {combined}")
    print("bathroom-01 (Model A) left untouched.")
    print("Draft packs ready for visual review in #visualizer-2d after rooms2d.js update.")


if __name__ == "__main__":
    main()
