export const ENQUIRY_LIMITS = { name: 80, phone: 25, message: 2000 }
export const ENQUIRY_COOLDOWN_KEY = 'sidhhi-enquiry-cooldown'
export const ENQUIRY_COOLDOWN_MS = 30_000
export const ENQUIRY_INTERACTION_MS = 1500

const length = (value) => Array.from(value).length
const cleanString = (value) => typeof value === 'string' ? value.trim() : ''

export function normalizeIndianMobile(value) {
  if (typeof value !== 'string' || value.length > ENQUIRY_LIMITS.phone || !/^[+\d\s().-]+$/.test(value)) return null
  const compact = value.replace(/[\s().-]/g, '')
  if (!/^\+?\d+$/.test(compact)) return null
  let digits = compact.replace(/^\+/, '')
  if (compact.startsWith('+') && !(digits.length === 12 && digits.startsWith('91'))) return null
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null
}

export function validateEnquiry(input, allowedInterests = []) {
  const values = {
    name: cleanString(input.name).normalize('NFC'),
    phone: normalizeIndianMobile(input.phone),
    interest: cleanString(input.interest),
    message: cleanString(input.message).normalize('NFC'),
  }
  const errors = {}
  if (length(values.name) < 2 || length(values.name) > ENQUIRY_LIMITS.name || !/\p{L}/u.test(values.name) || !/^[\p{L}\p{M}\s.'’\-\u200c\u200d]+$/u.test(values.name) || /[\r\n\t]/.test(values.name)) {
    errors.name = 'Enter your name using 2–80 characters.'
  }
  if (!values.phone) errors.phone = 'Enter a valid 10-digit Indian mobile number, optionally with +91.'
  if (values.interest && !allowedInterests.includes(values.interest)) errors.interest = 'Choose an interest from the list.'
  if (length(values.message) > ENQUIRY_LIMITS.message) errors.message = 'Keep your message within 2,000 characters.'
  else if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(values.message)) errors.message = 'Remove unsupported control characters from your message.'
  return { values, errors, valid: Object.keys(errors).length === 0 }
}

export function readEnquiryCooldown(storage, now = Date.now()) {
  try {
    const value = Number(storage.getItem(ENQUIRY_COOLDOWN_KEY))
    return Number.isFinite(value) && value > 0 && value <= now && now - value < ENQUIRY_COOLDOWN_MS ? value : null
  } catch { return null }
}

export function saveEnquiryCooldown(storage, now = Date.now()) {
  try { storage.setItem(ENQUIRY_COOLDOWN_KEY, String(now)) } catch { /* In-memory guard remains active. */ }
}

/** Client-side friction only: there is no form submission endpoint to protect. */
export function checkEnquiryGuard({ honeypot, startedAt, lastPreparedAt, now = Date.now() }) {
  if (typeof honeypot === 'string' && honeypot.trim()) return 'We could not prepare this draft. Please refresh the page and try again, or use the direct WhatsApp link.'
  if (!Number.isFinite(startedAt) || startedAt > now || now - startedAt < ENQUIRY_INTERACTION_MS) return 'Please take a moment to review your details, then prepare your draft again.'
  if (Number.isFinite(lastPreparedAt) && lastPreparedAt <= now && now - lastPreparedAt < ENQUIRY_COOLDOWN_MS) {
    const seconds = Math.ceil((ENQUIRY_COOLDOWN_MS - (now - lastPreparedAt)) / 1000)
    return `Please wait ${seconds} seconds before preparing a new draft. You can still review the previous draft.`
  }
  return null
}

export function createEnquiryDraft(values, business) {
  const text = [
    `Enquiry for ${business.name}`,
    `Name: ${values.name}`,
    `Phone: ${values.phone}`,
    `Interested in: ${values.interest || 'Not specified'}`,
    `Message: ${values.message || '-'}`,
  ].join('\n')
  return { text, href: `${business.whatsapp}?text=${encodeURIComponent(text)}` }
}
