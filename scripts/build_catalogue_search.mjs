import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'))
const books = await readJson('src/data/catalogueBooks.generated.json')
const sourceFiles = {
  'global-floor': 'floor-catalogue-structured.json',
  'global-wall': 'gt2025-catalogue-structured.json',
  sky: 'sky12x18-catalogue-structured.json',
  sunflora: 'sunflora-catalogue-structured.json',
}

function dimensions(value = '') {
  return [...new Set([...String(value).matchAll(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/gi)]
    .map(([, first, second]) => [Number(first), Number(second)].sort((a, b) => a - b).join(' × ') + ' mm'))]
}

function finishLabel(value = '') {
  const label = String(value || '').trim().replace(/\s*\+\s*/g, ' + ').replace(/\s+/g, ' ')
  if (!label || /special colou?r/i.test(label)) return ''
  return label.toLowerCase().replace(/\bmatte\b/g, 'matt').replace(/\b\w/g, char => char.toUpperCase())
    .replace(/\b(?:Ghr|Pos)\b/g, word => word.toUpperCase())
}

const records = []
const coverageBooks = []
for (const book of books) {
  const historical = sourceFiles[book.id] ? await readJson(`scripts/${sourceFiles[book.id]}`) : null
  if (historical) assert.equal(historical.sourcePdf.split(/[\\/]/).at(-1), book.sourceName, `Wrong source book: ${book.id}`)
  let corrections
  try { corrections = await readJson(`scripts/catalogue-search-corrections-${book.id}.json`) }
  catch (error) { if (error.code !== 'ENOENT') throw error; corrections = { pages: [] } }
  if (corrections.sourceHash) assert.equal(corrections.sourceHash, book.sourceHash, `${book.id}: source changed; reverify labels`)
  const excludedPages = new Set((corrections.excludedPages || [1, 2]).map(page => typeof page === 'number' ? page : page.pdfPage))
  if (book.id === 'sky') { excludedPages.clear(); excludedPages.add(1) }
  const pageCorrections = new Map(corrections.pages.map(page => [page.pdfPage, page]))
  assert.equal(pageCorrections.size, corrections.pages.length, `Duplicate correction page in ${book.id}`)
  for (const page of excludedPages) {
    assert(Number.isInteger(page) && page >= 1 && page <= book.pageCount, `${book.id}: invalid excluded page ${page}`)
    assert(!pageCorrections.has(page), `${book.id}: product page ${page} cannot also be excluded`)
  }
  const sourcePages = new Set((historical?.products || []).filter(product => product.confidence !== 'non_product').map(product => product.pdfPage))
  for (const page of pageCorrections.keys()) sourcePages.add(page)
  if (!historical) {
    assert.equal(corrections.sourceHash, book.sourceHash, `${book.id}: new catalogue labels require a verified source hash`)
    for (let page = 1; page <= book.pageCount; page += 1) {
      assert(pageCorrections.has(page) || excludedPages.has(page), `${book.id}: page ${page} has not been reviewed`)
    }
  }
  const fallbackPages = []
  let designCount = 0
  for (const pageNumber of [...sourcePages].sort((a, b) => a - b)) {
    assert(Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= book.pageCount, `${book.id}: invalid PDF page ${pageNumber}`)
    if (excludedPages.has(pageNumber)) continue
    const originalPage = book.pages.find(page => page.number === pageNumber)
    assert(originalPage, `Missing page ${book.id}/${pageNumber}`)
    const page = pageCorrections.get(pageNumber)
    const products = page?.products || page?.codes?.map(code => ({ name: code, code })) || []
    if (!products.length) {
      fallbackPages.push(pageNumber)
      records.push({ id: `${book.id}-p${pageNumber}`, bookId: book.id, pageNumber,
        name: `Designs on page ${pageNumber}`, code: '', size: '', finish: '',
        aliases: [book.title, `page ${pageNumber}`], thumbnail: originalPage.thumbnail, kind: 'page' })
      continue
    }
    const seen = new Set()
    for (const product of products) {
      const name = product.name?.trim()
      assert(name && name.length < 120 && !/[<>]/.test(name), `${book.id}/${pageNumber}: invalid verified name`)
      const sizeMm = product.sizeMm ?? page.sizeMm ?? ''
      const sizes = dimensions(sizeMm)
      const size = sizes.join(' / ')
      const printedFinish = product.finish ?? page.finish ?? ''
      const finish = finishLabel(printedFinish)
      const finishes = finish.split(/\s*&\s*/).filter(Boolean)
      const code = product.code || (/^[A-Z0-9]+(?:[-_][A-Z0-9]+)*$/i.test(name) && /\d/.test(name) ? name : '')
      const key = [name, code, size, finish].join('|')
      if (seen.has(key)) continue
      seen.add(key)
      const sizeAliases = product.sizeFt ?? page.sizeFt ?? (book.id === 'sky' ? '12x18in' : book.id === 'sunflora' ? '2x4ft' : '')
      const aliases = [book.title, sizeAliases, product.sizeIn, page.sizeIn,
        product.category, page.category, ...(product.aliases || [])].filter(Boolean)
      if (printedFinish && !finish) aliases.push(printedFinish)
      if (/STRWBERRY/.test(name)) aliases.push(name.replace('STRWBERRY', 'STRAWBERRY'))
      records.push({ id: `${book.id}-p${pageNumber}-d${seen.size}`, bookId: book.id, pageNumber,
        name, code, size, finish, ...(sizes.length > 1 ? { sizes } : {}),
        ...(finishes.length > 1 ? { finishes } : {}), aliases: [...new Set(aliases)],
        thumbnail: originalPage.thumbnail, kind: 'design' })
      designCount += 1
    }
  }
  coverageBooks.push({ bookId: book.id, sourceName: book.sourceName, sourceHash: book.sourceHash,
    totalPages: book.pageCount, namedPages: pageCorrections.size, designCount,
    fallbackPages, excludedPages: [...excludedPages].sort((a, b) => a - b),
    method: corrections.method || 'Visually verified publisher labels with explicit one-based PDF page mappings.' })
}
const complete = coverageBooks.every(book => book.fallbackPages.length === 0)
const index = { version: 1, records, coverage: {
  complete,
  totalPages: books.reduce((sum, book) => sum + book.pageCount, 0),
  namedDesigns: records.filter(record => record.kind === 'design').length,
  fallbackPages: records.filter(record => record.kind === 'page').length,
  note: complete
    ? 'Search uses design names and codes checked against all catalogue design pages. Open the original page to confirm every printed size, finish and variant.'
    : 'Search uses checked design names and codes. Some pages are available to browse without indexed names. Open the original page to confirm all printed sizes, finishes and variants.',
  books: coverageBooks,
} }
const output = resolve(root, 'src/data/catalogueSearch.generated.json')
const serialized = JSON.stringify(index) + '\n'
if (process.argv.includes('--check')) {
  assert.equal(await readFile(output, 'utf8'), serialized, 'Catalogue search index is stale. Run node scripts/build_catalogue_search.mjs')
} else {
  await writeFile(output, serialized)
}
console.log(`Catalogue search: ${index.coverage.namedDesigns} checked designs, ${index.coverage.fallbackPages} original-page fallbacks across ${books.length} books.`)
