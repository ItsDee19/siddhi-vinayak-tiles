// Branded 1200x630 sharing card using actual publisher art already displayed by
// the catalogue. Run when the brand or selected catalogue photo changes.
import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'public/catalogues/global-floor/page-003-detail.webp')
const { width, height } = await sharp(source).metadata()
const { stories } = JSON.parse(await readFile(path.join(root, 'scripts/catalogue-gallery-map-global-floor.json'), 'utf8'))
const rect = stories.find(story => story.id === 'global-floor-p3-left').views.room.rect
const [left, top, regionWidth, regionHeight] = rect.map((value, index) => Math.round(value * (index % 2 ? height : width)))
const photo = await sharp(source).extract({ left, top, width: regionWidth, height: regionHeight }).resize(568, 630, { fit: 'cover' }).toBuffer()
const logo = await sharp(path.join(root, 'public/favicon-192.png')).resize(58, 58).toBuffer()
const overlay = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect x="44" y="44" width="1112" height="542" rx="26" fill="none" stroke="#efd095" stroke-opacity=".48"/>
  <text x="136" y="97" fill="#efd095" font-family="Arial, sans-serif" font-size="16" letter-spacing="2">NUAPADA · ODISHA</text>
  <text x="70" y="221" fill="#fff8ec" font-family="Georgia, serif" font-size="55">Sidhhi Binayak</text>
  <text x="70" y="285" fill="#fff8ec" font-family="Georgia, serif" font-size="55">Tiles</text>
  <text x="73" y="356" fill="#e8ddcb" font-family="Arial, sans-serif" font-size="22">Tiles · Marble · Granite · Quartz</text>
  <text x="73" y="389" fill="#e8ddcb" font-family="Arial, sans-serif" font-size="22">&amp; Sanitaryware</text>
  <line x1="73" y1="440" x2="170" y2="440" stroke="#efd095" stroke-width="2"/>
  <text x="73" y="488" fill="#efd095" font-family="Arial, sans-serif" font-size="23">Find the finish for your home.</text>
  <text x="73" y="545" fill="#e8ddcb" font-family="Arial, sans-serif" font-size="17">sidhhibinayaktiles.com</text>
</svg>`)
const output = await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#2c1a0e' } })
  .composite([{ input: photo, top: 0, left: 632 }, { input: logo, top: 62, left: 66 }, { input: overlay }])
  .jpeg({ quality: 86, mozjpeg: true }).toBuffer()
await writeFile(path.join(root, 'public/social-preview.jpg'), output)
console.log(`Social preview: 1200x630 / ${(output.length / 1024).toFixed(1)} KB`)
