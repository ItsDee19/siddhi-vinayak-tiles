---
version: alpha
name: Sidhhi Binayak Tiles
description: A tile showroom website with an interactive room and product comparison tool.
colors:
  charcoal: "#2C1A0E"
  surface: "#3D2512"
  cream: "#F5E6C8"
  sand: "#C9A97A"
  gold: "#C49A3C"
  ink: "#1A0E05"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
  sans:
    fontFamily: "Manrope, Inter, system-ui, sans-serif"
rounded:
  card: "4px"
  button: "2px"
spacing:
  control-min: "44px"
components:
  SurfaceLibrary: {}
  ModelTabs: {}
  ProductCard: {}
---

# Sidhhi Binayak Tiles design context

## Overview

The website serves showroom customers in Nuapada, Odisha comparing tiles and
sanitaryware on phones and desktops. The brand site contains a room comparison
tool. English product labels retain the catalogue's model names and dimensions.
The signature is a large, neutrally lit room beside actual product photographs.
Product choice and physical scale take priority over ornamental interface motion.

This file records the existing visual identity; it does not generate tokens.
`tailwind.config.js` and `src/index.css` remain the runtime styling owners.
Room behavior and client dimensions are maintained in
`docs/3d-visualizer-quality.md`; verified basin evidence is in `basinCatalogue.js`.

## Colors

Brown surfaces, cream text and restrained gold selection/focus styling follow
the established theme. Interface selection must never tint tile artwork or
ceramic materials. Catalogue photography and the 3D scene keep their own colours.

## Typography

Playfair Display is reserved for showroom headings. Manrope handles controls,
product names and dimensions. Product details use sentence case and readable
wrapping; dimensions retain units and multiplication signs.

## Layout

The desktop preview sits beside the scrolling product library. On narrow
screens the preview remains visible above the picker. Controls reserve at least
44 px touch height. Product images reserve an aspect ratio before loading.
Only one basin is shown in Basin Wall; its detail preset gives it more screen
space without falsifying catalogue dimensions.

## Elevation & Depth

Fine borders and subtle shadows separate the preview and library. Depth belongs
primarily to the rendered room; avoid competing decorative effects around it.

## Shapes

Use existing 4 px cards and 2 px controls. Gold borders and explicit selected
labels distinguish choices; colour alone does not communicate selection.

## Components

`SurfaceLibrary` owns tile and basin choice, local search, empty results and
selection feedback. Native size selects deliberately use platform popup behavior
and keyboard support. Do not replace them with screen-local dropdowns.
`ModelTabs` owns room switching. `ProductCard` and `ProductLightbox` route eligible
catalogue products through the same preview bridge.

Native buttons expose pressed/disabled states and visible focus. Search clears
immediately and returns focus. Tile uploads are offered only for tile surfaces.
Product choices are reversible and require no confirmation. Basin selection
persists across room changes; Reset design resets the active Basin Wall design.
Save room and the enquiry draft include the chosen basin as well as the tiles.

Existing colour transitions are short; camera motion follows the shared camera
controller and reduced-motion behavior. Selection must remain usable with a
keyboard or touch, with no hover-only actions. Existing `Icons` remain the icon
source. Error messages and approximate product previews use plain visible copy.

## Do's and Don'ts

- Preserve catalogue product identity, printed dimensions and real photos.
- Use the shared picker and preview bridge for either product type.
- Keep tile texture repeat, grout and basin geometry in separate rendering paths.
- Do not use a page photograph as a repeated tile or pretend a representative
  basin shell is manufacturer CAD geometry.
