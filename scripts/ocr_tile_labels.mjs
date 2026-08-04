/**
 * OCR the label crops produced by scripts/detect_tile_regions.py and write a
 * single review CSV. Nothing is applied to importedCatalogue.js here.
 *
 * For each product id, several candidate crops may exist (fixed/mirrored,
 * above/below, plus a detected-region fallback). Each is OCR'd and the best
 * plausible result wins by a simple score: regex plausibility, then length,
 * then OCR confidence.
 *
 *   node scripts/ocr_tile_labels.mjs --family gt2025
 *   node scripts/ocr_tile_labels.mjs --family sunflora
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { createWorker } from 'tesseract.js'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const WORK_DIR = path.join(ROOT, '.tile-name-work')
const DATA = path.join(ROOT, 'src/data/importedCatalogue.js')

// Candidate crop keys, in the order worth trying (cheapest/most-reliable first).
// "mirrored" reaches across to the opposite side of the box, which is needed
// for sunflora (genuinely left/right ambiguous within a page) but for gt2025
// it can leak across the two-page-spread gutter and pick up an unrelated
// product's label -- keep it out of that family's candidate list.
const CANDIDATE_ORDER = {
  gt2025: ['fixed_below', 'fixed_above', 'region_below', 'region_above'],
  sunflora: ['fixed_below', 'mirrored_below', 'fixed_above', 'mirrored_above', 'region_below', 'region_above'],
}

function cleanText(raw) {
  return raw
    .replace(/[|_]/g, ' ')
    .replace(/[^A-Za-z0-9()&\- ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Recurring page chrome that OCR happily reads as if it were a product name.
// Seen verbatim across multiple pages/families during validation.
const CHROME_PHRASES = [
  /digital wall tiles/i,
  /exclusive collection/i,
  /^exclusive$/i,
  /global tiles?/i,
  /bathroom series/i,
  /vitrified tiles/i,
  /italian design/i,
  /glossy finish/i,
  /^size\b/i,
  /^glossy$/i,
  /wall tiles?$/i,
  /tap to details?/i,
  /^carving$/i, // "Surface: Carving" field value, not a product name
  /^back$/i,
  /^random\b/i,
  /^thickness\b/i,
]

/** A usable label is either a product-style code (letters+digits) or a short
 * all-caps-ish marketing name (2-5 words, no stray OCR noise words). */
function scoreCandidate(text) {
  const t = text.trim()
  if (!t || t.length < 3 || t.length > 40) return 0
  if (CHROME_PHRASES.some((re) => re.test(t))) return 0

  const isCode = /^[A-Za-z]{0,4}[-\s]?\d{2,5}([-\s][A-Za-z0-9]{1,4})?$/.test(t)
  const words = t.split(/\s+/)
  const isName = words.length >= 1 && words.length <= 5 && words.every((w) => /^[A-Za-z0-9&'-]+$/.test(w))
  const junkWord = /^(page|install|full|both|loss|pans|ewe|room|oom|digi|glos|tal|ish|ara|ing|size|s)$/i

  if (isCode) return 3
  if (isName && !words.some((w) => junkWord.test(w))) return 2
  if (isName) return 1
  return 0
}

/**
 * Candidate crops are a generous band that usually contains one real text
 * line plus a slice of whatever bordered it (a dark tile edge above, plain
 * background, or the start of the next photo below). Tesseract's own page
 * segmentation reliably loses the text line in that mix. Text rows have a
 * distinct signature -- mostly-white background (mean > 200) broken up by
 * dark letter strokes (stddev > 20) -- unlike a solid dark bar (low mean)
 * or photo texture (low mean, high variance) or blank background (near-zero
 * variance). Isolate that band and crop tightly to it before OCR.
 */
async function tightenToTextBand(file) {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info
  if (W < 4 || H < 4) return file

  const rowStat = (y) => {
    let s = 0
    let s2 = 0
    for (let x = 0; x < W; x++) {
      const v = data[y * W + x]
      s += v
      s2 += v * v
    }
    const m = s / W
    return { m, sd: Math.sqrt(Math.max(0, s2 / W - m * m)) }
  }

  // Bold black-on-white label text produces a sharp variance spike (stddev
  // 45-70+); a faint tile texture under similar mean brightness only wobbles
  // by ~15-25 and must not win just for being a longer run.
  const isTextRow = (y) => {
    const { m, sd } = rowStat(y)
    return m > 205 && sd > 35
  }

  let best = { start: -1, len: 0, score: 0 }
  let runStart = -1
  let runSdSum = 0
  for (let y = 0; y <= H; y++) {
    const hit = y < H && isTextRow(y)
    if (hit) {
      if (runStart === -1) {
        runStart = y
        runSdSum = 0
      }
      runSdSum += rowStat(y).sd
    }
    if (!hit && runStart !== -1) {
      const len = y - runStart
      const score = runSdSum // total variance mass: rewards both length and strength together
      if (score > best.score) best = { start: runStart, len, score }
      runStart = -1
    }
  }
  if (best.start === -1 || best.len < 3) return file // no text-like band found; let OCR try the whole crop
  const bestStart = best.start
  const bestLen = best.len

  const pad = 4
  const top = Math.max(0, bestStart - pad)
  const height = Math.min(H - top, bestLen + pad * 2)
  return sharp(file).extract({ left: 0, top, width: W, height }).toBuffer()
}

async function ocrImage(worker, file) {
  try {
    const tight = await tightenToTextBand(file)
    const meta = await sharp(tight).metadata()
    const buf = await sharp(tight)
      .greyscale()
      .normalise()
      .resize({ width: Math.max(600, meta.width * 3) })
      .sharpen()
      .png()
      .toBuffer()
    const { data } = await worker.recognize(buf)
    return { text: cleanText(data.text), confidence: data.confidence ?? 0 }
  } catch {
    return { text: '', confidence: 0 }
  }
}

async function main() {
  const family = process.argv[process.argv.indexOf('--family') + 1]
  if (!family) throw new Error('usage: node scripts/ocr_tile_labels.mjs --family <name>')

  const manifestPath = path.join(WORK_DIR, family, 'regions.json')
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))

  const src = await fs.readFile(DATA, 'utf8')
  const ids = [...src.matchAll(/"id":\s*"([^"]*)"/g)].map((m) => m[1])
  const names = [...src.matchAll(/"name":\s*"([^"]*)"/g)].map((m) => m[1])
  const nameById = new Map(ids.map((id, i) => [id, names[i]]))

  const worker = await createWorker('eng')

  const rows = []
  let done = 0
  for (const entry of manifest) {
    done++
    if (done % 25 === 0) console.log(`  ${family}: ${done}/${manifest.length}`)

    const currentName = nameById.get(entry.id) ?? ''
    let best = { text: '', confidence: 0, score: 0, source: '' }

    for (const key of CANDIDATE_ORDER[family]) {
      const rel = entry.crops?.[key]
      if (!rel) continue
      const { text, confidence } = await ocrImage(worker, path.join(ROOT, rel))
      // A crop can contain multiple lines; try the whole block and each line.
      // The region_* fallback is the least reliable path (arbitrary detected
      // contour, not a known label position) -- only trust it when the OCR
      // engine itself was confident about what it read.
      const minConfidence = key.startsWith('region_') ? 70 : 0
      if (confidence < minConfidence) continue

      if (confidence < 55) continue // too garbled to trust regardless of shape

      const candidates = [text, ...text.split('\n').map((l) => l.trim())].filter(Boolean)
      for (const c of candidates) {
        const score = scoreCandidate(c)
        if (score === 0) continue // never let a rejected candidate become "best"
        if (score > best.score || (score === best.score && confidence > best.confidence)) {
          best = { text: c, confidence, score, source: key }
        }
      }
      if (best.score >= 3) break // code-quality match found, stop searching
    }

    rows.push({
      id: entry.id,
      page: entry.page,
      current_name: currentName,
      suggested_name: best.text,
      source_crop: best.source,
      confidence: Math.round(best.confidence),
      quality: best.score,
    })
  }

  await worker.terminate()

  const outPath = path.join(ROOT, `scripts/tile-names-review-${family}.csv`)
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`
  const header = 'id,page,current_name,suggested_name,source_crop,confidence,quality,ACCEPT\n'
  const body = rows
    .map((r) => {
      const accept = r.quality >= 2 && r.suggested_name ? '' : '' // never pre-tick; human decides every row
      return [r.id, r.page, r.current_name, r.suggested_name, r.source_crop, r.confidence, r.quality, accept].map(esc).join(',')
    })
    .join('\n')
  await fs.writeFile(outPath, header + body + '\n', 'utf8')

  const strong = rows.filter((r) => r.quality >= 2).length
  console.log('')
  console.log(`${family}: ${rows.length} products, ${strong} with a plausible suggested name`)
  console.log(`review file: ${path.relative(ROOT, outPath)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
