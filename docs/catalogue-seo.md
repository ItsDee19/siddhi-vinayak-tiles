# Catalogue search and discovery

The public canonical origin is `https://sidhhibinayaktiles.com`, confirmed by the showroom owner. `SITE_URL` may override it only with a valid HTTPS origin. Preview and development deployments emit `noindex, follow`; an ephemeral Vercel hostname is never selected as canonical.

## What visitors and crawlers receive

- The homepage is rendered at build time from the same React components that hydrate in the browser. Primary content is present before JavaScript runs.
- `/catalogues/` lists the four original collections. `/catalogues/{id}/` and its numbered index pages provide ordinary links to each original catalogue page, the immersive viewer and the original PDF.
- Page indexes keep 12 source-page thumbnails together to keep an individual document index manageable. They are browsing aids, not invented individual product pages. Every index has its own canonical URL and title.
- Original PDFs are linked directly and included in the sitemap. Printed details remain on complete, uncropped page images. Extracted text appears only where the supplied document has text; missing extraction is not replaced with guessed specifications.
- The sitemap also contains the homepage, library, indexes and factual website policies. The custom 404 page is excluded and explicitly marked `noindex`.
- All indexable HTML receives a unique title, description, canonical URL, social metadata and safely serialized JSON-LD. Static catalogue and policy pages do not load the React application.
- The landscape social card uses the actual showroom emblem and a real Global catalogue room photograph. Its 1199 × 630 JPEG is captured from the 1200 × 630 browser layout without resampling; declared dimensions are checked against the output file.

## Business and document facts

`src/data/siteConfig.js` owns the showroom name, Nuapada address and phone. Structured data uses `HomeGoodsStore`, `WebSite`, `CollectionPage`, `DigitalDocument`, `MediaObject` and breadcrumbs as appropriate. It does not assert prices, inventory availability, ratings, geographical coordinates or verified opening hours. Manufacturer PDF artwork is not presented as artwork authored by the showroom.

The contact flow opens a WhatsApp draft; the customer must press Send in WhatsApp. The application cannot confirm delivery. There is no website order, payment, enquiry database or analytics integration. The old sample reviews and unverified social links are not published.

## Hosting and security

`vercel.json` redirects only the `www.sidhhibinayaktiles.com` host to the owner-confirmed HTTPS apex origin. It also forwards legacy `/catalogue/` paths to the new `/catalogues/` library. The apex origin and preview hosts do not match the host redirect. The domain must be attached to the Vercel project for that rule to apply.

No catch-all SPA rewrite is configured: Vercel serves the generated `404.html` with a 404 status for unmatched files, following its [static custom 404 guidance](https://vercel.com/kb/guide/custom-404-page). Vite's development preview is not evidence of production HTTP status handling.

Hashed bundle files use long-lived immutable caching. Stable catalogue/PDF/image paths require revalidation, so updates do not stay in a customer's browser for a year. Security headers in `public/_headers` match the Vercel policy. The application no longer needs external font origins, embedded maps, workers or blob script permissions.

JSON-LD is emitted only as a non-executable `application/ld+json` data block; [HTML script data blocks](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script) are not processed as browser scripts. All executable code is in same-origin JavaScript files, and the output checker rejects executable inline scripts or event handlers. The strict `script-src 'self'` policy is retained without a broad inline exception.

A fresh browser tab loaded a JSON-LD data block under the exact configured CSP with no console violations. No inline-script hash is required for this inert data. The social card was visually checked after its self-hosted fonts finished loading.

## SEO and generative search approach

The work follows [Google’s guidance for generative AI search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide): useful visible content, crawlable links, reliable business details and a clear technical structure. Google does not require an `llms.txt` file or special AI schema, and inclusion or ranking is not guaranteed.

The document indexes follow [Google’s pagination guidance](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading): each index has an ordinary discoverable URL and links to the other indexes. Business markup follows [Google’s local business documentation](https://developers.google.com/search/docs/appearance/structured-data/local-business), limited to facts actually supplied by the owner.

## Verification

Run `node --test src/data/seo.test.js` for canonical validation, safe escaping, document links, complete pagination coverage, truthful structured data, preview indexing and policy checks. After the production build, run `node scripts/check_built_seo.mjs` for all emitted HTML: unique titles, H1s, canonicals, JSON-LD parsing, local links and fragments, original PDF byte lengths and SHA-256 integrity, and sitemap coverage.

Browser review must also verify a direct catalogue/page link, Back and Forward navigation, original PDF access, a small viewport, keyboard controls and homepage hydration. These runtime checks complement the static checks.

After the production deployment is public, the owner can verify the domain in Search Console, submit `/sitemap.xml` and use URL Inspection to request indexing. Claim or verify the actual Google Business Profile and supply its exact link before adding reviews, a Maps business pin or profile identifiers. Those account actions cannot be inferred from a source-code change.
