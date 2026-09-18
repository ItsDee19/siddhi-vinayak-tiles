import test from 'node:test'
import assert from 'node:assert/strict'
import { ENQUIRY_COOLDOWN_MS, ENQUIRY_INTERACTION_MS, normalizeIndianMobile, validateEnquiry, checkEnquiryGuard, createEnquiryDraft, readEnquiryCooldown, saveEnquiryCooldown } from './enquiry.js'

const valid = { name: 'Rahul Sahu', phone: '9876543210', interest: 'Tiles', message: 'For our home' }
const allowed = ['Tiles', 'Sanitaryware', 'Multiple / Not sure']

test('Indian mobile normalization accepts national and explicit country prefixes', () => {
  for (const phone of ['9876543210', '+91 98765 43210', '91-98765-43210', '09876543210', '(+91) 98765 43210']) {
    assert.equal(normalizeIndianMobile(phone), '+919876543210')
  }
  for (const phone of ['1234567890', '987654321', '+1 9876543210', '+9876543210', '++919876543210', '91abc9876543210', '9876543210 ext 2', '999999999999999999999999999', '', null]) {
    assert.equal(normalizeIndianMobile(phone), null)
  }
})

test('enquiry validates Unicode names, bounds and allowed interests without losing text', () => {
  for (const name of ['ଶୁଭମ ସାହୁ', 'राहुल साहू', 'Mary O’Neil', 'Anne-Marie', 'R. Sahu']) {
    assert.equal(validateEnquiry({ ...valid, name }, allowed).valid, true, name)
  }
  assert.equal(validateEnquiry({ ...valid, name: 'x' }, allowed).valid, false)
  assert.equal(validateEnquiry({ ...valid, name: 'a'.repeat(81) }, allowed).valid, false)
  assert.equal(validateEnquiry({ ...valid, name: 'A\nInjected' }, allowed).valid, false)
  assert.equal(validateEnquiry({ ...valid, interest: 'Injected category' }, allowed).valid, false)
  assert.equal(validateEnquiry({ ...valid, interest: '', message: '' }, allowed).valid, true)
  assert.equal(validateEnquiry({ ...valid, message: 'a'.repeat(2000) }, allowed).valid, true)
  assert.equal(validateEnquiry({ ...valid, message: 'a'.repeat(2001) }, allowed).valid, false)
  assert.equal(validateEnquiry({ ...valid, message: 'text\u0000text' }, allowed).valid, false)
  const result = validateEnquiry({ ...valid, name: ' Rahul Sahu ', message: 'First line\nSecond line' }, allowed)
  assert.equal(result.values.name, 'Rahul Sahu')
  assert.equal(result.values.phone, '+919876543210')
  assert.equal(result.values.message, 'First line\nSecond line')
})

test('honeypot, interaction delay and preparation cooldown reject rapid automated drafts', () => {
  const now = 1_790_000_000_000
  const context = { now, startedAt: now - ENQUIRY_INTERACTION_MS, honeypot: '', lastPreparedAt: null }
  assert.equal(checkEnquiryGuard(context), null)
  assert.ok(checkEnquiryGuard({ ...context, honeypot: 'bot.example' }))
  assert.ok(checkEnquiryGuard({ ...context, startedAt: null }))
  assert.ok(checkEnquiryGuard({ ...context, startedAt: now }))
  assert.ok(checkEnquiryGuard({ ...context, lastPreparedAt: now - 1000 }))
  assert.equal(checkEnquiryGuard({ ...context, lastPreparedAt: now - ENQUIRY_COOLDOWN_MS }), null)
})

test('session cooldown stores a timestamp only and tolerates unavailable storage', () => {
  const now = 1_790_000_000_000
  let stored
  const storage = { getItem: () => stored ?? null, setItem: (_key, value) => { stored = value } }
  assert.equal(readEnquiryCooldown(storage, now), null)
  saveEnquiryCooldown(storage, now)
  assert.equal(stored, String(now))
  assert.equal(readEnquiryCooldown(storage, now + 1), now)
  assert.equal(readEnquiryCooldown(storage, now + ENQUIRY_COOLDOWN_MS), null)
  assert.equal(readEnquiryCooldown(storage, now - 1), null)
  const blocked = { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } }
  assert.equal(readEnquiryCooldown(blocked, now), null)
  assert.doesNotThrow(() => saveEnquiryCooldown(blocked, now))
})

test('draft is encoded for WhatsApp, preserving Unicode and user message content', () => {
  const values = validateEnquiry({ ...valid, name: 'ଶୁଭମ ସାହୁ', message: 'Marble & quartz?\nSize: 2 × 4' }, allowed).values
  const draft = createEnquiryDraft(values, { name: 'Our showroom', whatsapp: 'https://wa.me/916371255411' })
  const url = new URL(draft.href)
  assert.equal(url.origin, 'https://wa.me')
  assert.equal(url.searchParams.get('text'), draft.text)
  assert.match(draft.text, /ଶୁଭମ ସାହୁ/)
  assert.match(draft.text, /Phone: \+919876543210/)
  assert.match(draft.text, /Marble & quartz\?\nSize: 2 × 4/)
})
