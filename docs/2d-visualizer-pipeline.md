# 2D Room Tile Visualizer — Pipeline & Technicalities

Technical documentation for the **Siddhi Vinayak Tiles** 2D lifestyle visualizer: how room packs are built, masked, registered, and composed in the browser.

---

## 1. Product goal

Let a shopper **preview real catalogue tiles** on fixed lifestyle room photos:

- **Floor** and/or **wall** get swappable tiles
- **Fixtures** (toilet, tub, mirror, sky, rail, etc.) stay locked from the photo
- Quality bar: **Model A (`bathroom-01`)** — hand-refined Photopea pack
- Site focus is **2D packs** (the 3D visualizer section was removed from the live page; 3D code may still exist in the repo)

---

## 2. Core idea (mask + fill + overlay)

Every room is a **layered 2D pack**, not a 3D mesh:

```
┌─────────────────────────────────────┐
│  overlay-locked.png  (RGBA fixtures) │  ← drawn last, never recolored
├─────────────────────────────────────┤
│  tile fill on mask-wall.png          │  ← seamless createPattern
│  tile fill on mask-floor.png         │  ← seamless createPattern (if present)
├─────────────────────────────────────┤
│  base.png  (photo of the room)       │  ← base / lighting reference
└─────────────────────────────────────┘
```

### Pack contract

Path: `public/2d-rooms/<id>/`

| File | Role |
|------|------|
| `base.png` | Room photo (or AI-generated lifestyle base) |
| `mask-floor.png` | White-on-black = floor pixels that get tiles *(optional; omitted on feature wall)* |
| `mask-wall.png` | White-on-black = wall pixels that get tiles |
| `overlay-locked.png` | RGBA: fixtures/shadows; alpha locks non-tile areas |
| `pack.json` / `README.txt` | Metadata |
| `headless_meta.json` | Optional run metadata from fal/OpenCV pipeline |

### Zone policy (current)

| Model | ID | Zones |
|-------|-----|--------|
| A Small Bathroom | `bathroom-01` | floor + wall |
| B Large Bathroom | `large-bathroom-b` | floor + wall |
| C Staircase | `staircase-c` | floor + wall |
| D Feature Wall | `feature-wall-d` | **wall only** |
| E Vanity | `vanity-e` | floor + wall |

**Not used:** multi-band wall splits (lower / feature / upper), staircase treads/risers/landing as separate zones, vanity counter/fascia as separate zones.

Registration: `src/data/rooms2d.js`.

---

## 3. End-to-end pipeline

```
┌──────────────┐   ┌──────────────┐   ┌─────────────────┐   ┌──────────────┐
│ 1. Catalogue │ → │ 2. Tile      │ → │ 3. Room bases   │ → │ 4. Masking   │
│    extract   │   │    textures  │   │    generation   │   │    pack      │
└──────────────┘   └──────────────┘   └─────────────────┘   └──────────────┘
                                                                     │
                                                                     ▼
┌──────────────┐   ┌──────────────┐   ┌─────────────────┐
│ 7. Browser   │ ← │ 6. Site UI   │ ← │ 5. Optional     │
│    compose   │   │    register  │   │    Photopea     │
└──────────────┘   └──────────────┘   └─────────────────┘
```

---

### Stage 1 — Catalogue extraction

**Goal:** Turn PDF catalogues into product rows (name, size, finish, surface, image).

| Tech | Role |
|------|------|
| Python + OpenCV / PDF tooling | Page render, crop swatches |
| OCR name scripts | Tile names from labels |
| `scripts/apply_*_catalogue.mjs` | Seed into app data |
| Weak-name review | QA on bad OCR (`scripts/WEAK_NAMES_REVIEW.md`) |

Catalogues include Sunflora, Sky, Skype, GT2025, Floor, and related extracts under `scripts/` and catalogue assets.

---

### Stage 2 — Visualizer tile textures

**Goal:** Tiles that **tile seamlessly** (or good enough) for canvas fill.

| Tech | Role |
|------|------|
| `scripts/build_visualizer_tiles.mjs` | Build processed textures + manifest |
| `src/data/visualizerTileManifest.json` | Map product → texture URLs / tiers |
| `src/data/tileQuality2d.js` + quality JSON | **2D gate:** only “strong” seamless tiles in 2D UI |
| `isStrong2dTile()` | Filters weak/tiny WebPs out of the 2D picker |

Products offered in the visualizer: `src/data/visualizerCatalogue.js` (candidates filtered by `hasVisualizerTexture`).

---

### Stage 3 — Room base images

**Goal:** Lifestyle photo for each PRD model (A–E).

| Model | Base source |
|-------|-------------|
| **A `bathroom-01`** | Existing high-quality pack (reference / gold standard) |
| **B–E** | AI bases via **fal** — `openai/gpt-image-2` |

**Script:** `scripts/fal_generate_2d_bases.py`

**Why fal GPT Image (not Grok Imagine):** avoid watermarks/logos on lifestyle shots.

Typical B–E resolution: ~1920×1072. Model A is higher resolution (~3344×1882).

---

### Stage 4 — Masking / pack build (headless)

**Goal:** Produce zone masks + locked overlay **without a GUI**.

#### Stack

| Layer | Technology | Job |
|-------|------------|-----|
| **Segmentation** | **fal.ai SAM-3** (`fal-ai/sam-3/image`) | Text-prompt masks: `"floor tiles"`, `"wall tiles"`, fixtures |
| **Geometry / assemble** | **OpenCV + NumPy (Python)** | Resize, Otsu B/W, morph close, wall − floor, overlay alpha |
| **Optional edge** | **rembg** | Optional if installed; not required |
| **Orchestration** | `scripts/fal_headless_2d_pack.py` | Full pack for B–E |

#### Algorithm (per room)

1. Load `base.png` → BGR  
2. Send base as data-URI to **fal SAM-3** with zone prompts  
3. Convert returned masks → **white-on-black**, same resolution as base  
4. Prefer mid-sized masks; reject near-full-frame junk  
5. If both zones exist: **wall = wall − floor** (no double fill)  
6. **Feature wall:** wall prompt only; no floor mask  
7. **Overlay:** fixture prompts **and/or** non-tile = everything not (floor ∪ wall)  
8. Soften alpha (Gaussian) → write `overlay-locked.png`  
9. Write `pack.json`, `README.txt`, `headless_meta.json`  
10. Delete stale multi-zone files (`mask-treads`, bands, counter, etc.)

#### Related scripts

| Script | Purpose |
|--------|---------|
| `scripts/fal_generate_2d_bases.py` | AI bases |
| `scripts/fal_headless_2d_pack.py` | **Primary** mask + overlay pipeline |
| `scripts/fal_sam_remask_2d.py` | Remask single room with prompt list |
| `scripts/build_prd_2d_models_b_e.py` | Older CV/heuristic packs (legacy) |
| `scripts/build_2d_room_pack.py` | Pack scaffolding |

#### Auth

- `FAL_KEY` environment variable (or local MCP Bearer config)  
- **Do not commit** API keys to the repo  

---

### Stage 5 — Photopea API (optional polish)

**Not** automatic segmentation. Used when headless quality is below Model A.

| Piece | Role |
|-------|------|
| [photopea.com/api](https://www.photopea.com/api/) | Hash JSON: `files` + `script` |
| `scripts/photopea_pack_links.py` | Upload base to fal CDN → deep link |
| `public/2d-rooms/PHOTOPEA_REFINE.html` | One-click “Open in Photopea” |
| `public/2d-rooms/photopea_links.json` | Stored CDN URLs + deep links |
| Human | Paint white-on-black masks; export PNGs into pack folder |

Photopea also supports **save-to-server** and **Dezgo Remove BG** via API config — **not wired** in this project yet. Current use = **open + layer setup + manual export**.

**Quality bar:** Model A was refined this way (hand isolation + shadows). B–E default to SAM drafts with the same file contract.

---

### Stage 6 — Site registration & UX

| File | Role |
|------|------|
| `src/data/rooms2d.js` | Registers A–E: base/mask/overlay URLs, zones, `roomWidthMM` |
| `src/components/sections/Visualizer2D.jsx` | Room switcher, zone picker, scale, grout, export |
| `src/components/sections/Visualizer2DLazy.jsx` | Lazy-load when section enters view |
| `src/App.jsx` | Mounts 2D visualizer at `#visualizer` (old 3D slot) |
| `src/data/siteConfig.js` | Nav: **Visualizer** → `#visualizer` |
| `src/components/visualizer/ZonePicker.jsx` | Shared swatch UI (strong 2D tiles) |

3D multi-zone Three.js visualizer code may remain under `src/components/sections/Visualizer*.jsx` and `src/components/three/` but is **not mounted** in `App.jsx`.

---

### Stage 7 — Runtime compositor (browser)

| File | Role |
|------|------|
| `src/components/visualizer2d/composeRoom.js` | Core compose + export |
| `src/components/visualizer2d/RoomCanvas.jsx` | Progressive preview → full quality |

#### Technique

1. Draw **base** (context / lighting reference as needed)  
2. For each zone with a chosen product:  
   - Load **mask** (white = fill)  
   - Load tile texture (preview tier then full; full for export)  
   - Build a **cell** scaled by product size vs `roomWidthMM`  
   - **`ctx.createPattern(cell, 'repeat')`** full-frame  
   - Clip / alpha with the mask  
   - Soft **feather** on mask edge  
   - Optional AO / grout  
3. Draw **`overlay-locked.png`** on top (fixtures stay photoreal)

#### Why `createPattern` (not perspective warp)

Perspective warps left holes / partial bands on near-frontal photos. **Full-mask seamless fill** is more stable for this use case.

#### Export

- Offscreen canvas at higher width (up to ~3344)  
- Full-tier textures  
- Download via `ScreenshotHelper`

---

## 4. Technology map

| Domain | Stack |
|--------|--------|
| Frontend | React + Vite, Canvas 2D |
| Room data | Static packs under `public/2d-rooms/` |
| Tile catalogue | JS modules + JSON manifests |
| AI base gen | fal `openai/gpt-image-2` |
| AI segmentation | fal `fal-ai/sam-3/image` (text prompts) |
| Mask assembly | Python, OpenCV, NumPy |
| Optional polish | Photopea API (browser, human) |
| Optional BG | rembg (local, optional) |
| Cloud crop APIs | Cloudinary / Imgix **not** used |
| Live 3D on site | Demounted from UI |

---

## 5. Model quality strategy

| Tier | How | When |
|------|-----|------|
| **Gold** | Photopea hand masks + overlay | Model A; any room after QA fail |
| **Draft** | fal SAM-3 + OpenCV headless | Models B–E default |
| **Heuristic** | Color/geometry only (`build_prd_*`) | Legacy; not primary |

Simplifications driven by QA:

- No 3-band wall splits  
- No multi-zone staircase / vanity panel splits  
- Feature wall = wall only  

Simpler masks → fewer SAM errors → closer to Model A UX.

---

## 6. Runtime data flow (one user action)

```
User picks "Large Bathroom" + wall swatch
        │
        ▼
rooms2d.js → base, mask-wall, overlay URLs
        │
        ▼
tileQuality2d / visualizerTiles → seamless texture URL
        │
        ▼
composeRoom():
  pattern-fill wall mask with texture
  draw overlay-locked
        │
        ▼
Canvas shows tiled wall; fixtures stay original photo
```

---

## 7. What we deliberately do *not* do

| Approach | Why not (here) |
|----------|----------------|
| Pure headless Photopea | No auto-segment; needs human paint |
| Cloudinary / Imgix masking | URL crops, not multi-zone room packs |
| Local Meta SAM GPU by default | Heavier ops; fal SAM is enough for batch packs |
| Default live 3D rooms | Scope is 2D packs; 3D demounted from site |
| Multi-layer band segmentation | Unstable SAM; product decision is floor+wall (or wall-only) |

---

## 8. Operator commands

```powershell
# From repo root: C:\sanket da deepak\siddhi-vinayak-tiles

# 1) Generate / refresh AI bases (B–E)
$env:FAL_KEY="..."
python scripts/fal_generate_2d_bases.py

# 2) Headless mask packs
#    floor+wall for most; feature-wall-d = wall only
python scripts/fal_headless_2d_pack.py --all-prd
python scripts/fal_headless_2d_pack.py --room vanity-e

# 3) Photopea deep links (manual refine)
python scripts/photopea_pack_links.py --skip-upload
# open http://127.0.0.1:5173/2d-rooms/PHOTOPEA_REFINE.html

# 4) Site
npm run dev
# http://127.0.0.1:5173/#visualizer
```

---

## 9. Key source map

| Area | Path |
|------|------|
| Room registry | `src/data/rooms2d.js` |
| 2D UI | `src/components/sections/Visualizer2D.jsx` |
| Compositor | `src/components/visualizer2d/composeRoom.js` |
| Room packs | `public/2d-rooms/*` |
| Headless masks | `scripts/fal_headless_2d_pack.py` |
| Base gen | `scripts/fal_generate_2d_bases.py` |
| Photopea links | `scripts/photopea_pack_links.py` |
| Tile quality gate | `src/data/tileQuality2d.js` |
| Nav / section | `src/data/siteConfig.js`, `src/App.jsx` |

---

## 10. Realism upgrades (post–flat tiling)

Default fill remains **stable** `createPattern`. Realism layers on top:

| Upgrade | Where | What |
|---------|--------|------|
| **Luminance multiply** | `composeRoom.js` → `applyLuminanceMultiply` | Grayscale lighting plate from `base.png`, multiply-blended through the zone mask so window light / soft shadows return onto tiles |
| **Soft mask feather** | Compositor + headless | Stronger anti-aliased mask edges; headless uses depth-ish near/far Gaussian |
| **Micro-depth cells** | `applyCellMicroDepth` | Soft edge shade + thin highlight on each tile cell (fake height / recessed grout) |
| **Contact AO** | `fal_headless_2d_pack.py` → `contact_ao_darken` | Sobel on fixture alpha darkens overlay RGB at furniture contact lines |
| **Perspective (opt-in)** | `zone.perspectiveQuad` | Normalized TL,TR,BR,BL; grid warp via affine triangles. **Off by default** (bad quads cause holes) |
| **Room knobs** | `rooms2d.js` | `lightStrength` (0–1), `maskFeatherPx` |

### Tuning perspective (optional)

```js
// on a floor zone in rooms2d.js — corners in 0–1 image UV
perspectiveQuad: [
  [0.12, 0.62], // TL
  [0.88, 0.62], // TR
  [0.98, 0.96], // BR
  [0.02, 0.96], // BL
],
```

Tune by eye until grout lines vanish correctly into the room; leave omitted for flat fill.

### Not yet built

| Item | Status |
|------|--------|
| Auto normal maps in `build_visualizer_tiles.mjs` | Deferred (micro-depth covers light bevel) |
| OpenCV.js in browser | Not required (custom triangle warp) |
| Variable per-pixel DOF blur on live canvas | Approximated via headless soft edges |

---

## 11. Performance notes (high ROI)

| Optimization | Status |
|--------------|--------|
| **WebP room packs** | `npm run build:2d-webp` → `.webp` for base/overlay/masks; `rooms2d.js` serves WebP |
| **Preload** | `preloadRoomAssets()` on mount + room switch |
| **Catalogue → 2D** | `view-in-2d` custom event applies product to matching zones |
| **Deep links** | `#visualizer?room=&floor=&wall=&scale=` + **Copy link** button |
| **Mobile lite-first** | `RoomCanvas preferLiteFirst` on small screens |
| PNG sources | Kept for Python/SAM tooling; browser uses WebP |

### Deep-link examples

```
#visualizer?room=large-bathroom-b&floor=gt-floor-p12-t1&wall=sky12x18-p03-v1&scale=0.50
#visualizer?room=staircase-c&floor=gt-floor-p20-t2&scale=0.55
```

---

## 12. One-sentence mental model

**We generate lifestyle room photos, cut them into floor/wall masks with cloud SAM + OpenCV, lock fixtures in an RGBA overlay (with contact AO), then in the browser fill those masks with seamless catalogue textures via canvas `createPattern`, multiply room luminance back on, and optionally warp floors into a perspective quad — with Photopea reserved when hand quality must match Model A.**

---

*Last updated: luminance multiply, micro-depth cells, opt-in perspective quads, headless soft edges + contact AO; floor+wall zone policy; feature-wall wall-only; 2D at `#visualizer`.*

