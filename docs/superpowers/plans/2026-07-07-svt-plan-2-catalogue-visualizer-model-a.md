# Plan 2: Catalogue + Visualizer UI Shell + Model A (Small Bathroom)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Replace the coverflow Gallery with a filterable catalogue grid (full PRD schema), build the multi-zone Visualizer UI shell (model selector tabs, surface-filtered swatch strip, reset/screenshot/share, mobile drawer), and build Model A (Small Bathroom) as the reference 3D implementation that proves the zone-based texture system end-to-end.

**Architecture:** Build 3D scene as a composition of shared primitives (`BandedWall`, `TexturedFloor`, `FixturePlaceholder`, `ModelShell`, `CameraRig`). The Visualizer shell holds `zoneTextures` state — each model declares its zones, each zone reads its texture from this state. Texture loading: procedural first, `textureUrl` from swatch if present, custom upload (URL.createObjectURL) as third option.

**Tech Stack:** React 18, @react-three/fiber 8, @react-three/drei 9, Framer Motion 11, Tailwind CSS.

## Global Constraints

- Unit: 1 Three.js unit = 1 foot (PRD §4.1)
- 3D canvas lazy-loaded (Suspense), unmounts on tab switch to free GPU memory
- Textures ≤ 512×512 (procedural default; URL-loaded cached in module-scope)
- All `prefers-reduced-motion` guards (use shared `useReducedMotion` hook from Plan 1)
- Mobile: canvas full width, pickers as bottom drawer, touch orbit/pinch-zoom
- Low-end / no-WebGL: keep `CanvasFallback` (already exists), add static model image

## File Structure

### 3D Primitives (`src/components/three/primitives/`)

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `primitives/BandedWall.jsx` | Wall with horizontal texture bands |
| Create | `primitives/TexturedFloor.jsx` | Floor plane with zone texture |
| Create | `primitives/TexturedPlane.jsx` | Generic plane with texture + repeat |
| Create | `primitives/FixturePlaceholder.jsx` | Shower, WC, faucet, basin primitives |
| Create | `primitives/CameraRig.jsx` | Animate camera to preset positions |
| Create | `primitives/ModelShell.jsx` | Canvas + lighting + OrbitControls wrapper |

### 3D Models (`src/components/three/models/`)

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `models/ModelA.jsx` | Small Bathroom (8×5, 3-2-3 bands) |
| Create | `models/registry.js` | Model metadata (id, name, zones, presets) |
| Create | `models/index.js` | Lazy exports |

### Visualizer UI

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/components/sections/Visualizer.jsx` | New multi-model, multi-zone shell |
| Create | `src/components/visualizer/ModelTabs.jsx` | Model selector tabs |
| Create | `src/components/visualizer/ZonePicker.jsx` | Surface-filtered swatch strip |
| Create | `src/components/visualizer/ControlBar.jsx` | Reset / Screenshot / WhatsApp |
| Create | `src/components/visualizer/MobileDrawer.jsx` | Bottom-sheet picker panel on mobile |
| Create | `src/components/visualizer/ScreenshotHelper.js` | toDataURL + watermark + download |

### Catalogue

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/data/catalogue.js` | Full PRD product schema |
| Delete | `src/data/products.js` (keep `categories`) | Old products data |
| Create | `src/components/sections/Catalogue.jsx` | Filterable grid |
| Create | `src/components/catalogue/CategoryTabs.jsx` | All + 5 category pills |
| Create | `src/components/catalogue/SubCategoryStrip.jsx` | Sub-category filter |
| Create | `src/components/catalogue/FinishChips.jsx` | Matte/Glossy/Polished filter |
| Create | `src/components/catalogue/ProductCard.jsx` | Card with size/finish/priceRange/View-in-3D |
| Create | `src/components/catalogue/ProductLightbox.jsx` | Full specs + WhatsApp CTA |
| Create | `src/components/catalogue/EmptyState.jsx` | No-results with WhatsApp button |

### App wiring

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/App.jsx` | Replace `<Gallery />` with `<Catalogue />` |
| Modify | `src/data/products.js` | Keep only `categories` export (catalogue owns the rest) |

---

### Task 1: Create `catalogue.js` data file

**Files:** Create `src/data/catalogue.js`

**Produces:** Full PRD product schema with seed data covering all 5 categories.

- [ ] **Step 1: Create the file with PRD schema and seed data** (15+ products across all 5 categories, including some with `featured: true` and a few with `textureUrl` populated to demo the View-in-3D flow):

```js
// ---------------------------------------------------------------------------
// Catalogue — the shop's product range. Single source of truth so the shop
// owner can add products by appending objects here.
//
// Schema (PRD §3.3):
//   id            string   unique slug
//   name          string
//   category      enum     Tiles | Marble | Granite | Quartz | Sanitaryware
//   subCategory   string   Floor Tiles | Wall Tiles | Exterior | Décor | etc.
//   size          string   e.g. "600×600mm"
//   finish        enum     Matte | Glossy | Satin | Polished | Rough
//   color         string   hex for swatch chip
//   surface       enum     Floor | Wall | Both | Countertop
//   priceRange    enum     Budget | Mid | Premium
//   imageUrl      string?  optional, real photo path
//   textureUrl    string?  optional, for 3D visualizer
//   tags          string[] e.g. ["white", "marble-look"]
//   featured      boolean
// ---------------------------------------------------------------------------

export const subCategories = {
  tiles:       ['Floor Tiles', 'Wall Tiles', 'Exterior', 'Décor'],
  marble:      ['Italian', 'Indian', 'Statuario', 'Plain'],
  granite:     ['Kitchen', 'Stairs', 'Outdoor', 'Countertop'],
  quartz:      ['Countertop', 'Backsplash', 'Feature Wall'],
  sanitaryware:['Basins', 'Faucets', 'Closets', 'Showers'],
}

export const finishes = ['Matte', 'Glossy', 'Satin', 'Polished', 'Rough']
export const priceRanges = ['Budget', 'Mid', 'Premium']
export const surfaces = ['Floor', 'Wall', 'Both', 'Countertop']

export const products = [
  // Tiles
  { id: 'tile-001', name: 'Carrara Matte Floor', category: 'Tiles', subCategory: 'Floor Tiles', size: '600×600mm', finish: 'Matte', color: '#E8E0D5', surface: 'Floor', priceRange: 'Mid', imageUrl: null, textureUrl: null, tags: ['white', 'marble-look', 'bathroom', 'kitchen'], featured: true },
  { id: 'tile-002', name: 'Walnut Wood-Look', category: 'Tiles', subCategory: 'Floor Tiles', size: '200×1200mm', finish: 'Matte', color: '#7c5a3c', surface: 'Floor', priceRange: 'Premium', tags: ['wood-look', 'living-room'], featured: false },
  { id: 'tile-003', name: 'Ivory Glossy Wall', category: 'Tiles', subCategory: 'Wall Tiles', size: '300×600mm', finish: 'Glossy', color: '#e9e1d3', surface: 'Wall', priceRange: 'Budget', tags: ['white', 'kitchen', 'bathroom'] },
  { id: 'tile-004', name: 'Slate Grey Exterior', category: 'Tiles', subCategory: 'Exterior', size: '400×400mm', finish: 'Rough', color: '#6f6e6b', surface: 'Floor', priceRange: 'Mid', tags: ['grey', 'outdoor'] },
  // Marble
  { id: 'marble-001', name: 'Statuario White Slab', category: 'Marble', subCategory: 'Italian', size: '8×4 ft', finish: 'Polished', color: '#f1ece2', surface: 'Floor', priceRange: 'Premium', tags: ['white', 'veined', 'luxury'], featured: true },
  { id: 'marble-002', name: 'Crema Beige', category: 'Marble', subCategory: 'Indian', size: '8×4 ft', finish: 'Polished', color: '#e3d4bb', surface: 'Floor', priceRange: 'Mid', tags: ['beige', 'warm'] },
  { id: 'marble-003', name: 'Noir Marquina', category: 'Marble', subCategory: 'Italian', size: '8×4 ft', finish: 'Polished', color: '#211f1d', surface: 'Floor', priceRange: 'Premium', tags: ['black', 'feature-wall', 'bathroom'] },
  // Granite
  { id: 'granite-001', name: 'Galaxy Black Counter', category: 'Granite', subCategory: 'Countertop', size: '10×5 ft', finish: 'Polished', color: '#2a2826', surface: 'Countertop', priceRange: 'Mid', tags: ['black', 'kitchen'], featured: true },
  { id: 'granite-002', name: 'Pearl White', category: 'Granite', subCategory: 'Kitchen', size: '10×5 ft', finish: 'Polished', color: '#d8d2c6', surface: 'Countertop', priceRange: 'Mid', tags: ['white', 'kitchen'] },
  { id: 'granite-003', name: 'Steel Grey Steps', category: 'Granite', subCategory: 'Stairs', size: '4 ft wide', finish: 'Polished', color: '#5a5854', surface: 'Floor', priceRange: 'Mid', tags: ['grey', 'stairs'] },
  // Quartz
  { id: 'quartz-001', name: 'Snow Quartz Top', category: 'Quartz', subCategory: 'Countertop', size: '10×5 ft', finish: 'Polished', color: '#f4f1ea', surface: 'Countertop', priceRange: 'Premium', tags: ['white', 'kitchen'], featured: true },
  { id: 'quartz-002', name: 'Champagne Quartz', category: 'Quartz', subCategory: 'Backsplash', size: '600×600mm', finish: 'Polished', color: '#e4d8c2', surface: 'Wall', priceRange: 'Premium', tags: ['warm', 'kitchen'] },
  // Sanitaryware
  { id: 'sani-001', name: 'Modern Basin Suite', category: 'Sanitaryware', subCategory: 'Basins', size: '24×18 in', finish: 'Glossy', color: '#f4f1ec', surface: 'Countertop', priceRange: 'Mid', tags: ['white', 'bathroom'], featured: true },
  { id: 'sani-002', name: 'Matte Black Faucet', category: 'Sanitaryware', subCategory: 'Faucets', size: 'Standard', finish: 'Matte', color: '#2c2b29', surface: 'Countertop', priceRange: 'Premium', tags: ['black', 'modern'] },
  { id: 'sani-003', name: 'Wall-Hung Closet', category: 'Sanitaryware', subCategory: 'Closets', size: 'Standard', finish: 'Glossy', color: '#eceae4', surface: 'Floor', priceRange: 'Mid', tags: ['white', 'bathroom'] },
]
```

- [ ] **Step 2: Trim `src/data/products.js`** to only export `categories` (delete `swatches` and `galleryItems` — the catalogue owns all products now; the visualizer will use `catalogue.products` as its swatch source).

- [ ] **Step 3: Commit**

```bash
git add src/data/catalogue.js src/data/products.js
git commit -m "feat: catalogue data with full PRD schema, trim products.js to categories"
```

---

### Task 2: Create catalogue components

**Files:** Create `src/components/catalogue/{CategoryTabs,SubCategoryStrip,FinishChips,ProductCard,ProductLightbox,EmptyState}.jsx`

**Produces:** All catalogue UI primitives.

- [ ] **Step 1: Create `CategoryTabs.jsx`** — All + 5 categories from `products.js`:

```jsx
import { categories } from '../../data/products'

export default function CategoryTabs({ active, onChange }) {
  const items = [{ id: 'all', name: 'All' }, ...categories]
  return (
    <div className="flex flex-wrap justify-center gap-2.5">
      {items.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          className={`rounded-btn px-5 py-2.5 text-sm font-semibold transition-all duration-150 ease-pr ${
            active === c.id
              ? 'bg-gold text-ink shadow-glow'
              : 'bg-white/5 text-sand hover:bg-white/10'
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `SubCategoryStrip.jsx`** — strip that shows sub-categories for the active category:

```jsx
import { subCategories } from '../../data/catalogue'

export default function SubCategoryStrip({ category, active, onChange }) {
  if (category === 'all') return null
  const subs = subCategories[category] || []
  if (subs.length === 0) return null
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      <button
        onClick={() => onChange(null)}
        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
          active === null ? 'bg-gold/20 text-gold' : 'bg-white/5 text-sand/70 hover:bg-white/10'
        }`}
      >
        All {category}
      </button>
      {subs.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            active === s ? 'bg-gold/20 text-gold' : 'bg-white/5 text-sand/70 hover:bg-white/10'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `FinishChips.jsx`** — Matte/Glossy/Polished/Satin/Rough chips:

```jsx
import { finishes } from '../../data/catalogue'

export default function FinishChips({ active, onChange }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {finishes.map((f) => (
        <button
          key={f}
          onClick={() => onChange(active === f ? null : f)}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all ${
            active === f
              ? 'border-gold bg-gold/15 text-gold'
              : 'border-white/10 text-sand/70 hover:border-sand/30'
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create `ProductCard.jsx`** — image, name, size, finish chip, surface tag, priceRange tag, View-in-3D icon if `textureUrl`, featured ribbon if `featured`:

```jsx
import SwatchThumb from '../ui/SwatchThumb'
import Icon from '../Icons'

// Convert catalogue product → shape SwatchThumb understands
function asSwatch(p) {
  return {
    id: p.id,
    name: p.name,
    type: p.category.toLowerCase(),
    color: p.color,
    accent: p.color,
    image: p.imageUrl,
  }
}

export default function ProductCard({ product, onOpen, onViewIn3D }) {
  const has3D = Boolean(product.textureUrl)
  return (
    <button
      onClick={() => onOpen(product)}
      className="group relative overflow-hidden rounded-card border border-white/5 bg-charcoal-700 text-left shadow-soft transition-all hover:border-gold/30 hover:shadow-card"
    >
      {product.featured && (
        <span className="absolute right-2 top-2 z-10 rounded-btn bg-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink">
          Featured
        </span>
      )}
      <SwatchThumb swatch={asSwatch(product)} className="aspect-[4/3] w-full" eager />
      <div className="p-4">
        <h3 className="font-display text-base text-cream">{product.name}</h3>
        <p className="mt-1 text-xs text-sand/70">{product.size}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold">
            {product.finish}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-sand/70">
            {product.surface}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-sand/70">
            {product.priceRange}
          </span>
        </div>
        {has3D && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewIn3D(product) }}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:underline"
          >
            <Icon name="compass" className="h-3.5 w-3.5" /> View in 3D
          </button>
        )}
      </div>
    </button>
  )
}
```

- [ ] **Step 5: Create `ProductLightbox.jsx`** — full specs + WhatsApp CTA:

```jsx
import { motion } from 'framer-motion'
import Icon from '../Icons'
import SwatchThumb from '../ui/SwatchThumb'
import { business } from '../../data/siteConfig'

function asSwatch(p) { return { id: p.id, name: p.name, type: p.category.toLowerCase(), color: p.color, accent: p.color, image: p.imageUrl } }

export default function ProductLightbox({ product, onClose, onViewIn3D }) {
  if (!product) return null
  const waText = encodeURIComponent(
    `Hi! I'd like to know more about "${product.name}" (${product.size}, ${product.finish}). Is it available?`
  )
  const waHref = `${business.whatsapp}?text=${waText}`

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-charcoal/90 p-4 backdrop-blur-sm"
    >
      <button onClick={onClose} aria-label="Close" className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-cream hover:bg-white/20">
        <Icon name="close" className="h-5 w-5" />
      </button>
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl overflow-hidden rounded-card border border-white/10 bg-charcoal-800 shadow-card"
      >
        <SwatchThumb swatch={asSwatch(product)} className="aspect-video w-full" eager size={640} />
        <div className="p-6">
          <span className="text-xs uppercase tracking-wider text-gold">{product.category} · {product.subCategory}</span>
          <h3 className="mt-1 font-display text-2xl text-cream">{product.name}</h3>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><dt className="text-[10px] uppercase tracking-wider text-sand/60">Size</dt><dd className="mt-1 text-cream">{product.size}</dd></div>
            <div><dt className="text-[10px] uppercase tracking-wider text-sand/60">Finish</dt><dd className="mt-1 text-cream">{product.finish}</dd></div>
            <div><dt className="text-[10px] uppercase tracking-wider text-sand/60">Surface</dt><dd className="mt-1 text-cream">{product.surface}</dd></div>
            <div><dt className="text-[10px] uppercase tracking-wider text-sand/60">Price</dt><dd className="mt-1 text-cream">{product.priceRange}</dd></div>
          </dl>
          {product.tags?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {product.tags.map((t) => <span key={t} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-sand/70">#{t}</span>)}
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={waHref} target="_blank" rel="noreferrer" className="btn-gold">
              <Icon name="whatsapp" className="h-4 w-4" filled /> Ask for this product
            </a>
            {product.textureUrl && (
              <button onClick={() => onViewIn3D(product)} className="btn-outline">
                <Icon name="compass" className="h-4 w-4" /> View in 3D
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
```

- [ ] **Step 6: Create `EmptyState.jsx`** — friendly empty state with WhatsApp:

```jsx
import Icon from '../Icons'
import { business } from '../../data/siteConfig'

export default function EmptyState({ onClear }) {
  const waHref = `${business.whatsapp}?text=${encodeURIComponent("Hi! I'm looking for a specific tile/material but couldn't find it on your site. Can you help?")}`
  return (
    <div className="rounded-card border border-white/5 bg-charcoal-700 p-10 text-center">
      <Icon name="search" className="mx-auto h-10 w-10 text-sand/40" />
      <h3 className="mt-4 font-display text-xl text-cream">No products match these filters</h3>
      <p className="mt-2 text-sm text-sand/70">Try a different category, finish, or clear the filters. Or message us — we may have it in-store.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={onClear} className="btn-outline">Clear filters</button>
        <a href={waHref} target="_blank" rel="noreferrer" className="btn-gold">
          <Icon name="whatsapp" className="h-4 w-4" filled /> Ask on WhatsApp
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/catalogue/
git commit -m "feat: catalogue UI primitives (tabs, strips, card, lightbox, empty state)"
```

---

### Task 3: Create the Catalogue section

**Files:** Create `src/components/sections/Catalogue.jsx`

**Produces:** Filterable 3/2/1 grid catalogue that replaces Gallery. Dispatches a `view-in-3d` CustomEvent when a user clicks "View in 3D" (the Visualizer listens for this and pre-loads the texture).

- [ ] **Step 1: Create the Catalogue section:**

```jsx
import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import SectionHeading from '../ui/SectionHeading'
import CategoryTabs from '../catalogue/CategoryTabs'
import SubCategoryStrip from '../catalogue/SubCategoryStrip'
import FinishChips from '../catalogue/FinishChips'
import ProductCard from '../catalogue/ProductCard'
import ProductLightbox from '../catalogue/ProductLightbox'
import EmptyState from '../catalogue/EmptyState'
import { products } from '../../data/catalogue'

export default function Catalogue() {
  const [cat, setCat] = useState('all')
  const [sub, setSub] = useState(null)
  const [finish, setFinish] = useState(null)
  const [open, setOpen] = useState(null)

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (cat !== 'all' && p.category.toLowerCase() !== cat) return false
      if (sub && p.subCategory !== sub) return false
      if (finish && p.finish !== finish) return false
      return true
    })
  }, [cat, sub, finish])

  const onViewIn3D = (p) => {
    // Tell the Visualizer to load this texture
    window.dispatchEvent(new CustomEvent('view-in-3d', { detail: p }))
    document.getElementById('visualizer')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section id="catalogue" className="section-pad relative bg-charcoal-800">
      <div className="container-px">
        <SectionHeading
          eyebrow="Our Collection"
          title="Browse the Catalogue"
          subtitle="Filter by category, sub-type and finish. Click any product to see full specs and ask for availability on WhatsApp."
        />
        <div className="mt-12">
          <CategoryTabs active={cat} onChange={(c) => { setCat(c); setSub(null) }} />
          <SubCategoryStrip category={cat} active={sub} onChange={setSub} />
          <FinishChips active={finish} onChange={setFinish} />
        </div>

        {filtered.length === 0 ? (
          <div className="mt-10">
            <EmptyState onClear={() => { setCat('all'); setSub(null); setFinish(null) }} />
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onOpen={setOpen}
                onViewIn3D={onViewIn3D}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <ProductLightbox
            product={open}
            onClose={() => setOpen(null)}
            onViewIn3D={(p) => { setOpen(null); onViewIn3D(p) }}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
```

- [ ] **Step 2: Update `src/App.jsx`** — replace `<Gallery />` with `<Catalogue />`:

```jsx
import Catalogue from './components/sections/Catalogue'
// ... in JSX:
<Hero />
<ProductCategories />
<Visualizer />
<Catalogue />     {/* was <Gallery /> */}
<WhyChooseUs />
```

- [ ] **Step 3: Delete `src/components/sections/Gallery.jsx`** (the coverflow carousel is fully replaced):

```bash
git rm src/components/sections/Gallery.jsx
```

- [ ] **Step 4: Verify** — visit http://localhost:5173/#catalogue. All 15 products show in a 3-col grid; category tabs filter; sub-categories show after selecting a category; finish chips further filter; clicking a card opens the lightbox with WhatsApp CTA; featured products show a gold ribbon; products with `textureUrl` show a "View in 3D" link; filtering to a combo that yields 0 shows the empty state.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/Catalogue.jsx src/App.jsx
git commit -m "feat: catalogue section replaces coverflow Gallery"
```

---

### Task 4: Create `getZoneTexture` utility (extends `threeTextures.js`)

**Files:** Modify `src/utils/threeTextures.js`

**Produces:** A single helper that resolves a swatch to a `THREE.Texture` using procedural generation, `textureUrl` from the swatch, or a custom uploaded URL.

- [ ] **Step 1: Add `getZoneTexture(swatch, repeat, size)` that handles both procedural and URL sources:**

```js
// Add at end of src/utils/threeTextures.js
import * as THREE from 'three'
import { makeMaterialCanvas } from './textures'

const cache = new Map()

export function getMaterialTexture(swatch, repeat = 1, size = 512) {
  // Backwards-compatible: procedural swatch only
  const key = `proc|${swatch.id || swatch.type + swatch.color}@${repeat}@${size}`
  if (cache.has(key)) return cache.get(key)
  const canvas = makeMaterialCanvas({
    type: swatch.type, color: swatch.color, accent: swatch.accent, size,
    seed: swatch.id || swatch.type + swatch.color,
  })
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  cache.set(key, tex)
  return tex
}

// New: handles both procedural and URL textures
const loader = new THREE.TextureLoader()
const urlCache = new Map()

export function getZoneTexture(source, repeat = 1, size = 512) {
  // source can be: a catalogue/swatches object, or { url: 'blob:...', isCustom: true }
  const urlKey = source.url
  if (urlKey) {
    if (urlCache.has(urlKey)) {
      const tex = urlCache.get(urlKey).clone()
      tex.needsUpdate = true
      tex.repeat.set(repeat, repeat)
      return tex
    }
    // sync return from cache promise — for simplicity caller awaits
    return null
  }
  // procedural fallback
  return getMaterialTexture(source, repeat, size)
}

export function loadZoneTexture(source, repeat = 1, size = 512) {
  return new Promise((resolve) => {
    if (source?.url) {
      if (urlCache.has(source.url)) {
        const cached = urlCache.get(source.url)
        const tex = cached.clone()
        tex.repeat.set(repeat, repeat)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.needsUpdate = true
        resolve(tex)
        return
      }
      loader.load(source.url, (tex) => {
        urlCache.set(source.url, tex)
        const out = tex.clone()
        out.wrapS = out.wrapT = THREE.RepeatWrapping
        out.repeat.set(repeat, repeat)
        out.anisotropy = 8
        out.colorSpace = THREE.SRGBColorSpace
        out.needsUpdate = true
        resolve(out)
      }, undefined, () => {
        // On URL load failure, fall back to procedural
        resolve(getMaterialTexture(source.fallback || { type: 'ceramic', color: '#cfc6b4' }, repeat, size))
      })
    } else {
      resolve(getMaterialTexture(source, repeat, size))
    }
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/threeTextures.js
git commit -m "feat: getZoneTexture supports procedural + URL + custom-upload sources"
```

---

### Task 5: Create 3D primitives

**Files:** Create `src/components/three/primitives/{BandedWall,TexturedFloor,TexturedPlane,FixturePlaceholder,CameraRig,ModelShell}.jsx`

**Produces:** Reusable building blocks for all 5 models.

- [ ] **Step 1: Create `BandedWall.jsx`** — wall split into horizontal bands. Each band is its own mesh with its own zone texture:

```jsx
import { useEffect, useState } from 'react'
import { loadZoneTexture } from '../../../utils/threeTextures'

// bands: [{ y0, y1, zoneId }]  — heights in scene units (= feet)
export default function BandedWall({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  width = 8,        // wall length (ft)
  bands = [],
  zoneTextures = {},  // { [zoneId]: swatchObject | { url, isCustom } | null }
  onZoneClick,
  activeZone,
}) {
  const [textures, setTextures] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all(
      bands.map(async (b) => {
        const src = zoneTextures[b.zoneId]
        if (!src) return [b.zoneId, null]
        const tex = await loadZoneTexture(src, 4, 512)
        return [b.zoneId, tex]
      })
    ).then((entries) => {
      if (!cancelled) setTextures(Object.fromEntries(entries))
    })
    return () => { cancelled = true }
  }, [bands, zoneTextures])

  return (
    <group position={position} rotation={rotation}>
      {bands.map((b) => {
        const h = b.y1 - b.y0
        const cy = b.y0 + h / 2
        const isActive = activeZone === b.zoneId
        return (
          <mesh
            key={b.zoneId}
            position={[0, cy, 0]}
            onClick={onZoneClick ? (e) => { e.stopPropagation(); onZoneClick(b.zoneId) } : undefined}
            castShadow
            receiveShadow
          >
            <planeGeometry args={[width, h]} />
            <meshStandardMaterial
              map={textures[b.zoneId] || null}
              color={textures[b.zoneId] ? '#ffffff' : '#5C3A22'}
              roughness={0.85}
              metalness={0.05}
              emissive={isActive ? '#C49A3C' : '#000000'}
              emissiveIntensity={isActive ? 0.15 : 0}
            />
          </mesh>
        )
      })}
    </group>
  )
}
```

- [ ] **Step 2: Create `TexturedFloor.jsx`:**

```jsx
import { useEffect, useState } from 'react'
import { loadZoneTexture } from '../../../utils/threeTextures'

export default function TexturedFloor({
  size = [8, 5],
  position = [0, 0, 0],
  rotation = [-Math.PI / 2, 0, 0],
  source,            // swatch or { url }
  repeat = 4,
  onClick,
  isActive = false,
}) {
  const [tex, setTex] = useState(null)
  useEffect(() => {
    let cancelled = false
    if (source) {
      loadZoneTexture(source, repeat, 512).then((t) => { if (!cancelled) setTex(t) })
    } else {
      setTex(null)
    }
    return () => { cancelled = true }
  }, [source, repeat])

  return (
    <mesh
      position={position}
      rotation={rotation}
      receiveShadow
      onClick={onClick}
    >
      <planeGeometry args={size} />
      <meshStandardMaterial
        map={tex || null}
        color={tex ? '#ffffff' : '#5C3A22'}
        roughness={0.4}
        metalness={0.1}
        emissive={isActive ? '#C49A3C' : '#000000'}
        emissiveIntensity={isActive ? 0.15 : 0}
      />
    </mesh>
  )
}
```

- [ ] **Step 3: Create `TexturedPlane.jsx`** (generic — feature walls, side returns):

```jsx
import { useEffect, useState } from 'react'
import { loadZoneTexture } from '../../../utils/threeTextures'

export default function TexturedPlane({
  size = [10, 10], position = [0, 0, 0], rotation = [0, 0, 0],
  source, repeat = 4, isActive = false, onClick,
}) {
  const [tex, setTex] = useState(null)
  useEffect(() => {
    let cancelled = false
    if (source) {
      loadZoneTexture(source, repeat, 512).then((t) => { if (!cancelled) setTex(t) })
    } else { setTex(null) }
    return () => { cancelled = true }
  }, [source, repeat])

  return (
    <mesh position={position} rotation={rotation} receiveShadow onClick={onClick} castShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial
        map={tex || null}
        color={tex ? '#ffffff' : '#5C3A22'}
        roughness={0.85}
        metalness={0.05}
        emissive={isActive ? '#C49A3C' : '#000000'}
        emissiveIntensity={isActive ? 0.15 : 0}
      />
    </mesh>
  )
}
```

- [ ] **Step 4: Create `FixturePlaceholder.jsx`** — simple primitive fixtures with toggles:

```jsx
export function ShowerFixture({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      {/* Shower head — vertical cylinder */}
      <mesh position={[0, 7, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.1, 16]} />
        <meshStandardMaterial color="#9a9488" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Pipe */}
      <mesh position={[0, 6, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
        <meshStandardMaterial color="#7a6f5c" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  )
}

export function WCFixture({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.8, 0.8, 1.2]} />
        <meshStandardMaterial color="#eceae4" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.95, -0.3]} castShadow>
        <boxGeometry args={[0.8, 0.5, 0.3]} />
        <meshStandardMaterial color="#eceae4" roughness={0.3} />
      </mesh>
    </group>
  )
}

export function Faucet({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 1, 8]} />
        <meshStandardMaterial color="#cfc6b4" roughness={0.2} metalness={0.8} />
      </mesh>
    </group>
  )
}

export function Basin({ position = [0, 0, 0], style = 'rect' }) {
  if (style === 'round') {
    return (
      <mesh position={position} castShadow>
        <cylinderGeometry args={[0.5, 0.4, 0.3, 24]} />
        <meshStandardMaterial color="#eceae4" roughness={0.3} />
      </mesh>
    )
  }
  if (style === 'vessel') {
    return (
      <mesh position={position} castShadow>
        <sphereGeometry args={[0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#eceae4" roughness={0.3} />
      </mesh>
    )
  }
  // rectangular undermount (default)
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={[1.2, 0.3, 0.7]} />
      <meshStandardMaterial color="#eceae4" roughness={0.3} />
    </mesh>
  )
}
```

- [ ] **Step 5: Create `CameraRig.jsx`** — animates camera to preset positions:

```jsx
import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// presets: { [name]: { position: [x,y,z], target: [x,y,z] } }
export default function CameraRig({ presets, active, controlsRef }) {
  const { camera } = useThree()
  const animating = useRef(false)

  useEffect(() => {
    const p = presets[active] || presets.default
    if (!p) return
    animating.current = true
    const startPos = camera.position.clone()
    const startTarget = controlsRef.current?.target.clone() || new THREE.Vector3()
    const endPos = new THREE.Vector3(...p.position)
    const endTarget = new THREE.Vector3(...p.target)
    const start = performance.now()
    const dur = 600

    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - t, 3)
      camera.position.lerpVectors(startPos, endPos, eased)
      if (controlsRef.current) controlsRef.current.target.lerpVectors(startTarget, endTarget, eased)
      controlsRef.current?.update()
      if (t < 1) requestAnimationFrame(tick)
      else animating.current = false
    }
    requestAnimationFrame(tick)
  }, [active, presets, camera, controlsRef])

  return null
}

export { OrbitControls }
```

- [ ] **Step 6: Create `ModelShell.jsx`** — the Canvas + lighting wrapper shared by all models:

```jsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import CameraRig from './CameraRig'
import { useRef } from 'react'

// Wraps every model. Children render the actual geometry.
// cameraPresets is a { [name]: { position, target } } map; first preset is the default.
export default function ModelShell({
  children,
  cameraPresets = {},
  frameloop = 'always',
  showControls = true,
}) {
  const reduce = useReducedMotion()
  const controlsRef = useRef(null)
  const presetNames = Object.keys(cameraPresets)
  const initial = cameraPresets[presetNames[0]] || cameraPresets.default
  const initialPos = initial?.position || [6, 5, 7]
  const initialTarget = initial?.target || [0, 0, 0]

  return (
    <>
      <Canvas
        shadows
        frameloop={frameloop}
        dpr={[1, 1.8]}
        camera={{ position: initialPos, fov: 40 }}
        gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        // preserveDrawingBuffer enables canvas.toDataURL() for screenshots
      >
        <color attach="background" args={['#3D2512']} />
        <hemisphereLight args={['#f3e6cf', '#2a2622', 0.9]} />
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[5, 8, 4]} intensity={1.7} castShadow color="#f3e6cf"
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-4, 3, -2]} intensity={0.4} color="#C49A3C" />

        {children}

        <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={20} blur={2.4} far={6} />
        {showControls && (
          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            minDistance={3}
            maxDistance={20}
            minPolarAngle={0.1}
            maxPolarAngle={Math.PI / 2.05}
            autoRotate={!reduce}
            autoRotateSpeed={0.4}
            target={initialTarget}
          />
        )}
      </Canvas>
      <CameraRig presets={cameraPresets} active={presetNames[0]} controlsRef={controlsRef} />
    </>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/three/primitives/
git commit -m "feat: 3D primitives — BandedWall, TexturedFloor/Plane, Fixture, CameraRig, ModelShell"
```

---

### Task 6: Create model registry + Model A (Small Bathroom)

**Files:** Create `src/components/three/models/ModelA.jsx`, Create `src/components/three/models/registry.js`, Create `src/components/three/models/index.js`

**Produces:** Model A reference implementation. Registry is the index of all models (Model B-E added in Plan 3).

- [ ] **Step 1: Create `registry.js`:**

```js
// Registry of all 3D models. Each model:
//   id        unique key
//   name      display name
//   blurb     one-line description for the tab
//   zones     [{ id, label, surface }]  (surface = Floor | Wall | Countertop | Both)
//   presets   { [name]: { position, target } }
//   load      () => import('./ModelX')    (lazy)
//
// "Floor" / "Wall" / "Countertop" surface tags are how the ZonePicker
// filters swatches (a floor zone should only show products with
// surface=Floor or Both). The catalogue products are the source.

export const models = [
  {
    id: 'bathroom-s',
    name: 'Small Bathroom',
    blurb: '8×5 ft, 3-2-3 tile bands',
    zones: [
      { id: 'floor',     label: 'Floor',        surface: 'Floor' },
      { id: 'lower',     label: 'Lower Wall',   surface: 'Wall' },
      { id: 'feature',   label: 'Feature Band', surface: 'Wall' },
      { id: 'upper',     label: 'Upper Wall',   surface: 'Wall' },
    ],
    presets: {
      default: { position: [7, 5, 8],   target: [0, 3, 0] },
    },
    load: () => import('./ModelA'),
  },
  // Models B-E added in Plan 3
]
```

- [ ] **Step 2: Create `ModelA.jsx`** — 8×5 floor + two banded 8ft walls + shower toggle:

```jsx
import BandedWall from '../primitives/BandedWall'
import TexturedFloor from '../primitives/TexturedFloor'
import { ShowerFixture } from '../primitives/FixturePlaceholder'

// 3-2-3 horizontal bands (bottom to top): 0-3ft lower, 3-5ft feature, 5-8ft upper
const BANDS = [
  { y0: 0, y1: 3, zoneId: 'lower' },
  { y0: 3, y1: 5, zoneId: 'feature' },
  { y0: 5, y1: 8, zoneId: 'upper' },
]

export default function ModelA({ zoneTextures, activeZone, onZoneClick, showShower = true }) {
  return (
    <group>
      {/* Floor: 8 ft long × 5 ft wide */}
      <TexturedFloor
        size={[8, 5]}
        position={[0, 0, 0]}
        source={zoneTextures.floor}
        repeat={3}
        isActive={activeZone === 'floor'}
        onClick={() => onZoneClick?.('floor')}
      />

      {/* Back wall — the long wall (8 ft) at z = -2.5 */}
      <BandedWall
        position={[0, 0, -2.5]}
        width={8}
        bands={BANDS}
        zoneTextures={{ lower: zoneTextures.lower, feature: zoneTextures.feature, upper: zoneTextures.upper }}
        activeZone={activeZone}
        onZoneClick={onZoneClick}
      />

      {/* Side wall — left short wall (5 ft) at x = -4 */}
      <BandedWall
        position={[-4, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        width={5}
        bands={BANDS}
        zoneTextures={{ lower: zoneTextures.lower, feature: zoneTextures.feature, upper: zoneTextures.upper }}
        activeZone={activeZone}
        onZoneClick={onZoneClick}
      />

      {/* Optional shower fixture (toggle) */}
      {showShower && <ShowerFixture position={[3, 0, 2]} />}
    </group>
  )
}
```

- [ ] **Step 3: Create `models/index.js`** for lazy exports:

```js
export { models } from './registry'
```

- [ ] **Step 4: Commit**

```bash
git add src/components/three/models/
git commit -m "feat: model registry + Model A (Small Bathroom, 3-2-3 bands)"
```

---

### Task 7: Create Visualizer UI sub-components

**Files:** Create `src/components/visualizer/{ModelTabs,ZonePicker,ControlBar,MobileDrawer,ScreenshotHelper}.js(x)`

**Produces:** All visualizer UI pieces.

- [ ] **Step 1: Create `ModelTabs.jsx`:**

```jsx
import { models } from '../three/models'

export default function ModelTabs({ active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {models.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`whitespace-nowrap rounded-btn px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-150 ${
            active === m.id
              ? 'bg-gold text-ink shadow-glow'
              : 'bg-white/5 text-sand hover:bg-white/10'
          }`}
          title={m.blurb}
        >
          {m.name}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `ZonePicker.jsx`** — surface-filtered scrollable swatch strip with active gold border + custom upload:

```jsx
import { useRef } from 'react'
import Icon from '../Icons'
import { products } from '../../data/catalogue'
import { finishes } from '../../data/catalogue'

// Convert product → swatch shape for the swatch thumb
function asSwatch(p) {
  return { id: p.id, name: p.name, type: p.category.toLowerCase(), color: p.color, accent: p.color, image: p.imageUrl }
}

export default function ZonePicker({
  zone,                       // { id, label, surface }
  activeZoneId,               // currently active zone
  zoneTextures,               // { [zoneId]: swatch }
  onSwatchPick,               // (zoneId, swatch) => void
  onActivateZone,             // (zoneId) => void
  onCustomUpload,             // (zoneId, file) => void
}) {
  const fileRef = useRef(null)
  const surface = zone?.surface
  const compatible = products.filter((p) => p.surface === surface || p.surface === 'Both')
  const isActive = zone?.id === activeZoneId

  return (
    <div className={`rounded-card border p-4 transition-all ${isActive ? 'border-gold bg-charcoal-800' : 'border-white/5 bg-charcoal-800/60'}`}>
      <div className="flex items-center justify-between">
        <button onClick={() => onActivateZone(zone.id)} className="text-left">
          <span className="text-[10px] uppercase tracking-wider text-sand/60">Zone</span>
          <h4 className="font-display text-base text-cream">{zone.label}</h4>
        </button>
        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold">
          {surface}
        </span>
      </div>

      {isActive && (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {compatible.map((p) => {
              const sel = zoneTextures[zone.id]?.id === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => onSwatchPick(zone.id, p)}
                  title={p.name}
                  className={`relative h-12 w-16 shrink-0 overflow-hidden rounded border-2 transition-all ${
                    sel ? 'border-gold shadow-glow' : 'border-transparent hover:border-sand/30'
                  }`}
                  style={{ background: p.color }}
                >
                  {sel && <Icon name="star" className="absolute right-0.5 top-0.5 h-3 w-3 text-gold" filled />}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-btn border border-dashed border-white/10 px-3 py-2 text-xs text-sand/70 hover:border-gold hover:text-gold"
          >
            <Icon name="send" className="h-3.5 w-3.5" /> Upload a photo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onCustomUpload(zone.id, file)
              e.target.value = ''
            }}
          />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `ControlBar.jsx`** — Reset / Screenshot / WhatsApp:

```jsx
import Icon from '../Icons'
import { useState } from 'react'
import { business } from '../../data/siteConfig'

export default function ControlBar({ onReset, onScreenshot, zoneTextures, modelName }) {
  const [busy, setBusy] = useState(false)
  const onShot = async () => {
    setBusy(true)
    try { await onScreenshot() } finally { setBusy(false) }
  }
  const summary = Object.entries(zoneTextures)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v.name}`)
    .join(' · ')
  const waHref = `${business.whatsapp}?text=${encodeURIComponent(
    `Hi! I tried a ${modelName} preview in your Visualizer. ${summary}. Can we discuss these in-store?`
  )}`
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={onReset} className="btn-outline px-4 py-2 text-xs">
        <Icon name="compass" className="h-4 w-4" /> Reset Camera
      </button>
      <button onClick={onShot} disabled={busy} className="btn-outline px-4 py-2 text-xs">
        <Icon name="search" className="h-4 w-4" /> {busy ? 'Saving…' : 'Save Preview'}
      </button>
      <a href={waHref} target="_blank" rel="noreferrer" className="btn-gold px-4 py-2 text-xs">
        <Icon name="whatsapp" className="h-4 w-4" filled /> Ask on WhatsApp
      </a>
    </div>
  )
}
```

- [ ] **Step 4: Create `ScreenshotHelper.js`** — the actual capture logic:

```js
import { business } from '../../data/siteConfig'

// Capture the WebGL canvas, stamp the shop name, trigger a PNG download.
// Called by ControlBar's onScreenshot with a ref to the canvas element.
export async function captureAndDownload(canvas) {
  if (!canvas) return
  // Force a render to ensure the buffer is fresh
  // (most apps need preserveDrawingBuffer: true on the gl context)
  const w = canvas.width
  const h = canvas.height
  const off = document.createElement('canvas')
  off.width = w
  off.height = h
  const ctx = off.getContext('2d')
  ctx.drawImage(canvas, 0, 0, w, h)
  // Watermark
  ctx.fillStyle = 'rgba(26, 14, 5, 0.55)'
  ctx.fillRect(0, h - 48, w, 48)
  ctx.fillStyle = '#C49A3C'
  ctx.font = '600 18px Manrope, sans-serif'
  ctx.fillText(business.name, 16, h - 18)
  ctx.fillStyle = 'rgba(245, 230, 200, 0.7)'
  ctx.font = '12px Manrope, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(new Date().toLocaleDateString('en-IN'), w - 16, h - 18)

  // Download
  const url = off.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `svt-preview-${Date.now()}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
```

- [ ] **Step 5: Create `MobileDrawer.jsx`** — bottom-sheet picker for mobile:

```jsx
import { AnimatePresence, motion } from 'framer-motion'
import Icon from '../Icons'
import ModelTabs from './ModelTabs'
import ZonePicker from './ZonePicker'
import ControlBar from './ControlBar'

export default function MobileDrawer({
  open, onClose,
  models, activeModelId, onModelChange,
  activeZoneId, onActivateZone, zoneTextures, onSwatchPick, onCustomUpload,
  onReset, onScreenshot, modelName,
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-charcoal/60 backdrop-blur-sm lg:hidden"
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-card border-t border-gold/30 bg-charcoal-800 p-5 shadow-card lg:hidden"
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-gold/40" />
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-cream">Customize</h3>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-cream"><Icon name="close" className="h-4 w-4" /></button>
            </div>
            <div className="mt-4">
              <ModelTabs active={activeModelId} onChange={onModelChange} />
            </div>
            <div className="mt-4 space-y-3">
              {models.find((m) => m.id === activeModelId)?.zones.map((z) => (
                <ZonePicker
                  key={z.id}
                  zone={z}
                  activeZoneId={activeZoneId}
                  zoneTextures={zoneTextures}
                  onSwatchPick={onSwatchPick}
                  onActivateZone={onActivateZone}
                  onCustomUpload={onCustomUpload}
                />
              ))}
            </div>
            <div className="mt-5 border-t border-white/5 pt-4">
              <ControlBar
                onReset={onReset}
                onScreenshot={onScreenshot}
                zoneTextures={zoneTextures}
                modelName={modelName}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/visualizer/
git commit -m "feat: Visualizer UI sub-components (ModelTabs, ZonePicker, ControlBar, MobileDrawer, ScreenshotHelper)"
```

---

### Task 8: Rewrite Visualizer.jsx to be the multi-model, multi-zone shell

**Files:** Modify `src/components/sections/Visualizer.jsx`

**Produces:** The full Visualizer section with model selector tabs, multi-zone texture pickers, reset/screenshot/share, mobile drawer, and the "View in 3D" event listener that pre-loads a texture when a catalogue card triggers it.

- [ ] **Step 1: Replace the entire `Visualizer.jsx` with the new shell:**

```jsx
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import SectionHeading from '../ui/SectionHeading'
import CanvasFallback from '../ui/CanvasFallback'
import { useWebGL } from '../../hooks/useWebGL'
import { useInView } from '../../hooks/useInView'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { models } from '../three/models'
import { products } from '../../data/catalogue'
import ModelTabs from '../visualizer/ModelTabs'
import ZonePicker from '../visualizer/ZonePicker'
import ControlBar from '../visualizer/ControlBar'
import MobileDrawer from '../visualizer/MobileDrawer'
import Icon from '../Icons'
import { captureAndDownload } from '../visualizer/ScreenshotHelper'

// Lazy model components keyed by id
const modelCache = {}
function getModel(id) {
  if (!modelCache[id]) {
    const m = models.find((x) => x.id === id)
    if (m) modelCache[id] = lazy(m.load)
  }
  return modelCache[id]
}

// Default zone textures — pick a starter product per zone's surface
const defaultZoneTextures = (zones) => {
  const out = {}
  zones.forEach((z) => {
    const candidate = products.find((p) => p.surface === z.surface || p.surface === 'Both')
    if (candidate) out[z.id] = candidate
  })
  return out
}

export default function Visualizer() {
  const webgl = useWebGL()
  const [stageRef, stageEntered, stageVisible] = useInView({ rootMargin: '300px' })
  const reduce = useReducedMotion()
  const [activeModelId, setActiveModelId] = useState(models[0].id)
  const [activeZoneId, setActiveZoneId] = useState(models[0].zones[0].id)
  const [resetKey, setResetKey] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [presetName, setPresetName] = useState('default')
  const canvasWrapRef = useRef(null)

  const activeModel = useMemo(() => models.find((m) => m.id === activeModelId), [activeModelId])
  const ModelComp = getModel(activeModelId)

  // Initialize / reset zone textures when the model changes
  const [zoneTextures, setZoneTextures] = useState(() => defaultZoneTextures(models[0].zones))
  useEffect(() => {
    setZoneTextures(defaultZoneTextures(activeModel.zones))
    setActiveZoneId(activeModel.zones[0].id)
    setPresetName('default')
  }, [activeModelId])  // eslint-disable-line react-hooks/exhaustive-deps

  const onSwatchPick = (zoneId, swatch) => {
    setZoneTextures((z) => ({ ...z, [zoneId]: swatch }))
  }
  const onCustomUpload = (zoneId, file) => {
    const url = URL.createObjectURL(file)
    onSwatchPick(zoneId, { id: 'custom-' + Date.now(), name: file.name, url, isCustom: true })
  }
  const onReset = () => {
    setZoneTextures(defaultZoneTextures(activeModel.zones))
    setActiveZoneId(activeModel.zones[0].id)
    setResetKey((k) => k + 1)
    setPresetName('default')
  }
  const onScreenshot = async () => {
    const canvas = canvasWrapRef.current?.querySelector('canvas')
    if (canvas) await captureAndDownload(canvas)
  }

  // Listen for "view-in-3d" events from the Catalogue
  useEffect(() => {
    const handler = (e) => {
      const product = e.detail
      setActiveModelId(models[0].id)  // currently only Model A; will be smarter in Plan 3
      setZoneTextures((z) => ({ ...z, [activeModel.zones[0].id]: product }))
    }
    window.addEventListener('view-in-3d', handler)
    return () => window.removeEventListener('view-in-3d', handler)
  }, [activeModel])

  return (
    <section id="visualizer" className="section-pad relative bg-charcoal">
      <div className="container-px">
        <SectionHeading
          eyebrow="See It Before You Buy"
          title="Interactive Tile Visualizer"
          subtitle="Pick a model, then assign tiles to each surface zone. Drag to orbit, scroll to zoom — preview the look before you visit."
        />

        <div className="mt-10 lg:hidden">
          <ModelTabs active={activeModelId} onChange={setActiveModelId} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* 3D stage */}
          <div
            ref={stageRef}
            className="relative aspect-[4/3] overflow-hidden rounded-card border border-white/5 bg-charcoal-800 shadow-card lg:aspect-auto lg:min-h-[540px]"
          >
            {webgl ? (
              stageEntered ? (
                <Suspense
                  fallback={
                    <div className="flex h-full w-full items-center justify-center text-sand/60">
                      <span className="animate-pulse">Loading 3D scene…</span>
                    </div>
                  }
                >
                  <div ref={canvasWrapRef} key={`${activeModelId}-${resetKey}`} className="h-full w-full">
                    <ModelComp
                      zoneTextures={zoneTextures}
                      activeZone={activeZoneId}
                      onZoneClick={setActiveZoneId}
                      frameloop={stageVisible ? 'always' : 'never'}
                      presetName={presetName}
                    />
                  </div>
                </Suspense>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sand/50">
                  <span className="animate-pulse">Preparing 3D…</span>
                </div>
              )
            ) : (
              <div className="relative h-full w-full p-4">
                <CanvasFallback swatchList={Object.values(zoneTextures).filter(Boolean).slice(0, 6)} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal to-transparent p-4 text-center text-xs text-sand/70">
                  3D preview unavailable on this device — showing material samples
                </div>
              </div>
            )}

            {/* controls hint */}
            {webgl && (
              <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full bg-charcoal/70 px-3 py-1.5 text-[11px] text-sand backdrop-blur">
                <Icon name="compass" className="h-3.5 w-3.5 text-gold" />
                Drag to orbit · Scroll to zoom
              </div>
            )}

            {/* Mobile: open drawer button */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-btn bg-gold px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink shadow-glow lg:hidden"
            >
              <Icon name="grid" className="h-4 w-4" /> Customize
            </button>
          </div>

          {/* Desktop: side panel */}
          <div className="hidden flex-col gap-4 lg:flex">
            <ModelTabs active={activeModelId} onChange={setActiveModelId} />
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {activeModel.zones.map((z) => (
                <ZonePicker
                  key={z.id}
                  zone={z}
                  activeZoneId={activeZoneId}
                  zoneTextures={zoneTextures}
                  onSwatchPick={onSwatchPick}
                  onActivateZone={setActiveZoneId}
                  onCustomUpload={onCustomUpload}
                />
              ))}
            </div>
            <ControlBar
              onReset={onReset}
              onScreenshot={onScreenshot}
              zoneTextures={zoneTextures}
              modelName={activeModel.name}
            />
          </div>
        </div>
      </div>

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        models={models}
        activeModelId={activeModelId}
        onModelChange={setActiveModelId}
        activeZoneId={activeZoneId}
        onActivateZone={setActiveZoneId}
        zoneTextures={zoneTextures}
        onSwatchPick={onSwatchPick}
        onCustomUpload={onCustomUpload}
        onReset={onReset}
        onScreenshot={onScreenshot}
        modelName={activeModel.name}
      />
    </section>
  )
}
```

- [ ] **Step 2: Update `ModelShell.jsx`** to accept `presetName` from parent and read the matching preset (the current CameraRig reads `Object.keys(presets)[0]` — extend to read the named one):

Update ModelShell's inner call:
```jsx
<CameraRig presets={cameraPresets} active={presetName || Object.keys(cameraPresets)[0]} controlsRef={controlsRef} />
```
And add `presetName` prop. Add `frameloop` passthrough.

- [ ] **Step 3: Verify end-to-end** — open http://localhost:5173/#visualizer. Model A (Small Bathroom) renders. Click a swatch in a zone → that zone's wall re-textures. Click "View in 3D" on a catalogue card with textureUrl → scroll to visualizer, that texture pre-loaded. Click "Customize" on mobile → bottom drawer slides up. Click "Save Preview" → PNG downloads with shop name watermark. Click "Reset Camera" → camera returns to default. Click "Ask on WhatsApp" → opens WA with a description of the chosen tiles.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/Visualizer.jsx src/components/three/primitives/ModelShell.jsx
git commit -m "feat: Visualizer multi-model multi-zone shell (replaces single-model Visualizer)"
```

---

### Task 9: Verify + visual QA

- [ ] **Step 1: Run dev server.** Confirm localhost:5173 works with all sections loading.
- [ ] **Step 2: Catalogue** — 15 products in 3-col grid; filter pills work; sub-categories show after selecting category; finish chips filter; lightbox opens with all specs + WhatsApp CTA; featured ribbon shows; View-in-3D link appears on products with textureUrl; empty state shows for impossible filter combos.
- [ ] **Step 3: Visualizer** — Model A (Small Bathroom) renders with 3-2-3 wall bands. Floor and 3 wall zones each have their own swatch strip. Click a swatch in any zone → that surface re-textures. Active zone has a subtle gold glow. Toggling the "showShower" fixture (TODO: add UI toggle in Plan 2 follow-up if not present) shows a grey cylinder.
- [ ] **Step 4: Cross-link** — Click a catalogue card's "View in 3D" → page scrolls to visualizer, the texture is pre-loaded.
- [ ] **Step 5: Mobile drawer** — Resize below lg breakpoint. Click "Customize" → drawer slides up. Tap a zone, pick a swatch. Drawer closes on backdrop click.
- [ ] **Step 6: Screenshot** — Click "Save Preview" → PNG downloads with shop name watermark and date.
- [ ] **Step 7: WhatsApp share** — Click "Ask on WhatsApp" → new tab opens with prefilled message describing the selected tiles.
- [ ] **Step 8: Reduced-motion** — Toggle in DevTools. Reload. Confirm: no pulse on Visualizer, smooth instant zone changes.
- [ ] **Step 9: Build** — `npm run build` succeeds with no errors.
- [ ] **Step 10: Final commit.**

---

## Self-Review

**Spec coverage:**
- C1–C8 catalogue requirements → Tasks 1, 2, 3 ✓
- "View in 3D" linking → Tasks 3 (dispatch event), 8 (listen + pre-load) ✓
- §4.1 visualizer overview → Task 8 (multi-model shell) ✓
- §4.2 Model A (Small Bathroom) → Task 6 ✓
- §5 visualizer UI shell → Tasks 5, 7, 8 (ModelTabs, ZonePicker, ControlBar, MobileDrawer, Screenshot) ✓
- NF2 lazy-loaded Suspense → Task 8 (existing pattern) ✓
- NF5 reduced-motion → Task 5 (ModelShell) + §hook from Plan 1 ✓
- "Procedural now, real assets later" → `getZoneTexture` falls back when no url ✓

**Gaps:** Models B-E not in this plan (Plan 3). "Reset Camera" for Model A only resets zones (not camera) — Model A has no presets yet so camera reset is no-op; Plan 3 adds presets and the camera reset will work properly.
