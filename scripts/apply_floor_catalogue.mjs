/**
 * Apply floor-catalogue-structured.json into importedCatalogue.js
 * for high-confidence OCR rows only. Also writes size-calculator seed JSON.
 *
 *   node scripts/apply_floor_catalogue.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA = path.join(ROOT, 'src/data/importedCatalogue.js')
const SRC = path.join(ROOT, 'scripts/floor-catalogue-structured.json')
const CALC_OUT = path.join(ROOT, 'src/data/floorSizeCalculator.json')

const junk = /coverage\s*area|net\s*weight|page[- ]?\d|^\W+$|se el|^est$|^wet$|^aol$|^ied$|^dee$|^take$|^rny$|^ane$|^qaa$|^—$/i

function isGoodName(name) {
  if (!name || name.length < 3 || name.length > 48) return false
  if (junk.test(name.trim())) return false
  if (/^Global Floor Tile/i.test(name)) return false
  if (/(.)\1{3,}/.test(name)) return false
  if (/series|adhesive|mortar|baker board|coverage area/i.test(name)) return false
  const letters = [...name].filter((c) => /[A-Za-z]/.test(c)).length
  if (letters < 3) return false
  // Too many non-alphanumeric (OCR garbage)
  const bad = [...name].filter((c) => !/[A-Za-z0-9 \-()'/&.,]/.test(c)).length
  if (bad > 2) return false
  // Product codes A-1234
  if (/^[A-Z]-?\d{4,6}$/i.test(name)) return true
  // Color + finish: Super White Matt, Galaxy Black Matt
  if (/\b(Matt|Matte|Glossy|Carving|Polished)\b/i.test(name) && letters >= 8) return true
  // Single short token unless code-like
  if (!name.includes(' ') && name.length < 4 && !/^[A-Z]-?\d/i.test(name)) return false
  return letters >= 5
}

const payload = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const products = payload.products || []
const WEAK = path.join(ROOT, 'scripts/floor-weak-slots-remaining.csv')

function cardNum(id) {
  const m = /c(\d+)$/i.exec(id)
  return m ? Number(m[1]) : 0
}

let src = fs.readFileSync(DATA, 'utf8')
let nameApplied = 0
let sizeApplied = 0
let finishApplied = 0
const calcRows = []
const weak = []

for (const p of products) {
  const id = p.id
  let name = p.name || ''
  const good = isGoodName(name) && !/^Global Floor Tile/i.test(name)

  const displayName = good ? name : `Global Floor Tile #${cardNum(id)}`
  if (!good) weak.push({ ...p, name: displayName, ocrName: p.name })

  calcRows.push({
    id,
    name: displayName,
    code: p.code || null,
    sizeMm: p.sizeMm,
    sizeFt: p.sizeFt,
    finish: p.finish,
    pcsPerBox: p.pcsPerBox ?? null,
    boxWeightKg: p.boxWeightKg ?? null,
    surface: 'Floor',
    bodyType: p.bodyType || 'PGVT',
    textureUrl: p.textureUrl,
    confidence: good ? 'high' : 'placeholder',
    ocrOk: good,
  })

  // Always apply size when present (useful for calculator even if name is weak)
  if (p.sizeMm) {
    const sizeRe = new RegExp(`("id":\\s*"${id}"[\\s\\S]*?"size":\\s*")([^"]*)(")`)
    if (sizeRe.test(src)) {
      src = src.replace(sizeRe, (_m, pre, _old, post) => `${pre}${p.sizeMm}${post}`)
      sizeApplied++
    }
  }

  if (!good) continue

  const nameRe = new RegExp(`("id":\\s*"${id}",\\s*\\n\\s*"name":\\s*")([^"]*)(")`)
  if (nameRe.test(src)) {
    src = src.replace(nameRe, (_m, pre, _old, post) => `${pre}${name}${post}`)
    nameApplied++
  }

  if (p.finish) {
    const finRe = new RegExp(`("id":\\s*"${id}"[\\s\\S]*?"finish":\\s*")([^"]*)(")`)
    if (finRe.test(src)) {
      src = src.replace(finRe, (_m, pre, _old, post) => `${pre}${p.finish}${post}`)
      finishApplied++
    }
  }
}

fs.writeFileSync(DATA, src, 'utf8')

const sizes = {}
for (const p of calcRows) {
  if (p.sizeMm) sizes[p.sizeMm] = (sizes[p.sizeMm] || 0) + 1
}

fs.writeFileSync(
  WEAK,
  [
    'id,name,ocrName,sizeMm,finish,pdfPage,textureUrl',
    ...weak.map(
      (p) =>
        `"${p.id}","${p.name}","${(p.ocrName || '').replace(/"/g, "'")}","${p.sizeMm || ''}","${p.finish || ''}","${p.pdfPage || ''}","${p.textureUrl || ''}"`,
    ),
  ].join('\n'),
  'utf8',
)

fs.writeFileSync(
  CALC_OUT,
  JSON.stringify(
    {
      source: 'scripts/floor-catalogue-structured.json',
      updatedAt: new Date().toISOString(),
      count: calcRows.length,
      highConfidenceNames: calcRows.filter((p) => p.confidence === 'high').length,
      placeholderNames: calcRows.filter((p) => p.confidence === 'placeholder').length,
      sizeHistogram: sizes,
      products: calcRows,
    },
    null,
    2,
  ),
  'utf8',
)

const goodCalc = calcRows.filter((r) => r.ocrOk).length
console.log(`names applied: ${nameApplied}`)
console.log(`sizes applied: ${sizeApplied}`)
console.log(`finishes applied: ${finishApplied}`)
console.log(`high: ${goodCalc} placeholders: ${calcRows.length - goodCalc}`)
console.log(`calculator seed: ${CALC_OUT}`)
console.log('size histogram:', sizes)
console.log(`weak: ${WEAK}`)
