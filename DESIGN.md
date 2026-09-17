---
version: alpha
name: Sidhhi Binayak Tiles
description: A showroom website centred on faithful, large-format catalogue reading.
colors:
  charcoal: '#2C1A0E'
  surface: '#3D2512'
  cream: '#F5E6C8'
  sand: '#C9A97A'
  gold: '#C49A3C'
  reader: '#171916'
typography:
  display:
    fontFamily: 'Playfair Display, Georgia, serif'
  sans:
    fontFamily: 'Manrope, system-ui, sans-serif'
  mono:
    fontFamily: 'ui-monospace, monospace'
rounded:
  card: 4px
  button: 2px
spacing:
  control-min: 44px
  page-max: 1600px
components:
  CatalogueLibrary: {}
  PdfPage: {}
  ReaderDialog: {}
---

## Direction and source of truth

The current brief replaces the visualizer with four owner-supplied PDF catalogues. A warm editorial showroom leads into a neutral, functional reading space. The PDFs are the authority for products; old OCR placeholders must not become tile names or specifications. All 257 original pages remain intact, including covers, printed labels and packing tables. No invented prices, availability, reviews or technical details.

## Visual system

Keep the existing brown and gold identity. Self-host Playfair Display for expressive headings and Manrope for controls and body copy. Use the original Global room scene in the hero. The neutral charcoal reader applies no filters or coloured overlays to artwork. Thin rules and deliberate whitespace replace decorative motion. Tailwind owns brand tokens; src/styles/catalogue.css owns reader tokens and responsive composition.

## Interaction contracts

Native HTML owns the contact category select, form fields, validation semantics, details disclosures, dialog focus containment and scrollbars. The authored catalogue component owns collection selection, page navigation, zoom state and page-specific enquiry links. No third-party widget replaces these browser contracts.

Four collection buttons precede a large page reader. Fit view never crops a page. Zoom loads a native-resolution derivative only when requested, and native scrolling supports touch and keyboard panning. Complete original PDFs remain linked. Book/page selection is shareable through query parameters; page numbers explicitly refer to PDF pages. Thumbnail groups are bounded to twelve and reach every page.

Full-screen reading uses a native modal dialog with Escape, trapped focus and focus restoration. Exactly one page reader is mounted. The toolbar is always above the page. Inputs have visible labels and errors; controls are at least 44px. Reduced motion disables transitions, and SSR renders real content without invisible entrance states. The compact size estimate is disclosed on demand and makes no product packing assumptions.

## Content and discoverability

All supplied PDFs lack text layers. Printed tile details are preserved and enlarged; noisy OCR is not presented as verified customer-facing text. No nonfunctional design-name search is shown. HTML collection indexes expose original page previews, document links, factual showroom information and contact routes to search engines and assistive technology. Technical extraction cannot add specifications absent from the source.

## Verification

Validate original PDF hashes, every page and image ratio; test query bounds, page groups, zoom geometry and estimates. Build and inspect server-rendered metadata, links and schema. Review desktop/mobile layouts, fullscreen close/focus, zoom/pan, endpoint navigation, original PDF links and error recovery in the browser. Evidence belongs in ignored build-artifacts, not in product copy.
