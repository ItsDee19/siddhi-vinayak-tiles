import manifest from './catalogueGallery.generated.json'
import index from './catalogueSearch.generated.json'
import { catalogues } from './catalogueBooks'

const records = new Map(index.records.map(record => [record.id, record]))
export const galleryStories = manifest.stories.map(story => {
  const book = catalogues.find(item => item.id === story.bookId)
  const products = story.productIds.map(id => records.get(id))
  const title = story.title || [...new Set(products.map(product => product.name))].join(' / ')
  return { ...story, title, book, page: book.pages[story.pageNumber - 1], products,
    specs: [...new Set(products.flatMap(product => [product.size, product.finish]).filter(Boolean))].join(' · ') }
})
export const storyById = new Map(galleryStories.map(story => [story.id, story]))
export const storyByProduct = new Map(galleryStories.flatMap(story => story.productIds.map(id => [id, story])))
export const storiesByBook = Object.fromEntries(catalogues.map(book => [book.id, galleryStories.filter(story => story.bookId === book.id)]))
