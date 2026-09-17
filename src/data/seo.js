import { business } from './siteConfig.js'

// Confirmed by the owner. A per-deployment Vercel hostname is never canonical.
export const PRODUCTION_ORIGIN = 'https://sidhhibinayaktiles.com'
export const siteTitle = `Tile Catalogues in Nuapada | ${business.name}`
export const siteDescription = 'Explore Global, Sky and Sunflora tile catalogues in detail. Visit Sidhhi Binayak Tiles in Nuapada, Odisha for tiles, stone and sanitaryware.'
export const INDEX_PAGE_SIZE = 12
export const socialImage = { path: '/og-image.jpg', width: 1199, height: 630 }
export const socialImageAlt = 'Sidhhi Binayak Tiles catalogue library in Nuapada, with a room from the original Global floor collection'
export const policyLinks = [
  { href: '/privacy-policy/', label: 'Privacy policy' },
  { href: '/terms-and-conditions/', label: 'Website terms' },
]

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

export function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

export function resolveSiteOrigin(env = {}) {
  const value = env.SITE_URL?.trim() || PRODUCTION_ORIGIN
  let url
  try { url = new URL(value) } catch { throw new Error('SITE_URL must be an absolute HTTPS production origin') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/'
    || url.search || url.hash || !url.hostname.includes('.') || url.hostname.endsWith('.localhost')
    || /^\d+(\.\d+){3}$/.test(url.hostname)) {
    throw new Error('SITE_URL must be an HTTPS production origin without credentials, port, path, query or fragment')
  }
  return url.origin
}

export function isPreviewBuild(env = {}) {
  return env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'development'
}

export function cataloguePath(id, index = 1) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Invalid catalogue identifier')
  if (!Number.isInteger(index) || index < 1) throw new Error('Index number must be positive')
  return `/catalogues/${id}/${index > 1 ? `page/${index}/` : ''}`
}

export function readerPath(id, page = 1) {
  if (!Number.isInteger(page) || page < 1) throw new Error('PDF page number must be positive')
  return `/?catalogue=${encodeURIComponent(id)}&page=${page}#catalogue`
}

export function catalogueIndexPages(book, pageSize = INDEX_PAGE_SIZE) {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('Page size must be positive')
  const total = Math.max(1, Math.ceil(book.pages.length / pageSize))
  return Array.from({ length: total }, (_, index) => ({
    book, number: index + 1, total, path: cataloguePath(book.id, index + 1),
    previous: index ? cataloguePath(book.id, index) : null,
    next: index + 1 < total ? cataloguePath(book.id, index + 2) : null,
    pages: book.pages.slice(index * pageSize, (index + 1) * pageSize),
    start: book.pages.length ? index * pageSize + 1 : 0,
    end: Math.min((index + 1) * pageSize, book.pages.length),
  }))
}

export function catalogueMetadata(page) {
  return {
    path: page.path,
    title: `${page.book.title}${page.number > 1 ? ` · Pages ${page.start}–${page.end}` : ''} | ${business.name}`,
    description: `Explore pages ${page.start}–${page.end} of ${page.book.title}. Enlarge original tile designs and printed details, open the PDF and enquire at our Nuapada showroom.`,
    book: page.book,
  }
}

export function structuredData({ origin = PRODUCTION_ORIGIN, path = '/', title = siteTitle, description = siteDescription, book, books } = {}) {
  const pageUrl = `${origin}${path}`
  const showroomId = `${origin}/#showroom`
  const websiteId = `${origin}/#website`
  const document = item => ({
    '@type': 'DigitalDocument', '@id': `${origin}${cataloguePath(item.id)}#document`,
    name: item.title, description: item.description, url: `${origin}${cataloguePath(item.id)}`,
    encoding: { '@type': 'MediaObject', contentUrl: `${origin}${item.pdfUrl}`, encodingFormat: 'application/pdf' },
  })
  const graph = [
    {
      '@type': 'HomeGoodsStore', '@id': showroomId, name: business.name,
      description: business.intro, telephone: business.phoneTel, url: `${origin}/`,
      logo: `${origin}/logo-emblem.png`, image: `${origin}${socialImage.path}`,
      address: {
        '@type': 'PostalAddress', streetAddress: `${business.address.line1}, ${business.address.line2}`,
        addressLocality: business.address.city, addressRegion: business.address.state,
        postalCode: business.address.pin, addressCountry: 'IN',
      },
    },
    { '@type': 'WebSite', '@id': websiteId, name: business.name, url: `${origin}/`, inLanguage: 'en-IN', publisher: { '@id': showroomId } },
    {
      '@type': path.startsWith('/catalogues/') ? 'CollectionPage' : 'WebPage', '@id': `${pageUrl}#webpage`,
      url: pageUrl, name: title, description, inLanguage: 'en-IN',
      isPartOf: { '@id': websiteId }, about: { '@id': showroomId },
      ...(book ? { mainEntity: { '@id': `${origin}${cataloguePath(book.id)}#document` } } : {}),
    },
  ]
  if (book) graph.push(document(book))
  if (books) graph.push({
    '@type': 'ItemList', '@id': `${pageUrl}#catalogues`, name: 'Original tile catalogues',
    numberOfItems: books.length,
    itemListElement: books.map((item, index) => ({ '@type': 'ListItem', position: index + 1, item: document(item) })),
  })
  if (path !== '/') graph.push({
    '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
      ...(book ? [{ '@type': 'ListItem', position: 2, name: 'Tile catalogues', item: `${origin}/catalogues/` }] : []),
      { '@type': 'ListItem', position: book ? 3 : 2, name: book?.title || title.split(' | ')[0], item: pageUrl },
    ],
  })
  return { '@context': 'https://schema.org', '@graph': graph }
}

export function renderSeoHead({
  origin = PRODUCTION_ORIGIN, path = '/', title = siteTitle, description = siteDescription,
  preview = false, noindex = false, canonical = true, includeStructuredData = true, book, books,
} = {}) {
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${preview || noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}" />`,
    '<meta property="og:type" content="website" />', '<meta property="og:locale" content="en_IN" />',
    `<meta property="og:site_name" content="${escapeHtml(business.name)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  ]
  if (canonical) tags.push(
    `<link rel="canonical" href="${escapeHtml(`${origin}${path}`)}" />`,
    `<meta property="og:url" content="${escapeHtml(`${origin}${path}`)}" />`,
  )
  tags.push(
    `<meta property="og:image" content="${escapeHtml(`${origin}${socialImage.path}`)}" />`,
    `<meta property="og:image:width" content="${socialImage.width}" />`,
    `<meta property="og:image:height" content="${socialImage.height}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(socialImageAlt)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(`${origin}${socialImage.path}`)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(socialImageAlt)}" />`,
  )
  if (includeStructuredData) tags.push(`<script type="application/ld+json">${serializeJsonLd(structuredData({ origin, path, title, description, book, books }))}</script>`)
  return tags.join('\n    ')
}

export function renderSitemap(origin, paths) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...new Set(paths)].map(path => `  <url><loc>${escapeHtml(`${origin}${path}`)}</loc></url>`).join('\n')}\n</urlset>\n`
}

export function renderRobots(origin, preview = false) {
  // Preview crawlers must be able to fetch pages to see their noindex directive.
  return `User-agent: *\nAllow: /\n${!preview ? `\nSitemap: ${origin}/sitemap.xml\n` : ''}`
}

export function renderStaticHeader() {
  return `<header class="border-b border-sand/20 bg-charcoal"><div class="container-px flex flex-wrap items-center justify-between gap-4 py-5">
    <a href="/" class="flex items-center gap-3 font-display text-xl text-cream"><img src="/logo-emblem.png" width="40" height="40" alt="" />${escapeHtml(business.name)}</a>
    <nav aria-label="Main navigation" class="flex flex-wrap gap-x-6 text-sm text-sand"><a class="inline-flex min-h-11 items-center hover:text-cream" href="/#catalogue">Open catalogue viewer</a><a class="inline-flex min-h-11 items-center hover:text-cream" href="/#contact">Visit / contact</a></nav>
  </div></header>`
}

export function renderStaticFooter() {
  return `<footer class="border-t border-sand/20 bg-charcoal"><div class="container-px py-8 text-sm text-sand">
    <p>${escapeHtml(business.name)} · ${escapeHtml(business.address.full)}</p>
    <a href="tel:${business.phoneTel}" class="mt-2 inline-flex min-h-11 items-center text-cream underline underline-offset-4">${escapeHtml(business.phoneDisplay)}</a>
    <nav aria-label="Footer navigation" class="mt-3 flex flex-wrap gap-x-6 gap-y-2"><a class="inline-flex min-h-11 items-center hover:text-cream" href="/catalogues/">All catalogues</a>${policyLinks.map(link => `<a class="inline-flex min-h-11 items-center hover:text-cream" href="${link.href}">${link.label}</a>`).join('')}</nav>
  </div></footer>`
}

function staticShell(content) {
  return `<a href="#page-content" class="skip-link">Skip to content</a>${renderStaticHeader()}<main id="page-content" tabindex="-1" class="container-px py-12 sm:py-16">${content}</main>${renderStaticFooter()}`
}

export const libraryMetadata = {
  path: '/catalogues/', title: `Global, Sky & Sunflora Tile Catalogues | ${business.name}`,
  description: 'Browse four original tile catalogues: Global floor and wall tiles, Sky 12×18 and Sunflora 2×4. Page details and PDFs from our Nuapada showroom library.',
}

export function renderLibraryBody(books) {
  return staticShell(`<p class="text-sm text-sand">Nuapada, Odisha · Original tile catalogues</p>
    <h1 class="mt-4 font-display text-4xl text-cream sm:text-5xl">Find a collection. See every detail.</h1>
    <p class="mt-5 max-w-3xl text-base leading-relaxed text-sand">Browse the original pages supplied by the showroom. Each collection keeps its tile designs, printed codes, sizes and finish information together. Open a page in the viewer to enlarge it, or download the original PDF.</p>
    <div class="mt-10 grid gap-8 sm:grid-cols-2">${books.map(book => `<article class="overflow-hidden rounded-2xl border border-sand/20 bg-charcoal-800">
      <a href="${cataloguePath(book.id)}" class="block bg-charcoal-700"><img src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)} catalogue cover" width="600" height="800" loading="lazy" decoding="async" class="h-72 w-full object-contain" /></a>
      <div class="p-6"><p class="text-xs text-sand">${escapeHtml(book.format)} · ${book.pageCount} pages</p><h2 class="mt-2 font-display text-2xl text-cream"><a href="${cataloguePath(book.id)}">${escapeHtml(book.title)}</a></h2>
      <p class="mt-3 text-sm leading-relaxed text-sand">${escapeHtml(book.description)}</p><div class="mt-5 flex flex-wrap gap-3"><a href="${escapeHtml(readerPath(book.id, book.featuredPage || 1))}" class="btn-gold">View collection</a><a href="${cataloguePath(book.id)}" class="btn-outline">Browse page details</a></div></div>
    </article>`).join('')}</div>
    <p class="mt-8 max-w-3xl text-sm leading-relaxed text-sand">Catalogues show a collection, not live stock or prices. For availability, share the collection name, page and design code with our <a href="/#contact" class="text-cream underline underline-offset-4">Nuapada showroom</a>. For marble, granite, quartz and sanitaryware, ask about the in-store selection.</p>`)
}

export function renderCatalogueBody(indexPage) {
  const { book, pages, number, total, start, end } = indexPage
  return staticShell(`<nav aria-label="Breadcrumb" class="text-sm text-sand"><a href="/catalogues/" class="underline underline-offset-4">Tile catalogues</a> / ${escapeHtml(book.title)}</nav>
    <h1 class="mt-5 font-display text-4xl text-cream sm:text-5xl">${escapeHtml(book.title)}${number > 1 ? ` · Pages ${start}–${end}` : ''}</h1>
    <p class="mt-5 max-w-3xl text-base leading-relaxed text-sand">${escapeHtml(book.description)}</p>
    <p class="mt-3 text-sm text-sand">${escapeHtml(book.format)} · ${book.pageCount} original pages · ${Math.max(1, Math.round(book.fileSize / 1024 / 1024))} MB PDF</p>
    <div class="mt-6 flex flex-wrap gap-3"><a href="${escapeHtml(readerPath(book.id, pages[0]?.number || 1))}" class="btn-gold">Open immersive viewer</a><a href="${escapeHtml(book.pdfUrl)}" class="btn-outline">Open original PDF</a></div>
    <p class="mt-6 max-w-3xl text-sm leading-relaxed text-sand">Use the original page to check the printed tile name, design code, dimensions and finish. ${pages.some(page => page.text?.trim()) ? 'The text below is extracted from the supplied document and may be incomplete; the original page is the reference. ' : 'Open any page in the viewer to enlarge its designs and read the printed details. '}Confirm availability and specifications with the showroom.</p>
    <h2 class="mt-10 font-display text-2xl text-cream">Catalogue pages ${start}–${end}</h2>
    <div class="mt-6 grid gap-7 lg:grid-cols-2">${pages.map(page => `<article id="page-${page.number}" class="overflow-hidden rounded-2xl border border-sand/20 bg-charcoal-800">
      <a href="${escapeHtml(readerPath(book.id, page.number))}" class="block bg-charcoal-700"><img src="${escapeHtml(page.thumbnail || page.image)}" width="${page.width}" height="${page.height}" alt="${escapeHtml(book.title)}, original catalogue page ${page.number}" loading="lazy" decoding="async" class="max-h-96 w-full object-contain" /></a>
      <div class="p-6"><h3 class="font-display text-xl text-cream"><a href="${escapeHtml(readerPath(book.id, page.number))}" class="underline underline-offset-4">View page ${page.number} in detail</a></h3>
      <p class="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-sand">${escapeHtml(page.text?.trim() || 'View the original page to read the printed tile details.')}</p>
      <a href="${escapeHtml(`${book.pdfUrl}#page=${page.number}`)}" class="mt-4 inline-flex min-h-11 items-center text-sm text-cream underline underline-offset-4">Page ${page.number} in the original PDF</a></div></article>`).join('')}</div>
    <nav aria-label="Catalogue page index" class="mt-9"><p class="text-sm text-sand">Index ${number} of ${total}</p><div class="mt-3 flex flex-wrap gap-2">${Array.from({ length: total }, (_, i) => `<a href="${cataloguePath(book.id, i + 1)}"${i + 1 === number ? ' aria-current="page"' : ''} class="${i + 1 === number ? 'btn-gold' : 'btn-outline'} px-4">${i + 1}</a>`).join('')}</div></nav>
    <p class="mt-8 text-sm text-sand">Found a design? <a href="/#contact" class="text-cream underline underline-offset-4">Contact ${escapeHtml(business.name)}</a> with the collection, page number and printed design code.</p>`)
}
