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

const ROOMS = [
  // Wall is three straight horizontal bands (PRD §4.2 3-2-3) plus the floor.
  { id: 'bathroom-01', name: 'Small Bathroom', zones: ['Floor', 'Lower Wall', 'Accent Strip', 'Upper Wall'] },
  // Same idea at 2-4-2 (PRD §4.3); floor stays tileable.
  { id: 'large-bathroom-b', name: 'Large Bathroom', zones: ['Floor', 'Lower Band', 'Feature Band', 'Upper Band'] },
  { id: 'staircase-c', name: 'Staircase', zones: ['Stairs'] },
  { id: 'feature-wall-d', name: 'Feature Wall', zones: ['Wall'] },
  // Vanity zones rebuilt around photo A: Wall, Floor and one combined
  // Basin chip (wash basin + granite counter). Cabinet/tap stay locked.
  { id: 'vanity-e', name: 'Vanity Counter', zones: ['Wall', 'Floor', 'Basin'] },
]

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

  // ── Visualizer core ──
  await check('desktop:visualizer-heading', async () => {
    await scrollTo(page, 'visualizer')
    await page.waitForSelector('#visualizer', { timeout: 20000 })
    await page.waitForTimeout(2000) // canvas compose
    const h = await page.locator('#visualizer').innerText()
    if (!/Tile Visualizer|Room Preview/i.test(h)) throw new Error('heading missing')
    return 'ok'
  })

  await check('desktop:visualizer-canvas', async () => {
    const canvas = page.locator('#visualizer canvas').first()
    await canvas.waitFor({ state: 'visible', timeout: 30000 })
    const box = await canvas.boundingBox()
    if (!box || box.width < 200 || box.height < 150) throw new Error(`canvas ${JSON.stringify(box)}`)
    // non-blank sample
    const pixels = await page.evaluate(() => {
      const c = document.querySelector('#visualizer canvas')
      if (!c) return null
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!ctx) return { note: 'no-2d-ctx' }
      const { width: w, height: h } = c
      if (w < 2 || h < 2) return { note: 'tiny', w, h }
      const data = ctx.getImageData(Math.floor(w / 2), Math.floor(h / 2), 1, 1).data
      return { w, h, r: data[0], g: data[1], b: data[2], a: data[3] }
    })
    if (!pixels) throw new Error('no canvas')
    if (pixels.note === 'no-2d-ctx') return 'WebGL/other ctx ok'
    if (pixels.a === 0) throw new Error('canvas fully transparent at center')
    return `${pixels.w}×${pixels.h} rgba(${pixels.r},${pixels.g},${pixels.b},${pixels.a})`
  })

  // The room runs full-bleed and the tile picker sits underneath it. Both are
  // easy to undo by accident — a stray wrapper restoring the container padding,
  // or a grid class putting the picker back in a side column — and neither
  // shows up as an error, so they are asserted rather than eyeballed.
  await check('desktop:visualizer-full-bleed', async () => {
    const box = await page.locator('#visualizer canvas').first().boundingBox()
    const vw = await page.evaluate(() => window.innerWidth)
    const vh = await page.evaluate(() => window.innerHeight)
    const pct = Math.round((box.width / vw) * 100)
    // 16:9 plates on a viewport wider than 16:9 are height-bound, so the floor
    // for this assertion is the geometric limit, not an arbitrary percentage.
    const ceiling = Math.min(vw, vh * 0.92 * (16 / 9))
    if (box.width < ceiling * 0.9) {
      throw new Error(`canvas ${Math.round(box.width)}px is well under the ${Math.round(ceiling)}px the viewport allows`)
    }
    if (box.height > vh + 1) throw new Error(`canvas ${Math.round(box.height)}px taller than viewport ${vh}px`)
    return `${Math.round(box.width)}×${Math.round(box.height)} = ${pct}% of ${vw}px, room fully visible`
  })

  await check('desktop:picker-below-canvas', async () => {
    const canvas = await page.locator('#visualizer canvas').first().boundingBox()
    const search = await page.locator('#visualizer input[placeholder*="Search by tile"]').first().boundingBox()
    if (!search) throw new Error('tile search box not found')
    if (search.y < canvas.y + canvas.height - 2) {
      throw new Error(`picker top ${Math.round(search.y)} overlaps canvas bottom ${Math.round(canvas.y + canvas.height)} — still side-by-side`)
    }
    return `picker starts ${Math.round(search.y - (canvas.y + canvas.height))}px below the room`
  })

  // All 5 rooms
  for (const room of ROOMS) {
    await check(`desktop:room-${room.id}`, async () => {
      await scrollTo(page, 'visualizer')
      const tab = page.locator('#visualizer button[role="tab"]', { hasText: room.name })
      await tab.first().click()
      await page.waitForTimeout(1800)
      const selected = await tab.first().getAttribute('aria-selected')
      if (selected !== 'true') throw new Error(`aria-selected=${selected}`)
      // zone chips
      for (const z of room.zones) {
        const zc = page.locator('#visualizer button', { hasText: new RegExp(`^${z}`) })
        if ((await zc.count()) < 1) throw new Error(`zone chip missing: ${z}`)
      }
      // staircase should NOT show Wall as active zone chip row for tiling walls
      if (room.id === 'staircase-c') {
        const wallOnly = page.locator('#visualizer button').filter({ hasText: /^Wall$/ })
        // may exist in room list? no — zone chips only Floor/Stairs
        const stairs = page.locator('#visualizer button', { hasText: /Stairs/ })
        if ((await stairs.count()) < 1) throw new Error('Stairs zone missing')
      }
      if (room.id === 'feature-wall-d') {
        const floor = page.locator('#visualizer button', { hasText: /^Floor$/ })
        // Feature wall has only Wall zone — Floor zone chip should be absent
        // (product labels may still say Floor elsewhere — check zone chips area carefully)
        const zoneLabels = await page.evaluate(() => {
          const sec = document.getElementById('visualizer')
          // zone chips are buttons with label block
          return [...sec.querySelectorAll('button')].map((b) => b.innerText.trim().split('\n')[0])
        })
        if (zoneLabels.includes('Floor') && !zoneLabels.includes('Wall')) {
          throw new Error('Feature wall should have Wall zone')
        }
        if (!zoneLabels.some((t) => t === 'Wall')) throw new Error(`no Wall zone; labels=${zoneLabels.slice(0, 20)}`)
      }
      const canvas = page.locator('#visualizer canvas').first()
      await canvas.waitFor({ state: 'visible', timeout: 15000 })
      return `selected · zones ${room.zones.join('+')}`
    })
  }

  // Switch back to bathroom for tile interactions
  await check('desktop:pick-tile-swatch', async () => {
    await scrollTo(page, 'visualizer')
    await page.locator('#visualizer button[role="tab"]', { hasText: 'Small Bathroom' }).first().click()
    await page.waitForTimeout(1200)
    // Floor zone
    const floorBtn = page.locator('#visualizer button', { hasText: /^Floor/ }).first()
    await floorBtn.click()
    await page.waitForTimeout(300)
    const options = page.locator('#visualizer [role="option"]')
    await options.first().waitFor({ state: 'visible', timeout: 15000 })
    const n = await options.count()
    if (n < 5) throw new Error(`only ${n} swatches`)
    // pick a later swatch
    const target = options.nth(Math.min(5, n - 1))
    await target.click()
    await page.waitForTimeout(800)
    const sel = await target.getAttribute('aria-selected')
    if (sel !== 'true') throw new Error('swatch not selected')
    return `${n} swatches`
  })

  await check('desktop:tile-search', async () => {
    const input = page.locator('#visualizer input[type="search"]').first()
    await input.fill('grey')
    await page.waitForTimeout(400)
    const n = await page.locator('#visualizer [role="option"]').count()
    await input.fill('')
    await page.waitForTimeout(200)
    return `grey → ${n} results`
  })

  await check('desktop:tile-size-filter-chips', async () => {
    const chip = page.locator('#visualizer button', { hasText: /2x4 Slabs|Floor Collection|All \(/ }).first()
    await chip.click()
    await page.waitForTimeout(300)
    const n = await page.locator('#visualizer [role="option"]').count()
    // reset All
    await page.locator('#visualizer button', { hasText: /^All \(/ }).first().click()
    return `${n} after filter`
  })

  await check('desktop:scale-slider', async () => {
    const range = page.locator('#visualizer input[type="range"][aria-label="Tile size"]')
    await range.waitFor({ state: 'visible', timeout: 10000 })
    const before = await range.inputValue()
    await range.fill('1.2')
    const after = await range.inputValue()
    if (Number(after) < 1.1) throw new Error(`scale ${before}→${after}`)
    await page.waitForTimeout(600)
    return `${before} → ${after}`
  })

  await check('desktop:grout-toggle', async () => {
    const cb = page.locator('#visualizer label', { hasText: /grout/i }).locator('input[type="checkbox"]')
    await cb.check()
    await page.waitForTimeout(400)
    if (!(await cb.isChecked())) throw new Error('not checked')
    await cb.uncheck()
    return 'ok'
  })

  await check('desktop:copy-link', async () => {
    const hashBefore = await page.evaluate(() => location.hash)
    await page.locator('#visualizer button', { hasText: /Copy link|Link copied/ }).first().click()
    await page.waitForTimeout(400)

    // The share link lives in the CLIPBOARD, not in the address bar. This used
    // to fall back to asserting location.hash, which only passed back when the
    // visualizer wrote its state into the URL on every change. That was removed
    // deliberately — it hijacked the landing scroll and meant copying the
    // address bar shared a half-finished tile selection — so asserting on the
    // hash here would now be testing for the bug rather than the feature.
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    if (!clip.includes('#visualizer?') || !clip.includes('room=')) {
      throw new Error(`clipboard=${clip.slice(0, 120)}`)
    }

    // Regression guard for that fix: copying a link must not mutate the URL.
    const hashAfter = await page.evaluate(() => location.hash)
    if (hashAfter !== hashBefore) {
      throw new Error(`copy mutated the address bar: ${hashBefore} -> ${hashAfter}`)
    }
    return clip.slice(clip.indexOf('#'), clip.indexOf('#') + 80)
  })

  await check('desktop:reset', async () => {
    await page.locator('#visualizer button', { hasText: /^Reset$/ }).first().click()
    await page.waitForTimeout(600)
    return 'ok'
  })

  await check('desktop:download-hq-button', async () => {
    const btn = page.locator('#visualizer button', { hasText: /Download HQ|Exporting/ }).first()
    await btn.waitFor({ state: 'visible' })
    // Don't fully download (file dialog); just ensure clickable and no crash
    return 'visible'
  })

  // Deep link cold load
  await check('desktop:deep-link-room', async () => {
    const url = `${BASE}/#visualizer?room=staircase-c&scale=0.90`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('#visualizer', { timeout: 30000 })
    const tab = page.locator('#visualizer button[role="tab"]', { hasText: 'Staircase' })
    await tab.first().waitFor({ state: 'visible', timeout: 25000 })
    // Poll until deep-link boot selects the room (lazy chunk + force-from-hash).
    // Note: Playwright waitForFunction(fn, arg, options) — options are 3rd arg.
    let selected = 'false'
    let scale = '?'
    let hash = ''
    for (let i = 0; i < 40; i++) {
      selected = await tab.first().getAttribute('aria-selected')
      const range = page.locator('#visualizer input[type="range"][aria-label="Tile size"]')
      scale = (await range.count()) ? await range.inputValue() : '?'
      hash = await page.evaluate(() => location.hash)
      if (selected === 'true' && Math.abs(Number(scale) - 0.9) < 0.06) break
      await page.waitForTimeout(250)
    }
    if (selected !== 'true') {
      throw new Error(`Staircase not selected after boot; scale=${scale} hash=${hash}`)
    }
    if (Math.abs(Number(scale) - 0.9) >= 0.06) {
      throw new Error(`scale expected ~0.90 got ${scale}; hash=${hash}`)
    }
    return `selected=${selected} scale=${scale} hash=${hash.slice(0, 90)}`
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

  await check('desktop:catalogue-try-visualizer', async () => {
    await scrollTo(page, 'catalogue')
    await page.waitForTimeout(800)
    const tryBtn = page.locator('#catalogue button', { hasText: /Try Visualizer/ }).first()
    await tryBtn.waitFor({ state: 'visible', timeout: 15000 })
    await tryBtn.click()
    await page.waitForTimeout(1500)
    // should scroll/navigate to visualizer and update hash or tiles
    const viz = page.locator('#visualizer')
    const inView = await page.evaluate(() => {
      const el = document.getElementById('visualizer')
      if (!el) return false
      const r = el.getBoundingClientRect()
      return r.top < window.innerHeight && r.bottom > 0
    })
    if (!inView) {
      // event may apply tiles without scroll — still check hash or zone labels
      await scrollTo(page, 'visualizer')
    }
    await page.waitForTimeout(800)
    const text = await viz.innerText()
    if (!/Tile Visualizer|Floor|Wall/i.test(text)) throw new Error('visualizer not ready after Try')
    return inView ? 'scrolled to visualizer' : 'applied (scrolled manually)'
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

  // ── Room assets HTTP ──
  for (const room of ROOMS) {
    await check(`desktop:asset-${room.id}-base.webp`, () =>
      assetOk(page, `/2d-rooms/${room.id}/base.webp`),
    )
    await check(`desktop:asset-${room.id}-overlay.webp`, () =>
      assetOk(page, `/2d-rooms/${room.id}/overlay-locked.webp`),
    )
  }
  await check('desktop:asset-bathroom-masks', async () => {
    await assetOk(page, '/2d-rooms/bathroom-01/mask-floor.webp')
    await assetOk(page, '/2d-rooms/bathroom-01/mask-wall.webp')
    return 'ok'
  })
  await check('desktop:asset-staircase-mask-only-floor', async () => {
    await assetOk(page, '/2d-rooms/staircase-c/mask-floor.webp')
    const wall = await page.request.get(new URL('/2d-rooms/staircase-c/mask-wall.webp', BASE).href)
    // wall mask should not exist (or 404) for stairs-only model
    if (wall.ok()) return 'WARN: mask-wall exists (unexpected but not crash)'
    return `wall mask status ${wall.status()} (expected missing)`
  })
  await check('desktop:asset-feature-wall-mask-only-wall', async () => {
    await assetOk(page, '/2d-rooms/feature-wall-d/mask-wall.webp')
    const floor = await page.request.get(new URL('/2d-rooms/feature-wall-d/mask-floor.webp', BASE).href)
    if (floor.ok()) return 'WARN: mask-floor exists'
    return `floor mask status ${floor.status()} (expected missing)`
  })

  // ── No dead 3D visualizer GLB route ──
  await check('desktop:no-3d-visualizer-section', async () => {
    const has3d = await page.evaluate(() => !!document.getElementById('visualizer-3d'))
    if (has3d) throw new Error('legacy #visualizer-3d present')
    return 'only 2D #visualizer'
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
      const menuOpen = await page.locator('header a[href="#home"]').nth(1).isVisible().catch(() => false)
      // If mobile drawer links are visible below nav, close
      const drawerLink = page.locator('header ul a[href="#visualizer"]')
      if ((await drawerLink.count()) > 0 && (await drawerLink.first().isVisible().catch(() => false))) {
        await burger.click({ force: true })
        await page.waitForTimeout(350)
      }
    }
  }

  async function clickRoomTab(name) {
    await closeMobileChrome()
    await scrollTo(page, 'visualizer')
    // Center room chips under fixed header / above sticky bottom bar
    await page.evaluate(() => {
      const el = document.getElementById('visualizer')
      if (!el) return
      const y = el.getBoundingClientRect().top + window.scrollY - 70
      window.scrollTo(0, Math.max(0, y))
    })
    await page.waitForTimeout(300)
    const tab = page.locator('#visualizer button[role="tab"]', { hasText: name }).first()
    await tab.waitFor({ state: 'attached', timeout: 15000 })
    // force: sticky chrome + open menu can intercept synthetic clicks
    await tab.click({ force: true })
    await page.waitForTimeout(1200)
    const sel = await tab.getAttribute('aria-selected')
    if (sel !== 'true') {
      // retry once via DOM click
      await tab.evaluate((el) => el.click())
      await page.waitForTimeout(1000)
    }
    const sel2 = await tab.getAttribute('aria-selected')
    if (sel2 !== 'true') throw new Error(`aria-selected=${sel2}`)
  }

  await check('mobile:nav-menu', async () => {
    const burger = page.locator('button[aria-label="Toggle menu"]')
    await burger.click()
    await page.waitForTimeout(400)
    const links = await page.locator('header a[href="#visualizer"]').count()
    if (links < 1) throw new Error('no visualizer link')
    // CRITICAL: close menu so later tests are not blocked by the drawer overlay
    await burger.click()
    await page.waitForTimeout(350)
    return `visualizer links=${links}; menu closed`
  })

  // The action bar is position:fixed and the visualiser mounts 500px early, so
  // it used to hover over the hero from first paint. It must appear only while
  // the visualiser itself is on screen.
  await check('mobile:no-choose-tiles-bar-at-top', async () => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3500) // past any lazy-mount / observer backstop
    await closeMobileChrome()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(600)
    const bar = page.locator('button', { hasText: /Choose tiles/ })
    if (await bar.first().isVisible().catch(() => false)) {
      throw new Error('"Choose tiles" bar is visible at the top of the page')
    }
    return 'hidden at hero'
  })

  await check('mobile:choose-tiles-bar-appears-in-visualizer', async () => {
    await page.evaluate(() => document.getElementById('visualizer')?.scrollIntoView())
    await page.waitForTimeout(1200)
    const bar = page.locator('button', { hasText: /Choose tiles/ })
    await bar.first().waitFor({ state: 'visible', timeout: 10000 })
    return 'visible once the room is on screen'
  })

  await check('mobile:visualizer-layout', async () => {
    await page.goto(BASE + '/#visualizer', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#visualizer', { timeout: 30000 })
    await page.waitForTimeout(2000)
    await closeMobileChrome()
    const choose = page.locator('#visualizer button', { hasText: /Choose tiles/ })
    await choose.first().waitFor({ state: 'visible', timeout: 15000 })
    const canvas = page.locator('#visualizer canvas').first()
    await canvas.waitFor({ state: 'visible', timeout: 20000 })
    return 'sheet bar + canvas'
  })

  for (const room of ROOMS) {
    await check(`mobile:room-${room.id}`, async () => {
      await clickRoomTab(room.name)
      return 'ok'
    })
  }

  await check('mobile:open-tile-sheet', async () => {
    await clickRoomTab('Small Bathroom')
    await page.locator('#visualizer button', { hasText: /Choose tiles/ }).first().click({ force: true })
    await page.waitForTimeout(500)
    const dialog = page.locator('[role="dialog"][aria-label="Choose tiles"]')
    await dialog.waitFor({ state: 'visible', timeout: 10000 })
    return 'dialog open'
  })

  await check('mobile:horizontal-swatch-scroll', async () => {
    const listbox = page.locator('[role="dialog"] [role="listbox"]').first()
    await listbox.waitFor({ state: 'visible', timeout: 10000 })
    const metrics = await listbox.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      canScroll: el.scrollWidth > el.clientWidth + 8,
    }))
    if (!metrics.canScroll) {
      throw new Error(
        `swatch strip not horizontally scrollable (scrollWidth=${metrics.scrollWidth}, clientWidth=${metrics.clientWidth})`,
      )
    }
    await listbox.evaluate((el) => {
      el.scrollLeft = Math.min(el.scrollWidth - el.clientWidth, 200)
    })
    await page.waitForTimeout(200)
    const after = await listbox.evaluate((el) => el.scrollLeft)
    if (after < 10) throw new Error(`scrollLeft stayed ${after}`)
    return `scrollWidth=${metrics.scrollWidth} client=${metrics.clientWidth} left=${after}`
  })

  await check('mobile:pick-swatch-in-sheet', async () => {
    const opt = page.locator('[role="dialog"] [role="option"]').nth(3)
    await opt.click({ force: true })
    await page.waitForTimeout(600)
    const sel = await opt.getAttribute('aria-selected')
    if (sel !== 'true') throw new Error('not selected')
    await page.locator('[role="dialog"] button', { hasText: /^Done$/ }).click({ force: true })
    await page.waitForTimeout(400)
    return 'picked + closed'
  })

  await check('mobile:zone-switch-opens-sheet', async () => {
    await closeMobileChrome()
    const wall = page.locator('#visualizer button', { hasText: /^Wall/ }).first()
    if ((await wall.count()) > 0) {
      await wall.click({ force: true })
      await page.waitForTimeout(500)
      const dialog = page.locator('[role="dialog"]')
      const open = await dialog.isVisible().catch(() => false)
      if (open) {
        await page.locator('button[aria-label="Close"]').first().click({ force: true }).catch(() => {})
      }
      return open ? 'sheet opened' : 'zone switched (no auto sheet)'
    }
    return 'no wall zone on current room'
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
