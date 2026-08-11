/**
 * Apply GT2025 structured extract + existing review CSV into importedCatalogue.js
 * and write wallSizeCalculator.json seed.
 *
 *   node scripts/apply_gt2025_catalogue.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA = path.join(ROOT, 'src/data/importedCatalogue.js')
const EXTRACT = path.join(ROOT, 'scripts/gt2025-catalogue-structured.json')
const REVIEW = path.join(ROOT, 'scripts/tile-names-review-gt2025.csv')
const CALC = path.join(ROOT, 'src/data/wallSizeCalculator.json')
const WEAK = path.join(ROOT, 'scripts/gt2025-weak-slots-remaining.csv')

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
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((w) => {
      if (/^\d/.test(w) || /[0-9]/.test(w)) return w.toUpperCase()
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(s.includes('-') ? '-' : ' ')
}

function isGoodName(name) {
  if (!name || name.length < 3 || name.length > 48) return false
  if (
    /^—$|^Hl-\d|^Dimension$|^Premium$|^Pull-Out$|^Mrp$|^With$|^Riser$|^Plain$|^User$|^Suspect$|^Lets$|^Anal$|^Cos$|^Pene$|^Carer$|^Otrr$|^Babee$/i.test(
      name,
    )
  )
    return false
  if (/(.)\1{3,}/.test(name)) return false // long repeated chars / OCR stutter
  if (/^Global Wall Tile/i.test(name)) return false
  const letters = [...name].filter((c) => /[A-Za-z]/.test(c)).length
  if (letters < 2) return false
  // HL codes: 56177-HL
  if (/^\d{3,5}-HL$/i.test(name)) return true
  // product-code style OK: Briko-Carrot, Stony-11, El-1015, Lx-66, Spw-131-Hl-2
  if (/^[A-Za-z]{1,4}-?\d{2,5}(?:-?[A-Za-z0-9]{1,4}){0,2}$/i.test(name)) return true
  if (/^[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+){0,4}(?:\s*\([^)]+\))?$/.test(name) && letters >= 3) return true
  return letters >= 4 && name.length <= 48
}

function cardNum(id) {
  const m = /c(\d+)$/i.exec(id)
  return m ? Number(m[1]) : 0
}

const extract = JSON.parse(fs.readFileSync(EXTRACT, 'utf8'))
const review = parseCsv(REVIEW)
const reviewMap = new Map()
for (const r of review) {
  if (Number(r.quality) >= 2 && r.suggested_name) {
    reviewMap.set(r.id, titleName(r.suggested_name.replace(/-/g, ' ')).replace(/ /g, (m, i, s) => {
      // keep hyphenated codes like BRIKO-CARROT as Title-Title
      return '-'
    }))
    // Better: preserve hyphens from suggested
    reviewMap.set(r.id, r.suggested_name.split('-').map((w) => {
      if (/\d/.test(w)) return w.toUpperCase()
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    }).join('-'))
  }
}

let src = fs.readFileSync(DATA, 'utf8')
let nameOk = 0
let sizeOk = 0
const weak = []
const calc = []

for (const p of extract.products) {
  let name = p.name || ''
  // Prefer reviewed CSV names
  if (reviewMap.has(p.id)) {
    name = reviewMap.get(p.id)
  }
  const good = isGoodName(name)
  // Salvage nameOcrRaw if primary name weak
  if (!good && p.nameOcrRaw) {
    const m = String(p.nameOcrRaw).match(/\b([A-Za-z]{1,4}-?\d{1,5}[A-Za-z]?|[A-Z][a-z]{3,})\b/)
    if (m && isGoodName(m[1])) {
      name = m[1].includes('-') || /\d/.test(m[1]) ? m[1].toUpperCase().replace(/([A-Z]+)/, (x) => x[0] + x.slice(1).toLowerCase()) : m[1]
      // normalize codes like LX-66 → Lx-66
      if (/^[A-Za-z]{1,4}-?\d/i.test(name)) {
        name = name.replace(/^([A-Za-z]+)-?(\d+[A-Za-z]?)$/i, (_, a, b) => `${a[0].toUpperCase()}${a.slice(1).toLowerCase()}-${b}`)
      }
    }
  }
  const good2 = isGoodName(name)
  if (!good2) {
    name = `Global Wall Tile #${cardNum(p.id)}`
    weak.push({ ...p, name, ocrName: p.name })
  } else {
    nameOk++
  }

  // size
  const sizeMm = p.sizeMm || '300×300mm'

  calc.push({
    id: p.id,
    name,
    sizeMm,
    sizeIn: p.sizeIn || null,
    finish: p.finish || 'Glossy',
    pcsPerBox: p.pcsPerBox ? Number(p.pcsPerBox) : null,
    boxWeightKg: p.boxWeightKg ? Number(p.boxWeightKg) : null,
    coverageSqFt: p.coverageSqFt ? Number(p.coverageSqFt) : null,
    surface: 'Wall',
    confidence: good2 ? 'high' : 'placeholder',
    textureUrl: p.textureUrl,
  })

  // Apply names only when high-confidence (avoid writing placeholders over prior good names)
  if (good2) {
    const nameRe = new RegExp(`("id":\\s*"${p.id}",\\s*\\n\\s*"name":\\s*")([^"]*)(")`)
    if (nameRe.test(src)) {
      src = src.replace(nameRe, (_m, a, _b, c) => `${a}${name.replace(/"/g, "'")}${c}`)
    }
  }
  if (sizeMm) {
    const sizeRe = new RegExp(`("id":\\s*"${p.id}"[\\s\\S]*?"size":\\s*")([^"]*)(")`)
    if (sizeRe.test(src)) {
      src = src.replace(sizeRe, (_m, a, _b, c) => `${a}${sizeMm}${c}`)
      sizeOk++
    }
  }
}

fs.writeFileSync(DATA, src, 'utf8')

const sizes = {}
for (const p of calc) sizes[p.sizeMm] = (sizes[p.sizeMm] || 0) + 1

fs.writeFileSync(
  CALC,
  JSON.stringify(
    {
      source: 'scripts/gt2025-catalogue-structured.json',
      count: calc.length,
      highConfidenceNames: calc.filter((p) => p.confidence === 'high').length,
      placeholderNames: calc.filter((p) => p.confidence === 'placeholder').length,
      sizeHistogram: sizes,
      products: calc,
    },
    null,
    2,
  ),
  'utf8',
)

// weak csv
const wlines = [
  'id,name,ocrName,sizeMm,pcsPerBox,boxWeightKg,pdfPage,textureUrl',
  ...weak.map(
    (p) =>
      `"${p.id}","${p.name}","${(p.ocrName || '').replace(/"/g, "'")}","${p.sizeMm}","${p.pcsPerBox}","${p.boxWeightKg}","${p.pdfPage}","${p.textureUrl}"`,
  ),
]
fs.writeFileSync(WEAK, wlines.join('\n'), 'utf8')

console.log(`products: ${calc.length}`)
console.log(`high names: ${calc.filter((p) => p.confidence === 'high').length}`)
console.log(`placeholders: ${weak.length}`)
console.log(`sizes applied: ${sizeOk}`)
console.log('size histogram:', sizes)
console.log(`calc: ${CALC}`)
console.log(`weak: ${WEAK}`)
