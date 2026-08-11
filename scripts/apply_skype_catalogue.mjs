/**
 * Apply Skype 2×4 structured extract into catalogue + size calculator seed.
 *
 *   node scripts/apply_skype_catalogue.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA = path.join(ROOT, 'src/data/importedCatalogue.js')
const EXTRACT = path.join(ROOT, 'scripts/skype-catalogue-structured.json')
const CALC = path.join(ROOT, 'src/data/skypeSizeCalculator.json')
const WEAK = path.join(ROOT, 'scripts/skype-weak-slots-remaining.csv')

function isGoodName(name) {
  if (!name || name.length < 5) return false
  return /^Skype\s+\d{4}$/i.test(name)
}

function cardNum(id) {
  const m = /c(\d+)$/i.exec(id)
  return m ? Number(m[1]) : 0
}

const extract = JSON.parse(fs.readFileSync(EXTRACT, 'utf8'))
let src = fs.readFileSync(DATA, 'utf8')

// Prefer existing catalogue names (already coded Skype 2551…) when OCR is weak
const existingNames = new Map()
for (const m of src.matchAll(/"id":\s*"(skype-c\d+)",\s*\n\s*"name":\s*"([^"]+)"/g)) {
  existingNames.set(m[1], m[2])
}

let nameOk = 0
let sizeOk = 0
let finishOk = 0
const weak = []
const calc = []

for (const p of extract.products) {
  let name = p.name || ''
  if (!isGoodName(name) && isGoodName(existingNames.get(p.id) || '')) {
    name = existingNames.get(p.id)
  }
  const good = isGoodName(name)
  if (!good) {
    name = `Skype Tile #${cardNum(p.id)}`
    weak.push({ ...p, name, ocrName: p.name })
  } else {
    nameOk++
  }

  const sizeMm = p.sizeMm || '600×1200mm'
  const finish = p.finish || 'Glossy'

  calc.push({
    id: p.id,
    name,
    code: p.code || null,
    sizeMm,
    sizeFt: p.sizeFt || '2×4 Ft',
    finish,
    surface: 'Floor & Wall',
    confidence: good ? 'high' : 'placeholder',
    textureUrl: p.textureUrl,
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
      source: 'scripts/skype-catalogue-structured.json',
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

fs.writeFileSync(
  WEAK,
  [
    'id,name,ocrName,sizeMm,pdfPage,textureUrl',
    ...weak.map(
      (p) =>
        `"${p.id}","${p.name}","${(p.ocrName || '').replace(/"/g, "'")}","${p.sizeMm || ''}","${p.pdfPage}","${p.textureUrl || ''}"`,
    ),
  ].join('\n'),
  'utf8',
)

console.log(`products: ${calc.length}`)
console.log(`high names: ${nameOk}`)
console.log(`placeholders: ${weak.length}`)
console.log(`sizes applied: ${sizeOk}`)
console.log('size histogram:', sizes)
console.log(`calc: ${CALC}`)
