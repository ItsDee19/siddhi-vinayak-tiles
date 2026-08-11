/**
 * Apply Sunflora structured extract + review CSV into importedCatalogue.js
 * and write sunfloraSizeCalculator.json seed.
 *
 *   node scripts/apply_sunflora_catalogue.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA = path.join(ROOT, 'src/data/importedCatalogue.js')
const EXTRACT = path.join(ROOT, 'scripts/sunflora-catalogue-structured.json')
const REVIEW_NEW = path.join(ROOT, 'scripts/tile-names-review-sunflora-new.csv')
const REVIEW_OLD = path.join(ROOT, 'scripts/tile-names-review-sunflora.csv')
const CALC = path.join(ROOT, 'src/data/sunfloraSizeCalculator.json')
const WEAK = path.join(ROOT, 'scripts/sunflora-weak-slots-remaining.csv')

function parseCsv(file) {
  if (!fs.existsSync(file)) return []
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

function titleName(s) {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (/^\d/.test(w) || /[0-9]/.test(w)) return w.toUpperCase()
      if (/^(CV|SP|END|3D|POS)$/i.test(w)) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(' ')
}

function isGoodName(name) {
  if (!name || name.length < 4 || name.length > 72) return false
  if (/^Sunflora\s+\d/i.test(name)) return false
  if (/^—$|^Hl-\d|^Dimension$|^Premium$|^Mrp$|^With$|^Plain$|^Suspect$|^Collection$/i.test(name))
    return false
  if (/(.)\1{3,}/.test(name)) return false // OCR stutter
  // dual product names: validate each side
  if (name.includes(' / ')) {
    return name.split(' / ').every((p) => isGoodName(p.trim()))
  }
  if (/^3D[-\s]?\d+/i.test(name)) return true
  const letters = [...name].filter((c) => /[A-Za-z]/.test(c)).length
  if (letters < 5) return false
  const toks = name.split(/\s+/).filter(Boolean)
  const short = toks.filter((t) => t.length <= 1).length
  if (short >= 1 && toks.length <= 3) return false
  if (toks.length >= 3 && toks.filter((t) => t.length <= 2).length >= 2) return false
  if (/^(Cv|Sp|End|3D|Subway|Sense|Prestige|Monostone|Fort|Mozo|Diamond|Endless)\b/i.test(name))
    return true
  return letters >= 8 && name.length <= 48 && toks.length >= 2
}

const extract = JSON.parse(fs.readFileSync(EXTRACT, 'utf8'))

// Prefer explicit ACCEPT=yes from review; otherwise keep structured extract names
// (old auto-OCR review often truncated dual-product pages).
const reviewMap = new Map()
for (const file of [REVIEW_NEW, REVIEW_OLD]) {
  for (const r of parseCsv(file)) {
    const accept = String(r.ACCEPT || '').toLowerCase() === 'yes'
    const suggested = (r.suggested_name || r.suggestedName || '').trim()
    if (!suggested || !accept) continue
    if (!reviewMap.has(r.id)) {
      reviewMap.set(r.id, titleName(suggested))
    }
  }
}

let src = fs.readFileSync(DATA, 'utf8')
let nameOk = 0
let sizeOk = 0
let finishOk = 0
const weak = []
const calc = []

// Catalogue only has c001..c034 typically — only apply those IDs that exist
for (const p of extract.products) {
  let name = p.name || ''
  // Review ACCEPT wins only when extract name is missing/weak
  if (reviewMap.has(p.id) && !isGoodName(name)) {
    name = reviewMap.get(p.id)
  }
  // Fix known OCR typo
  name = name.replace(/\bMozlo\b/g, 'Mozo')

  // Prefer first half of dual OCR name if review gave single product name already applied
  // Cover/divider pages — not sellable products
  if (p.confidence === 'non_product' || (p.layout === 'empty' && !name)) {
    const label =
      p.id === 'sunflora-c001' ? 'Cover (not a product)' : 'Divider (not a product)'
    calc.push({
      id: p.id,
      name: label,
      sizeMm: '',
      sizeFt: '',
      finish: '',
      surface: 'Floor & Wall',
      layout: 'empty',
      confidence: 'non_product',
      textureUrl: p.textureUrl || '',
      altNames: '',
    })
    const nameRe = new RegExp(`("id":\\s*"${p.id}",\\s*\\n\\s*"name":\\s*")([^"]*)(")`)
    if (nameRe.test(src)) {
      src = src.replace(nameRe, (_m, a, _b, c) => `${a}${label}${c}`)
    }
    continue
  }

  const good = isGoodName(name)
  if (!good) {
    const m = /c(\d+)$/i.exec(p.id)
    name = `Sunflora 2X4 Tile #${m ? Number(m[1]) : p.id}`
    weak.push({ ...p, name, ocrName: p.name })
  } else {
    nameOk++
  }

  const sizeMm = p.sizeMm || '600×1200mm'
  const finish = p.finish || 'Carving'

  calc.push({
    id: p.id,
    name,
    sizeMm,
    sizeFt: p.sizeFt || '2×4 Ft',
    finish,
    thicknessMm: p.thicknessMm || '9.0',
    surface: 'Floor & Wall',
    layout: p.layout || '',
    confidence: good ? (p.confidence === 'high' || reviewMap.has(p.id) ? 'high' : 'medium') : 'placeholder',
    textureUrl: p.textureUrl || `/assets/catalogue/swatches/${p.id}-swatch.webp`,
    altNames: p.altNames || '',
  })

  // Apply only if id exists in catalogue
  const nameRe = new RegExp(`("id":\\s*"${p.id}",\\s*\\n\\s*"name":\\s*")([^"]*)(")`)
  if (nameRe.test(src) && good) {
    src = src.replace(nameRe, (_m, a, _b, c) => `${a}${name.replace(/"/g, "'")}${c}`)
  }
  // Scope size/finish replace to a single product object (next "id" or end of object)
  const blockRe = new RegExp(
    `("id":\\s*"${p.id}"[\\s\\S]*?)("size":\\s*")([^"]*)(")([\\s\\S]*?"finish":\\s*")([^"]*)(")`,
  )
  if (blockRe.test(src) && sizeMm) {
    src = src.replace(blockRe, (_m, pre, sPre, _oldS, sPost, fPre, _oldF, fPost) => {
      sizeOk++
      if (good && finish) finishOk++
      const nextFinish = good && finish ? finish : _oldF
      return `${pre}${sPre}${sizeMm}${sPost}${fPre}${nextFinish}${fPost}`
    })
  }
}

fs.writeFileSync(DATA, src, 'utf8')

const sizes = {}
for (const p of calc) sizes[p.sizeMm] = (sizes[p.sizeMm] || 0) + 1

// calculator: only product pages with names or catalogue-backed placeholders for c001-c034
const calcProducts = calc.filter((p) => {
  const n = Number(p.id.replace(/\D/g, ''))
  return n >= 1 && n <= 40
})

fs.writeFileSync(
  CALC,
  JSON.stringify(
    {
      source: 'scripts/sunflora-catalogue-structured.json',
      count: calcProducts.length,
      highConfidenceNames: calcProducts.filter((p) => p.confidence === 'high').length,
      mediumConfidenceNames: calcProducts.filter((p) => p.confidence === 'medium').length,
      placeholderNames: calcProducts.filter((p) => p.confidence === 'placeholder').length,
      sizeHistogram: sizes,
      products: calcProducts,
    },
    null,
    2,
  ),
  'utf8',
)

const wlines = [
  'id,name,ocrName,sizeMm,finish,pdfPage,layout,textureUrl',
  ...weak.map(
    (p) =>
      `"${p.id}","${p.name}","${(p.ocrName || '').replace(/"/g, "'")}","${p.sizeMm || ''}","${p.finish || ''}","${p.pdfPage}","${p.layout || ''}","${p.textureUrl || ''}"`,
  ),
]
fs.writeFileSync(WEAK, wlines.join('\n'), 'utf8')

console.log(`products: ${calcProducts.length}`)
console.log(`high/medium names applied quality: ${nameOk}`)
console.log(`placeholders: ${weak.length}`)
console.log(`sizes applied: ${sizeOk}`)
console.log(`finishes applied: ${finishOk}`)
console.log('size histogram:', sizes)
console.log(`calc: ${CALC}`)
console.log(`weak: ${WEAK}`)
