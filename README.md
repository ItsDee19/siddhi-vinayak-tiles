# Sidhhi Binayak Tiles

A showroom website for tiles, marble, granite, quartz and sanitaryware in Nuapada, Odisha. This branch replaces the room visualizer with an immersive library of the owner's four original PDF catalogues.

## Develop and verify

```sh
npm install
npm run dev
npm test
npm run check:catalogues
npm run build
npm run preview
```

The build produces static HTML plus a React reader. It prerenders the homepage, collection indexes, policies and a custom 404, then checks metadata, schema, links and original PDF integrity. No Python or PDF rendering is needed on Vercel.

## Catalogue experience

- Four complete source documents, 257 original pages, including printed tile names, design codes, dimensions, finishes and packing details wherever supplied.
- Fit-page and full-screen reading, sharp zoom, native touch/keyboard panning, page jumps and a bounded thumbnail index.
- Shareable links such as `/?catalogue=global-floor&page=3#catalogue`.
- WhatsApp enquiries reference the exact collection and PDF page. Sending is completed by the customer in WhatsApp.
- Preview images load individually; source-resolution detail images load on zoom. Original PDFs are optional links, not automatic downloads.
- No artificial lighting, colour filters or generated replacement tile designs.

The PDFs are scans without text layers. Their printed details remain authoritative. No noisy OCR, guessed product names, prices or stock claims are presented as verified data.

## Editing content

| Content | Source |
| --- | --- |
| Business name, address, contact details | `src/data/siteConfig.js` |
| Catalogue definitions and source filenames | `scripts/build_catalogue_library.py` |
| Generated complete page manifest | `src/data/catalogueBooks.generated.json` |
| Reader controls and layout | `src/components/catalogue/`, `src/styles/catalogue.css` |
| Brand tokens and design decisions | `tailwind.config.js`, `DESIGN.md` |
| SEO, canonical origin and static indexes | `src/data/seo.js` |
| Privacy and website terms | `src/data/policyPages.js` |

To regenerate page assets, install Python's `pypdfium2` and `Pillow`, then run:

```sh
python scripts/build_catalogue_library.py --source-dir "/path/to/original-pdfs"
npm run check:catalogues
```

The source filenames are recorded in the script. Originals are copied byte-for-byte and SHA-256 checked. Preview/detail/thumbnail assets preserve full page proportions; detail rendering is capped at the source's effective resolution.

## Hosting, search and privacy

Vercel should build with `npm run build` and publish `dist`. The canonical domain is `https://sidhhibinayaktiles.com`. Vercel preview builds emit `noindex`; production builds publish a sitemap and ordinary HTML links to all catalogue pages and PDFs.

See [catalogue search and discovery](docs/catalogue-seo.md) for schema, redirects, security headers and the Search Console / Business Profile account steps. No analytics or advertising integration is included. The optional privacy acknowledgement is stored locally. The enquiry form prepares a WhatsApp draft and does not claim to have delivered a message.

Fonts are self-hosted. Legacy visualizer code/assets remain in the repository for reference, but the active site imports no Three.js and the deployment copies only assets used by the catalogue site. Use the Git deployment integration for the catalogue library; the complete originals are larger than a small CLI source-upload budget.

## Verification scope

Unit tests cover selection bounds, deep links, page-index coverage, page geometry, estimates and SEO serialization. Asset validation checks all 257 pages and 771 derivatives plus original PDF hashes. Browser review covers desktop/mobile layouts, full-screen focus, zoom/panning, validation, deep-link reloads and image-error recovery. The strict UI source audit is documented in `premium-ui.json`; it supplements, rather than replaces, browser and accessibility review.
