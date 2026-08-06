// Swatch dot shown on each colour filter pill, and the canonical order the
// families are listed in.
//
// These are the families scripts/build_product_facets.mjs classifies into, so
// the two must stay in step — the build script owns the same list as
// COLOR_FAMILIES. Kept in src/ rather than imported from scripts/ because the
// script pulls in sharp, which must never reach the browser bundle.
export const COLOR_SWATCHES = {
  White: '#F2F1ED',
  Cream: '#E8DCC2',
  Beige: '#D6C3A1',
  Grey: '#9A9A99',
  Charcoal: '#3A3A3C',
  Brown: '#7A4F2C',
  Terracotta: '#B4573A',
  Gold: '#C9A227',
  Green: '#4E7A54',
  Blue: '#3C6E9F',
}
