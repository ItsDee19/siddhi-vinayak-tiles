# Siddhi Vinayak Tiles — Implementation Plan Index

> **Read this first in any new session.** This is the single source of truth for
> what's planned, what's done, and what's next.

**Last updated:** 2026-07-07
**Project:** Siddhi Vinayak Tiles — premium 3D-interactive showroom website
**Location:** `C:\sanket da\siddhi-vinayak-tiles`
**Stack:** React 18 + Vite 5 + Tailwind CSS 3.4 + React Three Fiber 8 + Framer Motion 11

---

## Scope Decisions (locked in)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Plan structure | 3 phased plans | Foundation → Catalogue+Shell+Model A → Models B-E |
| Theme migration | Adopt PRD tokens exactly | Replace existing palette with PRD hex values |
| Gallery vs Catalogue | Replace Gallery | Coverflow carousel → PRD filterable grid catalogue |
| 3D model priority | Shell + Model A first | Prove multi-zone architecture before building more |
| Asset strategy | Procedural now, real assets later | textureUrl/imageUrl in schema, fall back to procedural |
| Config file location | Keep `src/data/siteConfig.js` | Don't migrate to `src/config/business.js` |

---

## The 3 Plans

| # | Plan | Status | File |
|---|------|--------|------|
| 1 | Foundation: Theme + Logo + NFRs | Pending execution | [2026-07-07-svt-plan-1-foundation-theme-logo-nfrs.md](docs/superpowers/plans/2026-07-07-svt-plan-1-foundation-theme-logo-nfrs.md) |
| 2 | Catalogue + Visualizer UI Shell + Model A | Pending execution | [2026-07-07-svt-plan-2-catalogue-visualizer-model-a.md](docs/superpowers/plans/2026-07-07-svt-plan-2-catalogue-visualizer-model-a.md) |
| 3 | 3D Models B–E | Pending execution | [2026-07-07-svt-plan-3-models-b-to-e.md](docs/superpowers/plans/2026-07-07-svt-plan-3-models-b-to-e.md) |

---

## Execution Order (critical)

1. **Plan 1 first** — theme/logo/NFRs must land before catalogue/3D work so
   everything builds on the correct palette, radii, motion tokens, and
   reduced-motion infrastructure.
2. **Plan 2 second** — catalogue grid + visualizer shell + Model A. Model A is
   the reference implementation that proves the multi-zone texture system,
   camera presets, and screenshot/share features work end-to-end.
3. **Plan 3 last** — Models B, C, D, E built from the primitives established in
   Plan 2's Model A. Each model is an independent, testable deliverable.

---

## 3D Architecture (applies to Plans 2 & 3)

### Shared primitives (`src/components/three/primitives/`)

| Primitive | Responsibility | Used by |
|-----------|----------------|---------|
| `BandedWall` | Wall split into horizontal texture bands (3-2-3, 2-4-2, etc.) | A, B, D, E |
| `TexturedFloor` | Flat plane with zone texture + repeat | A, B, E |
| `TexturedPlane` | Generic textured plane (feature walls, side returns) | D, E |
| `StepFlight` | N steps (tread + riser + optional nosing) | C |
| `FixturePlaceholder` | Shower, WC, faucet, basin primitives with toggle | A, B, E |
| `CameraRig` | Animates camera to named presets | B, C, D, E |
| `ModelShell` | Canvas + lighting + shadows + OrbitControls wrapper | All |

### Zone-based texture system

Each model declares its zones. The Visualizer shell holds `zoneTextures` state:
```
{ [zoneId]: swatchObject }
```
- User selects a zone in the picker panel, then clicks a swatch → applies to that zone
- Each zone mesh reads `zoneTextures[zoneId]` → `getMaterialTexture(swatch)` (procedural) or `TextureLoader.load(textureUrl)` (real asset)
- Custom JPG upload → `URL.createObjectURL(file)` → same code path

### Convention: 1 Three.js unit = 1 foot

All PRD dimensions map 1:1 to Three.js units. Model A floor = 8×5 units, walls = 8 units tall.

### Camera presets

Each model exports `cameraPresets: { [name]: { position, target } }`.
`CameraRig` animates between presets via `Vector3.lerp` over 600ms with PRD easing.

### Screenshot (PNG + watermark)

1. `gl.render(scene, camera)` (force render)
2. `canvas.toDataURL('image/png')`
3. Draw to 2D canvas + stamp `business.name` watermark
4. Trigger `<a download>` click

### Auto-rotate with interaction pause (Model C)

- `OrbitControls.autoRotate` on by default
- Any pointer/wheel interaction → `autoRotate=false`, start 5s timer
- Timer fires → `autoRotate=true`
- Reduced-motion → never auto-rotate

---

## PRD Reference

The full PRD addendum covers 6 subsystems:
1. Logo Setup (L1–L5)
2. Theme (color tokens, typography, spacing, radii, motion)
3. Cataloguing System (data schema, grid, filters, lightbox, View-in-3D linking)
4. 3D Visualizer Models A–E (Small Bathroom, Large Bathroom, Staircase, Feature Wall, Vanity)
5. Visualizer UI Shell (model tabs, texture pickers, reset/screenshot/share, mobile drawer)
6. Non-Functional Requirements (FCP, lazy-loading, WebP, reduced-motion, business data)

---

## How to Resume in a New Session

1. Read this file (`PLAN.md` at project root).
2. Check which plan status is "In Progress" or "Pending."
3. Read the specific plan file for detailed tasks.
4. Continue from the last unchecked checkbox.
5. After completing a task, commit and update the checkbox.
