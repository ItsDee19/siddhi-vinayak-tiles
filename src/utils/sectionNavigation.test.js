import assert from 'node:assert/strict'
import test from 'node:test'
import { scrollToSection, cancelSectionNavigation, scrollBehavior } from './sectionNavigation.js'
import { publishCatalogueCategory, subscribeCatalogueCategory } from './catalogueSelection.js'

function environment(t, reduced = false) {
  const targets = new Map(), events = [], observers = [], listeners = new Map()
  const previous = { window: globalThis.window, document: globalThis.document, MutationObserver: globalThis.MutationObserver }
  globalThis.window = {
    matchMedia: () => ({ matches: reduced }), location: { hash: '' },
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name),
    history: { pushState: (_, __, hash) => { events.push(['push', hash]); window.location.hash = hash } },
  }
  globalThis.document = { getElementById: id => targets.get(id), body: {} }
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this) }
    observe() {}
    disconnect() { this.disconnected = true }
  }
  t.after(() => { cancelSectionNavigation(); Object.assign(globalThis, previous) })
  const target = id => {
    const heading = { hasAttribute: () => false, setAttribute: (key, value) => events.push([key, value]), focus: options => events.push(['focus', options]) }
    targets.set(id, { querySelector: () => heading, scrollIntoView: options => events.push(['scroll', options]) })
  }
  return { target, events, observers, listeners }
}

test('section navigation honors reduced motion, preserves focus and avoids duplicate history', t => {
  const { target, events } = environment(t, true)
  target('catalogue')
  assert.equal(scrollBehavior(), 'instant')
  scrollToSection('catalogue', { focus: true })
  scrollToSection('catalogue')
  assert.deepEqual(events.filter(event => event[0] === 'push'), [['push', '#catalogue']])
  assert.deepEqual(events.find(event => event[0] === 'focus'), ['focus', { preventScroll: true }])
  assert.ok(events.filter(event => event[0] === 'scroll').every(event => event[1].behavior === 'instant'))
})

test('a newer lazy-section navigation cancels the previous observer', t => {
  const { target, events, observers } = environment(t)
  scrollToSection('catalogue')
  scrollToSection('contact')
  assert.equal(observers[0].disconnected, true)
  target('contact')
  observers[1].callback()
  assert.equal(observers[1].disconnected, true)
  assert.deepEqual(events.find(event => event[0] === 'push'), ['push', '#contact'])
  assert.deepEqual(events.find(event => event[0] === 'scroll'), ['scroll', { behavior: 'smooth', block: 'start' }])
  assert.equal(scrollToSection(''), false)
  assert.equal(scrollToSection('../outside'), false)
})

test('category choices survive lazy catalogue mounting, while unavailable categories stay out', () => {
  const received = []
  publishCatalogueCategory('tiles')
  publishCatalogueCategory('sanitaryware')
  assert.equal(publishCatalogueCategory('marble'), false)
  const unsubscribe = subscribeCatalogueCategory(value => received.push(value))
  assert.deepEqual(received, ['sanitaryware'])
  publishCatalogueCategory('tiles')
  assert.deepEqual(received, ['sanitaryware', 'tiles'])
  unsubscribe()
  const next = []
  subscribeCatalogueCategory(value => next.push(value))()
  assert.deepEqual(next, [])
})

test('manual input cancels navigation while a lazy section is still loading', t => {
  const { observers, listeners } = environment(t)
  scrollToSection('contact')
  listeners.get('wheel')()
  assert.equal(observers[0].disconnected, true)
  assert.equal(listeners.size, 0)
})
