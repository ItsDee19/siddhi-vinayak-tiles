/**
 * Apply reviewed tile-name suggestions into importedCatalogue.js.
 * Only touches the "name" field of matching "id" blocks. Nothing else.
 *
 *   node scripts/apply_tile_names.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA = path.join(ROOT, 'src/data/importedCatalogue.js')

function parseCsv(file) {
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/)
  const split = (l) => {
    const out = []
    let cur = ''
    let q = false
    for (let i = 0; i < l.length; i++) {
      const c = l[i]
      if (c === '"') {
        if (q && l[i + 1] === '"') {
          cur += '"'
          i++
        } else q = !q
      } else if (c === ',' && !q) {
        out.push(cur)
        cur = ''
      } else cur += c
    }
    out.push(cur)
    return out
  }
  const header = split(lines[0])
  return lines.slice(1).map((l) => {
    const cells = split(l)
    const row = {}
    header.forEach((h, i) => (row[h] = cells[i] ?? ''))
    return row
  })
}

function toTitleCase(s) {
  // suggested names arrived as ALL CAPS from OCR; make them presentable.
  return s
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ')
}

const gt2025 = parseCsv(path.join(ROOT, 'scripts/tile-names-review-gt2025.csv')).filter(
  (r) => Number(r.quality) >= 2 && r.suggested_name,
)
const sunflora = parseCsv(path.join(ROOT, 'scripts/tile-names-review-sunflora-new.csv')).filter(
  (r) => r.ACCEPT === 'yes' && r.suggested_name,
)

const changes = new Map()
for (const r of gt2025) changes.set(r.id, r.suggested_name)
for (const r of sunflora) changes.set(r.id, r.suggested_name)

console.log(`gt2025: ${gt2025.length} rows to apply`)
console.log(`sunflora: ${sunflora.length} rows to apply`)
console.log(`total unique ids: ${changes.size}`)

let src = fs.readFileSync(DATA, 'utf8')
let applied = 0
let missing = []

for (const [id, rawName] of changes) {
  const name = toTitleCase(rawName)
  const idRe = new RegExp(`("id":\\s*"${id}",\\s*\\n\\s*"name":\\s*")([^"]*)(")`)
  if (idRe.test(src)) {
    src = src.replace(idRe, (_m, pre, _old, post) => `${pre}${name}${post}`)
    applied++
  } else {
    missing.push(id)
  }
}

fs.writeFileSync(DATA, src, 'utf8')

console.log(`applied: ${applied}`)
if (missing.length) console.log(`not found in data (skipped): ${missing.join(', ')}`)
