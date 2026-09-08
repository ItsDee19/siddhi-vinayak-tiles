let pending = null
const subscribers = new Set()

export function publishCatalogueCategory(category) {
  if (!['tiles', 'sanitaryware', 'all'].includes(category)) return false
  if (subscribers.size) subscribers.forEach(receive => receive(category))
  else pending = category
  return true
}

export function subscribeCatalogueCategory(receive) {
  subscribers.add(receive)
  if (pending !== null) {
    const category = pending
    pending = null
    receive(category)
  }
  return () => subscribers.delete(receive)
}
