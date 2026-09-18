import { useEffect, useRef, useState } from 'react'
import Icon from '../Icons'
import Reveal from '../ui/Reveal'
import SectionHeading from '../ui/SectionHeading'
import { business } from '../../data/siteConfig'
import { categories } from '../../data/products'
import { useConsent } from '../privacy/ConsentProvider'
import { ENQUIRY_LIMITS, checkEnquiryGuard, createEnquiryDraft, readEnquiryCooldown, saveEnquiryCooldown, validateEnquiry } from '../../utils/enquiry'

const interests = [...categories.map((category) => category.name), 'Multiple / Not sure']

export default function Contact() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    interest: '',
    message: '',
  })
  const [errors, setErrors] = useState({})
  const [guardError, setGuardError] = useState('')
  const [draft, setDraft] = useState(null)
  const [reviewing, setReviewing] = useState(false)
  const formRef = useRef(null)
  const draftHeading = useRef(null)
  const honeypot = useRef(null)
  const startedAt = useRef(null)
  const lastPreparedAt = useRef(null)
  const { mapsAllowed, allowMaps } = useConsent()

  const beginInteraction = () => { startedAt.current ??= Date.now() }
  const update = (key) => (event) => {
    beginInteraction()
    setForm((current) => ({ ...current, [key]: event.target.value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setGuardError('')
  }

  useEffect(() => {
    if (reviewing) draftHeading.current?.focus()
  }, [reviewing])

  // This prepares a draft locally. Nothing is sent until the customer chooses
  // the explicit WhatsApp link and sends the message inside WhatsApp.
  const handleSubmit = (event) => {
    event.preventDefault()
    const result = validateEnquiry(form, interests)
    setErrors(result.errors)
    setGuardError('')
    if (!result.valid) {
      const firstError = Object.keys(result.errors)[0]
      requestAnimationFrame(() => formRef.current?.elements.namedItem(firstError)?.focus())
      return
    }
    const nextDraft = createEnquiryDraft(result.values, business)
    // Reopening the same draft does not create a second enquiry or reset limits.
    if (draft?.text === nextDraft.text) {
      setReviewing(true)
      return
    }
    const now = Date.now()
    let stored = null
    try { stored = readEnquiryCooldown(window.sessionStorage, now) } catch { /* browser storage may be disabled */ }
    const error = checkEnquiryGuard({
      honeypot: honeypot.current?.value,
      startedAt: startedAt.current,
      lastPreparedAt: Math.max(lastPreparedAt.current || 0, stored || 0) || null,
      now,
    })
    if (error) {
      setGuardError(error)
      return
    }
    lastPreparedAt.current = now
    try { saveEnquiryCooldown(window.sessionStorage, now) } catch { /* in-memory cooldown remains active */ }
    setDraft(nextDraft)
    setReviewing(true)
  }

  return (
    <section id="contact" className="section-pad relative bg-charcoal-800">
      <div className="container-px">
        <SectionHeading
          eyebrow="Visit Us"
          title="Come Say Hello"
          subtitle="Drop by the showroom, call us, or send a quick enquiry — we’d love to help with your project."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          {/* left: details + map */}
          <Reveal>
            <div className="flex h-full flex-col gap-6">
              {/* quick contact cards */}
              <div className="grid gap-4 sm:grid-cols-2">
                <a
                  href={`tel:${business.phoneTel}`}
                  className="group rounded-2xl border border-white/5 bg-charcoal-700 p-5 transition-colors hover:border-gold/30"
                >
                  <Icon name="phone" className="h-6 w-6 text-gold" />
                  <p className="mt-3 text-xs uppercase tracking-wider text-sand/60">
                    Call us
                  </p>
                  <p className="font-display text-lg text-cream">
                    {business.phoneDisplay}
                  </p>
                </a>
                <a
                  href={business.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-2xl border border-white/5 bg-charcoal-700 p-5 transition-colors hover:border-gold/30"
                >
                  <Icon name="whatsapp" className="h-6 w-6 text-gold" />
                  <p className="mt-3 text-xs uppercase tracking-wider text-sand/60">
                    WhatsApp
                  </p>
                  <p className="font-display text-lg text-cream">Chat with us</p>
                </a>
              </div>

              <div className="rounded-2xl border border-white/5 bg-charcoal-700 p-5">
                <div className="flex items-start gap-3">
                  <Icon name="mapPin" className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                  <div>
                    <p className="text-xs uppercase tracking-wider text-sand/60">
                      Address
                    </p>
                    <p className="text-cream">{business.address.line1}</p>
                    <p className="text-sand/80">
                      {business.address.line2}, {business.address.city},{' '}
                      {business.address.state} {business.address.pin}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3 border-t border-white/5 pt-4">
                  <Icon name="clock" className="h-5 w-5 shrink-0 text-gold" />
                  <p className="text-sm text-sand">
                    <span className="font-medium text-cream">
                      {business.hours.label}
                    </span>{' '}
                    · {business.hours.time}
                    <span className="block text-xs text-sand/60">
                      {business.hours.note}
                    </span>
                  </p>
                </div>
              </div>

              {/* map */}
              <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/5 shadow-card">
                {mapsAllowed ? (
                  <iframe
                    title="Sidhhi Binayak Tiles location"
                    src={business.mapEmbedSrc}
                    className="h-full min-h-[300px] w-full"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    allowFullScreen
                  />
                ) : (
                  <div className="contact-map-placeholder">
                    <Icon name="mapPin" className="h-8 w-8 text-gold" />
                    <p className="font-display text-xl">Find our showroom</p>
                    <p>The embedded Google Map stays off until you allow it. Google may use cookies and receive your device information.</p>
                    <button type="button" onClick={allowMaps} className="btn-outline">Allow Google Maps</button>
                  </div>
                )}
                <a
                  href={business.mapLink}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute bottom-3 right-3 rounded-full bg-charcoal/85 px-3 py-1.5 text-xs text-gold backdrop-blur hover:bg-charcoal"
                >
                  Open in Maps →
                </a>
              </div>
            </div>
          </Reveal>

          {/* right: enquiry form */}
          <Reveal delay={0.1}>
            <div className="rounded-3xl border border-white/5 bg-charcoal-700 p-7 shadow-card sm:p-9">
              <h3 className="font-display text-2xl text-cream">Start an Enquiry</h3>
              <p className="mt-2 text-sm text-sand/70">
                Prepare your enquiry here, then review and send it in WhatsApp.
              </p>

              {reviewing ? (
                <div className="mt-8 rounded-2xl border border-gold/30 bg-gold/10 p-6 text-center">
                  <Icon
                    name="whatsapp"
                    className="mx-auto h-10 w-10 text-gold"
                  />
                  <h4 ref={draftHeading} tabIndex={-1} className="mt-3 font-display text-lg text-cream">Your draft is ready</h4>
                  <p className="mt-1 text-sm text-sand/80">
                    Nothing has been sent yet. Open WhatsApp to review your message and tap Send there.
                  </p>
                  <p className="contact-draft-preview">{draft.text}</p>
                  <a href={draft.href} target="_blank" rel="noopener noreferrer" className="btn-gold mt-5 w-full">Review in WhatsApp</a>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewing(false)
                      requestAnimationFrame(() => formRef.current?.elements.namedItem('name')?.focus())
                    }}
                    className="btn-outline mt-5 px-5 py-2.5 text-xs"
                  >
                    Edit details
                  </button>
                </div>
              ) : (
                <form ref={formRef} onSubmit={handleSubmit} onFocusCapture={beginInteraction} noValidate className="mt-7 space-y-4">
                  <div className="enquiry-honeypot" aria-hidden="true">
                    <label htmlFor="enquiry-website">Leave this field empty</label>
                    <input ref={honeypot} type="text" name="website" id="enquiry-website" tabIndex={-1} autoComplete="off" />
                  </div>
                  <Field
                    label="Your Name"
                    name="name"
                    value={form.name}
                    onChange={update('name')}
                    placeholder="e.g. Rahul Sahu"
                    autoComplete="name"
                    maxLength={ENQUIRY_LIMITS.name}
                    error={errors.name}
                    required
                  />
                  <Field
                    label="Phone Number"
                    name="phone"
                    value={form.phone}
                    onChange={update('phone')}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={ENQUIRY_LIMITS.phone}
                    error={errors.phone}
                    placeholder="10-digit mobile"
                    required
                  />
                  <div>
                    <label htmlFor="enquiry-interest" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-sand/70">
                      Interested In <span className="normal-case tracking-normal">(optional)</span>
                    </label>
                    <select
                      id="enquiry-interest"
                      name="interest"
                      aria-invalid={Boolean(errors.interest)}
                      aria-describedby={errors.interest ? 'enquiry-interest-error' : undefined}
                      value={form.interest}
                      onChange={update('interest')}
                      className="w-full rounded-xl border border-white/10 bg-charcoal-800 px-4 py-3 text-cream outline-none transition-colors focus:border-gold"
                    >
                      <option value="">Select a category…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                      <option value="Multiple / Not sure">
                        Multiple / Not sure
                      </option>
                    </select>
                    {errors.interest && <p id="enquiry-interest-error" className="privacy-error">{errors.interest}</p>}
                  </div>
                  <div>
                    <label htmlFor="enquiry-message" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-sand/70">
                      Message <span className="normal-case tracking-normal">(optional)</span>
                    </label>
                    <textarea
                      id="enquiry-message"
                      name="message"
                      maxLength={ENQUIRY_LIMITS.message}
                      aria-invalid={Boolean(errors.message)}
                      aria-describedby={`enquiry-message-help${errors.message ? ' enquiry-message-error' : ''}`}
                      value={form.message}
                      onChange={update('message')}
                      rows={4}
                      placeholder="Tell us about your project, sizes, budget…"
                      className="w-full resize-none rounded-xl border border-white/10 bg-charcoal-800 px-4 py-3 text-cream outline-none transition-colors placeholder:text-sand/40 focus:border-gold"
                    />
                    <p id="enquiry-message-help" className="contact-field-help">Up to 2,000 characters. Please avoid sharing sensitive information.</p>
                    {errors.message && <p id="enquiry-message-error" className="privacy-error">{errors.message}</p>}
                  </div>
                  {Object.keys(errors).some((key) => errors[key]) && <p className="sr-only" role="alert">Please check the highlighted fields.</p>}
                  {guardError && <p className="privacy-error" role="alert">{guardError}</p>}
                  <button type="submit" className="btn-gold w-full">
                    <Icon name="whatsapp" className="h-4 w-4" />
                    Prepare WhatsApp draft
                  </button>
                  {draft && <button type="button" onClick={() => setReviewing(true)} className="contact-previous-draft">Review previous draft</button>}
                  <p className="contact-field-help text-center">
                    Your details stay on this page until you open WhatsApp. <a href="/privacy-policy">Privacy policy</a>
                  </p>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function Field({ label, name, error, type = 'text', ...props }) {
  const id = `enquiry-${name}`
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-sand/70">
        {label} {props.required && <span className="normal-case tracking-normal">(required)</span>}
      </label>
      <input
        type={type}
        id={id}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
        className="w-full rounded-xl border border-white/10 bg-charcoal-800 px-4 py-3 text-cream outline-none transition-colors placeholder:text-sand/40 focus:border-gold"
      />
      {error && <p id={`${id}-error`} className="privacy-error">{error}</p>}
    </div>
  )
}
