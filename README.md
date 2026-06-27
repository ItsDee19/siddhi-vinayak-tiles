# Siddhi Vinayak Tiles — Website

A premium, 3D-interactive single-page website for **Siddhi Vinayak Tiles**, a
family-run tiles, marble, granite, quartz & sanitaryware showroom in Nuapada,
Odisha.

> _“Enter as Friend, Leave as Family.”_

## Tech stack

- **React 18 + Vite** — fast dev/build
- **Tailwind CSS** — styling, custom stone-showroom palette
- **Framer Motion** — scroll/hover/page-transition animations
- **React Three Fiber + drei (Three.js)** — the 3D elements

## Getting started

```bash
npm install
npm run dev      # start dev server (http://localhost:5173)
npm run build    # production build → dist/
npm run preview  # preview the production build
```

## Highlights

- **Hero 3D tile wall** — a floating grid of material tiles that tilts with the
  pointer and drifts apart on scroll.
- **Interactive Visualizer** — a 3D room whose floor re-textures live as you
  pick a Tiles / Marble / Granite / Quartz swatch. Drag to orbit, scroll to zoom.
- **Tilt category cards**, filterable **gallery + lightbox**, animated **stat
  counters**, a rotating **marble slab** in About, and floating **Call /
  WhatsApp** buttons.
- **Graceful fallback** — devices without WebGL (or with reduced-motion
  enabled) get static procedural material grids instead of the 3D canvases.

## Editing content

Everything is config-driven — no need to touch components for routine edits:

| What | Where |
| --- | --- |
| Name, address, phone, hours, tagline, stats, testimonials, socials | `src/data/siteConfig.js` |
| Categories, swatches, gallery items | `src/data/products.js` |
| Colours, fonts, shadows | `tailwind.config.js` |

### Swapping in real photos

All material previews are **procedurally generated** (`src/utils/textures.js`)
so the site works with zero external image assets. To use real shop photos,
add an `image` field to any swatch or gallery item in `src/data/products.js`:

```js
{ id: 'g1', category: 'tiles', title: 'Living Room Floor', image: '/photos/floor.jpg' }
```

The UI prefers `image` over the generated texture wherever it’s present.

### Google Map

The Contact map uses an `iframe` centred on Motanuapada, Nuapada. Replace
`mapEmbedSrc` / `mapLink` in `src/data/siteConfig.js` with the verified Google
Business embed once available.

### Enquiry form

The form has no backend — on submit it composes a pre-filled WhatsApp message to
the shop. Swap `handleSubmit` in `src/components/sections/Contact.jsx` for an
email service or form endpoint if you'd prefer.
