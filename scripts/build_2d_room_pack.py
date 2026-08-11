"""
Build a 2D room pack that matches Sidhhi Binayak Visualizer2D contract.

Output folder (public/2d-rooms/<room-id>/):
  base.png            — lifestyle photo (resized, aligned)
  mask-floor.png      — white floor on black
  mask-wall.png       — white wall on black
  overlay-locked.png  — fixtures RGBA on transparent
  README.txt          — zone map

Modes
-----
1) From existing masks (fast, what you already did in Photopea):
   python scripts/build_2d_room_pack.py ^
     --room bathroom-02 ^
     --base path/to/photo.png ^
     --mask-floor path/to/floor.png ^
     --mask-wall path/to/wall.png

2) Heuristic auto masks (rough draft — review before ship):
   python scripts/build_2d_room_pack.py --room bathroom-02 --base photo.png --auto-masks

3) SAM-assisted (optional, if ultralytics / segment-anything installed):
   python scripts/build_2d_room_pack.py --room bathroom-02 --base photo.png --sam

Overlay is derived as:  pixels outside floor∪wall masks  (fixtures / decor),
with soft edge cleanup. Shadows under vanity/toilet stay if they sit outside
the tile masks (same Photopea isolation principle).

This is the agentic Stage 3–4 of your proposed pipeline, wired to the real
site architecture — not ComfyUI/Photopea cloud. Stage 1 (image gen) and Stage 2
(SAM text prompts) plug in by feeding --base and optional masks.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

try:
    import cv2
except ImportError:
    print("Install OpenCV: pip install opencv-python-headless numpy", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "public" / "2d-rooms"


def read_bgr(path: Path):
    img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if img is None:
        raise FileNotFoundError(path)
    return img


def ensure_bgr(img):
    if img.ndim == 2:
        return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    if img.shape[2] == 4:
        return cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    return img


def to_binary_mask(img, target_h: int, target_w: int) -> np.ndarray:
    """Any bright-on-dark or alpha mask → uint8 0/255 white-on-black."""
    if img.ndim == 2:
        g = img
    elif img.shape[2] == 4:
        # Prefer alpha if present, else luminance
        a = img[:, :, 3]
        if a.max() > 0 and a.mean() < 250:
            g = a
        else:
            g = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2GRAY)
    else:
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    g = cv2.resize(g, (target_w, target_h), interpolation=cv2.INTER_LINEAR)
    # Auto threshold: treat lighter region as mask
    _, bw = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # If mask is inverted (mostly white), flip
    if (bw > 127).mean() > 0.65:
        # could be white-bg black-mask — invert if edges look wrong
        # Prefer minority region as "active" for typical floor/wall (~10–45%)
        if (bw > 127).mean() > 0.55:
            bw = 255 - bw
    # Clean holes
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    bw = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, k, iterations=2)
    bw = cv2.morphologyEx(bw, cv2.MORPH_OPEN, k, iterations=1)
    return bw


def heuristic_masks(bgr: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Rough draft masks for bathroom-like near-frontal photos.
    Floor ≈ lower third; wall ≈ upper-middle band. Always review.
    """
    h, w = bgr.shape[:2]
    floor = np.zeros((h, w), np.uint8)
    wall = np.zeros((h, w), np.uint8)
    # Floor: bottom 38%
    floor[int(h * 0.62) :, :] = 255
    # Wall: central vertical band upper portion
    wall[: int(h * 0.68), int(w * 0.18) : int(w * 0.82)] = 255
    # Remove floor from wall
    wall = cv2.bitwise_and(wall, cv2.bitwise_not(floor))
    # Soften
    floor = cv2.GaussianBlur(floor, (0, 0), 2)
    wall = cv2.GaussianBlur(wall, (0, 0), 2)
    _, floor = cv2.threshold(floor, 127, 255, cv2.THRESH_BINARY)
    _, wall = cv2.threshold(wall, 127, 255, cv2.THRESH_BINARY)
    return floor, wall


def try_sam_masks(bgr: np.ndarray) -> tuple[np.ndarray, np.ndarray] | None:
    """
    Optional SAM path. Tries ultralytics SAM if installed.
    Returns (floor, wall) or None if unavailable.
    """
    try:
        from ultralytics import SAM  # type: ignore
    except Exception:
        print("[sam] ultralytics not installed — skip. pip install ultralytics")
        return None

    # Write temp for SAM
    tmp = ROOT / ".tile-name-work" / "sam_input.png"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(tmp), bgr)
    try:
        model = SAM("sam_b.pt")  # downloads on first use
        # Prompt-free auto — then pick largest lower / mid regions
        results = model(str(tmp))
        if not results:
            return None
        # Ultralytics SAM returns masks; take largest two by area + position
        r0 = results[0]
        if r0.masks is None:
            return None
        masks = r0.masks.data.cpu().numpy()  # (N,H,W)
        h, w = bgr.shape[:2]
        scored = []
        for i, m in enumerate(masks):
            m8 = (cv2.resize(m.astype(np.float32), (w, h)) > 0.5).astype(np.uint8) * 255
            ys, xs = np.where(m8 > 0)
            if len(ys) < 100:
                continue
            cy = ys.mean() / h
            area = len(ys) / (h * w)
            scored.append((area, cy, m8))
        if len(scored) < 2:
            return None
        # Floor = largest mask with center in lower half
        lower = [s for s in scored if s[1] > 0.55]
        upper = [s for s in scored if s[1] <= 0.55]
        floor = max(lower or scored, key=lambda s: s[0])[2]
        wall_cands = upper or [s for s in scored if s is not floor]
        wall = max(wall_cands, key=lambda s: s[0])[2] if wall_cands else np.zeros_like(floor)
        wall = cv2.bitwise_and(wall, cv2.bitwise_not(floor))
        print("[sam] produced floor/wall masks")
        return floor, wall
    except Exception as e:
        print(f"[sam] failed: {e}")
        return None


def build_overlay(bgr: np.ndarray, floor: np.ndarray, wall: np.ndarray) -> np.ndarray:
    """
    Fixtures = everything NOT in floor∪wall (and not pure empty).
    Keeps vanity/toilet/mirror + their contact shadows if those pixels
    are outside tile masks — same isolation idea as Photopea.
    """
    tile = cv2.bitwise_or(floor, wall)
    # Dilate tile slightly so grout/edge noise doesn't leak into overlay
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    tile_d = cv2.dilate(tile, k, iterations=1)
    fixture = cv2.bitwise_not(tile_d)

    # Soft edge: keep alpha from fixture mask with light blur
    alpha = cv2.GaussianBlur(fixture, (0, 0), 1.2)
    _, alpha_bin = cv2.threshold(alpha, 40, 255, cv2.THRESH_BINARY)
    alpha = cv2.bitwise_and(alpha, alpha_bin)

    bgra = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = alpha
    # Zero RGB where fully transparent (cleaner PNG)
    bgra[alpha < 8, :3] = 0
    return bgra


def write_readme(path: Path, room_id: str, name: str, width_mm: int):
    path.write_text(
        f"""Room name: {room_id}
Display name: {name}
Angle: front
Room width MM: {width_mm}

Zones:
- floor     → surface: Floor   → mask-floor.png
- wall      → surface: Wall    → mask-wall.png

Files:
- base.png           lifestyle photo
- mask-floor.png     white floor on black
- mask-wall.png      white wall on black
- overlay-locked.png fixtures + shadows on transparent

Site registration: append entry in src/data/rooms2d.js
""",
        encoding="utf-8",
    )


def rooms2d_snippet(room_id: str, name: str, blurb: str, width_mm: int) -> str:
    return f"""  {{
    id: '{room_id}',
    name: '{name}',
    blurb: '{blurb}',
    baseUrl: '/2d-rooms/{room_id}/base.png',
    overlayUrl: '/2d-rooms/{room_id}/overlay-locked.png',
    roomWidthMM: {width_mm},
    maskFeatherPx: 1.5,
    grout: {{ enabled: false, color: '#d4cdc0' }},
    zones: [
      {{ id: 'floor', label: 'Floor', surface: 'Floor', maskUrl: '/2d-rooms/{room_id}/mask-floor.png' }},
      {{ id: 'wall', label: 'Wall', surface: 'Wall', maskUrl: '/2d-rooms/{room_id}/mask-wall.png' }},
    ],
  }},
"""


def main():
    ap = argparse.ArgumentParser(description="Build Visualizer2D room pack")
    ap.add_argument("--room", required=True, help="folder id e.g. bathroom-02")
    ap.add_argument("--base", required=True, type=Path, help="source lifestyle photo")
    ap.add_argument("--mask-floor", type=Path, default=None)
    ap.add_argument("--mask-wall", type=Path, default=None)
    ap.add_argument("--auto-masks", action="store_true", help="heuristic floor/wall")
    ap.add_argument("--sam", action="store_true", help="try SAM via ultralytics")
    ap.add_argument("--name", default=None, help="display name")
    ap.add_argument("--blurb", default="Lifestyle room · locked fixtures")
    ap.add_argument("--width-mm", type=int, default=3600)
    ap.add_argument("--max-width", type=int, default=3344, help="export long side")
    ap.add_argument("--out-root", type=Path, default=OUT_ROOT)
    args = ap.parse_args()

    if not args.base.exists():
        print("Base missing:", args.base, file=sys.stderr)
        sys.exit(1)

    bgr = ensure_bgr(read_bgr(args.base))
    h0, w0 = bgr.shape[:2]
    # Downscale large sources; upscale small AI bases toward target long side
    scale = args.max_width / max(w0, h0)
    if abs(scale - 1.0) > 0.02:
        interp = cv2.INTER_AREA if scale < 1.0 else cv2.INTER_CUBIC
        bgr = cv2.resize(
            bgr,
            (int(w0 * scale), int(h0 * scale)),
            interpolation=interp,
        )
    h, w = bgr.shape[:2]
    print(f"Base {w}×{h}")

    floor = wall = None
    if args.mask_floor and args.mask_wall:
        floor = to_binary_mask(read_bgr(args.mask_floor), h, w)
        wall = to_binary_mask(read_bgr(args.mask_wall), h, w)
        print("Masks: from files")
    elif args.sam:
        pair = try_sam_masks(bgr)
        if pair:
            floor, wall = pair
        else:
            print("SAM unavailable — falling back to --auto-masks")
            args.auto_masks = True
    if floor is None and args.auto_masks:
        floor, wall = heuristic_masks(bgr)
        print("Masks: heuristic (REVIEW before production)")
    if floor is None or wall is None:
        print(
            "Need --mask-floor + --mask-wall, or --auto-masks, or --sam",
            file=sys.stderr,
        )
        sys.exit(1)

    # Align dimensions
    floor = cv2.resize(floor, (w, h), interpolation=cv2.INTER_NEAREST)
    wall = cv2.resize(wall, (w, h), interpolation=cv2.INTER_NEAREST)
    _, floor = cv2.threshold(floor, 127, 255, cv2.THRESH_BINARY)
    _, wall = cv2.threshold(wall, 127, 255, cv2.THRESH_BINARY)

    overlay = build_overlay(bgr, floor, wall)

    out = args.out_root / args.room
    out.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out / "base.png"), bgr)
    cv2.imwrite(str(out / "mask-floor.png"), floor)
    cv2.imwrite(str(out / "mask-wall.png"), wall)
    cv2.imwrite(str(out / "overlay-locked.png"), overlay)

    display = args.name or args.room.replace("-", " ").title()
    write_readme(out / "README.txt", args.room, display, args.width_mm)

    snippet = rooms2d_snippet(args.room, display, args.blurb, args.width_mm)
    (out / "rooms2d-snippet.js").write_text(snippet, encoding="utf-8")

    meta = {
        "id": args.room,
        "width": w,
        "height": h,
        "widthMm": args.width_mm,
        "files": [
            "base.png",
            "mask-floor.png",
            "mask-wall.png",
            "overlay-locked.png",
            "README.txt",
        ],
    }
    (out / "pack.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"\nPack written → {out}")
    print("Register in src/data/rooms2d.js (snippet also in rooms2d-snippet.js):")
    print(snippet)


if __name__ == "__main__":
    main()
