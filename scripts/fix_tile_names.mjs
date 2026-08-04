/**
 * Post-apply cleanup:
 *  1. Revert ids whose applied name has leaked OCR garbage after the code
 *     (a stray trailing word beyond the plausible LETTERS?-DIGITS pattern).
 *  2. Fix hyphen title-casing: "Briko-carrot" -> "Briko-Carrot".
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA = path.join(ROOT, 'src/data/importedCatalogue.js')

// ids confirmed by inspection to have trailing OCR garbage after the code.
const REVERTS = {
  'gt2025-c186': 'Global 2025 Tile #186',
  'gt2025-c205': 'Global 2025 Tile #205',
  'gt2025-c209': 'Global 2025 Tile #209',
  'gt2025-c213': 'Global 2025 Tile #213',
}

let src = fs.readFileSync(DATA, 'utf8')

let reverted = 0
for (const [id, original] of Object.entries(REVERTS)) {
  const re = new RegExp(`("id":\\s*"${id}",\\s*\\n\\s*"name":\\s*")([^"]*)(")`)
  if (re.test(src)) {
    src = src.replace(re, (_m, pre, _old, post) => `${pre}${original}${post}`)
    reverted++
  }
}

// Fix "Word-lowercase" -> "Word-Lowercase" in name fields only.
let recased = 0
src = src.replace(/"name":\s*"([^"]*)"/g, (m, name) => {
  const fixed = name.replace(/-([a-z])/g, (mm, c) => '-' + c.toUpperCase())
  if (fixed !== name) recased++
  return `"name": "${fixed}"`
})

fs.writeFileSync(DATA, src, 'utf8')
console.log(`reverted (garbage): ${reverted}`)
console.log(`recased (hyphen casing): ${recased}`)
