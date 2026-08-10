# 2D Room Model — What You Need to Provide

Hand this folder (or these files) to the agent when you’re ready to build a **Simpolo-style 2D visualizer** next to the existing 3D one.

**Rules we already agreed:**

- 2D model sits **beside** the 3D visualizer (not instead of it)
- Do **not** change the 3D visualizer, catalogue, or rest of the site
- Agent waits for **these assets** before writing 2D code

---

## 1. Where to put files

Preferred location:

```text
C:\sanket da deepak\siddhi-vinayak-tiles\public\2d-rooms\bathroom-01\
```

Suggested layout:

```text
public/2d-rooms/bathroom-01/
  base.webp                 # or base.png
  mask-floor.png
  mask-wall.png
  mask-feature.png          # optional but recommended
  mask-vanity.png           # optional (washstand colour)
  overlay-locked.png        # optional (fixtures/shadows that never retexture)
  README.txt                # or fill in the checklist below
```

You can use another folder path — just tell the agent the full path.

---

## 2. Minimum assets (required for MVP)

| # | File | Format | Spec | Purpose |
|---|------|--------|------|---------|
| 1 | **Base room photo** | PNG or WebP | **1920×1080 or larger**; same size as all masks | The fixed bathroom (or room) photo users see |
| 2 | **Floor mask** | PNG | **Same resolution as base**; white/opaque = floor, black/transparent = not | Where floor tiles are painted |
| 3 | **Main wall mask** | PNG | Same as above | Where wall tiles are painted |
| 4 | **Zone list** | Text in this file or `README.txt` | Zone ids + surface types | Tells the agent which regions exist |

### Zone list template (copy and fill)

```text
Room name: bathroom-01
Angle: front (only one for MVP)

Zones:
- floor     → surface: Floor
- wall      → surface: Wall
- feature   → surface: Wall     (if you provide mask-feature)
- vanity    → surface: Countertop or "furniture colour only" (if you provide mask-vanity)
```

---

## 3. Strongly recommended (better quality)

| # | File / item | Spec | Why |
|---|-------------|------|-----|
| 5 | **Feature wall mask** | Same size as base | Accent strip / patterned panel (like Simpolo leaf wall) |
| 6 | **Vanity cabinet mask** | Same size as base | Swap washstand colour (White / Black / Grey / wood) |
| 7 | **Locked overlay** | Transparent PNG, same size | Chrome, basin, toilet, soft shadows that must **never** retexture |
| 8 | **Rights note** | One line in README | e.g. “We own this photo” or “Licensed for commercial use on the shop site” |

### Mask rules (important)

- **Same pixel size** as `base` (width × height must match exactly)
- **White / solid** = area that can change  
- **Black / empty** = leave the base photo as-is  
- Soft edges OK (anti-aliased masks look better than hard jaggies)
- One mask per zone; do not combine floor + wall into one mask

---

## 4. Nice-to-have (optional)

| Item | Notes |
|------|--------|
| **2–3 camera angles** | e.g. front, slight left, detail — each with its own base + matching masks |
| **Vanity colour variants** | Pre-made PNGs: White / Black / Grey / Oak / Walnut (easier than live recolour) |
| **Perspective corners** | 4 corner points per wall plane (for tile warp); skip if unsure — agent can estimate from masks |
| **Default products** | e.g. “start with first floor tile + first wall tile from catalogue” or specific product ids |
| **Room name / label** | Display name in UI: e.g. “Modern Bathroom”, “Small Bath” |

---

## 5. What you do **not** need to provide

| Already in the project | Notes |
|------------------------|--------|
| Tile catalogue images | ~557 products / thousands of WebPs already on site |
| 3D GLB models A–E | Untouched; stay as Interactive (3D) mode |
| Website redesign | Not required |
| Blender file | Only if you later want 2D stills rendered from 3D |

---

## 6. How this differs from 3D (reminder)

| 2D (what this pack enables) | 3D (already live) |
|-----------------------------|-------------------|
| Fixed photo + masks | Orbitable GLB rooms |
| Looks like lifestyle photography | Looks like interactive 3D |
| Swap tiles on painted regions | Swap textures on mesh zones |
| Light on phones | Needs WebGL / GPU |

---

## 7. Checklist before you hand off

Copy this section and tick what you’ve uploaded:

```text
[ ] base.webp or base.png (1920×1080+)
[ ] mask-floor.png (same size as base)
[ ] mask-wall.png (same size as base)
[ ] mask-feature.png (optional)
[ ] mask-vanity.png (optional)
[ ] overlay-locked.png (optional)
[ ] Zone list filled in (this file or README.txt)
[ ] Rights / ownership note
[ ] Full folder path told to the agent

Optional:
[ ] Extra camera angles + masks
[ ] Vanity colour variant images
[ ] Default product preferences
```

---

## 8. After you provide this

1. Tell the agent: **“2D assets are ready at …”** (path).  
2. Agent will confirm files and sizes.  
3. Only then implement **2D mode beside 3D** — without editing 3D, catalogue, or other site sections (unless you ask otherwise).

---

## 9. Contact / shop context (already in repo — no need to re-send)

Business details live in `src/data/siteConfig.js` (name, phone, address).  
Only re-send if you want different copy **inside the 2D panel** specifically.

---

**File location on disk:**  
`C:\sanket da deepak\siddhi-vinayak-tiles\docs\2d-model-what-you-need-to-provide.md`
