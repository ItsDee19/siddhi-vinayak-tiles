"""
Generate 2D visualizer BASE images via fal (NO Grok Imagine — no watermark logo).

Preferred models (try in order):
  openai/gpt-image-2
  fal-ai/gpt-image-2
  fal-ai/nano-banana-pro
  fal-ai/nano-banana-2

Requires FAL_KEY env. Does not store the key in the repo.

  python scripts/fal_generate_2d_bases.py
  python scripts/fal_generate_2d_bases.py --model openai/gpt-image-2
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "2d-rooms"

# PRD Models B–E only (A = bathroom-01 Photopea pack — do not overwrite)
ROOMS = {
    "large-bathroom-b": {
        "name": "Large Bathroom",
        "width_mm": 3048,
        "prompt": (
            "Photorealistic architectural photography of a spacious modern master bathroom, "
            "corner camera angle showing two adjacent fully tiled walls and a large floor of "
            "clean rectified porcelain tiles. Open floor plan about 10 by 10 feet, 8 foot ceiling. "
            "Floating wood vanity with mirror, wall-hung toilet, glass shower enclosure, freestanding "
            "bathtub on one side. Soft natural daylight, no people, no text, no watermark, no logo, "
            "no brand mark, no corner signature. Ultra sharp showroom quality, 16:9 landscape."
        ),
    },
    "staircase-c": {
        "name": "Staircase",
        "width_mm": 1220,
        "prompt": (
            "Photorealistic architectural photography of a clean residential staircase with two "
            "flights of steps and a mid-landing platform, three-quarter elevation view. Clear "
            "visible stair treads, vertical risers, and flat landing ready for tile materials. "
            "Simple wooden handrail, white walls, bright even lighting. Indian home style, empty "
            "of people. No text, no watermark, no logo, no signature. Ultra sharp, 16:9 landscape."
        ),
    },
    "feature-wall-d": {
        "name": "Feature Wall",
        "width_mm": 9144,
        "prompt": (
            "Photorealistic straight-on elevation of a large outdoor compound feature wall fully "
            "clad in large-format stone-look tiles, about 30 feet wide by 10 feet tall. Flat "
            "unbroken wall face filling most of the frame, soft sky and garden only at edges. "
            "No people, no text, no watermark, no logo, no signature. Architectural product "
            "photography, ultra sharp, 16:9 landscape."
        ),
    },
    "vanity-e": {
        "name": "Vanity Counter",
        "width_mm": 3048,
        "prompt": (
            "Photorealistic straight-on front elevation of a long double bathroom vanity about "
            "10 feet wide. White marble countertop with two undermount sinks and chrome faucets, "
            "blue or wood cabinet fascia below, white subway tile backsplash wall above counter "
            "with a large mirror, small strip of floor tiles at bottom. Soft studio lighting. "
            "No people, no text, no watermark, no logo, no signature. Architectural product "
            "photography, ultra sharp, 16:9 landscape."
        ),
    },
}

MODEL_CANDIDATES = [
    "openai/gpt-image-2",
    "fal-ai/gpt-image-2",
    "fal-ai/nano-banana-pro",
    "fal-ai/nano-banana-2",
    "fal-ai/flux-pro/v1.1",
    "fal-ai/flux/dev",
]


def download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "svt-2d/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def try_generate(client, model: str, prompt: str) -> bytes | None:
    """Return image bytes or None if model fails."""
    # GPT Image style params
    attempts = [
        {
            "prompt": prompt,
            "image_size": "landscape_16_9",
            "quality": "high",
            "output_format": "png",
            "num_images": 1,
        },
        {
            "prompt": prompt,
            "image_size": "landscape_16_9",
            "num_inference_steps": 28,
            "guidance_scale": 3.5,
            "num_images": 1,
            "output_format": "png",
            "enable_safety_checker": True,
        },
        {
            "prompt": prompt,
            "aspect_ratio": "16:9",
            "num_images": 1,
            "output_format": "png",
        },
        {
            "prompt": prompt,
            "image_size": {"width": 1536, "height": 864},
            "num_images": 1,
        },
    ]
    last_err = None
    for args in attempts:
        try:
            result = client.subscribe(model, arguments=args)
            images = result.get("images") or result.get("image")
            if isinstance(images, dict):
                images = [images]
            if not images:
                continue
            url = images[0].get("url")
            if not url:
                continue
            return download(url)
        except Exception as e:
            last_err = e
            continue
    if last_err:
        print(f"  model {model} failed: {last_err}")
    return None


def pick_model(client, preferred: str | None) -> str:
    if preferred:
        return preferred
    for m in MODEL_CANDIDATES:
        print(f"Probing model {m}…")
        data = try_generate(
            client,
            m,
            "Simple photorealistic empty white room corner, soft light, no text no watermark no logo",
        )
        if data and len(data) > 5000:
            print(f"  SELECTED {m}")
            # don't keep probe image
            return m
    raise RuntimeError("No fal image model accepted the request with this key")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", default=None)
    ap.add_argument("--model", default=None, help="force endpoint id")
    ap.add_argument("--room", action="append", dest="rooms")
    args = ap.parse_args()

    try:
        from fal_client import SyncClient
    except ImportError:
        print("pip install fal-client", file=sys.stderr)
        sys.exit(1)

    key = args.key or os.environ.get("FAL_KEY")
    if not key:
        print("Set FAL_KEY", file=sys.stderr)
        sys.exit(1)
    client = SyncClient(key=key)

    model = args.model
    if not model:
        # Prefer gpt-image-2 / nano-banana without full probe waste —
        # try best first with real first room if needed
        model = None
        for m in MODEL_CANDIDATES:
            print(f"Trying generation model: {m}")
            # lightweight probe with first prompt
            data = try_generate(client, m, ROOMS["feature-wall-d"]["prompt"][:200] + ", no text no watermark no logo")
            if data:
                model = m
                print(f"Using model: {model}")
                # save probe as feature wall if generating all
                break
        if not model:
            print("All models failed", file=sys.stderr)
            sys.exit(1)
    else:
        print(f"Using forced model: {model}")

    rooms = args.rooms or list(ROOMS.keys())
    meta = {"model": model, "rooms": {}}

    # If we already generated feature-wall as probe, re-gen all cleanly
    for rid in rooms:
        info = ROOMS[rid]
        print(f"\n=== Generating base: {rid} ===")
        data = try_generate(client, model, info["prompt"])
        if not data:
            print(f"FAILED {rid}")
            continue
        room_dir = OUT / rid
        room_dir.mkdir(parents=True, exist_ok=True)
        # decode & save as clean PNG (strip any weird metadata)
        arr = np.frombuffer(data, dtype=np.uint8)
        im = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if im is None:
            (room_dir / "base_raw.bin").write_bytes(data)
            print("  decode failed, raw saved")
            continue
        # ensure landscape min long side
        h, w = im.shape[:2]
        if max(h, w) < 1920:
            scale = 1920 / max(h, w)
            im = cv2.resize(im, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
        # crop bottom-right 8% strip if residual watermark region (safety)
        # only if extreme corner is very dark logo — skip destructive crop by default
        out_path = room_dir / "base.png"
        cv2.imwrite(str(out_path), im, [cv2.IMWRITE_PNG_COMPRESSION, 3])
        meta["rooms"][rid] = {
            "path": str(out_path.relative_to(ROOT)),
            "width": im.shape[1],
            "height": im.shape[0],
            "bytes": out_path.stat().st_size,
        }
        print(f"  wrote {out_path} {im.shape[1]}x{im.shape[0]}")

    (OUT / "_fal_base_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print("\nBases done. Next: python scripts/fal_sam_remask_2d.py --all-prd")
    print("Photopea: refine masks to bathroom-01 quality if SAM is imperfect.")


if __name__ == "__main__":
    main()
