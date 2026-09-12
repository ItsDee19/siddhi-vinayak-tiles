# Initial loading

The homepage keeps the branded CSS logo and a static, procedural stone backdrop.
It does not start a decorative WebGL context. The interactive five-room
visualizer remains unchanged and loads when its section approaches the viewport.
The same material painters still provide the room preview's non-WebGL fallback.

Vite uses Rollup's automatic splitting. The former manual `three` chunk collected
shared React dependencies, which caused the homepage to preload the renderer
despite the room component's lazy import. A build guard now walks emitted static
imports, fails if a Three package becomes part of the initial graph, and enforces
a 150 KiB gzip initial JavaScript budget. It deliberately excludes dynamic room
imports; it does not claim that the entire site has downloaded within that budget.

## Measured comparison

Measured from emitted JavaScript files with Node's `gzipSync` on 12 September 2026:

| Initial script graph | Uncompressed bytes | Gzip bytes |
| --- | ---: | ---: |
| Before, commit `b2df661` (entry + preloaded Three) | 1,260,445 | 362,758 |
| After the import-boundary change, isolated Vite build | 299,005 | 98,159 |
| Combined launch fixes, static import graph | 300,551 | 98,633 |

That is a 73% reduction in compressed JavaScript on the initial static import
graph. Other launch fixes may change the final numbers slightly; every complete
`npm run build` prints and enforces the current graph's byte totals. The catalogue
data, image responses, CSS, fonts and room assets are not counted in this table.

The combined build also eagerly mounts the seven supporting lazy sections after
hydration. Including their shared catalogue data and responsive image manifest,
the startup JavaScript files total **892,467 uncompressed / 161,196 gzip bytes**.
This larger total is the appropriate download estimate before scrolling; the
static-graph budget alone does not include those immediately requested chunks.

This is a build artifact comparison, not a Lighthouse score, network benchmark,
or Core Web Vitals field measurement. Production timings depend on cache state,
network, device and hosting. Browser verification should confirm that a fresh
homepage stays free of WebGL canvases until the visualizer approaches the
viewport, then check room selection and catalogue-to-room preview normally.

Rollup's [manual chunk documentation](https://rollupjs.org/configuration-options/#output-manualchunks)
describes dependency collection by manual chunks; Vite's
[production build guide](https://v6.vite.dev/guide/build.html#chunking-strategy)
documents the build's chunking controls.
