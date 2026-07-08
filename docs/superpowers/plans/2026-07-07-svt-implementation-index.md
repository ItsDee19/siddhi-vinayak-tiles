# SVT Implementation Index

> **Read `PLAN.md` at the project root first** — it's the canonical index.
> This file is the detailed version under the docs/ convention.

**Created:** 2026-07-07
**Project:** Siddhi Vinayak Tiles
**Location:** `C:\sanket da\siddhi-vinayak-tiles`

## Plans

1. [Plan 1: Foundation — Theme, Logo, NFRs](./2026-07-07-svt-plan-1-foundation-theme-logo-nfrs.md)
2. [Plan 2: Catalogue + Visualizer UI Shell + Model A](./2026-07-07-svt-plan-2-catalogue-visualizer-model-a.md)
3. [Plan 3: 3D Models B–E](./2026-07-07-svt-plan-3-models-b-to-e.md)

## Scope Decisions

- **3 phased plans** — Foundation → Catalogue+Shell+Model A → Models B-E
- **Adopt PRD tokens exactly** — replace existing palette with PRD hex values
- **Replace Gallery** with catalogue grid (coverflow removed)
- **Shell + Model A first** — prove multi-zone architecture before more models
- **Procedural textures now**, real assets later (textureUrl in schema, optional)
- **Keep `src/data/siteConfig.js`** — do not migrate to `src/config/business.js`

## Execution Order

Plan 1 → Plan 2 → Plan 3. Each plan is independently shippable. See `PLAN.md` for full details.
