// Per-finish material response — the physically-plausible defaults for each
// tile finish name used across the catalogue (visualizerCatalogue.js /
// importedCatalogue.js `finish` field). Originally lived only in
// TiledSurface.jsx (a procedural fallback that never renders on the live
// GLB path); centralized here so GLBModel.jsx — the actual rendering path —
// can use the same table instead of a flat hardcoded roughness/metalness.
const FINISH_TABLE = {
  Polished: { roughness: 0.12, metalness: 0.15, clearcoat: 0.4, clearcoatRoughness: 0.10, envMapIntensity: 1.3 },
  Glossy:   { roughness: 0.22, metalness: 0.10, clearcoat: 0.4, clearcoatRoughness: 0.30, envMapIntensity: 1.15 },
  Satin:    { roughness: 0.38, metalness: 0.05, clearcoat: 0,   clearcoatRoughness: 0.30, envMapIntensity: 0.9 },
  Rough:    { roughness: 0.92, metalness: 0.05, clearcoat: 0,   clearcoatRoughness: 0.30, envMapIntensity: 0.6 },
}
const DEFAULT_FINISH = { roughness: 0.55, metalness: 0.05, clearcoat: 0, clearcoatRoughness: 0.30, envMapIntensity: 0.8 }

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
