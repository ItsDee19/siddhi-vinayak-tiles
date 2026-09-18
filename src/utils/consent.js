export const CONSENT_KEY = 'sidhhi-cookie-preferences'
export const CONSENT_VERSION = 1
export const CONSENT_LIFETIME_MS = 180 * 24 * 60 * 60 * 1000

/** Unknown, expired or malformed preferences never enable optional content. */
export function parseConsent(raw, now = Date.now()) {
  try {
    const value = JSON.parse(raw)
    if (!value || value.version !== CONSENT_VERSION || typeof value.maps !== 'boolean') return null
    if (!Number.isFinite(value.savedAt) || !Number.isFinite(value.expiresAt)) return null
    if (value.savedAt > now || value.savedAt <= 0 || value.expiresAt <= now) return null
    if (value.expiresAt - value.savedAt !== CONSENT_LIFETIME_MS) return null
    return { version: CONSENT_VERSION, maps: value.maps, savedAt: value.savedAt, expiresAt: value.expiresAt }
  } catch {
    return null
  }
}

export function readConsent(storage, now = Date.now()) {
  try {
    return parseConsent(storage.getItem(CONSENT_KEY), now)
  } catch {
    return null
  }
}

export function saveConsent(storage, maps, now = Date.now()) {
  const preference = {
    version: CONSENT_VERSION,
    maps: maps === true,
    savedAt: now,
    expiresAt: now + CONSENT_LIFETIME_MS,
  }
  try {
    storage.setItem(CONSENT_KEY, JSON.stringify(preference))
    // Some restricted browser contexts silently decline writes.
    const stored = readConsent(storage, now)
    return stored?.savedAt === now && stored.maps === preference.maps ? stored : null
  } catch {
    return null
  }
}
