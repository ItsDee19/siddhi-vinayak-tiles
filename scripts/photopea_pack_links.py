"""
Build one-click Photopea API links for each 2D room pack.

Photopea API: https://www.photopea.com/api/
- Opens Photopea with the room base preloaded (via fal CDN URL)
- Runs a setup script that creates empty mask layers to paint
- You export white-on-black masks + transparent overlay to match bathroom-01 quality

Requires FAL_KEY (for CDN upload of local bases). Does not commit the key.

  python scripts/photopea_pack_links.py
  python scripts/photopea_pack_links.py --room vanity-e
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROOMS_DIR = ROOT / "public" / "2d-rooms"
OUT_HTML = ROOMS_DIR / "PHOTOPEA_REFINE.html"
OUT_JSON = ROOMS_DIR / "photopea_links.json"

# Model A is already Photopea-quality; B–E need refine
DEFAULT_ROOMS = [
    "large-bathroom-b",
    "staircase-c",
    "feature-wall-d",
    "vanity-e",
]

# Every room: floor + wall only (matches bathroom-01)
ROOM_LAYERS = {
    "large-bathroom-b": ["floor", "wall", "OVERLAY_fixtures"],
    "staircase-c": ["floor", "wall", "OVERLAY_fixtures"],
    "feature-wall-d": ["wall", "OVERLAY_fixtures"],
    "vanity-e": ["floor", "wall", "OVERLAY_fixtures"],
    "bathroom-01": ["floor", "wall", "OVERLAY_fixtures"],
}


def setup_script(layer_names: list[str]) -> str:
    """Photopea JS: create empty layers for mask painting."""
    # Keep script compact for URL size
    creates = []
    for name in layer_names:
        # new raster layer via duplicate of background then clear — Photopea-friendly
        creates.append(
            f'var L=doc.artLayers.add(); L.name="{name}"; L.opacity=100;'
        )
    body = (
        "var doc=app.activeDocument;"
        "doc.activeLayer.name='BASE';"
        + "".join(creates)
        + 'alert("Paint pure WHITE on black for each MASK_* layer. '
        'For OVERLAY_fixtures: keep only fixtures+shadows on transparency. '
        'Export each mask as PNG (white on black).");'
    )
    return body


def photopea_url(file_url: str, script: str) -> str:
    cfg = {
        "files": [file_url],
        "script": script,
    }
    # encodeURIComponent of JSON
    payload = urllib.parse.quote(json.dumps(cfg, separators=(",", ":")))
    return f"https://www.photopea.com#{payload}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", default=None)
    ap.add_argument("--room", action="append", dest="rooms")
    ap.add_argument("--skip-upload", action="store_true", help="reuse previous CDN URLs in photopea_links.json")
    args = ap.parse_args()

    rooms = args.rooms or DEFAULT_ROOMS
    key = args.key or os.environ.get("FAL_KEY")

    prev = {}
    if OUT_JSON.exists():
        try:
            prev = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        except Exception:
            prev = {}

    client = None
    if not args.skip_upload:
        if not key:
            print("Set FAL_KEY to upload bases to CDN for Photopea.", file=sys.stderr)
            sys.exit(1)
        try:
            from fal_client import SyncClient
        except ImportError:
            print("pip install fal-client", file=sys.stderr)
            sys.exit(1)
        client = SyncClient(key=key)

    links = {"photopea_api": "https://www.photopea.com/api/", "rooms": {}}

    rows_html = []
    for rid in rooms:
        base = ROOMS_DIR / rid / "base.png"
        if not base.exists():
            print(f"skip {rid}: no base.png")
            continue

        cdn = None
        if args.skip_upload and prev.get("rooms", {}).get(rid, {}).get("cdn_url"):
            cdn = prev["rooms"][rid]["cdn_url"]
            print(f"{rid}: reuse CDN")
        else:
            print(f"{rid}: uploading base.png …")
            cdn = client.upload_file(base)
            print(f"  {cdn}")

        layers = ROOM_LAYERS.get(rid, ["floor", "wall", "OVERLAY_fixtures"])
        script = setup_script(layers)
        url = photopea_url(cdn, script)

        links["rooms"][rid] = {
            "cdn_url": cdn,
            "photopea_url": url,
            "layers": layers,
            "export": [f"mask-{L}.png" for L in layers if not L.startswith("OVERLAY")]
            + ["overlay-locked.png"],
            "local_folder": f"public/2d-rooms/{rid}/",
        }

        rows_html.append(
            f"""
      <section class="card">
        <h2>{rid}</h2>
        <p class="path"><code>{links['rooms'][rid]['local_folder']}</code></p>
        <p>Layers to paint: <code>{', '.join(layers)}</code></p>
        <a class="btn" href="{url}" target="_blank" rel="noopener">Open in Photopea</a>
        <ol>
          <li>Paint each mask layer: pure white (#FFFFFF) on black (#000000).</li>
          <li>Hide other layers, File → Export as → PNG for each mask → save as <code>mask-*.png</code>.</li>
          <li>For fixtures: keep only vanity/toilet/etc + shadows, transparent bg → <code>overlay-locked.png</code>.</li>
          <li>Overwrite files in the local folder (same pixel size as base).</li>
          <li>Hard-refresh <a href="http://127.0.0.1:5173/#visualizer">#visualizer</a>.</li>
        </ol>
      </section>
"""
        )

    OUT_JSON.write_text(json.dumps(links, indent=2), encoding="utf-8")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Photopea refine — 2D room packs</title>
  <style>
    body {{ font-family: system-ui, sans-serif; margin: 0; background: #2c1a0e; color: #f5e6c8; }}
    header {{ padding: 28px 24px; border-bottom: 1px solid rgba(197,154,60,.3); }}
    h1 {{ margin: 0 0 8px; font-size: 1.4rem; }}
    .sub {{ color: #c9a97a; max-width: 40rem; line-height: 1.45; }}
    main {{ padding: 20px 24px 48px; display: grid; gap: 16px; max-width: 720px; }}
    .card {{ background: #3d2512; border: 1px solid rgba(197,154,60,.25); border-radius: 8px; padding: 16px 18px; }}
    .card h2 {{ margin: 0 0 8px; font-size: 1.1rem; color: #c49a3c; }}
    .path {{ font-size: 0.85rem; color: #c9a97a; }}
    code {{ background: #2c1a0e; padding: 1px 5px; border-radius: 3px; }}
    .btn {{
      display: inline-block; margin: 10px 0; padding: 10px 16px;
      background: #c49a3c; color: #1a0e05; font-weight: 700; text-decoration: none; border-radius: 4px;
    }}
    .btn:hover {{ filter: brightness(1.08); }}
    ol {{ color: #c9a97a; line-height: 1.5; padding-left: 1.2rem; }}
    a {{ color: #e8c56a; }}
  </style>
</head>
<body>
  <header>
    <h1>Photopea API — refine packs to bathroom-01 quality</h1>
    <p class="sub">
      API docs: <a href="https://www.photopea.com/api/" target="_blank" rel="noopener">photopea.com/api</a>.
      Photopea does not auto-segment; it opens your base (hosted on fal CDN) so you can paint
      masks like Model A. SAM already made drafts — use this for final isolation + shadows.
    </p>
  </header>
  <main>
    {"".join(rows_html) if rows_html else "<p>No rooms found.</p>"}
  </main>
</body>
</html>
"""
    OUT_HTML.write_text(html, encoding="utf-8")
    print(f"\nWrote {OUT_HTML}")
    print(f"Wrote {OUT_JSON}")
    print("Open: http://127.0.0.1:5173/2d-rooms/PHOTOPEA_REFINE.html")


if __name__ == "__main__":
    main()
