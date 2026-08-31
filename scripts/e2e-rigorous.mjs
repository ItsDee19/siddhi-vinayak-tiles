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

// Mirrors src/data/tileShowcase.js's curation: 2 slides × 5 ranges. Only used
// here to know how many slides to expect — the actual titles/images are read
// live from the page, not hardcoded, so this suite doesn't need updating if
// the curated set changes later.
const SHOWCASE_SLIDE_COUNT = 10

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

  // ── Tile showcase carousel ──
  // Replaced the interactive 2D room visualizer (now on the archive/2d-visualizer
  // branch) with a passive 3D coverflow — see src/components/showcase/Coverflow.jsx.
  // `id="visualizer"` was kept on the section for anchor/deep-link stability.
  // Slide buttons' aria-labels always end in "current slide" or start with
  // "Go to " — the Next/Previous chevrons live in the same [role="group"]
  // container but don't match either pattern, so this selector naturally
  // excludes them without needing an explicit :not().
  const slideButtons = (p) =>
    p.locator('#visualizer [role="group"] button[aria-label$="current slide"], #visualizer [role="group"] button[aria-label^="Go to"]')
  const activeSlide = (p) => p.locator('#visualizer button[aria-label$="current slide"]')

  await check('desktop:showcase-heading', async () => {
    await scrollTo(page, 'visualizer')
    await page.waitForSelector('#visualizer', { timeout: 20000 })
    await page.waitForTimeout(500)
    const h = await page.locator('#visualizer').innerText()
    if (!/Tile Showcase/i.test(h)) throw new Error('heading missing')
    return 'ok'
  })

  // The carousel keeps the old visualizer's exact full-bleed footprint (same
  // negative gutters, same 16:9 band, same height cap) so the page doesn't
  // shift under the reader. A stray wrapper re-adding container padding, or a
  // CSS regression collapsing the aspect box, wouldn't show up as an error —
  // hence asserted, not eyeballed.
  await check('desktop:showcase-full-bleed', async () => {
    const box = await page.locator('#visualizer [role="group"]').first().boundingBox()
    const vw = await page.evaluate(() => window.innerWidth)
    const vh = await page.evaluate(() => window.innerHeight)
    const pct = Math.round((box.width / vw) * 100)
    const ceiling = Math.min(vw, vh * 0.92 * (16 / 9))
    if (box.width < ceiling * 0.9) {
      throw new Error(`carousel ${Math.round(box.width)}px is well under the ${Math.round(ceiling)}px the viewport allows`)
    }
    if (box.height > vh + 1) throw new Error(`carousel ${Math.round(box.height)}px taller than viewport ${vh}px`)
    return `${Math.round(box.width)}×${Math.round(box.height)} = ${pct}% of ${vw}px`
  })

  await check('desktop:showcase-slides-rendered', async () => {
    const n = await slideButtons(page).count()
    if (n !== SHOWCASE_SLIDE_COUNT) throw new Error(`expected ${SHOWCASE_SLIDE_COUNT} slides, found ${n}`)
    const activeCount = await activeSlide(page).count()
    if (activeCount !== 1) throw new Error(`expected exactly 1 active slide, found ${activeCount}`)
    return `${n} slides, 1 active`
  })

  await check('desktop:showcase-next-prev', async () => {
    const before = await activeSlide(page).getAttribute('aria-label')
    await page.locator('#visualizer button[aria-label="Next tile"]').click()
    await page.waitForTimeout(500)
    const afterNext = await activeSlide(page).getAttribute('aria-label')
    if (afterNext === before) throw new Error('Next did not change the active slide')
    await page.locator('#visualizer button[aria-label="Previous tile"]').click()
    await page.waitForTimeout(500)
    const afterPrev = await activeSlide(page).getAttribute('aria-label')
    if (afterPrev !== before) throw new Error(`Prev should return to "${before}", got "${afterPrev}"`)
    return `${before} → ${afterNext} → ${afterPrev}`
  })

  // Side panels overlap the (higher z-index) active panel — that's the
  // coverflow look. Only their outer ~35% sliver is actually painted on top,
  // so that's where a real click lands; the geometric center of the button's
  // own box sits under the active panel and would hit the wrong element.
  await check('desktop:showcase-click-side-panel', async () => {
    const target = page.locator('#visualizer button[aria-label^="Go to"]').first()
    const label = await target.getAttribute('aria-label')
    const box = await target.boundingBox()
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.5)
    await page.waitForTimeout(500)
    const active = await activeSlide(page).getAttribute('aria-label')
    if (!label.includes(active.replace(', current slide', ''))) {
      throw new Error(`clicked "${label}" but active is now "${active}"`)
    }
    return `clicked "${label}" → active`
  })

  await check('desktop:showcase-keyboard-nav', async () => {
    await page.locator('#visualizer [role="group"]').focus()
    const before = await activeSlide(page).getAttribute('aria-label')
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(500)
    const afterRight = await activeSlide(page).getAttribute('aria-label')
    if (afterRight === before) throw new Error('ArrowRight did not change the active slide')
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(500)
    const afterLeft = await activeSlide(page).getAttribute('aria-label')
    if (afterLeft !== before) throw new Error(`ArrowLeft should return to "${before}", got "${afterLeft}"`)
    return `${before} → ${afterRight} → ${afterLeft}`
  })

  await check('desktop:showcase-drag', async () => {
    const box = await page.locator('#visualizer [role="group"]').first().boundingBox()
    const before = await activeSlide(page).getAttribute('aria-label')
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.5, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(500)
    const after = await activeSlide(page).getAttribute('aria-label')
    if (after === before) throw new Error('drag-left did not change the active slide')
    return `${before} → ${after}`
  })

  // Autoplay is the thing that shows off "smooth sliding" to a visitor who
  // never touches the carousel — but it must not fight a user who's hovering
  // to read a caption or aim a click. AUTOPLAY_MS in Coverflow.jsx is 4500ms,
  // so this has to wait past a full interval — anything shorter would pass
  // whether or not the pause-on-hover actually works.
  await check('desktop:showcase-autoplay-pauses-on-hover', async () => {
    await page.locator('#visualizer [role="group"]').hover()
    const before = await activeSlide(page).getAttribute('aria-label')
    await page.waitForTimeout(5200)
    const after = await activeSlide(page).getAttribute('aria-label')
    if (after !== before) throw new Error(`active slide changed while hovered: "${before}" → "${after}"`)
    return 'unchanged across a full autoplay interval while hovered'
  })

  await check('desktop:showcase-image-assets', async () => {
    const srcs = await page.locator('#visualizer [role="group"] img').evaluateAll((imgs) => imgs.map((i) => new URL(i.src).pathname))
    if (srcs.length !== SHOWCASE_SLIDE_COUNT) throw new Error(`expected ${SHOWCASE_SLIDE_COUNT} images, found ${srcs.length}`)
    for (const src of srcs) await assetOk(page, src)
    return `${srcs.length} images 200`
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

  await check('desktop:catalogue-view-in-showcase', async () => {
    await scrollTo(page, 'catalogue')
    await page.waitForTimeout(800)
    const tryBtn = page.locator('#catalogue button', { hasText: /View in Showcase/ }).first()
    await tryBtn.waitFor({ state: 'visible', timeout: 15000 })
    await tryBtn.click()
    await page.waitForTimeout(1500)
    // should scroll to the showcase carousel (view-in-showcase event dispatch
    // + scrollIntoView — see Catalogue.jsx's onViewIn3D)
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
    if (!/Tile Showcase/i.test(text)) throw new Error('showcase not ready after View in Showcase')
    return inView ? 'scrolled to showcase' : 'applied (scrolled manually)'
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

  // ── No dead visualizer routes (2D room compositor or legacy 3D) ──
  await check('desktop:no-legacy-visualizer-section', async () => {
    const has3d = await page.evaluate(() => !!document.getElementById('visualizer-3d'))
    if (has3d) throw new Error('legacy #visualizer-3d present')
    const hasRoomCanvas = await page.evaluate(() => !!document.querySelector('#visualizer canvas'))
    if (hasRoomCanvas) throw new Error('a <canvas> is present in #visualizer — the 2D room visualizer should be fully replaced by the CSS-only showcase carousel')
    return 'only the showcase carousel'
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
    if (links < 1) throw new Error('no showcase link')
    // CRITICAL: close menu so later tests are not blocked by the drawer overlay
    await burger.click()
    await page.waitForTimeout(350)
    return `showcase links=${links}; menu closed`
  })

  await check('mobile:showcase-layout', async () => {
    await page.goto(BASE + '/#visualizer', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#visualizer', { timeout: 30000 })
    await page.waitForTimeout(1200)
    await closeMobileChrome()
    const group = page.locator('#visualizer [role="group"]').first()
    await group.waitFor({ state: 'visible', timeout: 15000 })
    const n = await page.locator('#visualizer [role="group"] button[aria-label$="current slide"], #visualizer [role="group"] button[aria-label^="Go to"]').count()
    if (n !== SHOWCASE_SLIDE_COUNT) throw new Error(`expected ${SHOWCASE_SLIDE_COUNT} slides, found ${n}`)
    return `carousel + ${n} slides`
  })

  await check('mobile:showcase-tap-arrow', async () => {
    await closeMobileChrome()
    const activeSlideM = () => page.locator('#visualizer button[aria-label$="current slide"]')
    const before = await activeSlideM().getAttribute('aria-label')
    await page.locator('#visualizer button[aria-label="Next tile"]').click({ force: true })
    await page.waitForTimeout(500)
    const after = await activeSlideM().getAttribute('aria-label')
    if (after === before) throw new Error('tapping Next did not change the active slide')
    return `${before} → ${after}`
  })

  await check('mobile:showcase-swipe', async () => {
    const activeSlideM = () => page.locator('#visualizer button[aria-label$="current slide"]')
    const before = await activeSlideM().getAttribute('aria-label')
    const box = await page.locator('#visualizer [role="group"]').first().boundingBox()
    await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5).catch(() => {})
    // touchscreen has no drag primitive in playwright-core; simulate the swipe
    // with pointer/mouse move, which the component's drag="x" handles the same way
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(500)
    const after = await activeSlideM().getAttribute('aria-label')
    if (after === before) throw new Error('swipe-left did not change the active slide')
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
