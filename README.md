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

## Performance

The site is tuned to paint fast and stay smooth:

- **Code-split 3D** — Three.js loads in its own async chunk; the rest of the
  page is light. WebGL-less devices never download it.
- **Deferred material generation** — the procedural textures are generated
  lazily (near-viewport, during idle time) and cached, so they never block the
  first paint. Thumbnails are encoded as JPEG at modest sizes.
- **Scroll-gated 3D** — each WebGL scene only mounts when you approach it and
  **pauses its render loop when scrolled off-screen** (saves GPU/CPU/battery).
- **No third-party HDR** — scene lighting is fully self-contained (hemisphere +
  directional lights), so nothing is fetched from a remote CDN at runtime.
- **Trimmed web fonts** to only the weights actually used.

Measured on the production build: `DOMContentLoaded ≈ 0.2s`, ~12 MB JS heap, and
the only runtime third-party request is Google Fonts (plus the Google Maps embed
once you scroll to Contact).

## Security

- All external links use `rel="noopener noreferrer"`; the map `iframe` uses
  `referrerPolicy="no-referrer"` and lazy loading.
- User input from the enquiry form is only ever URL-encoded into a `wa.me` link
  (no injection surface) and rendered through React (auto-escaped — no XSS).
- No secrets or API keys in the repo; the Maps embed is keyless.
- **HTTP security headers** ship for both hosts: see [`vercel.json`](vercel.json)
  (Vercel) and [`public/_headers`](public/_headers) (Netlify / Cloudflare Pages).
  They set a Content-Security-Policy, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy` and HSTS. If you later add real product
  photos from an external CDN, add that origin to the CSP `img-src`.
- `npm audit`: **0 vulnerabilities in production dependencies**. The remaining
  advisories are Vite **dev-server-only** (they affect `npm run dev` locally,
  never the deployed static site) and don't warrant the breaking Vite 8 upgrade.
