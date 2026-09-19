# Catalogue room previews

The tile-first release fills the 153 missing tile-product room views across 145 catalogue stories. Sanitaryware is outside this pass. Existing supplier room photos and the original PDF artwork remain authoritative and unchanged.

| Collection | Added product previews |
| --- | ---: |
| Global Floor | 6 |
| Global Wall | 68 |
| Lactose | 10 |
| Wood Planks | 20 |
| Seron Glossy | 6 |
| Seron Iconic Pro | 12 |
| Skype | 7 |
| Sunflora | 24 |
| Total | 153 |

Each scene was generated with built-in image generation using the individual product's catalogue crop, then visually reviewed. Neutral illumination, appropriate installation scale and unobstructed tile surfaces were requested. Scenes are illustrative: the gallery visibly labels them “AI room preview · Illustrative setting”, and details direct customers to confirm colour, finish and scale with a physical sample.

## Source record and delivery

- `scripts/catalogue-room-sources.json` retains the final prompts, review notes, product IDs, original PDF hashes, page numbers and reference crop rectangles.
- `public/catalogue-rooms/` contains content-versioned WebP assets: a 1200 × 800 preview and a native 1536 × 1024 detail image per product. The 306 files total 63.87 MiB; they load on demand when a room view is requested, not on the home page.
- `src/data/catalogueRooms.generated.json` contains only the small runtime lookup. Run `npm run check:catalogue-rooms` to validate source associations, assets, dimensions, size limits and generated metadata.
- The production prebuild regenerates the lookup from the reviewed source record. `scripts/prepare_catalogue_room.mjs` imports a reviewed generation into a working ledger; promotion into the source record requires visual review and the exact product reference.

## Display guarantees

Supplier room photos take priority. Generated images match an exact product ID and never fall back to a sibling design. Multi-product pages require an explicit selection where the source cannot identify a single product. Image, label and crop are committed together after image decoding so rapid navigation cannot attach a previous product's room to the new selection. Original PDF links continue to use the original catalogue page.

## Release verification

The audit inventory and approved source record match exactly: 153 unique products, no missing or extra entries. Reader and site checks pass (64 tests), and all 14 original PDF hashes and catalogue page proportions remain valid. Desktop/mobile checks covered complete-image fitting, side-by-side comparison, product-code search, exact variant switching and original-page access.
