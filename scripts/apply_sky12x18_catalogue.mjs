/**
 * Apply Sky 12×18 structured extract into importedCatalogue.js
 * and write sky12x18SizeCalculator.json seed.
 *
 *   node scripts/apply_sky12x18_catalogue.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA = path.join(ROOT, 'src/data/importedCatalogue.js')
const EXTRACT = path.join(ROOT, 'scripts/sky12x18-catalogue-structured.json')
const CALC = path.join(ROOT, 'src/data/sky12x18SizeCalculator.json')
const WEAK = path.join(ROOT, 'scripts/sky12x18-weak-slots-remaining.csv')

function isGoodName(name) {
  if (!name || name.length < 3 || name.length > 32) return false
  if (/^Sky\s+12x18/i.test(name)) return false
  if (/^74-HIME$/i.test(name) || /^HIME$/i.test(name)) return false
  // special-colour spreads (no numeric code on page)
  if (/^Special[-\s]?Colour$/i.test(name)) return true
  // design codes: 123-L, 150-AQUA, WOOD-11-LT, ARCH-WHITE
  if (/^ARCH-?WHITE$/i.test(name)) return true
  if (/^(WOOD[-\s]?\d+[-\s]?[A-Z]{0,3}|\d{2,5}[-\s]?[A-Z]{1,6})$/i.test(name)) return true
  const letters = [...name].filter((c) => /[A-Za-z]/.test(c)).length
  const digits = [...name].filter((c) => /\d/.test(c)).length
  return letters >= 1 && digits >= 2 && name.length <= 20
}

function formatName(raw) {
  const t = (raw || '').trim()
  if (!t) return ''
  if (/^special\s*colour$/i.test(t) || /^special-colour$/i.test(t)) return 'Special Colour'
  if (/^arch[-\s]?white$/i.test(t)) return 'ARCH-WHITE'
  // design codes → UPPER with hyphens
  return t.toUpperCase().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function cardNum(id) {
  const m = /c(\d+)$/i.exec(id)
  return m ? Number(m[1]) : 0
}

const extract = JSON.parse(fs.readFileSync(EXTRACT, 'utf8'))
let src = fs.readFileSync(DATA, 'utf8')
let nameOk = 0
let sizeOk = 0
let finishOk = 0
const weak = []
const calc = []

for (const p of extract.products) {
  let name = formatName(p.name || '')
  const good = isGoodName(name)
  if (!good) {
    name = `Sky 12x18 Concept #${cardNum(p.id)}`
    weak.push({ ...p, name, ocrName: p.name })
  } else {
    nameOk++
  }

  const sizeMm = p.sizeMm || '450×300mm'
  const finish = p.finish || 'Glossy'

  calc.push({
    id: p.id,
    name,
    sizeMm,
    sizeIn: p.sizeIn || '12"×18"',
    finish,
    surface: 'Wall',
    confidence: good ? 'high' : 'placeholder',
    textureUrl: p.textureUrl || `/assets/catalogue/swatches/${p.id}-swatch.webp`,
  })

  if (good) {
    const nameRe = new RegExp(`("id":\\s*"${p.id}",\\s*\\n\\s*"name":\\s*")([^"]*)(")`)
    if (nameRe.test(src)) {
      src = src.replace(nameRe, (_m, a, _b, c) => `${a}${name}${c}`)
    }
  }

  const blockRe = new RegExp(
    `("id":\\s*"${p.id}"[\\s\\S]*?)("size":\\s*")([^"]*)(")([\\s\\S]*?"finish":\\s*")([^"]*)(")`,
  )
  if (blockRe.test(src)) {
    src = src.replace(blockRe, (_m, pre, sPre, _os, sPost, fPre, _of, fPost) => {
      sizeOk++
      finishOk++
      return `${pre}${sPre}${sizeMm}${sPost}${fPre}${finish}${fPost}`
    })
  }
}

fs.writeFileSync(DATA, src, 'utf8')

const sizes = {}
for (const p of calc) sizes[p.sizeMm] = (sizes[p.sizeMm] || 0) + 1

fs.writeFileSync(
  CALC,
  JSON.stringify(
    {
      source: 'scripts/sky12x18-catalogue-structured.json',
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

const wlines = [
  'id,name,ocrName,sizeMm,finish,pdfPage,textureUrl',
  ...weak.map(
    (p) =>
      `"${p.id}","${p.name}","${(p.ocrName || '').replace(/"/g, "'")}","${p.sizeMm || ''}","${p.finish || ''}","${p.pdfPage}","${p.textureUrl || ''}"`,
  ),
]
fs.writeFileSync(WEAK, wlines.join('\n'), 'utf8')

console.log(`products: ${calc.length}`)
console.log(`high names: ${nameOk}`)
console.log(`placeholders: ${weak.length}`)
console.log(`sizes applied: ${sizeOk}`)
console.log(`finishes applied: ${finishOk}`)
console.log('size histogram:', sizes)
console.log(`calc: ${CALC}`)
console.log(`weak: ${WEAK}`)
