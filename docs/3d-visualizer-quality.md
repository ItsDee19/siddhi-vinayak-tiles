# Interior tile visualizer

The visualizer renders the client's five layouts using native Three.js scene
factories with Blender-authored fixed furnishings. It does not load the legacy
room GLBs. The model stays stationary while
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
polished or satin/matte tiles are not treated as raised geometry. Broad daylight, environment
reflections, shadowing and desktop ambient occlusion clarify the surfaces.
Each room focuses the shadow map on its own dimensions. Stair cores and
landings cast structural shadows; enclosing walls transmit the broad daylight.
Fixed timber, quartz, honed stone, plaster and linen use restrained, seamless
colour and roughness or micro-surface maps. Polished stone stays smooth.
The luxury vanity's curved timber flutes use one instanced draw call.
The mirror uses a 1024 px reflection target on desktop and 512 px on mobile.
No new external asset service or runtime dependency is required.

### Blender furnishings and construction

`public/models/showroom-fixtures.glb` contains nine fixed meshes authored in
Blender 4.5 LTS: three distinct ceramic basin profiles, an ergonomic soaking
tub, a double-sided draped towel, folded cloth, a softly compressed cushion and
two combined olive-tree meshes. Continuous inner/outer ceramic shells have
rolled rims, coved bowl floors and physical underside contact. The 236 KB
Draco-compressed library uses the existing locally served decoder.

`authoredFixtures.js` clones each imported geometry into the native fixture's
local envelope. Tile panels, physical room dimensions, camera positions and
mirror faces stay native. Waste discs are seated against the actual new inner
bowl; the tub overflow follows its inner wall. Removed native resources are
disposed without touching the GLTF cache. The tree replaces roughly 145
individual branches/leaves/petioles with two fixed mesh draws.

The staircase's upper flight has a continuous stepped concrete waist with a
sloped soffit, full-depth landing bearing, connected rail returns and slender
instanced infill. Its tile treads and risers remain independently editable.

To rebuild, start the configured Blender MCP add-on on localhost:9876, then run:

```sh
python scripts/blender_mcp_client.py execute_code --file blender/build_fixture_assets.py --timeout 600
```

The script owns only its named review scene, exports only its selected sources,
and writes an editable `blender/showroom-fixtures.blend` plus a rendered gallery
and mesh manifest under `build-artifacts/blender/`. These local review files are
ignored by Git; the reproducible authoring script and web GLB are versioned.

### Tile colour handling

The actual lights and lamp diffusers are neutral white. The original HDR's
linear luminance is preserved in an owned grayscale texture, retaining broad
window reflections without orange floor bounce or blue window casts. Desktop
and mobile use that same environment, fixed exposure and Khronos Neutral tone
mapping; quality changes only resolution and contact shading. Bathroom lights
illuminate the inside faces of both tiled walls, avoiding the previous strong
left/back brightness imbalance. Clear shower glass has no green tint.

Tile photographs remain sRGB, multiplied by white, with zero metallic response
and no selection glow. No lighting, colour grading or artificial wear is baked
into tile images. Shadows, reflectance and screen calibration still change
perceived appearance: this preserves source colour as far as a lit 3D preview
allows, rather than promising a colorimetric match to a physical sample.

Scene geometry, materials, reflection targets and per-mesh texture clones are
released on room changes. Custom-upload cache entries are evicted when no
saved room uses them, including requests still loading.
Instanced geometry also releases its separate GPU instance buffers.

## Verification

Run `npm run test:visualizer` and `npm run build`.

The regression suite decodes the shipped Blender GLB and covers hollow shells,
drain/rail/support contact, authored dimensions, UVs, cache ownership and live
room injection. Lighting checks cover every shipped HDR pixel, neutral-channel
equality, retained luminance, matching output transforms and balanced bathroom
wall illumination. Smooth printed finishes are guarded against false relief.
The suite also covers the five client layouts, measured floor and wall
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
