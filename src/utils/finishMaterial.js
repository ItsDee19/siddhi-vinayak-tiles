// Per-finish material response — the physically-plausible defaults for each
// tile finish name used across the catalogue (visualizerCatalogue.js /
// importedCatalogue.js `finish` field). Originally lived only in
// TiledSurface.jsx (a procedural fallback that never renders on the live
// GLB path); centralized here so GLBModel.jsx — the actual rendering path —
// can use the same table instead of a flat hardcoded roughness/metalness.
// metalness is 0 on every entry, and that is not a rounding choice.
//
// Ceramic, porcelain, glaze and stone are all dielectrics — none of them are
// metal, so the physically correct value is exactly 0. The table previously
// carried 0.05-0.15, which is a real error rather than a stylistic one: in a
// metallic-roughness workflow, metalness tints the specular reflection by the
// base colour AND suppresses the diffuse term in proportion. Non-zero values
// on a tile therefore drained its diffuse colour and made reflections take on
// the tile's own hue, which is a large part of why polished finishes read
// slightly plasticky and dull rather than glazed.
//
// The glaze layer that DOES sit on top of a glossy tile is what `clearcoat`
// models — a second, colourless specular lobe over the base material. That is
// the correct tool for it, and it only works on MeshPhysicalMaterial (see
// GLBModel.jsx); on MeshStandardMaterial these values are silently ignored.
//
// normalScale drives the derived normal map (utils/derivedMaps.js). Rougher
// finishes get more visible relief: a carved or structured tile should catch
// light across its face, a polished one should stay nearly flat.
const FINISH_TABLE = {
  Polished: { roughness: 0.16, metalness: 0, clearcoat: 0.5,  clearcoatRoughness: 0.1,  envMapIntensity: 1,    normalScale: 0 },
  Glossy:   { roughness: 0.25, metalness: 0, clearcoat: 0.4,  clearcoatRoughness: 0.16, envMapIntensity: 1,    normalScale: 0 },
  // A satin/matte photograph describes printed colour, not measured relief.
  Satin:    { roughness: 0.48, metalness: 0, clearcoat: 0.1,  clearcoatRoughness: 0.4,  envMapIntensity: 0.85, normalScale: 0 },
  Rough:    { roughness: 0.88, metalness: 0, clearcoat: 0,    clearcoatRoughness: 0.4,  envMapIntensity: 0.7,  normalScale: 0.35 },
}
const DEFAULT_FINISH = { roughness: 0.55, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.3, envMapIntensity: 0.85, normalScale: 0 }

// Catalogue finish strings aren't all clean single words (e.g. 'Matt / Glossy',
// 'Carving'). Normalize the common variants to the closest physical bucket.
const ALIASES = {
  'matt': 'Satin',
  'matte': 'Satin',
  'matt / glossy': 'Glossy',
  'carving': 'Rough',
}

export function getFinish(finishName) {
  if (!finishName) return DEFAULT_FINISH
  if (FINISH_TABLE[finishName]) return FINISH_TABLE[finishName]
  const alias = ALIASES[String(finishName).toLowerCase().trim()]
  if (alias && FINISH_TABLE[alias]) return FINISH_TABLE[alias]
  return DEFAULT_FINISH
}
