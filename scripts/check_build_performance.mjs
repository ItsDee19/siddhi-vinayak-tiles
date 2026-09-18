import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { resolveConfig } from 'vite'

const config = await resolveConfig({}, 'build')
const output = path.resolve(config.root, config.build.outDir)
const manifest = JSON.parse(fs.readFileSync(path.join(output, '.vite/manifest.json'), 'utf8'))
const initial = new Set()
function visit(key) {
  if (initial.has(key)) return
  assert(manifest[key], `Missing manifest entry: ${key}`)
  initial.add(key)
  for (const dependency of manifest[key].imports || []) visit(dependency)
}
for (const [key, entry] of Object.entries(manifest)) if (entry.isEntry) visit(key)
const initialFiles = [...initial].map(key => manifest[key].file)
const initialGzip = initialFiles.reduce((bytes, file) => bytes + gzipSync(fs.readFileSync(path.join(output, file))).length, 0)
const cssFiles = [...new Set([...initial].flatMap(key => manifest[key].css || []))]
const cssGzip = cssFiles.reduce((bytes, file) => bytes + gzipSync(fs.readFileSync(path.join(output, file))).length, 0)
const totalSize = directory => fs.readdirSync(directory, { withFileTypes: true }).reduce((bytes, entry) => bytes + (entry.isDirectory() ? totalSize(path.join(directory, entry.name)) : fs.statSync(path.join(directory, entry.name)).size), 0)
const report = { initialFiles, initialJavaScriptGzipBytes: initialGzip, initialCssGzipBytes: cssGzip, outputBytes: totalSize(output), catalogueBytes: totalSize(path.join(output, 'catalogues')) }
console.log(JSON.stringify(report, null, 2))
assert(initialGzip <= 135 * 1024, `Initial JS exceeds 135 KiB gzip (${initialGzip} bytes). Keep catalogue data and Three.js lazy.`)
assert(cssGzip <= 35 * 1024, `Critical CSS exceeds 35 KiB gzip (${cssGzip} bytes).`)
assert(!initialFiles.some(file => /(?:CatalogueLibrary|SizeCalculator|three)-/.test(path.basename(file))), 'Optional catalogue, calculator or Three.js is on the initial dependency chain')
