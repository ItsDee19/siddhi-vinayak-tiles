import { business } from './siteConfig.js'

export const CATALOGUE_PAGE_SIZE = 24
export const siteTitle = `Tiles & Sanitaryware in Nuapada | ${business.name}`
export const siteDescription = 'Explore tiles, marble, granite, quartz and sanitaryware at Sidhhi Binayak Tiles in Nuapada, Odisha. Browse the catalogue and try the 3D room visualizer.'
export const socialImage = { path: '/logo-emblem.png', width: 377, height: 377 }

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

export function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

// An explicit owner-supplied URL wins. Vercel's production-domain variable is
// safe as a fallback; its per-deployment VERCEL_URL is deliberately not used.
export function resolveSiteOrigin(env = {}) {
  const configured = env.SITE_URL?.trim()
  const productionHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (!configured && !productionHost) return null
  const value = configured || `https://${productionHost}`
  let url
  try { url = new URL(value) } catch { throw new Error('SITE_URL must be an absolute HTTPS production origin') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || url.pathname !== '/' || url.search || url.hash || !url.hostname.includes('.')
    || url.hostname.endsWith('.localhost') || /^\d+(\.\d+){3}$/.test(url.hostname)) {
    throw new Error('SITE_URL must be an HTTPS production origin without credentials, port, path, query or fragment')
  }
  return url.origin
}

export function isPreviewBuild(env = {}) {
  return env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'development'
}

export function cataloguePagePath(page) {
  if (!Number.isInteger(page) || page < 1) throw new Error('Catalogue page must be a positive integer')
  return page === 1 ? '/catalogue/' : `/catalogue/page/${page}/`
}

export function productDetailsPath(id) {
  return `/?product=${encodeURIComponent(id)}#catalogue`
}

export function cataloguePages(products, pageSize = CATALOGUE_PAGE_SIZE) {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('Page size must be positive')
  const total = Math.max(1, Math.ceil(products.length / pageSize))
  return Array.from({ length: total }, (_, index) => ({
    number: index + 1,
    total,
    path: cataloguePagePath(index + 1),
    previous: index ? cataloguePagePath(index) : null,
    next: index + 1 < total ? cataloguePagePath(index + 2) : null,
    products: products.slice(index * pageSize, (index + 1) * pageSize),
    start: products.length ? index * pageSize + 1 : 0,
    end: Math.min((index + 1) * pageSize, products.length),
    count: products.length,
  }))
}

export function structuredData({ origin = null, path = '/', title = siteTitle, description = siteDescription } = {}) {
  const pageUrl = origin ? `${origin}${path}` : path
  const websiteId = origin ? `${origin}/#website` : '/#website'
  const showroomId = origin ? `${origin}/#showroom` : '/#showroom'
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'HomeGoodsStore', '@id': showroomId, name: business.name,
        description: business.intro, telephone: business.phoneTel,
        ...(origin ? { url: `${origin}/`, logo: `${origin}${socialImage.path}`, image: `${origin}${socialImage.path}` } : {}),
        address: {
          '@type': 'PostalAddress',
          streetAddress: `${business.address.line1}, ${business.address.line2}`,
          addressLocality: business.address.city, addressRegion: business.address.state,
          postalCode: business.address.pin, addressCountry: 'IN',
        },
      },
      {
        '@type': 'WebSite', '@id': websiteId, name: business.name,
        ...(origin ? { url: `${origin}/` } : {}), inLanguage: 'en-IN',
        publisher: { '@id': showroomId },
      },
      {
        '@type': path === '/' ? 'WebPage' : 'CollectionPage', '@id': `${pageUrl}#webpage`,
        ...(origin ? { url: pageUrl } : {}), name: title, description,
        inLanguage: 'en-IN', isPartOf: { '@id': websiteId }, about: { '@id': showroomId },
      },
    ],
  }
}

export function renderSeoHead({ origin = null, path = '/', title = siteTitle, description = siteDescription, preview = false } = {}) {
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${preview ? 'noindex, follow' : 'index, follow, max-image-preview:large'}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:locale" content="en_IN" />',
    `<meta property="og:site_name" content="${escapeHtml(business.name)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    '<meta name="twitter:card" content="summary" />',
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  ]
  if (origin) tags.push(
    `<link rel="canonical" href="${escapeHtml(`${origin}${path}`)}" />`,
    `<meta property="og:url" content="${escapeHtml(`${origin}${path}`)}" />`,
    `<meta property="og:image" content="${escapeHtml(`${origin}${socialImage.path}`)}" />`,
    `<meta property="og:image:width" content="${socialImage.width}" />`,
    `<meta property="og:image:height" content="${socialImage.height}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(business.name)} emblem" />`,
    `<meta name="twitter:image" content="${escapeHtml(`${origin}${socialImage.path}`)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(business.name)} emblem" />`,
  )
  tags.push(`<script type="application/ld+json">${serializeJsonLd(structuredData({ origin, path, title, description }))}</script>`)
  return tags.join('\n    ')
}

export function renderSitemap(origin, paths) {
  if (!origin) return null
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(path => `  <url><loc>${escapeHtml(`${origin}${path}`)}</loc></url>`).join('\n')}\n</urlset>\n`
}

export function renderRobots(origin, preview = false) {
  // Crawlers must fetch preview HTML to read its noindex directive.
  return `User-agent: *\nAllow: /\n${origin && !preview ? `\nSitemap: ${origin}/sitemap.xml\n` : ''}`
}

function productArticle(product) {
  const href = escapeHtml(productDetailsPath(product.id))
  const image = typeof product.imageUrl === 'string' && /^\/(?!\/)/.test(product.imageUrl)
    && !product.imageUrl.includes('\\')
    ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" width="640" height="480" loading="lazy" decoding="async" class="aspect-[4/3] w-full object-contain" />`
    : '<div class="flex aspect-[4/3] items-center justify-center p-4 text-center text-sm text-sand">Ask for a product photograph</div>'
  const specifications = [['Size', product.size], ['Finish', product.finish], ['Surface', product.surface]]
    .filter(([, value]) => value).map(([label, value]) => `<div><dt class="inline text-sand">${label}: </dt><dd class="inline">${escapeHtml(value)}</dd></div>`).join('')
  return `<article class="overflow-hidden rounded-card border border-white/10 bg-charcoal-700">
    <a href="${href}" class="block" aria-label="${escapeHtml(`View ${product.name}`)}">${image}</a>
    <div class="p-4"><p class="text-xs text-sand">${escapeHtml(product.category)}</p>
      <h2 class="mt-2 break-words font-display text-lg text-cream"><a href="${href}" class="inline-flex min-h-11 items-center hover:text-gold-light">${escapeHtml(product.name)}</a></h2>
      <dl class="mt-3 space-y-1 text-xs leading-relaxed">${specifications}</dl>
      <p class="mt-3 break-all text-xs text-sand">Code: ${escapeHtml(product.id)}</p>
      <a href="${href}" class="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-gold hover:underline">View details</a>
    </div></article>`
}

// Literal Tailwind classes live in src so the ordinary production CSS scanner
// includes them. Static catalogue pages share the existing theme and fonts.
export function renderCatalogueBody(page) {
  const pageLinks = Array.from({ length: page.total }, (_, index) => {
    const number = index + 1
    return `<a href="${cataloguePagePath(number)}"${number === page.number ? ' aria-current="page"' : ''} class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-btn border ${number === page.number ? 'border-gold bg-gold text-ink' : 'border-white/10 text-sand hover:border-gold'}">${number}</a>`
  }).join('')
  return `<a href="#catalogue-products" class="skip-link">Skip to products</a>
    <header class="container-px border-b border-white/10 py-5"><nav aria-label="Main navigation" class="flex flex-wrap items-center justify-between gap-4">
      <a href="/" class="flex items-center gap-3 font-display text-lg text-cream"><img src="/logo-emblem.png" width="44" height="44" alt="" />${escapeHtml(business.name)}</a>
      <a href="/#catalogue" class="inline-flex min-h-11 items-center text-sm text-gold hover:underline">Search &amp; filter catalogue</a>
    </nav></header>
    <main id="catalogue-products" class="container-px py-12" tabindex="-1">
      <p class="text-sm text-sand"><a href="/" class="inline-flex min-h-11 items-center text-gold hover:underline">Home</a> / Catalogue${page.number > 1 ? ` / Page ${page.number}` : ''}</p>
      <h1 class="mt-5 font-display text-3xl text-cream sm:text-4xl">Tiles &amp; sanitaryware catalogue${page.number > 1 ? ` — Page ${page.number}` : ''}</h1>
      <p class="mt-4 max-w-2xl text-sm leading-relaxed text-sand">Browse the collection at ${escapeHtml(business.name)} in Nuapada, Odisha. Open a product for details, available 3D previews and enquiries. Please contact the showroom to confirm current availability and prices.</p>
      <p class="mt-6 text-sm text-sand">Products ${page.start}–${page.end} of ${page.count} · Page ${page.number} of ${page.total}</p>
      <div class="mt-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">${page.products.map(productArticle).join('\n')}</div>
      <nav aria-label="Catalogue pages" class="mt-8">
        <div class="flex items-center justify-between gap-4">
          ${page.previous ? `<a rel="prev" href="${page.previous}" class="btn-outline px-3 sm:px-7" aria-label="Previous catalogue page">Previous</a>` : '<span></span>'}
          ${page.next ? `<a rel="next" href="${page.next}" class="btn-outline px-3 sm:px-7" aria-label="Next catalogue page">Next</a>` : '<span></span>'}
        </div><div class="mt-5 flex flex-wrap gap-2">${pageLinks}</div>
      </nav>
    </main>
    <footer class="container-px border-t border-white/10 py-8 text-sm text-sand">
      <p class="font-semibold text-cream">${escapeHtml(business.name)}</p>
      <address class="mt-2 not-italic">${escapeHtml(business.address.full)}</address>
      <p class="mt-3"><a href="tel:${escapeHtml(business.phoneTel)}" class="inline-flex min-h-11 items-center text-gold hover:underline">Call ${escapeHtml(business.phoneDisplay)}</a></p>
      <a href="/#visualizer" class="inline-flex min-h-11 items-center text-gold hover:underline">Try the 3D room visualizer</a>
    </footer>`
}
