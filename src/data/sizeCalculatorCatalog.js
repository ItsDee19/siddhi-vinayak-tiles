/** Compact runtime index; the five extraction seeds stay in the offline pipeline. */
import index from './sizeCalculator.generated.js'
export { calculateTiles, normalizeSize, parseMm } from '../utils/tileCalculation.js'

export const sizeCalculatorProducts = index.products.map(values =>
  Object.fromEntries(index.fields.map((field, position) => [field, values[position]])),
)
export const sizeOptions = index.sizeOptions
export const collections = index.collections
