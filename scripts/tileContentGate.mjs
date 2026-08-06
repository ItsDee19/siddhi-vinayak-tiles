// =============================================================================
// tileContentGate.mjs
//
// Decides whether a catalogue crop is actually a photograph of a TILE FACE, or
// one of the other things the PDF-page extraction pulled out of the brochures:
// brand cover pages, flat vector logos, spec tables, "GLAM SERIES" labels,
// room lifestyle photography, product shots of adhesive bags and commodes.
//
// build_visualizer_tiles.mjs used to note this as a known-unfixable problem and
// shipped every crop regardless. That is what put the yellow/blue Global Tiles
// logo (sky12x18-p1-t1) on a 3D wall as diagonal stripes. It is fixable — not
// perfectly, but the failure modes are visually extreme compared to a tile
// photo, so a handful of cheap global statistics separates them well.
//
// Two calibration notes, both learned by running this over the real corpus:
//
//   * Aspect cannot be capped at a constant. The 3x12 elevation tiles are
//     76x300mm — a genuine 3.95:1 face — so a flat "nothing past 3.2:1"
//     rule threw out 400+ perfectly good tiles. The crop is instead checked
//     against the aspect the product's own declared size implies, which is
//     also exactly the property the 3D tiling maths needs to be true.
//
//   * "Mostly near-white" does not mean "mostly page". Statuario and plain
//     white tiles are near-white over most of their face. Paper is separated
//     from white tile by local flatness: printed page background is
//     dead-uniform, a white tile always carries veining or tone drift.
//
// The gate is deliberately biased toward rejecting: a visualizer that offers
// 700 correct tiles is better than one offering 1300 of which a third are
// brochure furniture.
// =============================================================================

import sharp from 'sharp'

// All statistics are measured on a small copy — we are looking at global
// composition, not detail, and 1200+ full-size decodes would be needlessly slow.
const SAMPLE = 200

export async function measure(input) {
  const { data, info } = await sharp(input)
    .removeAlpha()
    .resize(SAMPLE, SAMPLE, { fit: 'inside', withoutEnlargement: false })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width: W, height: H, channels: C } = info
  const n = W * H
  const lum = new Float32Array(n)
  const hue = new Float32Array(n)
  // 4 bits per channel — coarse enough that photographic noise collapses into
  // one bucket, fine enough that a real gradient still spans many.
  const hist = new Map()

  let sumSat = 0
  let dark = 0

  for (let i = 0; i < n; i++) {
    const p = i * C
    const r = data[p], g = data[p + 1], b = data[p + 2]
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    sumSat += mx === 0 ? 0 : (mx - mn) / mx
    if (lum[i] < 60) dark++
    // Hue as an angle, kept per-pixel for the block-homogeneity pass below.
    // Chroma-free pixels get angle 0; they carry no hue information and the
    // saturation weighting is handled by hueSpread being read together with
    // meanSat.
    const chroma = mx - mn
    let h = 0
    if (chroma > 0) {
      if (mx === r) h = ((g - b) / chroma) % 6
      else if (mx === g) h = (b - r) / chroma + 2
      else h = (r - g) / chroma + 4
      h = (h * Math.PI) / 3
    }
    hue[i] = h
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    hist.set(key, (hist.get(key) || 0) + 1)
  }

  const buckets = [...hist.values()].sort((a, b) => b - a)
  const topK = (k) => buckets.slice(0, k).reduce((a, v) => a + v, 0) / n

  // Local flatness pass. Two distinct things come out of it:
  //   flatFrac  — how much of the image has no local detail at all
  //   paperFrac — how much is *bright* and has no local detail, i.e. printed
  //               page background rather than a pale tile with veining
  let flat = 0
  let paper = 0
  const inner = (W - 2) * (H - 2)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      let lo = 255, hi = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const L = lum[(y + dy) * W + (x + dx)]
          if (L < lo) lo = L
          if (L > hi) hi = L
        }
      }
      const range = hi - lo
      if (range < 3) flat++
      if (range < 2 && lum[y * W + x] > 246) paper++
    }
  }

  // Mean absolute luminance gradient — text and hard-edged graphics spike it,
  // photographs of stone sit low.
  let grad = 0, gradN = 0
  for (let y = 0; y < H; y++) {
    for (let x = 1; x < W; x++) {
      grad += Math.abs(lum[y * W + x] - lum[y * W + x - 1])
      gradN++
    }
  }

  // Block homogeneity — the one statistic that separates a tile face from a
  // room photograph, since both are photographs and every texture-level metric
  // above treats them alike. A tile face is the same material edge to edge, so
  // its 5x5 block means cluster tightly. An interior shot has a dark sofa in
  // one corner and a bright window in another, and its blocks scatter.
  const GRID = 5
  const blockL = []
  const blockH = []
  for (let by = 0; by < GRID; by++) {
    for (let bx = 0; bx < GRID; bx++) {
      const x0 = Math.floor((bx * W) / GRID), x1 = Math.floor(((bx + 1) * W) / GRID)
      const y0 = Math.floor((by * H) / GRID), y1 = Math.floor(((by + 1) * H) / GRID)
      let sL = 0, sHx = 0, sHy = 0, cnt = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * W + x
          sL += lum[i]
          // Mean hue as a unit vector, so the average doesn't break at the
          // red wrap-around point.
          sHx += Math.cos(hue[i])
          sHy += Math.sin(hue[i])
          cnt++
        }
      }
      if (!cnt) continue
      blockL.push(sL / cnt)
      blockH.push(Math.atan2(sHy / cnt, sHx / cnt))
    }
  }
  const std = (arr) => {
    const m = arr.reduce((a, v) => a + v, 0) / arr.length
    return Math.sqrt(arr.reduce((a, v) => a + (v - m) * (v - m), 0) / arr.length)
  }
  // Spread of block hues around the circle, in radians.
  const hx = blockH.reduce((a, v) => a + Math.cos(v), 0) / blockH.length
  const hy = blockH.reduce((a, v) => a + Math.sin(v), 0) / blockH.length
  const hueSpread = 1 - Math.hypot(hx, hy) // 0 = one hue everywhere, 1 = scattered

  return {
    meanSat: sumSat / n,
    darkFrac: dark / n,
    top1: topK(1),
    top4: topK(4),
    flatFrac: flat / inner,
    paperFrac: paper / inner,
    meanGrad: grad / gradN,
    blockLumStd: std(blockL),
    hueSpread,
  }
}

// `srcW`/`srcH` are the dimensions of the crop as it will actually be used,
// i.e. after border trimming.
export function classify(stats, srcW, srcH) {
  // 1. Too small to become a texture. Upscaling a 90px crop to 2048 gives a
  //    blurry smear on a wall, which reads as "the tile pattern is wrong".
  if (Math.min(srcW, srcH) < 110) {
    return { ok: false, reason: 'too-small' }
  }

  // 2. Ribbon crops: a slice across a page, a header band, a rule line, a
  //    full-page column. Nothing in the range is thinner than the 76x300mm
  //    3x12 elevation tile at 3.95:1, so 4.5 clears every real face with room
  //    to spare while still catching the strips.
  //
  //    Note this is an absolute cap and deliberately NOT a comparison against
  //    the product's declared `size`. That was tried and reverted: the
  //    declared sizes are themselves wrong for a large part of the range (the
  //    3x12 tiles above are all labelled "300x600mm" in the catalogue data),
  //    so checking against them rejects good crops for bad metadata. The
  //    consumer side handles the same problem by trusting the crop's aspect
  //    over the declared one — see computeRepeat in GLBModel.jsx.
  const cropAspect = srcW >= srcH ? srcW / srcH : srcH / srcW
  if (cropAspect > 4.5) {
    return { ok: false, reason: 'extreme-aspect' }
  }

  // 3. Flat vector art: a logo or a coloured cover page. Very few distinct
  //    colours covering nearly everything, large perfectly-uniform areas, and
  //    saturated — the saturation term is what keeps plain white and beige
  //    tiles (equally few-coloured, but neutral) out of this bucket.
  if (stats.top4 > 0.72 && stats.flatFrac > 0.55 && stats.meanSat > 0.16) {
    return { ok: false, reason: 'flat-graphic' }
  }

  // 4. Printed page background dominates the crop — the tile chip sits in a
  //    corner of a mostly-white slot, or the crop missed the tile entirely.
  //    Tiling this paints a wall of paper with a smudge in it. Measured on
  //    paperFrac (bright AND dead-flat), never on brightness alone, so white
  //    marble survives.
  if (stats.paperFrac > 0.34) {
    return { ok: false, reason: 'page-background' }
  }

  // 5. Text / spec table: page background, a scattering of hard dark marks,
  //    and a high edge gradient from the glyph strokes.
  if (stats.paperFrac > 0.16 && stats.darkFrac > 0.015 && stats.meanGrad > 7) {
    return { ok: false, reason: 'text-page' }
  }

  // 6. Featureless: a solid block of one colour with no material at all
  //    (a swatch of flat page fill, a blown-out highlight).
  if (stats.top1 > 0.85 && stats.flatFrac > 0.9) {
    return { ok: false, reason: 'featureless' }
  }

  // 7. Room / product photography rather than a tile face: interior scenes,
  //    basins and commodes, adhesive sacks, styled vignettes with a plant and
  //    a chair. These are photographs, so every texture-level statistic above
  //    reads them as plausible; what gives them away is that they are not one
  //    uniform material edge to edge. Verified against the corpus: of the 200
  //    crops over this threshold, all but a handful are scenes, and the few
  //    tiles caught are partial crops with page showing beside them, which we
  //    do not want on a wall either.
  if (stats.blockLumStd > 30) {
    return { ok: false, reason: 'scene-photo' }
  }

  return { ok: true }
}

export async function gate(input, srcW, srcH) {
  const stats = await measure(input)
  const verdict = classify(stats, srcW, srcH)
  return { ...verdict, stats }
}
