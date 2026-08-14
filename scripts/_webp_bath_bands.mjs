import sharp from 'sharp'
import fs from 'fs'

const rooms = ['bathroom-01', 'large-bathroom-b']
const names = ['mask-wall-lower', 'mask-wall-feature', 'mask-wall-upper']
for (const r of rooms) {
  for (const n of names) {
    const src = `public/2d-rooms/${r}/${n}.png`
    const dest = `public/2d-rooms/${r}/${n}.webp`
    await sharp(src).webp({ lossless: true, effort: 4 }).toFile(dest)
    console.log(r, n, fs.statSync(dest).size)
  }
}
