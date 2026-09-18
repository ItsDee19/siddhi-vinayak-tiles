// The original PDF page remains the authority for every design and specification.
// Cache the small, immutable catalogue index instead of re-normalizing on each keypress.
const compiledIndexes = new WeakMap()

export function normalizeSearch(value = '') {
  const dimensionTokens = []
  return String(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/(\d+(?:\.\d+)?)\s*(?:mm|cm|in(?:ches)?|ft|["′″'])?\s*[x×✕]\s*(\d+(?:\.\d+)?)\s*(?:mm|cm|in(?:ches)?|ft|["′″'])?/g,
      (_, first, second) => {
        dimensionTokens.push(`${Math.min(Number(first), Number(second))}x${Math.max(Number(first), Number(second))}`)
        return ` dimensiontoken${dimensionTokens.length - 1} `
      })
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/[^a-z0-9x]+/g, ' ').trim().replace(/\s+/g, ' ')
    .replace(/dimensiontoken (\d+)/g, (match, index) => dimensionTokens[Number(index)] ?? match)
    .replace(/\bmatte\b/g, 'matt')
}

function compile(records) {
  if (!compiledIndexes.has(records)) {
    compiledIndexes.set(records, records.map((record, order) => {
      const name = normalizeSearch(record.name)
      const code = normalizeSearch(record.code)
      const text = normalizeSearch([record.name, record.code, record.size, record.finish,
        ...(record.aliases || [])].join(' '))
      return { record, order, name, code, tokens: text.split(' '),
        sizes: (record.sizes || [record.size]).map(normalizeSearch),
        finishes: (record.finishes || [record.finish]).map(normalizeSearch) }
    }))
  }
  return compiledIndexes.get(records)
}

function isAll(value) { return !value || value === 'all' }

function matchesTerm(token, term) {
  if (token === term) return true
  if (term.length <= 2 || /^\d+(?:\.\d+)?x\d/.test(term)) return false
  // Preserve significant leading zeros and avoid matching 007 inside 4007.
  return /^\d+$/.test(term) ? token.startsWith(term) : token.includes(term)
}

export function searchCatalogue(records, { query = '', bookId = 'all', size = 'all', finish = 'all' } = {}) {
  const normalizedQuery = normalizeSearch(query)
  const terms = normalizedQuery ? normalizedQuery.split(' ') : []
  const sizeKey = normalizeSearch(size)
  const finishKey = normalizeSearch(finish)
  return compile(records).filter(({ record, tokens, sizes, finishes }) =>
    (isAll(bookId) || record.bookId === bookId) &&
    (isAll(size) || sizes.includes(sizeKey)) &&
    (isAll(finish) || finishes.includes(finishKey)) &&
    terms.every(term => tokens.some(token => matchesTerm(token, term)))
  ).map(item => ({ ...item, rank: !normalizedQuery ? 0 :
    item.name === normalizedQuery || item.code === normalizedQuery ? 0 :
      item.name.startsWith(normalizedQuery) || item.code.startsWith(normalizedQuery) ? 1 : 2 }))
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map(item => item.record)
}

export function getFilterOptions(records, { bookId = 'all' } = {}) {
  const available = records.filter(record => isAll(bookId) || record.bookId === bookId)
  const values = (key, plural) => [...new Set(available.flatMap(record => record[plural] || [record[key]]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  return { sizes: values('size', 'sizes'), finishes: values('finish', 'finishes') }
}
