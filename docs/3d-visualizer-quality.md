# Interior tile visualizer

The visualizer renders the client's five layouts using native Three.js scene
factories. It does not load the legacy GLBs. The model stays stationary while
the customer looks around from authored interior viewpoints.

## Why these rooms

Each scene gives the tile a large, visible surface. Fixtures establish physical
scale while leaving enough wall area to compare colours, repeats and grout.
The bathroom partitions are horizontal tile bands, measured from floor level;
they are not physical dividing walls. Both adjacent walls share the same three
selections, making coordinated combinations easy to compare.

| Client model | Required dimensions | Editable surfaces |
| --- | --- | --- |
| A · Bathroom | 8 × 5 ft floor; two 8 ft walls; 3 / 2 / 3 ft bands | Lower, middle and upper wall bands only |
| B · Bathroom | 10 × 10 ft floor; two 8 ft walls; 2 / 4 / 2 ft bands | Lower, middle and upper wall bands only |
| C · Staircase | Two flights joined by an intermediate landing | Treads and landing, risers, hall floor, walls |
| D · Feature wall | 30 ft wide × 10 ft high | Full wall |
| E · Basin wall | 10 ft wide × 5 ft high above a 10 × 2 ft counter | Back wall, front panel, side returns |

The bathroom floors are fixed neutral stone. They have no selectable zone, and
the renderer accepts clicks only on meshes belonging to a registered zone.
Bath fixtures retain realistic dimensions in both sizes instead of scaling
the entire room and its contents. Mirrors reflect the actual scene.

A is a compact oak-and-chrome bathroom with a single floating vanity and a
600 mm neutral stone floor. B has a separate spa layout: a 1.5 m fluted walnut
double vanity, two hollow vessel basins, champagne-brass fittings, a broad
backlit mirror and a 1.55 m freestanding soaking tub. Its fixed floor uses
warmer 900 mm honed slabs. The tub has a continuous inner bowl, waste, overflow,
floor mixer and a timber bath bridge; it sits within the room footprint with
access space beside the vanity. Its rim stays below the first wall-band boundary.

The staircase opens from its intermediate landing: the left flight descends
away from the viewer and the right flight ascends. The tile sits above the
structural core, preventing the support from hiding the selected treads.

Model E follows the original project specification: the 5 ft back wall starts
at the 2.5 ft counter level, reaching 7.5 ft above the floor. Two 2 ft deep
upper side returns meet the back wall. Two hollow ceramic basins sit on a
fixed quartz counter. The front panel is independently tileable. The catalogue
has no approved countertop faces, so the counter retains its authored finish.

## Interaction

The models stay stationary. The camera looks around from a fixed interior eye
position, within 150 degrees of horizontal movement (−75 to +75 degrees).
Dragging and zooming do not move the eye through walls. Zoom changes the lens;
authored overview and detail presets move between useful
interior viewpoints. Pointer, touch, wheel and keyboard controls share bounds.

The desktop tile library sits next to the preview. On phones the preview stays
visible above the scrolling tile library; contact buttons yield space while
browsing the visualizer. Clicking a tileable surface selects its library.
Selections and grout colour persist independently for each room. Reset tiles
resets the current room; Reset room view preserves the design.

Catalogue selections are queued until the lazy visualizer is mounted. Only
products with compatible surfaces and approved processed tile faces expose
View in 3D. Saving waits for the current materials to load and render, and adds
the room name and selected products below the exported image. Failed texture
loads retain the previous visible design and prevent a mislabeled export.

## Rendering and scale

Room geometry uses metres. Tile UVs use world-space metre projection so
adjacent surfaces align and partial tiles preserve scale. Catalogued major
dimensions and processed image aspect determine the tile footprint; some
imported size metadata and swatch crops disagree, so this is a visual estimate,
not a measured installation plan. Custom photos use an explicitly approximate
600 mm scale. There is no arbitrary tile-size slider on catalogue products.

The material shader adds 2 mm grout with a small edge bevel and distance-aware
filtering. Tile colours are not tinted to show selection. Printed veins on
polished tiles are not treated as raised geometry. Broad daylight, environment
reflections, shadowing and desktop ambient occlusion clarify the surfaces.
Each room focuses the shadow map on its own dimensions. Stair cores and
landings cast structural shadows; enclosing walls transmit the broad daylight.
Fixed timber, quartz, honed stone, plaster and linen use restrained, seamless
colour and roughness or micro-surface maps. Polished stone stays smooth.
The luxury vanity's curved timber flutes use one instanced draw call.
The mirror uses a 1024 px reflection target on desktop and 512 px on mobile.
No new external asset service or runtime dependency is required.

Scene geometry, materials, reflection targets and per-mesh texture clones are
released on room changes. Custom-upload cache entries are evicted when no
saved room uses them, including requests still loading.
Instanced geometry also releases its separate GPU instance buffers.

## Verification

Run `npm run test:visualizer` and `npm run build`.

The regression suite covers the five client layouts, measured floor and wall
dimensions, band heights, fixed bathroom floors, view coverage, geometry
validity, metre UVs, actual tread visibility, independent resource disposal,
fixed-eye camera limits, grout filtering and catalogue selection delivery.
The luxury-fixture checks measure both basin bowls and the tub's usable depth,
floor contact, physical envelope and clearance from the vanity.
Browser review covers all five models, surface changes, camera presets,
desktop and phone layout, mirror reflections and room switching.

The preview is an interactive approximation. Source photography, colour
management, repeated swatches and simplified illumination limit finish
accuracy; the physical product remains the reference for final selection.
