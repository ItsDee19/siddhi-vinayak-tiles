"""
Headless 2D room pack masking (no Photopea GUI).

Stack (Python):
  1) fal-ai/sam-3/image  — text prompts for TILE zones + FIXTURES
  2) OpenCV             — white-on-black masks, band splits, overlay RGBA

Quality notes:
  - bathroom-01 was hand-painted; this approaches it with SAM text prompts.
  - No Grok watermark (bases should come from fal GPT Image 2 / nano-banana).
  - Optional rembg edge pass if installed (pip install rembg).

  set FAL_KEY=...
  python scripts/fal_headless_2d_pack.py --all-prd
  python scripts/fal_headless_2d_pack.py --room vanity-e
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.request
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ROOMS = ROOT / "public" / "2d-rooms"
SAM_MODEL = "fal-ai/sam-3/image"

# EVERY room: only floor + wall (no bands, treads, counter, fascia, etc.)
TILE_PROMPTS = {
    "large-bathroom-b": {
        "floor": ["floor tiles", "tiled floor", "floor"],
        "wall": ["wall tiles", "tiled wall", "wall"],
    },
    "staircase-c": {
        # floor/treads only — walls must stay photo-locked (no wall zone)
        "floor": [
            "stair treads",
            "horizontal step tops",
            "stair walking surfaces",
            "landing floor",
        ],
    },
    "feature-wall-d": {
        # wall only — no floor zone for this model
        "wall": ["stone wall", "tiled facade", "feature wall", "wall"],
    },
    "vanity-e": {
        "floor": ["floor tiles", "floor"],
        "wall": ["tile backsplash", "wall tiles", "white tile wall", "wall"],
    },
}

# Fixtures / locked pixels for overlay (not tile zones)
FIXTURE_PROMPTS = {
    "large-bathroom-b": ["bathtub", "toilet", "plant"],
    "staircase-c": ["wooden handrail", "railing"],
    "feature-wall-d": [],  # non-tile = inverse of floor|wall after
    "vanity-e": ["mirror", "faucet", "sink basin"],
}


def client(key: str | None):
    from fal_client import SyncClient

    k = key or os.environ.get("FAL_KEY")
    if not k:
        print("Set FAL_KEY", file=sys.stderr)
        sys.exit(1)
    return SyncClient(key=k)


def data_uri(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def download(url: str) -> np.ndarray:
    req = urllib.request.Request(url, headers={"User-Agent": "svt-headless/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        buf = np.frombuffer(r.read(), dtype=np.uint8)
    im = cv2.imdecode(buf, cv2.IMREAD_UNCHANGED)
    if im is None:
        raise RuntimeError(url)
    return im


def to_wb(im: np.ndarray, hw: tuple[int, int]) -> np.ndarray:
    h, w = hw
    if im.ndim == 2:
        g = im
    elif im.shape[2] == 4:
        a = im[:, :, 3]
        g = a if a.max() > 10 and float(a.mean()) < 250 else cv2.cvtColor(im[:, :, :3], cv2.COLOR_BGR2GRAY)
    else:
        g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    g = cv2.resize(g, (w, h), interpolation=cv2.INTER_LINEAR)
    _, bw = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if (bw > 127).mean() > 0.7:
        # applied-mask preview: try non-gray difference
        if im.ndim == 3 and im.shape[2] >= 3:
            rgb = cv2.resize(im[:, :, :3], (w, h))
            hsv = cv2.cvtColor(rgb, cv2.COLOR_BGR2HSV)
            diff = np.abs(rgb.astype(np.int16) - 128).sum(axis=2)
            bw = ((diff > 35) | (hsv[:, :, 1] > 35)).astype(np.uint8) * 255
        else:
            bw = 255 - bw
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    return cv2.morphologyEx(bw, cv2.MORPH_CLOSE, k, iterations=2)


def sam_prompt(c, uri: str, prompt: str) -> np.ndarray | None:
    try:
        result = c.subscribe(
            SAM_MODEL,
            arguments={
                "image_url": uri,
                "prompt": prompt,
                "apply_mask": False,
                "output_format": "png",
                "return_multiple_masks": True,
                "max_masks": 3,
                "include_scores": True,
            },
        )
    except Exception as e:
        print(f"    SAM error [{prompt}]: {e}")
        return None
    if not result:
        return None
    imgs = []
    for m in result.get("masks") or []:
        if m and m.get("url"):
            imgs.append(download(m["url"]))
    img = result.get("image") or {}
    if not imgs and img.get("url"):
        imgs.append(download(img["url"]))
    if not imgs:
        return None
    return imgs


def best_mask(imgs: list[np.ndarray], hw: tuple[int, int], prefer_mid_area: bool = False) -> np.ndarray | None:
    h, w = hw
    total = h * w
    scored = []
    for im in imgs:
        wb = to_wb(im, hw)
        area = int((wb > 127).sum())
        if area < 80:
            continue
        frac = area / total
        # prefer masks that aren't almost full-frame (often wrong)
        score = area
        if frac > 0.92:
            score *= 0.2
        if prefer_mid_area and 0.05 < frac < 0.55:
            score *= 1.4
        scored.append((score, wb))
    if not scored:
        return None
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1]


def try_prompts(c, uri: str, hw: tuple[int, int], prompts: list[str], prefer_mid=False) -> np.ndarray | None:
    for p in prompts:
        print(f"    try: {p!r}")
        imgs = sam_prompt(c, uri, p)
        if not imgs:
            continue
        m = best_mask(imgs, hw, prefer_mid_area=prefer_mid)
        if m is not None:
            print(f"    ok area={(m > 127).sum()}")
            return m
    return None


def split_wall_bands(wall: np.ndarray, lower_frac=0.25, feature_frac=0.5) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Split wall mask into lower / feature / upper (image Y, bottom = lower)."""
    h, w = wall.shape[:2]
    ys = np.where(wall > 127)[0]
    if len(ys) == 0:
        z = np.zeros_like(wall)
        return z, z, z
    y0, y1 = int(ys.min()), int(ys.max())
    span = max(1, y1 - y0)
    y_lt = y1 - int(span * lower_frac)
    y_ft = y1 - int(span * (lower_frac + feature_frac))

    def band(yhi, ylo):
        m = np.zeros((h, w), np.uint8)
        m[max(0, yhi) : min(h, ylo), :] = 255
        return cv2.bitwise_and(m, wall)

    lower = band(y_lt, y1 + 1)
    feature = band(y_ft, y_lt)
    upper = band(y0, y_ft)
    return lower, feature, upper


def soft_mask_edges(mask: np.ndarray, near_sigma: float = 0.8, far_sigma: float = 2.2) -> np.ndarray:
    """
    Depth-ish soft edges: tighter blur near bottom of frame (camera-near),
    softer blur higher up (receding into room). Approximates DOF without a depth map.
    """
    if mask is None or not mask.any():
        return mask
    h, w = mask.shape[:2]
    hard = (mask > 127).astype(np.uint8) * 255
    near = cv2.GaussianBlur(hard, (0, 0), near_sigma)
    far = cv2.GaussianBlur(hard, (0, 0), far_sigma)
    # y=0 top (far) → weight 1 on far blur; y=h bottom (near) → near blur
    ys = np.linspace(1.0, 0.0, h, dtype=np.float32).reshape(h, 1)
    blend = far.astype(np.float32) * ys + near.astype(np.float32) * (1.0 - ys)
    return np.clip(blend, 0, 255).astype(np.uint8)


def contact_ao_darken(bgr: np.ndarray, fixture_alpha: np.ndarray, strength: float = 0.45) -> np.ndarray:
    """
    Bake contact shadow along fixture edges (where furniture meets floor/wall).
    Sobel on alpha → darken RGB near contact for heavier, anchored look.
    """
    if fixture_alpha is None or not fixture_alpha.any():
        return bgr
    a = fixture_alpha.astype(np.float32) / 255.0
    gx = cv2.Sobel(a, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(a, cv2.CV_32F, 0, 1, ksize=3)
    edge = cv2.magnitude(gx, gy)
    if edge.max() > 0:
        edge = edge / edge.max()
    edge = cv2.GaussianBlur(edge, (0, 0), 1.5)
    # Only darken on the fixture side near boundary
    contact = edge * (a > 0.05).astype(np.float32)
    factor = 1.0 - contact * strength
    out = bgr.astype(np.float32)
    for c in range(3):
        out[:, :, c] *= factor
    return np.clip(out, 0, 255).astype(np.uint8)


def build_overlay(bgr: np.ndarray, tile_masks: list[np.ndarray], fixture: np.ndarray | None) -> np.ndarray:
    h, w = bgr.shape[:2]
    tile = np.zeros((h, w), np.uint8)
    for m in tile_masks:
        if m is None:
            continue
        if m.shape[:2] != (h, w):
            m = cv2.resize(m, (w, h), interpolation=cv2.INTER_NEAREST)
        tile = cv2.bitwise_or(tile, (m > 127).astype(np.uint8) * 255)

    if fixture is not None and fixture.any():
        alpha = soft_mask_edges(fixture, near_sigma=0.9, far_sigma=2.4)
        _, ab = cv2.threshold(alpha, 12, 255, cv2.THRESH_BINARY)
        alpha = cv2.bitwise_and(alpha, ab)
    else:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
        tile_d = cv2.dilate(tile, k, iterations=1)
        alpha = soft_mask_edges(cv2.bitwise_not(tile_d), near_sigma=0.9, far_sigma=2.4)
        _, ab = cv2.threshold(alpha, 16, 255, cv2.THRESH_BINARY)
        alpha = cv2.bitwise_and(alpha, ab)

    rgb = contact_ao_darken(bgr, alpha, strength=0.42)
    bgra = cv2.cvtColor(rgb, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = alpha
    bgra[alpha < 6, :3] = 0
    return bgra


def optional_rembg_refine(bgr: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """If rembg installed, refine alpha edges (optional)."""
    try:
        from rembg import remove
        from PIL import Image
    except ImportError:
        return alpha
    # rembg full-image subject cut — blend only near existing alpha edges
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb)
    out = remove(pil)
    arr = np.array(out)
    if arr.ndim != 3 or arr.shape[2] < 4:
        return alpha
    ra = arr[:, :, 3]
    if ra.shape[:2] != alpha.shape[:2]:
        ra = cv2.resize(ra, (alpha.shape[1], alpha.shape[0]))
    # only use rembg where we already think fixture exists
    return np.maximum(alpha, cv2.bitwise_and(ra, (alpha > 10).astype(np.uint8) * 255))


def process_room(c, room_id: str):
    room = ROOMS / room_id
    base_path = room / "base.png"
    if not base_path.exists():
        print(f"skip {room_id}: no base.png")
        return
    bgr = cv2.imread(str(base_path), cv2.IMREAD_COLOR)
    h, w = bgr.shape[:2]
    uri = data_uri(base_path)
    print(f"\n=== HEADLESS {room_id} {w}x{h} ===")

    tile_cfg = TILE_PROMPTS.get(
        room_id,
        {"floor": ["floor", "floor tiles"], "wall": ["wall", "wall tiles"]},
    )
    tile_masks: dict[str, np.ndarray] = {}

    # --- tile zones: floor + wall (or wall-only for feature-wall-d) ---
    do_floor = "floor" in tile_cfg
    do_wall = "wall" in tile_cfg
    floor = None
    wall = None
    if do_floor:
        floor = try_prompts(c, uri, (h, w), tile_cfg["floor"], prefer_mid=True)
    if do_wall:
        wall = try_prompts(c, uri, (h, w), tile_cfg["wall"])
    if floor is not None:
        # Soft anti-aliased edges (gray fringe) — compositor reads luminance as alpha
        floor = soft_mask_edges(floor, near_sigma=0.6, far_sigma=1.8)
        tile_masks["floor"] = floor
        cv2.imwrite(str(room / "mask-floor.png"), floor)
        print(f"  floor area={(floor > 127).sum()}")
    if wall is not None:
        if floor is not None:
            # Subtract hard core of floor so soft fringes don't double-fill
            floor_core = (floor > 127).astype(np.uint8) * 255
            wall = cv2.bitwise_and(wall, cv2.bitwise_not(floor_core))
        wall = soft_mask_edges(wall, near_sigma=0.7, far_sigma=2.0)
        tile_masks["wall"] = wall
        cv2.imwrite(str(room / "mask-wall.png"), wall)
        print(f"  wall area={(wall > 127).sum()}")

    # keep only active zone masks for this room
    keep = {f"mask-{z}.png" for z in tile_masks}
    for stale in room.glob("mask-*.png"):
        if stale.name not in keep:
            stale.unlink(missing_ok=True)
            print(f"  removed stale {stale.name}")

    # --- fixtures for overlay ---
    fixture = np.zeros((h, w), np.uint8)
    for p in FIXTURE_PROMPTS.get(room_id, []):
        m = try_prompts(c, uri, (h, w), [p], prefer_mid=True)
        if m is not None:
            if (m > 127).mean() > 0.55:
                print(f"    skip large fixture mask for {p!r}")
                continue
            fixture = cv2.bitwise_or(fixture, m)

    # anything not floor|wall stays locked (sky, fixtures, furniture)
    tile_union = np.zeros((h, w), np.uint8)
    for m in tile_masks.values():
        tile_union = cv2.bitwise_or(tile_union, m)
    if tile_union.any():
        non_tile = cv2.bitwise_not(tile_union)
        if fixture.any():
            fixture = cv2.bitwise_or(fixture, non_tile)
        else:
            fixture = non_tile

    if fixture.any():
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        fixture = cv2.morphologyEx(fixture, cv2.MORPH_CLOSE, k)

    tile_list = list(tile_masks.values())
    ov = build_overlay(bgr, tile_list, fixture if fixture.any() else None)
    ov[:, :, 3] = optional_rembg_refine(bgr, ov[:, :, 3])
    cv2.imwrite(str(room / "overlay-locked.png"), ov)

    # pack metadata
    zone_meta = []
    if "floor" in tile_masks:
        zone_meta.append({"id": "floor", "label": "Floor", "surface": "Floor"})
    if "wall" in tile_masks:
        zone_meta.append({"id": "wall", "label": "Wall", "surface": "Wall"})
    pack = {
        "id": room_id,
        "zones": zone_meta,
        "quality": "auto-mask-draft",
    }
    (room / "pack.json").write_text(json.dumps(pack, indent=2), encoding="utf-8")
    zone_names = " + ".join(tile_masks.keys()) or "none"
    mask_list = " · ".join(f"mask-{z}.png" for z in tile_masks) or "(no masks)"
    (room / "README.txt").write_text(
        f"Room: {room_id}\nZones: {zone_names}\n"
        f"{mask_list} · overlay-locked.png · base.png\n",
        encoding="utf-8",
    )

    meta = {
        "room": room_id,
        "engine": "headless",
        "sam": SAM_MODEL,
        "tile_zones": list(tile_masks.keys()),
        "fixture_pixels": int((fixture > 127).sum()) if fixture is not None else 0,
    }
    (room / "headless_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"  zones={list(tile_masks.keys())} overlay_alpha_mean={ov[:,:,3].mean():.1f}")


def main():
    ap = argparse.ArgumentParser(description="Headless SAM+OpenCV 2D pack masking")
    ap.add_argument("--key", default=None)
    ap.add_argument("--room", action="append", dest="rooms")
    ap.add_argument("--all-prd", action="store_true")
    args = ap.parse_args()

    c = client(args.key)
    rooms = args.rooms or []
    if args.all_prd or not rooms:
        rooms = ["large-bathroom-b", "staircase-c", "feature-wall-d", "vanity-e"]

    for rid in rooms:
        process_room(c, rid)
    print("\nDone. Review http://127.0.0.1:5173/#visualizer")
    print("All packs are floor + wall only.")


if __name__ == "__main__":
    main()
