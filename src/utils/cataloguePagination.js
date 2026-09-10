// Fixed-size pages keep browsing from continually lengthening the home page.
export function getCataloguePage(items, requestedPage = 0, pageSize = 6) {
  const size = Math.max(1, Math.trunc(pageSize) || 1)
  const pageCount = Math.ceil(items.length / size)
  const pageIndex = Math.min(Math.max(0, Math.trunc(requestedPage) || 0), Math.max(0, pageCount - 1))
  const offset = pageIndex * size
  return {
    pageIndex,
    pageCount,
    items: items.slice(offset, offset + size),
    start: items.length ? offset + 1 : 0,
    end: Math.min(offset + size, items.length),
  }
}

// Persist the reset so crossing a breakpoint twice cannot revive an old page.
export function reconcileCataloguePage(state, results, size) {
  return state.results === results && state.size === size
    ? state
    : { results, index: 0, size }
}

// Static catalogue pages deep-link only to a product in our local inventory.
export function productFromCatalogueQuery(items, search) {
  const id = new URLSearchParams(search).get('product')
  return id ? items.find((product) => product.id === id) || null : null
}
