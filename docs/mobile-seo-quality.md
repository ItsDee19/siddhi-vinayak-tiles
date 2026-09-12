# Mobile browsing, SEO and search discovery

Scope: the showroom website on `feat/3d-visualizer-realism`. This change shortens
the default mobile browsing experience and makes the same business information
and catalogue accessible to search crawlers. The five approved 3D rooms and the
existing brown, cream and gold identity remain the product context.

## Mobile browsing

The “What We Offer” section uses compact category rows on phones. All five
categories retain their descriptions and destinations: tiles and sanitaryware
open the online collection; marble, granite and quartz lead to an enquiry.

The interactive catalogue shows six products per phone page and 24 on wider
screens. Previous/next controls replace an ever-growing product grid. Search
stays available while advanced filters can be collapsed. Product details and
eligible 3D previews use the existing dialog and selection bridge. A visible
"Browse all catalogue pages" link provides a second route through the collection.

Additional mobile spacing changes reduce repeated padding in the supporting
sections. Brief showroom questions use native disclosures so readers can open
the information they need without a long block of text. Their answers remain
part of the document.

## HTML and metadata

`npm run build` first runs Vite and then `scripts/build_seo.mjs`. The latter uses
Vite’s server module loader and `src/entry-server.jsx` to render the actual React
App. It waits for lazy marketing sections before writing the document. It does
not launch a browser, choose content by user agent or create a separate hidden
SEO version of the page.

The built homepage contains its heading, category information, initial catalogue
records, About and Contact content before JavaScript runs. `src/main.jsx`
hydrates the marked document; local development still mounts an empty root.
The 3D room itself remains deferred until needed. Reveal content starts visible
so the initial HTML is readable without animation or JavaScript.

`src/data/seo.js` owns title/description generation, social metadata, structured
business data, canonical URL resolution, crawler files and static catalogue
markup. The homepage has a visible H1 naming the surfaces and Nuapada. Social
cards use the existing 377 × 377 px showroom emblem, with explicit image
dimensions and descriptive alternative text.

JSON-LD is a non-executable data script. The existing Content Security Policy
has not been weakened and no inline executable script is needed for the static
catalogue.

## Crawlable catalogue

The build generates ordinary HTML at `/catalogue/`, `/catalogue/page/2/` and
successive page URLs. Each page contains at most 24 products, a range/count,
real previous/next links and numbered page links. The current 557 records occupy
24 pages. Every source record appears once in this page graph.

Product names, IDs, photographs, sizes, finishes and surfaces come from
`src/data/catalogue.js`. No prices or stock offers are invented. A missing
photograph is labelled rather than replaced with a purported product photo.
Source values are escaped before HTML generation.

Product links use `/?product=ID#catalogue`, which the interactive catalogue
opens in its existing detail dialog. The static listing itself works without
JavaScript and shares the site’s generated CSS, fonts, emblem and contact
details. It does not download the Three.js application. These are browse pages;
the site does not claim separate indexed product-detail URLs.

## Production origin and preview indexing

The owner-confirmed public production origin is **https://sidhhibinayaktiles.com**.
The build now uses it by default. An explicit **SITE_URL** environment variable
can override this when the owner changes the preferred domain; configure it as
an HTTPS origin in Vercel and rebuild. Use the production identity for preview
builds too.

Neither `VERCEL_PROJECT_PRODUCTION_URL` nor the per-deployment `VERCEL_URL`
overrides the confirmed domain. Values in `SITE_URL` with
credentials, non-HTTPS protocols, paths, query strings, fragments, non-default
ports or local hosts are rejected.

The build generates absolute canonical/social URLs and a sitemap containing the
homepage, real static catalogue pages, `/privacy-policy/` and
`/terms-and-conditions/`. Hash destinations, product-filter URLs and the branded
`404.html` are not sitemap entries. No synthetic freshness dates are added.

Builds with `VERCEL_ENV=preview` or `development` emit `noindex, follow` metadata.
Their robots.txt allows crawling so crawlers can read that directive, and does
not advertise a sitemap. Production builds allow indexing and advertise the
sitemap. The error document always uses `noindex, follow` and has no canonical.
The wildcard crawl permission includes
ordinary search crawlers and OAI-SearchBot; no separate training-policy change
is required. Authentication-protected previews are not evidence of public
indexability.

## Business facts and deliberate omissions

The `HomeGoodsStore`, `WebSite` and page JSON-LD reuse `siteConfig.js`:

- Published name: **Sidhhi Binayak Tiles**.
- Address: Ward No. 03, Gayatri Mandir Chowk, Patora Road, Motanuapada, Nuapada,
  Odisha 766105, India.
- Telephone: **+916371255411**.
- The existing showroom introduction and product scope.

The schema does not invent geographic coordinates, reviews, ratings, price
offers, stock availability, social profiles or a verified Google Business
location. Opening hours and experience/customer statistics are not expanded
into structured claims; the earlier website audit still records them for owner
confirmation. The displayed map action remains an address lookup.

The visible showroom answers explain this website’s actual browsing, preview
and enquiry process. They are not marked up as a promised FAQ rich result.
Google retired FAQ rich results in May 2026. No `llms.txt` file or special
“AI schema” is added: those are not required for Google’s AI search features.

## Verification

Run:

```text
npm run test:ui
npm run test:seo
npm run test:visualizer
npm run build
node scripts/check_built_seo.mjs
```

The SEO unit tests cover production-origin validation, preview behavior,
metadata/JSON-LD escaping, factual schema fields, pagination coverage and crawler
file generation. The built-output check reads raw HTML, verifies the homepage’s
primary content and H1, walks all static catalogue and policy pages, confirms
their links and unique titles, parses structured data and checks every referenced
responsive image candidate and CSS file. It also checks that the error document
is noindex and excluded from the sitemap.

Use `npm run preview` to check the **built** homepage’s hydration and static
catalogue pages. A successful development-server check alone does not verify
the prerendered production document. Browser checks should include narrow
screens, page changes, filter collapse, the direct product link, keyboard focus,
the visualizer handoff, and console errors.

The implementation checks passed with 10 SEO unit tests and a production build
covering 24 static catalogue pages and 557 unique products. The existing large
Three.js bundle warning remains; these checks do not establish real-device
frame rates or Core Web Vitals scores.

## Search measurement and remaining owner setup

These changes make content available and easier to understand; they do not
guarantee ranking positions, indexing, traffic or AI answer citations. Once the
preferred public domain serves the updated production site, the owner can
verify it in Google Search Console and Bing Webmaster Tools, submit the sitemap
and inspect rendered URLs. Public access, real business-profile details and
ongoing product-data accuracy remain necessary. Search results and AI citations
should be measured after crawlers revisit the site.

## Primary guidance checked

- [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics):
  prerendering and crawlable documents.
- [Google mobile-first indexing](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing):
  responsive layouts and equivalent primary content.
- [Google catalogue pagination](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading):
  stable, linked pages instead of relying on a crawler to click buttons.
- [Google AI search guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide):
  useful content, accessibility to crawlers and the absence of special AI-file
  requirements.
- [Local business structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business)
  and [structured-data rules](https://developers.google.com/search/docs/appearance/structured-data/sd-policies):
  factual markup that represents the visible website.
- [Google Search documentation updates](https://developers.google.com/search/updates):
  May/June 2026 FAQ rich-result retirement and clarification about `llms.txt`.
- [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots):
  OAI-SearchBot supports ChatGPT Search; GPTBot is an independent control.
- [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a):
  discovery, crawlability and accurate structured data.

## Measured browser review

Measured at 390 × 844 CSS pixels with the default category and closed filters:

| Content | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Whole homepage | 22,970 px | 10,511 px | 54% |
| What We Offer | 2,167 px | 1,238 px | 43% |
| Catalogue | 11,765 px | 1,448 px | 88% |

These are page-height measurements, not loading-speed or ranking scores.
Opening filters or showroom disclosures intentionally reveals more content.

The final production build hydrated without browser errors at desktop and phone
widths. At 320 px the category controls fit on one row with 44 px hit areas,
search uses 16 px text, six cards occupy two columns, and there is no horizontal
page overflow. Contact overlays do not cover mobile catalogue choices.

Browser checks confirmed search across the catalogue (including Lavish basins),
filter reset, empty results, filter disclosure and result focus, page navigation,
desktop-to-phone-to-desktop page resets, and full product dialogs. An actual
static product link opened Sky 12x18 Concept #71; its View in 3D action selected
that tile and focused the visualizer. A static catalogue page loaded with only
non-executable JSON-LD, working photographs and page links.

Verification: 9 UI tests, 10 SEO tests, 59 visualizer tests, the normal production
build, and the raw HTML/catalogue graph check passed. The strict frontend audit
reported zero findings. A React 18 hydration defect found during integration was
fixed by moving catalogue page-state reconciliation out of rendering and into
an effect, while retaining synchronous displayed page resets. Lazy sections use
independent Suspense boundaries. A fresh production browser check confirmed the
correction.
