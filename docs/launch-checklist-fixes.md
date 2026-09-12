# Launch checklist fixes — 12 September 2026

Scope: resolve the audited gaps. Analytics (18) remains excluded; the earlier
exclusions for mobile friendliness (8), image alt text (19) and CTA strategy (20)
remain outside this checklist. Existing responsive behaviour was regression-checked.

| Item | Result |
| --- | --- |
| 1. Privacy | `/privacy-policy/` explains actual enquiry, upload, hosting and local-preference flows. |
| 2. Images | 554 original photographs retain their native files; 1,370 smaller WebP candidates serve catalogue and detail views with responsive sizing. |
| 3. Terms | `/terms-and-conditions/` covers catalogue use, approximate previews and enquiries; no invented sale or warranty arrangements. |
| 4. Load speed | Removed decorative WebGL startup and accidental Three preloading; compressed static import graph shrank about 73%. Build enforces a 150 KiB gzip budget for that graph. |
| 5. Frontend secrets | Environment files are ignored; a build scan rejects common credential signatures and accidentally published `.env` files. No credentials were detected in the scanned output. |
| 6. Contrast | Opaque sand labels, gold-light badge text and readable errors replace faded small text. |
| 7. HTTPS | Live apex HTTP 308 → HTTPS 200 and HSTS verified before release. Configuration preserves HTTPS and redirects `www` to the confirmed apex domain. |
| 9. Cookies | Truthful, dismissible privacy notice; its acknowledgement is the only application persistence. Fonts now load locally. No advertising/analytics cookies or scripts added. |
| 10. 404 | Static branded 404, noindex and no canonical, with home/catalogue recovery links; local preview also returns HTTP 404. |
| 11. Metadata | Unique titles/descriptions retained; new pages included. |
| 12. Links | Generated page links, product IDs and image candidates checked. WhatsApp redirects correctly and the address lookup responds 200; no message sent. |
| 13. Social preview | Absolute OG/Twitter emblem, title and description use the confirmed domain. |
| 14. Validation | Invalid enquiry submission still focuses the first error. Copy accurately explains when information passes to WhatsApp. |
| 15. Favicon | Existing valid favicon assets retained. |
| 16. Spam | There is no website enquiry ingestion endpoint. Visitors review and send drafts in WhatsApp; a website CAPTCHA would not protect the public phone number. Do not treat a future direct submission endpoint as protected by client validation. |
| 17. Discovery | Owner-confirmed default origin, robots and 27-URL sitemap: home, 24 catalogue pages and 2 policy pages. Preview builds remain noindex. |

## Verification

- 87 scoped tests passed: 9 UI/navigation, 59 room/material, 14 SEO and 5 image checks.
- Full production build, generated SEO/assets check and frontend credential-signature check passed.
- Strict interface source audit reported 0 findings.
- Desktop browser: responsive photograph selection, product modal, room rendering,
  policy navigation, form errors/focus and no application console errors.
- Phone 390×844: policy/404 readability, no horizontal overflow, privacy-notice
  dismissal, reserved spacing and persistence on reload.
- Local HTTP checks: homepage, policy pages, catalogue pages, sitemap and robots
  returned 200; unknown page and asset paths returned 404.
- Rendered contrast checks: footer 7.48:1, category count 5.54:1, gold badge 4.78:1,
  neutral badge 4.79:1. The scan skips image/gradient backgrounds, which were viewed
  separately; it is not a claim of exhaustive accessibility certification.

Photo comparisons are file-byte sums, not measured page transfers. First six
phone photographs at 390px/DPR2: 604,960 → 194,074 bytes (68% reduction). First 24
desktop photographs at 1440px/DPR1: 2,320,668 → 672,710 bytes (71% reduction).
See `initial-load-performance.md` for both static and total startup JS accounting.

Five live homepage HTML requests before release returned 200 with TTFB 112–183ms
and total response 126–197 ms from the test connection. These are HTTP response
timings, not complete browser load measurements. Google's public PageSpeed API
returned 429; no Lighthouse score or Core Web Vitals result is claimed.

The privacy and website-use terms are factual implementation descriptions, not a
claim of legal certification. Maintain them whenever data handling changes.

References: [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
[Vercel static 404 behaviour](https://vercel.com/kb/guide/custom-404-page).
