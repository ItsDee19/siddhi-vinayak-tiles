# Catalogue maintenance

The reader uses the supplier's original artwork: complete product views,
verified room photographs, searchable printed details, and the full source
pages. The PDFs in `public/catalogues/<id>.pdf` are copied byte-for-byte.
Rendering never rewrites a PDF or changes its colours, contrast or patterns.

## Authoritative inputs

- `scripts/catalogue-sources.json` is the ordered registry. Each entry supplies
  a stable `id`, exact `sourceName`, title, description, format, `featuredPage`,
  `expectedPages` and lowercase hexadecimal SHA-256 `sourceHash`. Optional
  `shortTitle` and `cardImage` control the collection card; its image must belong
  to that catalogue.
- `scripts/catalogue-search-corrections-<id>.json` contains verified names,
  codes, sizes, finishes and aliases, pinned to the same `sourceHash`. Use
  one-based **PDF page numbers**, including covers, in `pages[].pdfPage`.
  Account for every page with a products entry or an `excludedPages` entry
  explaining the cover, divider, index or duplicate room-only page.
- `scripts/catalogue-gallery-map-<id>.json` maps every indexed product to exactly
  one story and carries the same hash. Each story has a stable `id`,
  `pageNumber`, `productIds`, `sourceRect` and `views.tile`; `views.room` is
  optional. Product IDs follow `<book-id>-p<PDF-page>-d<product-order>` after
  per-page deduplication. Changing product order requires updating its map.

All rectangles are `[x, y, width, height]`, normalized to the **entire source
page**, not an earlier crop. Keep complete tile edges and preserve printed
labels when included. A view defaults to the story's page; a verified room
on another page uses, for example:

```json
"room": {
  "pageNumber": 22,
  "rect": [0, 0, 1, 0.923],
  "label": "Room setting"
}
```

Those coordinates are relative to page 22. Pair rooms only when the source
identifies the same design. Omit a room view when none is supplied. The full
original page remains available independently of these display regions.

## Add or replace a catalogue

1. Check the original PDF's SHA-256 and page count, then register it. A hash
   mismatch deliberately stops generation: review the replacement's labels
   and layouts before updating hashes in the registry and curated files.
2. Visually review every page. Text extraction or OCR can assist transcription,
   but verify names and specifications against the page. Preserve manufacturer
   spelling; omit unprinted or uncertain specifications. Do not treat old crop
   IDs as PDF page numbers. Keep review contact sheets in `build-artifacts/`.
3. Prepare the corrections and gallery map. Review representative crops and
   every layout exception at a readable size; ensure product IDs and room
   pairings match the source.
4. Regenerate in the order below. Python needs `pypdfium2` and `Pillow`; Node
   dependencies come from the project's usual `npm install` workflow.

```sh
python scripts/build_catalogue_library.py --source-dir "C:/path/to/supplier-pdfs"
npm run build:catalogue-search
npm run build:catalogue-gallery
npm run build:catalogue-focus
npm run check:catalogues
npm run test:reader
npm run build
```

For a rebuild from committed originals, omit `--source-dir`. Missing source
files also fall back to `public/catalogues/<id>.pdf`. The renderer verifies
hashes and counts, caches unchanged pages, and generates uncropped preview,
detail and thumbnail WebPs without upscaling embedded scans beyond their
effective resolution. The focus generator maintains additional verified
individual-tile regions for SKY and Sunflora.

Commit the registry, curated inputs, original PDFs, derived page assets and
`src/data/catalogue*.generated.json` outputs together. Deployment consumes
these committed assets and does not require Python. Never hand-edit generated
manifests. To detect stale search, gallery or focus output without writing it:

```sh
npm run build:catalogue-search -- --check
npm run build:catalogue-gallery -- --check
npm run build:catalogue-focus -- --check
```

The catalogue check verifies original PDF integrity, page completeness and
uncropped image proportions; it does not replace visual review of labels,
complete tile boundaries and room associations. Preview the reader on desktop
and mobile, including search destinations, source pages and cross-page rooms.

## Printed details and prices

The original page is authoritative for specifications, random faces, dimensions,
finishes and other printed details beyond the search fields. Do not fabricate
missing metadata or alter source artwork to make it appear more current.
Simpolo prices belong to the supplied **2025 catalogue**. Preserve those printed
values and their year; they are historical catalogue prices, not a live quote.
Customers should confirm current price and availability with the showroom.
