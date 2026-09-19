---
version: alpha
name: "Sidhhi Binayak Tiles"
description: "A warm family showroom with a transparent glass catalogue viewing room."
colors:
  brand: "#C49A3C"
  background: "#2C1A0E"
  text: "#F5E6C8"
  reader-background: "#3A2B20"
  reader-panel: "rgb(58 43 32 / 38%)"
  reader-raised: "rgb(255 233 196 / 14%)"
  reader-text: "#FFF8EC"
  reader-muted: "#E8DDCB"
  reader-line: "rgb(255 235 204 / 26%)"
  reader-accent: "#EFD095"
  reader-error: "#FFBAB0"
  reader-glass: "rgb(58 43 32 / 24%)"
  reader-edge: "rgb(255 244 219 / 45%)"
  reader-shadow: "rgb(20 12 7 / 30%)"
  glass-surface: "rgb(58 43 32 / 38%)"
  glass-solid: "#493426"
  glass-border: "rgb(255 244 219 / 45%)"
  glass-ink: "#FFF8EC"
  glass-muted: "#E8DDCB"
  glass-accent: "#EFD095"
  glass-raised: "rgb(255 233 196 / 14%)"
  glass-warm-surface: "rgb(58 43 32 / 38%)"
  glass-warm-border: "rgb(255 244 219 / 27%)"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
  sans:
    fontFamily: "Manrope, Inter, system-ui, sans-serif"
  mono:
    fontFamily: "ui-monospace, monospace"
rounded:
  DEFAULT: "8px"
  card: "18px"
  reader: "32px"
  reader-control: "99px"
spacing:
  page-max: "1500px"
  section-gap: "3rem"
components:
  reader-control: {}
  collection-card: {}
  pdf-page: {}
  reader-dialog: {}
---

# Sidhhi Binayak Tiles Design System

## Overview

### Creative North Star

A material sample behind clear glass in a warm showroom: the complete tile
occupies the centre, while translucent instruments sit around it. The catalogue
section carries the showroom background through its collection cards and reader.
Warm reflections, fine bevels and restrained shadows define their edges without
turning the entire surface white. Glass belongs to the surrounding interface;
the tile itself remains sharp, flat and faithful to the supplier art.

### Product context and register

- Audience: showroom customers choosing tiles for homes in Nuapada, Odisha.
  Evidence: `src/data/siteConfig.js`, the existing About section and user brief.
- Language: English UI; supplier artwork retains its original language and labels.
- Usage: browsing on phones and inspecting finishes and codes on larger screens.
- Register: public brand site with one interactive content viewer. No admin or
  commerce workflows are introduced.
- Signature: actual catalogue photography leads into one large, complete design
  surrounded by glass controls. Its verified room setting and optional paired
  view are one action away; neither competes with the default tile view.
- Restraint: no rotating paper, simulated lighting or filters over tile artwork,
  cursor effects, auto-playing page turns or invented searchable specifications.
- Alternatives considered: a 3D flipbook obscures artwork during turns; a long
  scrolling PDF hides navigation. The viewing room keeps the design visible,
  makes transitions brief, and preserves original pages as an explicit reference
  mode with a visual page overview.
- Runtime ownership: Model B. `src/index.css` and `tailwind.config.js` own brand
  tokens; `src/styles/catalogue.css` owns `--reader-*`. The catalogue gallery and
  `pdf-page.css` consume those tokens. `src/styles/site-glass.css` owns `--glass-*`
  for the floating site navigation, shared buttons and warm showroom card edges.
  This document mirrors the accepted runtime values; it does not generate a
  second theme.

## Colors

The showroom retains brown, cream and gold throughout. The catalogue section is
transparent over that background, with bounded amber and muted green light
gradients beneath its glass. Ivory labels, pale gold selection and warm translucent
fills preserve contrast. Light rim highlights define the surface; they do not
become white panel fills. The accent marks controls and the section invitation,
never the tile image. Error copy uses `--reader-error` with explanatory text.
Forced colours preserve outlines and selected states.

The `colors.reader-*` entries map to like-named `--reader-*` variables, except
`reader-background`, which maps to `--reader-bg`. Glass and edge values define
control surfaces; shadow defines their quiet separation from the stage. The
reader remains over the bounded warm showroom backdrop. `reader-background`
is its opaque fallback, not a full-opacity layer in the normal supported view.
Translucency must not be the only way to distinguish a selected control, nor
compromise label contrast. Labels that float over photographs or white publisher
pages need stronger local dimming than labels over the known showroom background.

The `colors.glass-*` entries map directly to `--glass-*` in `site-glass.css`.
The floating navigation uses the warm surface, ivory ink and directional border
roles; its opaque fallback uses `glass-solid`. The warm surface and border roles
also preserve the showroom behind surrounding product, About and Contact cards.
These site roles remain separate from reader roles because fixed navigation can
cross unpredictable content. Both navigation and reader use `color-scheme: dark`
so native fields and select popups remain consistent with their surroundings.
The navigation logo tagline uses `#FFEDCF` for legibility over bright content;
the gold primary action retains its established dark text.

## Typography

Fonts are self-hosted WOFF2 subsets with `font-display: swap`; keep the supplied
OFL licenses with the assets. No third-party font connection is needed. Privacy
and 404 documents use the same fonts and derive their palette from runtime CSS.

Playfair Display carries the section invitation, design name and optional detail
panel. The compact design title tops out at 24px; Manrope carries specifications,
collection names and controls. Page numbers use tabular figures and a monospace
input. Full text stays available in labels and supplier pages.

## Layout

The collection shelf is capped at 1500px; the reader uses the available screen
width with small responsive margins. Fourteen collection cards form a horizontal snap-scrolling shelf at every
screen size, with visible arrows and a scrollbar. An always-available collection
selector also switches books directly, including in full screen. This avoids a
tall catalogue section as suppliers are added. The design gallery fits the available viewport without vertical image
scrolling. Full design is the default at every size, using the entire art stage.
The title, specifications and view modes form a compact header; variant buttons
sit close to the artwork, and the navigation dock is a slim lower edge. Find a product opens search on demand,
returning that space to the artwork during viewing. In a room opens the verified
installation; side by side remains an optional desktop view.
All views contain their verified source regions at the original aspect ratio.
Where individually verified samples are available, a variant selector displays
one complete tile from its coordinated set at a time. Original page retains the
full publisher board. Narrow slabs and wide borders naturally leave free space
on the opposite axis: never stretch or clip a design simply to fill the stage.
Where the supplier has no room photograph, a reviewed AI room preview may be
matched to the exact product. It must use the catalogue tile as its reference,
neutral illumination, believable tile proportions and unobstructed material.
The room carries a visible "AI room preview · Illustrative setting" caption;
details clarify that colour, finish and scale should be confirmed with a sample.
Publisher photography takes priority. An ambiguous multi-product board requires
an explicit product choice; never borrow a sibling's generated room. Image,
product, caption and provenance switch together only after decoding completes.
Generated rooms load only on request, as versioned WebP previews and native-size
detail images. Their source crop, prompt and visual review are kept in
`scripts/catalogue-room-sources.json`, separate from the small runtime manifest.
When neither a matched publisher photo nor a reviewed generated room exists,
the complete design stands alone and the room control is unavailable. Original page opens a separate
reference mode with whole-page and Fit width sizing; only that reference canvas
owns page scrolling. Page overview, search and details replace the canvas without
extending the reader's height.
Full screen uses a native dialog with a flexible paper area, a fixed control
dock and safe-area padding. Other website sections retain document scrolling.

## Elevation & Depth

Depth comes from transparent warm surfaces, directional reflections, fine curved
rims and soft brown shadows. `--reader-reflection` uses a 135-degree warm-light
gradient with 12%, 2%, 1% and 7% alpha stops. `--reader-bevel` combines a 35%
upper highlight, a 12% side highlight and a 24% lower shadow. A masked one-pixel
reader rim adds direction without covering the content; ordinary borders remain
when masking is unsupported. State changes lift or illuminate the existing
surface rather than adding another opaque panel.

Backdrop blur is progressive enhancement. The reader shell uses 18px blur and
1.15 saturation; controls use 16px and 1.25. Site navigation consumes
`--glass-blur: 22px` and `--glass-shadow`, whose outer shadow is
`0 14px 40px rgb(27 13 5 / 18%)`, with warm 52% upper and 10% lower inset edges.
The navigation backdrop additionally uses 1.3 saturation and 0.45 brightness,
so bright pages passing underneath do not erase its ivory labels. Image-overlay
badges and loading messages use a 65% warm fill with 16px backdrop blur and 0.6
brightness; without backdrop support, their warm fill becomes opaque. Full-screen
uses a 42% brown scrim with 24px backdrop blur and 0.45 brightness. These effects
process the backdrop behind the interface, not the displayed tile pixels.
Use opaque warm fallbacks when blur is unavailable or reduced transparency is
requested. Increased contrast simplifies reader and navigation surfaces and
preserves visible control boundaries. Keep blur steady during interaction.

Do not apply image filters, tint, opacity or refraction to the tile art itself.
Backdrop effects belong behind it and to control surfaces. Publisher-white paper,
white tiles and white room details stay white; `.pdf-sheet` retains a white paper
base in the original-page view. Room-card cover photos may scale slightly on
hover. Gallery regions preserve the complete tile, design board or product;
the original page retains the full publisher artwork and its printed colours.

## Shapes

Reader controls use 99px capsule radii, collection cards 18px, and the desktop
viewing room 32px. Compact phone and full-screen geometry can reduce the outer
radius to preserve useful space. These are catalogue variants; the site's glass
navigation and controls carry the same softly rounded direction. Directional
page arrows are circular for recognition.

## Components

### Foundational visual states

Every action has hover, pressed, disabled and focus-visible states. Loading keeps
the last decoded page with explicit text identifying it until the requested page
arrives. Failed loads offer retry and the original PDF. No skeleton is required.

### Buttons and actions

`ReaderIcon` owns stroke icons. `CatalogueLibrary` owns design/page/collection
state, the dock, page overview, details and sharing. `CatalogueGallery` owns the
viewport-fitted design and room sequence; `PdfPage` owns original-page reference
viewing. Both keep decoded imagery during loading and prefetch adjacent images.
Buttons accompany every gesture.
The pale gold enquiry action is confined to the details panel.

### Navigation and data display

Collection changes create browser-history entries; design/page turns replace the
current entry. URL parameters identify the exact catalogue, design, selected
product variant and PDF page. Overview images are lazy-loaded and preserve
full-page proportions. Find a product opens a labelled search field and results
panel with collapsible collection, size and finish filters, so matches
remain immediately visible on small phones. Selecting a result opens that
product's gallery story and its individual sample when a verified region exists.
Coordinated variants remain connected through the variant selector and complete
original page. Results load in batches of 24 and use verified design previews.

Most supplier PDFs are image-only; a minority include a text layer. Search
uses a separately maintained, visually verified index of names, codes and specifications checked against the printed artwork;
uncertain metadata is omitted. The search panel explains its indexed coverage
and always offers the complete page browser. Source corrections and explicit
PDF page mappings accompany the generated index; image IDs are not page numbers.

### Forms and overlays

Page entry uses explicit local validation and supports Enter or the Go button.
Full screen reuses `ReaderDialog` (native `showModal`, inert background, Escape,
scroll lock and caller focus restoration). Its collection selector intentionally
uses the platform-native popup, as do reference-page sizing and search filters.
Variant selection uses labelled buttons with explicit pressed states. Search uses a
labelled search form, clear/reset actions, a live result count and a helpful
empty state. Page details, search and overview are non-modal canvas views, with
Back actions, Escape handling and caller focus restoration. Closing search
returns focus to Find a product. Copy feedback is local to the details panel;
clipboard failure reveals a selectable URL.

### Iconography

20px stroke icons, generally 1.6px stroke. Non-obvious actions retain text labels.
Zoom and arrows use accessible names and conventional symbols.

### Motion

Control feedback takes 150–250ms. Decoded gallery changes use a brief crossfade
with a small directional translation; glass controls respond through highlights
and subtle pressed depth. Images decode before the transition starts, and
prefetch is limited to adjacent designs/pages. Navigation is user controlled;
there is no auto-play or continuous decorative motion. Reduced-motion preferences
remove transitions and movement while keeping every control usable. Prefer
transform and opacity animation; do not animate blur or distort material art.

### Content and data visualization

Original PDFs are the authority for printed codes, names, dimensions and finishes.
Keep exact design, selected variant and original-page references in links and
WhatsApp drafts.
Gallery regions are manually verified against the original catalogue artwork.
Keep complete tile patterns and preserve access to coordinated sets. Individual
focus samples use explicitly verified regions and exact product identifiers;
never infer a sample from an arbitrary crop. Associate a room only when the
pictured design matches. Some matched rooms are on another PDF page: each view
retains its own source page and geometry, and both views decode before a paired
transition. Sanitaryware uses complete product cards with its printed details;
prices in the supplied 2025 catalogue are historical publisher content, never
presented as live store prices. Never stretch source regions, alter their colours,
generate substitute tiles or infer specifications. The original full page remains
available for reference. Source resolution limits zoom.

## Do's and Don'ts

### Privacy, enquiries and utility pages

The consent banner is a nonmodal warm-glass region with equal-size, equal-style
Essential only and Allow Google Maps controls. Do not steal focus on first visit.
Reopening preferences from the footer moves focus into the banner and returns it
after a choice. The 180-day browser preference controls the Maps iframe; rejected,
expired, unreadable or unsavable consent keeps it off. No analytics are installed.
The banner uses existing `--glass-*` roles, a steady 22px blur and a darker local
backdrop for readable text; it introduces no competing theme.

Enquiry labels identify required fields and associate errors with their fields.
Focus the first invalid field. A valid enquiry creates a local, editable draft;
only the explicit Review in WhatsApp link shares it with WhatsApp. Never claim
that preparing or opening a draft sent a message. The category select is native.
Honeypot, timing and session cooldown provide basic client-side friction; there
is no server submission endpoint. Never render sample testimonials as reviews.

Privacy and missing-page documents use the established warm glass, readable
measure, keyboard skip links and clear return paths. They load without the
catalogue application. A missing route must retain its actual HTTP 404 status.

### Loading and performance

Only the catalogue and calculator defer their code until near the viewport or
requested through a section link. Keep stable observation wrappers so contact
bubbles remain suppressed over the viewer. Small business/contact sections
remain available immediately for direct anchor links. A failed section import
offers an explicit reload action. Shelf covers use 640px WebP derivatives;
gallery detail images and original PDFs remain unchanged and load on demand.
Retired assets are excluded from build output only, never deleted from sources.
Save Data, slow connections, weak devices and reduced motion use static hero art;
known off-screen decorative canvases remain paused.

- Do give artwork the largest uninterrupted area.
- Do keep keyboard, touch, mouse and visible controls equivalent.
- Do use the shared reader tokens for feedback and scrollbars.
- Do apply glass to the controls while keeping the material unobscured.
- Don't clip complete designs, pair unrelated room images or crop artwork merely
  to fill the viewing area.
- Don't fetch all full-resolution pages or download a PDF before viewing.
- Don't let site contact bubbles cover viewer controls.

The transparent warm catalogue intentionally replaces the rejected white panels.
The user's requested glass treatment is expressed through translucency, edges
and reflections, with compact controls and individual design focus preserving
large tiles. The site's brown and gold identity remains visible through the
interface. Preserved white supplier artwork is content, not a white UI surface.
