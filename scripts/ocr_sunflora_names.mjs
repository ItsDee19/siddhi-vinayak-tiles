/**
 * Read Sunflora product names straight off the catalogue pages.
 *
 * The Sunflora PDF (Mozilla "Exquisite Surfaces") has a far simpler layout than
 * the Global Tiles catalogues: one product per A4 portrait page, with the name
 * set as a bold heading in a fixed block on the right-hand side, under the QR
 * code and above the Size / Finish / Random / Thickness spec list.
 *
 * There is no text layer, so this crops that heading block and OCRs it.
 * Writes a review CSV; applies nothing.
 *
 *   node scripts/ocr_sunflora_names.mjs
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { createWorker } from 'tesseract.js'

const execFileP = promisify(execFile)
const ROOT = path.resolve(import.meta.dirname, '..')
const PDF = 'C:\\Users\\KIIT\\Downloads\\SUNFLORA 2X4 (NEW DES).pdf'
const WORK = path.join(ROOT, '.sunflora-work')
const OUT = path.join(ROOT, 'scripts/tile-names-review-sunflora.csv')

// The catalogue mixes two page layouts.
//
// Layout A - one product per page. Name is a bold heading on the right, under
// the QR code and above the Size / Finish / Random / Thickness list.
// Generous on the bottom so two-line names ("SP SUBWAY BLACK / DECOR") survive.
const LAYOUT_A = [{ slot: 1, x0: 0.54, y0: 0.495, x1: 0.98, y1: 0.63 }]

// Layout B - two products per page. Each name is a left-aligned heading sitting
// directly above its own swatch block.
const LAYOUT_B = [
  { slot: 1, x0: 0.11, y0: 0.432, x1: 0.58, y1: 0.472 },
  { slot: 2, x0: 0.11, y0: 0.592, x1: 0.58, y1: 0.632 },
]

// Spec labels and page furniture that are not product names.
const CHROME =
  /^(tap to details?|back|size|finish|random|thickness|www\.|mozilla|exquisite surfaces|the art of elegant living)/i

function cleanName(raw) {
  const lines = raw
    .split('\n')
    .map((l) => l.replace(/[^A-Za-z0-9&.\-/ ]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((l) => !CHROME.test(l))
    .filter((l) => !/^\d+(\.\d+)?\s*(mm)?$/i.test(l)) // stray "3", "9.0mm"
    .filter((l) => !/^\d+\s*x\s*\d+\s*mm$/i.test(l)) // "600x1200mm"
    .filter((l) => l.length >= 2)

  if (!lines.length) return ''
  // Names wrap to at most two lines; anything past that is spec bleed.
  return lines.slice(0, 2).join(' ').toUpperCase().replace(/\s+/g, ' ').trim()
}

function titleCase(s) {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

async function renderAll(dpi = 200) {
  await fs.mkdir(WORK, { recursive: true })
  const py = `
import fitz, os
d = fitz.open(r"${PDF}")
os.makedirs(r"${WORK}", exist_ok=True)
for i in range(len(d)):
    d[i].get_pixmap(dpi=${dpi}, alpha=False).save(os.path.join(r"${WORK}", f"p{i+1:03d}.png"))
print(len(d))
`
  const { stdout } = await execFileP('python', ['-c', py], { maxBuffer: 1 << 26 })
  return Number(stdout.trim().split('\n').pop())
}

async function main() {
  console.log('rendering sunflora pages...')
  const pages = await renderAll()
  console.log(`${pages} pages`)

  const worker = await createWorker('eng')

  async function ocrBox(png, W, H, box) {
    const crop = {
      left: Math.round(W * box.x0),
      top: Math.round(H * box.y0),
      width: Math.round(W * (box.x1 - box.x0)),
      height: Math.round(H * (box.y1 - box.y0)),
    }
    const buf = await sharp(png)
      .extract(crop)
      .greyscale()
      .normalise()
      .resize({ width: crop.width * 2 })
      .sharpen()
      .png()
      .toBuffer()
    const { data } = await worker.recognize(buf)
    return { name: cleanName(data.text), confidence: Math.round(data.confidence ?? 0) }
  }

  const found = []
  for (let p = 1; p <= pages; p++) {
    const png = path.join(WORK, `p${String(p).padStart(3, '0')}.png`)
    const { width: W, height: H } = await sharp(png).metadata()

    // Try layout A first (most pages are single-product).
    const a = await ocrBox(png, W, H, LAYOUT_A[0])
    if (a.name) {
      found.push({ page: p, slot: 1, name: a.name, confidence: a.confidence })
      console.log(`  p${String(p).padStart(2)}  A  ${a.name}`)
      continue
    }

    // Fall back to layout B (two products stacked, left-aligned headings).
    let any = false
    for (const box of LAYOUT_B) {
      const b = await ocrBox(png, W, H, box)
      if (b.name) {
        any = true
        found.push({ page: p, slot: box.slot, name: b.name, confidence: b.confidence })
        console.log(`  p${String(p).padStart(2)}  B${box.slot}  ${b.name}`)
      }
    }
    if (!any) {
      found.push({ page: p, slot: 0, name: '', confidence: 0 })
      console.log(`  p${String(p).padStart(2)}  (none)`)
    }
  }

  await worker.terminate()

  // Product pages are the ones that yielded a name; covers/dividers yield none.
  const productPages = found.filter((f) => f.name)
  console.log(`\n${productPages.length} product entries with a name`)

  // Map to sunflora-cNNN in page + slot order.
  const rows = productPages.map((f, i) => ({
    id: `sunflora-c${String(i + 1).padStart(3, '0')}`,
    page: f.page,
    slot: f.slot,
    suggestedName: titleCase(f.name),
    confidence: f.confidence,
  }))

  const src = await fs.readFile(path.join(ROOT, 'src/data/importedCatalogue.js'), 'utf8')
  const ids = [...src.matchAll(/"id":\s*"([^"]*)"/g)].map((m) => m[1])
  const names = [...src.matchAll(/"name":\s*"([^"]*)"/g)].map((m) => m[1])
  const currentById = new Map(ids.map((id, i) => [id, names[i]]))

  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`
  const csv =
    'id,page,slot,current_name,suggested_name,confidence,ACCEPT\n' +
    rows
      .map((r) =>
        [
          r.id,
          r.page,
          r.slot,
          currentById.get(r.id) ?? '',
          r.suggestedName,
          r.confidence,
          r.confidence >= 70 ? 'yes' : '',
        ]
          .map(esc)
          .join(','),
      )
      .join('\n')

  let outPath = OUT
  try {
    await fs.writeFile(outPath, csv + '\n', 'utf8')
  } catch (e) {
    if (e.code !== 'EBUSY') throw e
    outPath = OUT.replace('.csv', '-new.csv')
    await fs.writeFile(outPath, csv + '\n', 'utf8')
    console.log(`(original file is open elsewhere - wrote to a new file instead)`)
  }

  const strong = rows.filter((r) => r.confidence >= 70).length
  console.log(`${strong} at confidence >= 70 (pre-ticked ACCEPT)`)
  console.log(`review file: ${path.relative(ROOT, outPath)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
