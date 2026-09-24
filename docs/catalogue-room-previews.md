# Catalogue room previews

The tile release fills all 153 missing tile-product room views across 145 catalogue stories. The sanitaryware pass is now complete: all 331 audited products have a room view, using 301 AI preview mappings and 30 verified supplier photographs. Existing supplier artwork, the earlier tile previews and all original PDFs remain unchanged.

## Completed sanitaryware coverage

| Collection | AI previews | Recovered supplier photos | Covered products |
| --- | ---: | ---: | ---: |
| Simpolo | 255 | 17 | 272 |
| Global Wall sanitaryware | 46 | 13 | 59 |
| Total | 301 | 30 | 331 |

Products with the same name but different colours, moulded finishes, sizes or pedestal assemblies keep separate references. Four repeated listings reuse an image only after a visual match of the same product and finish. Concealed hardware and small fittings use a bathroom preparation setting so their actual parts remain visible; these scenes are not installation instructions or compatibility claims.

## Earlier tile coverage

| Collection | Product previews |
| --- | ---: |
| Global Floor | 6 |
| Global Wall tiles | 68 |
| Lactose | 10 |
| Wood Planks | 20 |
| Seron Glossy | 6 |
| Seron Iconic Pro | 12 |
| Skype | 7 |
| Sunflora | 24 |
| Total | 153 |

Scenes were created with built-in image generation from individual catalogue product references and visually reviewed for silhouette, finish, pattern, mounting and visible openings. Neutral illumination and complete, unobstructed products were requested. They remain illustrative: the gallery labels them “AI room preview · Illustrative setting”, and details direct customers to confirm colour, finish and scale with a physical sample.

## Source record and delivery

- [scripts/catalogue-room-sources.json](../scripts/catalogue-room-sources.json) contains all 454 AI preview mappings, final prompts, review notes, product IDs, PDF hashes, source pages and reference crop rectangles. New remote references include the exact published source URL and in-memory delivery method.
- [scripts/catalogue-publisher-room-sources.json](../scripts/catalogue-publisher-room-sources.json) records the 30 supplier recoveries with exact product matches, original room pages, crop rectangles and match evidence.
- [docs/sanitaryware-room-coverage.json](sanitaryware-room-coverage.json) lists all 331 audited products, their source page and final room provenance; there are no missing products.
- public/catalogue-rooms/ contains 908 content-versioned WebPs totaling 155.7 MiB: a 1200 × 800 preview and native 1536 × 1024 detail image per mapping. Room images load on demand and use immutable cache headers; they are not requested on initial home-page or product-view load.
- src/data/catalogueRooms.generated.json contains the runtime lookups only. Run npm run check:catalogue-rooms to validate source associations, assets, dimensions, size limits and generated metadata. The production prebuild regenerates this file from reviewed source records.

## Display guarantees

Original story room photographs take priority, followed by verified exact-product supplier recoveries and then generated previews. A product never borrows an unrelated sibling image. Multi-product pages expose a product selector when an individual choice is needed. Images, labels and crops change together after decoding, preventing stale imagery during quick navigation. Original-page links retain the product listing; a failed cross-page supplier room links to its actual PDF room page.

## Release verification

Coverage verification matches all 331 sanitaryware IDs exactly (301 AI + 30 supplier) and confirms the 153 earlier tile source records and all previously published image mappings remain unchanged. Reader checks pass (57 tests), site checks pass (13 tests), and integrity checks confirm all 14 PDFs, 601 complete pages and 1,803 catalogue page images. The production build and performance budgets pass.

Eight focused desktop/mobile browser cases checked generated and supplier previews: full-image fitting, correct source and label, no eager AI image requests, desktop comparison mode, and no runtime errors or horizontal overflow. The approved gallery styling is unchanged.
