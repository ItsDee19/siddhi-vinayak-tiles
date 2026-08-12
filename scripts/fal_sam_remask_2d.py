"""
Re-mask 2D room packs using fal.ai SAM models (no key stored in repo).

Requires env FAL_KEY (or pass --key once; prefer env).

Models (from fal catalog):
  - fal-ai/sam-3/image          — text-prompt SAM 3 (preferred: "floor", "wall tiles")
  - fal-ai/sam2/auto-segment   — automatic multi-mask SAM 2
  - fal-ai/sam2/image          — point/box SAM 2

Usage:
  set FAL_KEY=...
  python scripts/fal_sam_remask_2d.py --room large-bathroom-b --prompts floor "wall tiles"
  python scripts/fal_sam_remask_2d.py --room vanity-e --model fal-ai/sam-3/image --prompts "white subway tile wall" "marble countertop" "blue cabinet"
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

# Prefer text-promptable SAM 3 for zone labels
DEFAULT_MODEL = "fal-ai/sam-3/image"
AUTO_MODEL = "fal-ai/sam2/auto-segment"

# Every room: floor + wall only (no multi-layer bands)
ROOM_PROMPTS = {
    "large-bathroom-b": [
        ("floor", "floor tiles"),
        ("wall", "wall tiles"),
    ],
    "staircase-c": [
        ("floor", "stair treads and landing"),
    ],
    "feature-wall-d": [
        ("wall", "stone tiled wall facade"),
    ],
    "vanity-e": [
        ("floor", "floor tiles"),
        ("wall", "white tile backsplash wall"),
    ],
    "bathroom-01": [
        ("floor", "bathroom floor tiles"),
        ("wall", "bathroom wall tiles"),
    ],
}


def get_client(key: str | None):
    try:
        from fal_client import SyncClient
    except ImportError:
        print("pip install fal-client", file=sys.stderr)
        sys.exit(1)
    k = key or os.environ.get("FAL_KEY")
    if not k:
        print("Set FAL_KEY env or pass --key", file=sys.stderr)
        sys.exit(1)
    return SyncClient(key=k)


def file_to_data_uri(path: Path) -> str:
    data = path.read_bytes()
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:image/png;base64,{b64}"


def download(url: str) -> np.ndarray:
    req = urllib.request.Request(url, headers={"User-Agent": "svt-2d-mask/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        buf = np.frombuffer(r.read(), dtype=np.uint8)
    im = cv2.imdecode(buf, cv2.IMREAD_UNCHANGED)
    if im is None:
        raise RuntimeError(f"decode failed: {url}")
    return im


def mask_to_white_black(im: np.ndarray, target_hw: tuple[int, int]) -> np.ndarray:
    """Convert SAM output (RGBA/mask preview) to solid white-on-black."""
    h, w = target_hw
    if im.ndim == 2:
        g = im
    elif im.shape[2] == 4:
        # Prefer alpha; else luminance of RGB
        a = im[:, :, 3]
        if a.max() > 10 and a.mean() < 250:
            g = a
        else:
            g = cv2.cvtColor(im[:, :, :3], cv2.COLOR_BGR2GRAY)
    else:
        g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    g = cv2.resize(g, (w, h), interpolation=cv2.INTER_LINEAR)
    # If mostly white (applied mask on image), use edge of non-black
    _, bw = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Prefer minority region if >65% white (likely inverted)
    if (bw > 127).mean() > 0.65:
        # for applied-mask previews, segment may be colored on image —
        # use non-near-black from RGB if present
        if im.ndim == 3 and im.shape[2] >= 3:
            rgb = cv2.resize(im[:, :, :3], (w, h))
            # mask often bright overlay; take saturated or bright non-bg
            hsv = cv2.cvtColor(rgb, cv2.COLOR_BGR2HSV)
            # high difference from gray bg
            diff = np.abs(rgb.astype(np.int16) - 128).sum(axis=2)
            bw = ((diff > 40) | (hsv[:, :, 1] > 40)).astype(np.uint8) * 255
        else:
            bw = 255 - bw
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    bw = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, k, iterations=2)
    return bw


def segment_prompt(client, image_uri: str, prompt: str, model: str) -> list[np.ndarray]:
    """Call text-prompt SAM; return list of mask images (BGR/A)."""
    if model.endswith("auto-segment") or "auto-segment" in model:
        result = client.subscribe(
            model,
            arguments={
                "image_url": image_uri,
                "output_format": "png",
                "points_per_side": 32,
                "pred_iou_thresh": 0.88,
                "stability_score_thresh": 0.95,
                "min_mask_region_area": 200,
            },
        )
        if not result:
            return []
        imgs = []
        for m in result.get("individual_masks") or []:
            if m and m.get("url"):
                imgs.append(download(m["url"]))
        cm = result.get("combined_mask") or {}
        if not imgs and cm.get("url"):
            imgs.append(download(cm["url"]))
        return imgs

    # SAM 3 text prompt — try a few prompt variants
    prompts = [prompt]
    # shorter fallbacks
    short = prompt.split()[0] if prompt else "object"
    if short not in prompts:
        prompts.append(short)

    imgs: list[np.ndarray] = []
    for p in prompts:
        try:
            result = client.subscribe(
                model,
                arguments={
                    "image_url": image_uri,
                    "prompt": p,
                    "apply_mask": False,
                    "output_format": "png",
                    "return_multiple_masks": True,
                    "max_masks": 3,
                    "include_scores": True,
                },
            )
        except Exception:
            result = None
        if not result:
            continue
        for m in result.get("masks") or []:
            if m and m.get("url"):
                imgs.append(download(m["url"]))
        if not imgs:
            img = result.get("image") or {}
            if img.get("url"):
                imgs.append(download(img["url"]))
        if imgs:
            break
    return imgs


def rebuild_overlay(bgr: np.ndarray, masks: list[np.ndarray]) -> np.ndarray:
    h, w = bgr.shape[:2]
    tile = np.zeros((h, w), np.uint8)
    for m in masks:
        if m.shape[:2] != (h, w):
            m = cv2.resize(m, (w, h), interpolation=cv2.INTER_NEAREST)
        tile = cv2.bitwise_or(tile, (m > 127).astype(np.uint8) * 255)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    tile = cv2.dilate(tile, k, iterations=1)
    fixture = cv2.bitwise_not(tile)
    alpha = cv2.GaussianBlur(fixture, (0, 0), 1.2)
    _, ab = cv2.threshold(alpha, 28, 255, cv2.THRESH_BINARY)
    alpha = cv2.bitwise_and(alpha, ab)
    bgra = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = alpha
    bgra[alpha < 8, :3] = 0
    return bgra


def process_room(client, room_id: str, model: str, prompts: list[tuple[str, str]] | None):
    room_dir = ROOMS / room_id
    base_path = room_dir / "base.png"
    if not base_path.exists():
        print(f"skip {room_id}: no base.png")
        return
    bgr = cv2.imread(str(base_path), cv2.IMREAD_COLOR)
    h, w = bgr.shape[:2]
    # Upload via data URI (auto-upload also works with path in some clients)
    uri = file_to_data_uri(base_path)
    print(f"\n=== {room_id} {w}x{h} model={model} ===")

    pairs = prompts or ROOM_PROMPTS.get(room_id)
    if not pairs:
        print("  no prompts defined")
        return

    saved = []
    for zone_id, prompt in pairs:
        print(f"  segment: {zone_id!r} ← {prompt!r}")
        try:
            masks = segment_prompt(client, uri, prompt, model)
        except Exception as e:
            print(f"  ERROR {zone_id}: {e}")
            continue
        if not masks:
            print(f"  no masks for {zone_id}")
            continue
        # pick largest white area
        best = None
        best_area = -1
        for im in masks:
            wb = mask_to_white_black(im, (h, w))
            area = int((wb > 127).sum())
            if area > best_area:
                best_area = area
                best = wb
        if best is None or best_area < 100:
            print(f"  weak mask {zone_id} area={best_area}")
            continue
        out = room_dir / f"mask-{zone_id}.png"
        cv2.imwrite(str(out), best)
        saved.append(best)
        print(f"  wrote {out.name} area={best_area}")

    if saved:
        ov = rebuild_overlay(bgr, saved)
        cv2.imwrite(str(room_dir / "overlay-locked.png"), ov)
        print(f"  wrote overlay-locked.png")
        (room_dir / "sam_meta.json").write_text(
            json.dumps({"model": model, "zones": [p[0] for p in pairs]}, indent=2),
            encoding="utf-8",
        )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", default=None, help="fal API key (prefer FAL_KEY env)")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--room", action="append", dest="rooms", help="room id (repeatable)")
    ap.add_argument("--all-prd", action="store_true", help="B–E packs")
    args = ap.parse_args()

    client = get_client(args.key)
    rooms = args.rooms or []
    if args.all_prd:
        rooms = list(ROOM_PROMPTS.keys())
        rooms = [r for r in rooms if r != "bathroom-01"]  # keep Photopea A unless asked
    if not rooms:
        rooms = ["large-bathroom-b", "staircase-c", "feature-wall-d", "vanity-e"]

    for rid in rooms:
        process_room(client, rid, args.model, None)

    print("\nDone. Review in #visualizer-2d — refine in Photopea if needed.")


if __name__ == "__main__":
    main()
