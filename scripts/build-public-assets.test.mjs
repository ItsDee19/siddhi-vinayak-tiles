import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { assertChildPath, pruneLegacyPublicFiles, referencedLegacyUrls } from './build-public-assets.mjs'
import { missingPageRoute, staticPageRoutes } from './local-site-routes.mjs'

function fixture(t) {
  const fixtures = path.resolve('build-artifacts/performance-tests')
  fs.mkdirSync(fixtures, { recursive: true })
  const root = fs.mkdtempSync(path.join(fixtures, 'tile-build-'))
  t.after(() => fs.rmSync(assertChildPath(fixtures, root), { recursive: true, force: true }))
  const output = path.join(root, 'custom-output')
  const write = (name, value = 'asset') => {
    const target = path.join(output, name)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, value)
    return target
  }
  return { root, output, write }
}

test('custom output pruning keeps current covers, all PDFs/page images, and public policy assets', t => {
  const { root, output, write } = fixture(t)
  const retained = ['catalogues/rich.pdf', 'catalogues/rich/page-006-detail.webp', 'fonts/outfit.woff2', '404.html', 'assets/catalogue/room.webp', 'assets/catalogue/with space.webp']
  for (const name of [...retained, '2d-rooms/unused/model.glb', 'textures/unused.webp', 'assets/catalogue/swatches/raw.webp']) write(name)
  const result = pruneLegacyPublicFiles({ outDir: output, projectRoot: root, sources: ['const cover="/assets/catalogue/room.webp?v=1"; const second="/assets/catalogue/with%20space.webp"'] })
  assert.equal(result.removedFiles, 3)
  assert.equal(result.retainedFiles, 2)
  for (const name of retained) assert(fs.existsSync(path.join(output, name)), name)
  assert(!fs.existsSync(path.join(output, 'textures/unused.webp')))
})

test('dynamic asset prefixes preserve every possible runtime file', t => {
  const { root, output, write } = fixture(t)
  write('assets/catalogue/visualizer_tiles/design.webp')
  write('assets/catalogue/interpolated/design.webp')
  write('assets/catalogue/unused.webp')
  const result = pruneLegacyPublicFiles({ outDir: output, projectRoot: root, sources: ['const url="/assets/catalogue/visualizer_tiles/"+name', 'const template = `/assets/catalogue/interpolated/${name}.webp`'] })
  assert.equal(result.retainedFiles, 2)
  assert.equal(result.removedFiles, 1)
  assert.deepEqual(referencedLegacyUrls(['"/textures/ivory.webp"']), ['/textures/ivory.webp'])
})

test('pruning rejects source directories, path escapes and junctions before deleting anything', t => {
  const { root, output, write } = fixture(t)
  const publicDir = path.join(root, 'public')
  fs.mkdirSync(publicDir)
  write('textures/unused.webp')
  assert.throws(() => assertChildPath(output, path.resolve(output, '../escaped')), /outside/)
  assert.throws(() => assertChildPath(output, output), /outside/)
  assert.throws(() => pruneLegacyPublicFiles({ outDir: root, projectRoot: root, sources: [] }), /source/)
  assert.throws(() => pruneLegacyPublicFiles({ outDir: publicDir, projectRoot: root, publicDir, sources: [] }), /source/)
  assert.throws(() => pruneLegacyPublicFiles({ outDir: path.join(publicDir, 'nested-output'), projectRoot: root, publicDir, sources: [] }), /source/)
  fs.symlinkSync(publicDir, path.join(output, '2d-rooms'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.throws(() => pruneLegacyPublicFiles({ outDir: output, projectRoot: root, sources: [] }), /linked/)
  assert(fs.existsSync(path.join(output, 'textures/unused.webp')))
})

function request(middleware, url, { method = 'GET', accept = 'text/html' } = {}) {
  const response = { headers: {}, statusCode: 200, setHeader(key, value) { this.headers[key] = value }, end(value) { this.body = value; this.ended = true } }
  middleware({ url, method, headers: { accept } }, response, () => { response.next = true })
  return response
}

test('local static pages have production-like status codes without swallowing application modules', t => {
  const { output, write } = fixture(t)
  write('privacy-policy/index.html', '<title>Privacy</title>')
  write('404.html', '<title>Page not found</title>')
  write('index.html', '<div id="root"></div>')
  assert.equal(request(staticPageRoutes(output), '/privacy-policy').statusCode, 200)
  assert.equal(request(staticPageRoutes(output), '/privacy-policy/', { method: 'HEAD' }).body, undefined)
  assert.equal(request(staticPageRoutes(output), '/404.html').statusCode, 404)
  assert.equal(request(missingPageRoute(output, output), '/not-found').statusCode, 404)
  assert.equal(request(missingPageRoute(output, output), '/not-found').headers['X-Robots-Tag'], 'noindex')
  assert.equal(request(missingPageRoute(output, output), '/').next, true)
  assert.equal(request(missingPageRoute(output, output), '/index.html').next, true)
  assert.equal(request(missingPageRoute(output, output), '/src/main.jsx').next, true)
  assert.equal(request(missingPageRoute(output, output), '/@vite/client').next, true)
  assert.equal(request(missingPageRoute(output, output), '/not-found', { method: 'POST' }).next, true)
  assert.equal(request(staticPageRoutes(output), '/privacy-policy', { method: 'POST' }).next, true)
  assert.equal(request(missingPageRoute(output, output), '/missing.webp', { accept: 'image/webp' }).next, true)
})
