// Small collection shelf covers; the reader continues to use original artwork.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const books = JSON.parse(await readFile(path.join(root, 'src/data/catalogueBooks.generated.json'), 'utf8'))
const publisherRooms = {
  'global-floor': '/assets/catalogue/gt-floor-p2-install.webp',
  'global-wall': '/assets/catalogue/gt-2025-p3-install.webp',
  sky: '/assets/catalogue/sky12x18-c001.webp',
  sunflora: '/assets/catalogue/sunflora-c001.webp',
}
const output = path.join(root, 'public/catalogue-covers')
await mkdir(output, { recursive: true })
const covers = {}
let before = 0, after = 0
for (const book of books) {
  const url = book.cardImage || publisherRooms[book.id] || book.thumbnail || book.cover
  const source = path.join(root, 'public', url)
  const image = await sharp(source).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toBuffer()
  const hash = createHash('sha256').update(image).digest('hex').slice(0, 12)
  const name = `${book.id}-${hash}.webp`
  await writeFile(path.join(output, name), image)
  covers[book.id] = `/catalogue-covers/${name}`
  before += (await stat(source)).size
  after += image.byteLength
}
await writeFile(path.join(root, 'src/data/catalogueCovers.generated.json'), `${JSON.stringify(covers, null, 2)}\n`)
console.log(`Collection shelf: ${books.length} covers, ${before.toLocaleString()} → ${after.toLocaleString()} bytes. Full-size reader images unchanged.`)
