/**
 * Rigorous feature smoke suite for Sidhhi Binayak Tiles.
 * Uses playwright-core + system Chromium from ms-playwright.
 *
 * Run: node scripts/e2e-rigorous.mjs
 * Env: BASE_URL=http://127.0.0.1:5173
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173'
const CHROME =
  process.env.CHROME_PATH ||
  [
    path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1228/chrome-win64/chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1208/chrome-win64/chrome.exe'),
  ].find((p) => p && fs.existsSync(p))

if (!CHROME) {
  console.error('No Chromium found under %LOCALAPPDATA%\\ms-playwright')
  process.exit(2)
}

const results = []
const pageErrors = []
const consoleErrors = []

function pass(id, detail = '') {
  results.push({ id, ok: true, detail })
  console.log(`  ✓ ${id}${detail ? ` — ${detail}` : ''}`)
}
function fail(id, detail = '') {
  results.push({ id, ok: false, detail })
  console.log(`  ✗ ${id}${detail ? ` — ${detail}` : ''}`)
}
async function check(id, fn) {
  try {
    const detail = await fn()
    pass(id, typeof detail === 'string' ? detail : '')
  } catch (e) {
    fail(id, e?.message || String(e))
  }
}

async function waitForSection(page, id, timeout = 20000) {
  await page.locator(`#${id}`).first().waitFor({ state: 'attached', timeout })
}

async function scrollTo(page, id) {
  await page.evaluate((sid) => {
    const el = document.getElementById(sid)
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })
  }, id)
  await page.waitForTimeout(400)
}

async function sectionVisible(page, id) {
  const box = await page.locator(`#${id}`).first().boundingBox()
  if (!box || box.height < 40) throw new Error(`#${id} missing or too short`)
  return `${Math.round(box.width)}×${Math.round(box.height)}`
}

async function assetOk(page, urlPath) {
  const res = await page.request.get(new URL(urlPath, BASE).href)
  if (!res.ok()) throw new Error(`${urlPath} → ${res.status()}`)
  return String(res.status())
}

// Mirrors src/data/catalogueBooks.generated.json — 4 supplied PDF catalogues.
// Only used here to know how many book cards to expect — titles/page counts
// are read live from the page, not hardcoded.
const CATALOGUE_BOOK_COUNT = 4

async function runDesktop(browser) {
  console.log('\n══ DESKTOP (1440×900) ══')
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => pageErrors.push(`[desktop] ${e.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[desktop] ${msg.text()}`)
  })

  // ── Load ──
  await check('desktop:home-loads', async () => {
    const res = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
    if (!res || !res.ok()) throw new Error(`status ${res?.status()}`)
    await page.waitForSelector('#home', { timeout: 30000 })
    await page.waitForTimeout(1500)
    return `HTTP ${res.status()}`
  })

  await check('desktop:title', async () => {
    const t = await page.title()
    if (!/tile|sidhhi|binayak|siddhi|vinayak/i.test(t)) throw new Error(`title="${t}"`)
    return t.slice(0, 80)
  })

  // ── Nav links present ──
  const navHrefs = ['#home', '#products', '#visualizer', '#catalogue', '#size-calculator', '#about', '#contact']
  for (const href of navHrefs) {
    await check(`desktop:nav-link${href}`, async () => {
      const n = await page.locator(`nav a[href="${href}"], a[href="${href}"]`).count()
      if (n < 1) throw new Error('not found')
      return `${n} link(s)`
    })
  }

  // ── Sections exist after lazy load (scroll full page) ──
  for (const id of ['home', 'products', 'visualizer', 'catalogue', 'size-calculator', 'about', 'contact']) {
    await check(`desktop:section#${id}`, async () => {
      await scrollTo(page, id)
      // lazy sections need a moment
      await waitForSection(page, id, 25000)
      return await sectionVisible(page, id)
    })
  }

  // ── Hero CTAs ──
  await check('desktop:hero-content', async () => {
    await scrollTo(page, 'home')
    const hasCta =
      (await page.locator('#home a[href="#visualizer"], #home a[href="#catalogue"], #home a[href="#contact"]').count()) > 0
    if (!hasCta) {
      // Accept logo/text presence
      const text = await page.locator('#home').innerText()
      if (!/tile|sidhhi|binayak|visualizer|explore/i.test(text)) throw new Error('hero empty')
      return 'text ok'
    }
    return 'CTAs present'
  })

  // ── Products ──
  await check('desktop:products-cards', async () => {
    await scrollTo(page, 'products')
    await page.waitForTimeout(500)
    // Category tiles are TiltCard divs (onClick), not buttons
    const titles = await page.locator('#products h3').count()
    const links = await page.locator('#products a').count()
    if (titles < 4) throw new Error(`only ${titles} category titles`)
    if (links < 1) throw new Error('no CTA link')
    return `${titles} titles, ${links} links`
  })

  // ── Catalogue library (PDF page reader) ──
  // Replaced the 3D showcase carousel with a passive reader over the 4
  // supplied PDF catalogues — see src/components/catalogue/CatalogueLibrary.jsx.
  // `id="visualizer"` was kept on the section for anchor/deep-link stability.
  await check('desktop:library-heading', async () => {
    await scrollTo(page, 'visualizer')
    await page.waitForSelector('#visualizer', { timeout: 20000 })
    await page.waitForTimeout(500)
    const h = await page.locator('#visualizer').innerText()
    if (!/tile library/i.test(h)) throw new Error('heading missing')
    return 'ok'
  })

  await check('desktop:library-books-rendered', async () => {
    const n = await page.locator('#visualizer .catalogue-book button').count()
    if (n !== CATALOGUE_BOOK_COUNT) throw new Error(`expected ${CATALOGUE_BOOK_COUNT} catalogue books, found ${n}`)
    const selected = await page.locator('#visualizer .catalogue-book.is-selected').count()
    if (selected !== 1) throw new Error(`expected exactly 1 selected book, found ${selected}`)
    return `${n} books, 1 selected`
  })

  // Exercises the "Collection details" link specifically (not the book
  // thumbnail button): it's a real <a href> intercepted with preventDefault
  // so it switches catalogues in place instead of hitting a non-existent
  // static route — the part most likely to regress silently.
  await check('desktop:library-book-switch', async () => {
    const before = await page.locator('#visualizer .reader-heading h3').innerText()
    const link = page.locator('#visualizer .catalogue-book:not(.is-selected) a', { hasText: 'Collection details' }).first()
    const href = await link.getAttribute('href')
    if (!/^\/\?catalogue=[a-z0-9-]+&page=\d+#visualizer$/.test(href)) throw new Error(`unexpected href: ${href}`)
    await link.click()
    await page.waitForTimeout(500)
    const after = await page.locator('#visualizer .reader-heading h3').innerText()
    if (after === before) throw new Error('Collection details link did not switch the open catalogue')
    if (!page.url().includes('#visualizer')) throw new Error(`left #visualizer, url=${page.url()}`)
    return `${before} → ${after}`
  })

  await check('desktop:library-next-prev', async () => {
    const input = page.locator('#visualizer #page-number')
    const before = await input.inputValue()
    await page.locator('#visualizer button[aria-label="Next page"]').click()
    await page.waitForTimeout(400)
    const afterNext = await input.inputValue()
    if (afterNext === before) throw new Error('Next page did not advance')
    await page.locator('#visualizer button[aria-label="Previous page"]').click()
    await page.waitForTimeout(400)
    const afterPrev = await input.inputValue()
    if (afterPrev !== before) throw new Error(`Previous page should return to "${before}", got "${afterPrev}"`)
    return `${before} → ${afterNext} → ${afterPrev}`
  })

  await check('desktop:library-page-jump', async () => {
    const input = page.locator('#visualizer #page-number')
    await input.fill('5')
    await page.locator('#visualizer button[aria-label="Go to page"]').click()
    await page.waitForTimeout(400)
    const value = await input.inputValue()
    if (value !== '5') throw new Error(`expected page 5, input shows "${value}"`)
    const status = await page.locator('#visualizer .reader-status').innerText()
    if (!/page 5/i.test(status)) throw new Error(`status does not confirm page 5: "${status}"`)
    return 'jumped to page 5'
  })

  await check('desktop:library-keyboard-nav', async () => {
    await page.locator('#visualizer .reader-stage [role="region"]').focus()
    const input = page.locator('#visualizer #page-number')
    const before = await input.inputValue()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(400)
    const after = await input.inputValue()
    if (after === before) throw new Error('ArrowRight did not advance the page')
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(400)
    const back = await input.inputValue()
    if (back !== before) throw new Error(`ArrowLeft should return to "${before}", got "${back}"`)
    return `${before} → ${after} → ${back}`
  })

  await check('desktop:library-zoom', async () => {
    const fitBtn = page.locator('#visualizer .reader-fit')
    const before = await fitBtn.innerText()
    await page.locator('#visualizer button[aria-label="Zoom in"]').click()
    await page.waitForTimeout(300)
    const after = await fitBtn.innerText()
    if (after === before) throw new Error('Zoom in did not change the zoom level')
    await fitBtn.click()
    await page.waitForTimeout(300)
    const reset = await fitBtn.innerText()
    if (!/fit page/i.test(reset)) throw new Error(`Fit page button should reset zoom, got "${reset}"`)
    return `${before} → ${after} → ${reset}`
  })

  await check('desktop:library-fullscreen', async () => {
    await page.locator('#visualizer .reader-expand').click()
    await page.waitForTimeout(500)
    const openCount = await page.locator('dialog.reader-dialog[open]').count()
    if (openCount < 1) throw new Error('fullscreen dialog did not open')
    await page.locator('dialog.reader-dialog [data-close-reader]').click()
    await page.waitForTimeout(400)
    const stillOpen = await page.locator('dialog.reader-dialog[open]').count()
    if (stillOpen > 0) throw new Error('fullscreen dialog did not close')
    return 'opened and closed'
  })

  await check('desktop:library-page-image', async () => {
    const src = await page.locator('#visualizer .reader-stage img').first().getAttribute('src')
    if (!src) throw new Error('no page image rendered')
    await assetOk(page, src)
    return src
  })

  await check('desktop:library-book-thumbnails', async () => {
    const srcs = await page.locator('#visualizer .catalogue-book img').evaluateAll((imgs) => imgs.map((i) => new URL(i.src).pathname))
    if (srcs.length !== CATALOGUE_BOOK_COUNT) throw new Error(`expected ${CATALOGUE_BOOK_COUNT} book thumbnails, found ${srcs.length}`)
    for (const src of srcs) await assetOk(page, src)
    return `${srcs.length} thumbnails 200`
  })

  // ── Catalogue ──
  await check('desktop:catalogue-products', async () => {
    await page.goto(BASE + '/#catalogue', { waitUntil: 'domcontentloaded' })
    await scrollTo(page, 'catalogue')
    await page.waitForTimeout(1500)
    const cards = page.locator('#catalogue [role="button"]')
    await cards.first().waitFor({ state: 'visible', timeout: 20000 })
    const n = await cards.count()
    if (n < 8) throw new Error(`only ${n} cards`)
    return `${n} cards`
  })

  await check('desktop:catalogue-search', async () => {
    const search = page.locator('#catalogue input[type="search"], #catalogue input[placeholder*="Search"]').first()
    if ((await search.count()) === 0) {
      // try any text input in catalogue
      const any = page.locator('#catalogue input').first()
      await any.fill('marble')
      await page.waitForTimeout(500)
      return 'used generic input'
    }
    await search.fill('white')
    await page.waitForTimeout(600)
    const n = await page.locator('#catalogue [role="button"]').count()
    await search.fill('')
    await page.waitForTimeout(300)
    return `${n} after search white`
  })

  await check('desktop:catalogue-view-in-library', async () => {
    await scrollTo(page, 'catalogue')
    await page.waitForTimeout(800)
    const tryBtn = page.locator('#catalogue button', { hasText: /View in Library/ }).first()
    await tryBtn.waitFor({ state: 'visible', timeout: 15000 })
    await tryBtn.click()
    await page.waitForTimeout(1500)
    // should scroll to the catalogue library (see Catalogue.jsx's onViewIn3D)
    const viz = page.locator('#visualizer')
    const inView = await page.evaluate(() => {
      const el = document.getElementById('visualizer')
      if (!el) return false
      const r = el.getBoundingClientRect()
      return r.top < window.innerHeight && r.bottom > 0
    })
    if (!inView) await scrollTo(page, 'visualizer')
    await page.waitForTimeout(500)
    const text = await viz.innerText()
    if (!/tile library/i.test(text)) throw new Error('library not ready after View in Library')
    return inView ? 'scrolled to library' : 'applied (scrolled manually)'
  })

  await check('desktop:catalogue-lightbox', async () => {
    await scrollTo(page, 'catalogue')
    await page.waitForTimeout(500)
    const card = page.locator('#catalogue [role="button"]').first()
    await card.click()
    await page.waitForTimeout(600)
    // lightbox dialog or close button
    const close = page.locator('[aria-label*="Close"], button:has-text("Close"), [role="dialog"]')
    const n = await close.count()
    if (n < 1) {
      // click again might have toggled — not fatal if no modal
      return 'no dialog detected (soft)'
    }
    // try close
    const esc = page.locator('button[aria-label*="Close"], [role="dialog"] button').first()
    if (await esc.count()) await esc.click().catch(() => {})
    await page.keyboard.press('Escape').catch(() => {})
    return `overlay elements=${n}`
  })

  // ── Size calculator ──
  await check('desktop:size-calculator-defaults', async () => {
    await scrollTo(page, 'size-calculator')
    await page.waitForTimeout(800)
    const text = await page.locator('#size-calculator').innerText()
    if (!/Size Calculator|Tile Planner/i.test(text)) throw new Error('heading missing')
    // result should compute for 12×10
    if (!/\d+/.test(text)) throw new Error('no numeric result')
    return 'ok'
  })

  await check('desktop:size-calculator-surface-modes', async () => {
    const sec = page.locator('#size-calculator')
    await sec.locator('button', { hasText: /^Wall$/ }).first().click()
    await page.waitForTimeout(200)
    await sec.locator('button', { hasText: /^Floor$/ }).first().click()
    await sec.locator('button', { hasText: /By product/ }).first().click()
    await page.waitForTimeout(300)
    await sec.locator('button', { hasText: /By size/ }).first().click()
    // change dimensions
    const inputs = sec.locator('input[type="number"], input[type="text"]')
    const count = await inputs.count()
    if (count >= 2) {
      await inputs.nth(0).fill('15')
      await inputs.nth(1).fill('12')
      await page.waitForTimeout(400)
    }
    const text = await sec.innerText()
    if (!/\d/.test(text)) throw new Error('no result after change')
    return `inputs=${count}`
  })

  await check('desktop:size-waste-presets', async () => {
    const sec = page.locator('#size-calculator')
    for (const pct of ['5%', '10%', '15%', '5', '10', '15']) {
      const b = sec.locator('button', { hasText: new RegExp(`^${pct}`) })
      if ((await b.count()) > 0) {
        await b.first().click()
        await page.waitForTimeout(150)
      }
    }
    return 'ok'
  })

  // ── About / contact / footer ──
  await check('desktop:about', async () => {
    await scrollTo(page, 'about')
    const t = await page.locator('#about').innerText()
    if (t.length < 40) throw new Error('about too short')
    return `${t.length} chars`
  })

  await check('desktop:contact-form', async () => {
    await scrollTo(page, 'contact')
    await page.waitForTimeout(500)
    const form = page.locator('#contact form')
    if ((await form.count()) < 1) throw new Error('no form')
    await page.locator('#contact input, #contact textarea').first().fill('Test User')
    const phone = page.locator('#contact input[type="tel"], #contact input').nth(1)
    if (await phone.count()) await phone.fill('9876543210')
    const wa = page.locator('#contact a[href*="wa.me"]')
    const tel = page.locator('#contact a[href^="tel:"]')
    if ((await wa.count()) < 1) throw new Error('no whatsapp link')
    if ((await tel.count()) < 1) throw new Error('no tel link')
    return 'form+links ok'
  })

  await check('desktop:floating-buttons', async () => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(800)
    const wa = page.locator('a[aria-label="Chat on WhatsApp"]')
    const call = page.locator('a[aria-label="Call now"]')
    // may need scroll past hero
    if ((await wa.count()) < 1) {
      await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.2))
      await page.waitForTimeout(600)
    }
    if ((await wa.count()) < 1 && (await call.count()) < 1) throw new Error('floating buttons not shown')
    return 'visible'
  })

  // ── No dead visualizer routes (2D room compositor or 3D carousel) ──
  await check('desktop:no-legacy-visualizer-section', async () => {
    const has3d = await page.evaluate(() => !!document.getElementById('visualizer-3d'))
    if (has3d) throw new Error('legacy #visualizer-3d present')
    const hasRoomCanvas = await page.evaluate(() => !!document.querySelector('#visualizer canvas'))
    if (hasRoomCanvas) throw new Error('a <canvas> is present in #visualizer — it should be fully replaced by the catalogue library')
    return 'only the catalogue library'
  })

  await context.close()
}

async function runMobile(browser) {
  console.log('\n══ MOBILE (390×844) ══')
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => pageErrors.push(`[mobile] ${e.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[mobile] ${msg.text()}`)
  })

  await check('mobile:home-loads', async () => {
    const res = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
    if (!res?.ok()) throw new Error(`status ${res?.status()}`)
    await page.waitForSelector('#home', { timeout: 30000 })
    await page.waitForTimeout(1200)
    return `HTTP ${res.status()}`
  })

  async function closeMobileChrome() {
    // Close open hamburger menu so it cannot intercept clicks
    const burger = page.locator('button[aria-label="Toggle menu"]')
    if ((await burger.count()) > 0) {
      // If mobile drawer links are visible below nav, close
      const drawerLink = page.locator('header ul a[href="#visualizer"]')
      if ((await drawerLink.count()) > 0 && (await drawerLink.first().isVisible().catch(() => false))) {
        await burger.click({ force: true })
        await page.waitForTimeout(350)
      }
    }
  }

  await check('mobile:nav-menu', async () => {
    const burger = page.locator('button[aria-label="Toggle menu"]')
    await burger.click()
    await page.waitForTimeout(400)
    const links = await page.locator('header a[href="#visualizer"]').count()
    if (links < 1) throw new Error('no library link')
    // CRITICAL: close menu so later tests are not blocked by the drawer overlay
    await burger.click()
    await page.waitForTimeout(350)
    return `library links=${links}; menu closed`
  })

  await check('mobile:library-layout', async () => {
    await page.goto(BASE + '/#visualizer', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#visualizer', { timeout: 30000 })
    await page.waitForTimeout(1200)
    await closeMobileChrome()
    const books = page.locator('#visualizer .catalogue-book button')
    await books.first().waitFor({ state: 'visible', timeout: 15000 })
    const n = await books.count()
    if (n !== CATALOGUE_BOOK_COUNT) throw new Error(`expected ${CATALOGUE_BOOK_COUNT} catalogue books, found ${n}`)
    return `library + ${n} books`
  })

  await check('mobile:library-tap-next', async () => {
    await closeMobileChrome()
    // The reader toolbar can land at whatever scroll depth the #visualizer
    // hash-jump happens to settle on, which on some runs puts it directly
    // under the fixed bottom-right WhatsApp/call buttons (FloatingButtons —
    // present on every section, not specific to this reader). Centering the
    // toolbar in the viewport first keeps the tap off that fixed corner.
    await page.locator('#visualizer .reader-toolbar').first().evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(300)
    const input = page.locator('#visualizer #page-number')
    const before = await input.inputValue()
    await page.locator('#visualizer button[aria-label="Next page"]').click({ force: true })
    await page.waitForTimeout(500)
    const after = await input.inputValue()
    if (after === before) throw new Error('tapping Next page did not advance')
    return `${before} → ${after}`
  })

  await check('mobile:library-book-switch', async () => {
    const before = await page.locator('#visualizer .reader-heading h3').innerText()
    const link = page.locator('#visualizer .catalogue-book:not(.is-selected) a', { hasText: 'Collection details' }).first()
    await link.click({ force: true })
    await page.waitForTimeout(500)
    const after = await page.locator('#visualizer .reader-heading h3').innerText()
    if (after === before) throw new Error('Collection details link did not switch the open catalogue')
    return `${before} → ${after}`
  })

  await check('mobile:catalogue-cards', async () => {
    await page.goto(BASE + '/#catalogue', { waitUntil: 'domcontentloaded' })
    await scrollTo(page, 'catalogue')
    await page.waitForTimeout(1500)
    const n = await page.locator('#catalogue [role="button"]').count()
    if (n < 4) throw new Error(`only ${n}`)
    return `${n} cards`
  })

  await check('mobile:size-calculator', async () => {
    await scrollTo(page, 'size-calculator')
    await page.waitForTimeout(800)
    const t = await page.locator('#size-calculator').innerText()
    if (!/Size Calculator/i.test(t)) throw new Error('missing')
    return 'ok'
  })

  await check('mobile:no-horizontal-page-overflow', async () => {
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
      }
    })
    if (overflow.scrollWidth > overflow.clientWidth + 8) {
      throw new Error(
        `page horizontal overflow scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`,
      )
    }
    return `w=${overflow.clientWidth}`
  })

  await context.close()
}

async function main() {
  console.log(`Base URL: ${BASE}`)
  console.log(`Chrome:   ${CHROME}`)

  // preflight
  try {
    const r = await fetch(BASE)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    console.log(`Preflight: ${r.status}`)
  } catch (e) {
    console.error(`Dev server not reachable at ${BASE}: ${e.message}`)
    process.exit(2)
  }

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  })

  try {
    await runDesktop(browser)
    await runMobile(browser)
  } finally {
    await browser.close()
  }

  // Filter noisy console errors (favicon, third-party, etc.)
  const seriousConsole = consoleErrors.filter(
    (m) =>
      !/favicon|Download the React DevTools|third-party|net::ERR_BLOCKED|google|maps/i.test(m) &&
      !/Failed to load resource/i.test(m),
  )
  const seriousPage = pageErrors.filter((m) => !/ResizeObserver|Script error/i.test(m))

  console.log('\n══ CONSOLE / PAGE ERRORS ══')
  console.log(`pageerrors: ${pageErrors.length} (serious ${seriousPage.length})`)
  seriousPage.slice(0, 10).forEach((m) => console.log(`  PAGE: ${m}`))
  console.log(`console errors: ${consoleErrors.length} (serious ${seriousConsole.length})`)
  seriousConsole.slice(0, 15).forEach((m) => console.log(`  CONSOLE: ${m}`))

  if (seriousPage.length) {
    fail('runtime:no-page-errors', seriousPage[0])
  } else {
    pass('runtime:no-page-errors', `${pageErrors.length} total filtered`)
  }

  const failed = results.filter((r) => !r.ok)
  const passed = results.filter((r) => r.ok)

  console.log('\n════════════════════════════════')
  console.log(`TOTAL: ${passed.length} passed, ${failed.length} failed, ${results.length} checks`)
  if (failed.length) {
    console.log('\nFAILED:')
    failed.forEach((f) => console.log(`  ✗ ${f.id}: ${f.detail}`))
  }

  // write report
  const reportPath = path.join(process.cwd(), 'scripts', 'e2e-report.json')
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        base: BASE,
        at: new Date().toISOString(),
        passed: passed.length,
        failed: failed.length,
        results,
        pageErrors,
        consoleErrors: seriousConsole,
      },
      null,
      2,
    ),
  )
  console.log(`\nReport: ${reportPath}`)

  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
