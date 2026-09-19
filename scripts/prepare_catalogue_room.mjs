import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

// A reviewed image is imported explicitly; this never generates or substitutes artwork.
// node scripts/prepare_catalogue_room.mjs <reviewed-entry.json> <ledger.json>
const [entryPath, ledgerPath] = process.argv.slice(2)
if (!entryPath || !ledgerPath) throw new Error('Provide a reviewed entry JSON and its output ledger path.')
const entry = JSON.parse(await readFile(entryPath, 'utf8'))
if (!/^[a-z0-9-]+$/.test(entry.productId) || !entry.generatedPath || !entry.prompt || !entry.qaNotes) {
  throw new Error('A product ID, generated image, generation prompt and visual review notes are required.')
}
const input = await readFile(entry.generatedPath)
const metadata = await sharp(input).metadata()
if (!metadata.width || !metadata.height || Math.min(metadata.width, metadata.height) < 768) {
  throw new Error('Room images must have valid dimensions and a native short edge of at least 768px.')
}
const digest = createHash('sha256').update(input).digest('hex').slice(0, 12)
const folder = path.resolve('public/catalogue-rooms')
await mkdir(folder, { recursive: true })
const basename = `${entry.productId}.${digest}`
const preview = `${basename}-preview.webp`
const detail = `${basename}-detail.webp`
await sharp(input).rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86, effort: 6 }).toFile(path.join(folder, preview))
await sharp(input).rotate().webp({ quality: 91, effort: 6 }).toFile(path.join(folder, detail))
const output = {
  ...entry,
  image: `/catalogue-rooms/${preview}`,
  detailImage: `/catalogue-rooms/${detail}`,
  width: metadata.width,
  height: metadata.height,
  label: 'AI room preview',
  provenance: 'ai-generated',
}
let ledger = []
try { ledger = JSON.parse(await readFile(ledgerPath, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
const previous = ledger.find(item => item.productId === output.productId)
if (previous) throw new Error(`Already imported ${output.productId}; review and remove its ledger entry before replacing.`)
ledger.push(output)
await mkdir(path.dirname(path.resolve(ledgerPath)), { recursive: true })
await writeFile(ledgerPath, JSON.stringify(ledger, null, 2) + '\n')
console.log(JSON.stringify({ productId: output.productId, image: output.image, width: output.width, height: output.height }))
