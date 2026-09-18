import test from 'node:test'
import assert from 'node:assert/strict'
import { CONSENT_KEY, CONSENT_LIFETIME_MS, CONSENT_VERSION, parseConsent, readConsent, saveConsent } from './consent.js'

const now = 1_790_000_000_000
const choice = { version: CONSENT_VERSION, maps: true, savedAt: now, expiresAt: now + CONSENT_LIFETIME_MS }
const memory = () => {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}

test('maps require a valid, unexpired, affirmative preference', () => {
  assert.equal(parseConsent(null, now), null)
  assert.equal(parseConsent('invalid', now), null)
  assert.equal(parseConsent('{}', now), null)
  assert.deepEqual(parseConsent(JSON.stringify(choice), now), choice)
  assert.equal(parseConsent(JSON.stringify({ ...choice, maps: false }), now).maps, false)
  for (const changed of [
    { version: 0 }, { maps: 'true' }, { maps: 1 }, { savedAt: now + 1 },
    { savedAt: 0 }, { expiresAt: now }, { expiresAt: choice.expiresAt + 1 },
  ]) assert.equal(parseConsent(JSON.stringify({ ...choice, ...changed }), now), null)
  assert.equal(parseConsent(JSON.stringify(choice), choice.expiresAt), null)
})

test('saving opt-in and revocation persists exact version and expiry', () => {
  const storage = memory()
  assert.equal(saveConsent(storage, true, now).maps, true)
  assert.deepEqual(readConsent(storage, now), choice)
  const revoked = saveConsent(storage, false, now + 100)
  assert.equal(revoked.maps, false)
  assert.equal(revoked.expiresAt, now + 100 + CONSENT_LIFETIME_MS)
  assert.equal(JSON.parse(storage.getItem(CONSENT_KEY)).maps, false)
  assert.equal(saveConsent(storage, 'true', now).maps, false)
})

test('blocked or silently refused storage cannot allow optional maps', () => {
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.equal(readConsent(blocked, now), null)
  assert.equal(saveConsent(blocked, true, now), null)
  assert.equal(saveConsent({ getItem: () => null, setItem() {} }, true, now), null)
  const stale = { getItem: () => JSON.stringify({ ...choice, maps: false }), setItem() {} }
  assert.equal(saveConsent(stale, true, now), null)
})
