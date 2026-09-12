# Website information pages and launch checks

Updated 12 September 2026. This supplements the original mobile/SEO implementation
notes; it describes the current website code, without asserting legal compliance
or creating unconfirmed showroom sales policies.

## Pages and crawl behavior

`src/data/policyPages.js` contains the factual website privacy and terms copy.
`scripts/build_seo.mjs` emits ordinary, styled HTML at `/privacy-policy/` and
`/terms-and-conditions/`. Each has a unique heading, description and canonical
URL, `WebPage` structured data, showroom contact information, and navigation back
to the catalogue and homepage. These pages and the catalogue share reciprocal
policy links. No application JavaScript is required to read them.

The build also emits a branded `dist/404.html` with recovery links. It always has
`noindex, follow`, no canonical or page JSON-LD, and no sitemap entry. Per
[Vercel's custom 404 guidance](https://vercel.com/kb/guide/custom-404-page), an
output-root `404.html` is served for unmatched static paths. Keep filesystem
routing; a catch-all rewrite to the homepage would turn missing addresses into
successful homepage responses. Vercel's
[SPA routing explanation](https://vercel.com/kb/guide/why-is-my-deployed-project-giving-404)
confirms that this rewrite is opt-in. Verify the HTTP status of a nonexistent
path on the deployed site. Vite's local preview behavior alone does not prove
the platform's deployed 404 routing.

The default canonical origin is the owner's confirmed
`https://sidhhibinayaktiles.com`. An explicitly configured `SITE_URL` overrides
that default and must pass HTTPS-origin validation. Deployment-specific Vercel
hostnames do not replace it. All preview/development builds identified by
`VERCEL_ENV` emit noindex metadata and omit sitemap discovery from robots.txt;
the sitemap itself still contains production URLs. The production sitemap now
has 27 entries: homepage, 24 catalogue pages and two policy pages.

## What the privacy page describes

- The contact form prepares an encoded WhatsApp link in the browser. Opening
  that link passes draft text to WhatsApp; the showroom receives a message only
  when the visitor chooses Send. This website has no enquiry database endpoint
  and cannot confirm delivery.
- A selected tile photograph is used locally through a browser object URL.
  Saving a room downloads an image. Sending either image to the showroom is a
  separate visitor action.
- Dismissing the privacy notice stores only an acknowledgement preference in
  localStorage (`sbt-privacy-notice-v1`). Clearing the site's browser data removes
  it. The notice is informational and does not switch on tracking.
- The application has no advertising or visitor-analytics scripts/cookies.
  Fonts and product images are self-hosted. The privacy page cautiously explains
  that hosting/security providers may process technical request information;
  it makes no fixed retention promise.
- WhatsApp and Maps are external services opened by the visitor. The Maps link
  looks up the published address; it is not described as a verified place pin.

Provider references are linked directly in the policy:
[WhatsApp Privacy Policy](https://www.whatsapp.com/legal/privacy-policy),
[Vercel Privacy Notice](https://vercel.com/legal/privacy-notice), and
[Google Privacy Policy](https://policies.google.com/privacy). They describe those
providers' practices, not a guarantee about all processing by the showroom.

## Scope of the website terms

The terms explain browsing, the illustrative nature of room previews, choosing
photographs the visitor has permission to use, WhatsApp drafts and external
services. There is no online checkout or payment flow. A selection or enquiry
does not place an order or reserve stock.

The page directs customers to confirm product specifications, quantity, current
prices and availability with the showroom. It does not invent delivery,
cancellation, returns, refund or warranty conditions, contractual waivers,
retention periods or an email address. It directs customers to discuss actual
sale arrangements with the showroom. The public name, address and phone reuse
`siteConfig.js`; ratings, coordinates, operating hours and offers are not added
to schema without verified source facts.

Keep these pages accurate if the business later adds payments, an enquiry
backend, analytics, embedded third-party content or additional browser storage.
Any future sales terms need to reflect the showroom's actual arrangements.

## Verification and owner follow-through

Run `npm run test:seo`, `npm run build`, and `npm run check:build`. The scoped
SEO suite currently has 14 passing tests. It covers the confirmed-domain
default, invalid URL rejection, preview noindex, escaping, factual schema,
catalogue coverage, policy navigation/metadata, 404 recovery metadata and
responsive catalogue markup. The built-output check verifies every local
`srcset` candidate exists in `dist`, all catalogue products occur once, policy
pages contain their contact/navigation links, and sitemap exclusions hold.

After deployment, confirm the public apex hostname, the `www` redirect,
policy URLs, an unknown URL's HTTP404 status, and preview noindex. Search Console
and Bing Webmaster Tools verification/submission remain owner-account actions;
no search ownership token is fabricated. These changes make information
available to crawlers and visitors, with no promise of indexing, ranking or AI
answer citations. The earlier mobile document retains its original measured
browser review; new launch checks should be recorded separately.
