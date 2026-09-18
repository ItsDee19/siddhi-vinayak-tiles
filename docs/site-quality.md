# Website delivery checks

Run `npm run build`, `npm run test:site`, `npm run test:reader` and
`npm run check:catalogues` before publishing.

The build regenerates small collection covers, a compact calculator index,
metadata, the privacy page, custom 404, robots.txt and sitemap.xml. It checks
the initial JavaScript/CSS budgets and published static links. The asset-pruning
plugin omits unused retired visualizer assets from the resolved output directory;
it keeps source files and every original catalogue PDF/page image. Do not replace
it with a broad deletion of `public/`.

The canonical origin is `https://sidhhibinayaktiles.com` in `src/data/seo.js`.
Catalogue query-string links share the home canonical. The sitemap lists real
indexable routes only. Static pages and metadata use `src/data/siteConfig.js`
for business facts. Update that source when showroom information changes.

Vercel serves `public/404.html` for unknown routes. Do not add a catch-all rewrite
to `/index.html`: it would hide broken links behind successful HTTP responses.
Local development and production preview emulate the same behavior. Check
`/privacy-policy`, `/robots.txt`, `/sitemap.xml`, `/social-preview.jpg` and one
unknown URL after deployment. Security and cache headers live in `vercel.json`;
`public/_headers` mirrors them for alternative static hosts.

Maps is optional and does not mount before valid saved consent. Preference
storage lasts 180 days and contains no enquiry data. Fonts are self-hosted with
their OFL licenses. No analytics or advertising scripts are installed.

Enquiries are browser-local WhatsApp drafts. Validation, a honeypot, a minimum
interaction time and a timestamp-only session cooldown add basic spam friction.
There is no form submission API or automatic message sending. If a server form
is introduced, add server validation, rate limits and bot verification there;
client-side checks alone must not be treated as server protection.

Verify on a phone-sized viewport: consent accept/reject/revoke, invalid-field
focus, draft edit/review, catalogue direct links, search, next/previous designs,
and privacy/404 recovery links. Never send a test enquiry to the showroom.
