import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { products } from '../src/data/catalogue.js'
import manifest from '../src/data/responsiveImageManifest.js'
import { getResponsiveImageProps, CATALOGUE_IMAGE_SIZES, PRODUCT_DETAIL_IMAGE_SIZES } from '../src/utils/responsiveImages.js'

const publicRoot = new URL('../public/', import.meta.url)
const assetPath = url => fileURLToPath(new URL(url.slice(1), publicRoot))

test('every current catalogue photograph has native dimensions and smaller responsive candidates', () => {
  const sources = [...new Set(products.map(product => product.imageUrl).filter(Boolean))].sort()
  assert.deepEqual(Object.keys(manifest).sort(), sources)
  for (const [url, entry] of Object.entries(manifest)) {
    assert.ok(entry.width > 0 && entry.height > 0, url)
    assert.ok(Array.isArray(entry.variants), url)
    const widths = entry.variants.map(variant => variant.width)
    assert.deepEqual(widths, [...new Set(widths)].sort((a, b) => a - b))
    assert.ok(widths.every(width => width < entry.width), `No upscaling: ${url}`)
  }
})

test('every shipped candidate is a valid smaller WebP with the declared width and original aspect ratio', async () => {
  for (const [url, entry] of Object.entries(manifest)) {
    const original = await stat(assetPath(url))
    for (const variant of entry.variants) {
      const file = assetPath(variant.src)
      const [info, output] = await Promise.all([sharp(file).metadata(), stat(file)])
      assert.equal(info.format, 'webp', variant.src)
      assert.equal(info.width, variant.width, variant.src)
      assert.ok(Math.abs(info.height - entry.height * variant.width / entry.width) <= 1, variant.src)
      assert.ok(output.size > 0 && output.size < original.size, variant.src)
    }
  }
})

test('responsive attributes preserve original fallback and distinguish grid from detail sizing', () => {
  const product = products.find(product => product.imageUrl)
  const image = getResponsiveImageProps(product.imageUrl)
  assert.equal(image.src, product.imageUrl)
  assert.equal(image.sizes, CATALOGUE_IMAGE_SIZES)
  assert.ok(image.srcSet.endsWith(`${product.imageUrl} ${image.width}w`))
  assert.equal(getResponsiveImageProps(product.imageUrl, { sizes: PRODUCT_DETAIL_IMAGE_SIZES }).sizes, PRODUCT_DETAIL_IMAGE_SIZES)
  for (const unknown of ['/uploads/new-photo.webp', 'data:image/png;base64,example', 'constructor', undefined]) {
    assert.deepEqual(getResponsiveImageProps(unknown), { src: unknown })
  }
})

test('compression preserves the overall RGB colour of representative catalogue photographs', async () => {
  // Check image content, not encoder options: accidental tinting/colour filters
  // would change these means even while dimensions and file paths still pass.
  const samples = [products[0], products[200], products[400], products.at(-1)].filter(product => product?.imageUrl)
  for (const product of samples) {
    const original = await readFile(assetPath(product.imageUrl))
    const variant = manifest[product.imageUrl].variants[0]
    const [before, after] = await Promise.all([
      sharp(original).stats(),
      sharp(assetPath(variant.src)).stats(),
    ])
    for (let channel = 0; channel < 3; channel += 1) {
      assert.ok(Math.abs(before.channels[channel].mean - after.channels[channel].mean) < 3,
        `${product.id}: channel ${channel} colour drift`)
    }
  }
})

test('first mobile catalogue page uses less than half the original photo bytes at DPR2', async () => {
  let originalBytes = 0
  let selectedBytes = 0
  for (const product of products.slice(0, 6)) {
    const entry = manifest[product.imageUrl]
    // At 390px the grid image is 169px wide; a 2x screen requests 338px.
    const selected = entry.variants.find(variant => variant.width >= 338)
    assert.ok(selected, product.id)
    const [original, responsive] = await Promise.all([
      stat(assetPath(product.imageUrl)), stat(assetPath(selected.src)),
    ])
    originalBytes += original.size
    selectedBytes += responsive.size
  }
  assert.ok(selectedBytes < originalBytes / 2, `${selectedBytes}/${originalBytes} bytes`)
})
