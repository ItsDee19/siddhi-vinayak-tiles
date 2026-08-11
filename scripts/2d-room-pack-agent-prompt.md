# Agent prompt: build a 2D room pack for Sidhhi Binayak Visualizer2D

Copy-paste this into your coding agent when generating the next room.

## Goal
Produce one code-ready folder:

```
public/2d-rooms/<room-id>/
  base.png
  mask-floor.png      # white (#FFFFFF) region on black (#000000)
  mask-wall.png
  overlay-locked.png  # fixtures + contact shadows, transparent elsewhere (RGBA)
  README.txt
```

Then register it in `src/data/rooms2d.js`.

## Contract (must match compositor)
- All four images **same pixel dimensions** (recommended long side ≤ 3344).
- Masks: solid white = tileable zone, solid black = not tileable.
- Overlay: only fixtures (vanity, toilet, mirror, taps, décor). Soft shadows under furniture stay on overlay so tiles slide underneath cleanly.
- Site compositor: `src/components/visualizer2d/composeRoom.js` draws base → seamless tile through masks → overlay on top.

## Preferred pipeline
1. **Base** — lifestyle photo (AI gen or shoot), near-frontal, 16:9.
2. **Masks** — Photopea / SAM text prompts `"floor"`, `"wall tiles"` / `"back wall"`.
3. **Overlay** — isolate non-tile objects onto transparent PNG (or run):

```bash
python scripts/build_2d_room_pack.py ^
  --room bathroom-02 ^
  --base path/to/base.png ^
  --mask-floor path/to/mask-floor.png ^
  --mask-wall path/to/mask-wall.png ^
  --name "Ensuite Bathroom" ^
  --width-mm 3600
```

4. Paste `rooms2d-snippet.js` into `src/data/rooms2d.js`.
5. Verify at `http://127.0.0.1:5173/#visualizer-2d`.

## Optional automation hooks
- `--sam` — tries Ultralytics SAM if installed (`pip install ultralytics`).
- `--auto-masks` — heuristic draft only; **never ship without review**.

## Do not
- Change mask colors (no gray / anti-aliased gray for final masks — soft edges live in compositor feather).
- Put tile pattern into overlay.
- Misalign sizes between base / masks / overlay.
