import { useRef, useState } from 'react'
import Icon from '../Icons'
import Reveal from '../ui/Reveal'
import SectionHeading from '../ui/SectionHeading'
import { business } from '../../data/siteConfig'
import { categories } from '../../data/products'
import { useReducedMotion } from '../../hooks/useReducedMotion'

export default function Contact() {
  const reduceMotion = useReducedMotion()
  const [form, setForm] = useState({
    name: '',
    phone: '',
    interest: '',
    message: '',
  })
  const [errors, setErrors] = useState({})
  const [draftUrl, setDraftUrl] = useState('')
  const formRef = useRef(null)

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }))
    setDraftUrl('')
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  // This prepares a draft only. Sending happens in WhatsApp, and cannot be
  // confirmed by this website. Keep the form and a retry link available.
  const handleSubmit = (e) => {
    e.preventDefault()
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Enter your name so we know who to reply to.'
    const phoneDigits = form.phone.replace(/\D/g, '')
    if (!/^[+\d\s().-]+$/.test(form.phone.trim()) || phoneDigits.length < 10 || phoneDigits.length > 15) {
      nextErrors.phone = 'Enter 10 digits, or include your country code (for example, +91).'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      // Focus after React has attached the inline error description.
      requestAnimationFrame(() => {
        const field = formRef.current?.elements.namedItem(Object.keys(nextErrors)[0])
        field?.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'center', inline: 'nearest' })
        field?.focus({ preventScroll: true })
      })
      return
    }
    const text = [
      `New enquiry for ${business.name}`,
      `Name: ${form.name.trim()}`,
      `Phone: ${form.phone.trim()}`,
      `Interested in: ${form.interest || 'Not specified'}`,
      `Message: ${form.message.trim() || '-'}`,
    ].join('\n')
    const url = `${business.whatsapp}?text=${encodeURIComponent(text)}`
    setDraftUrl(url)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <section id="contact" className="section-pad relative bg-charcoal-800">
      <div className="container-px">
        <SectionHeading
          eyebrow="Visit Us"
          title="Come Say Hello"
          subtitle="Drop by the showroom, call us, or send a quick enquiry — we’d love to help with your project."
        />

        <div className="mt-8 grid gap-6 sm:mt-14 sm:gap-8 lg:grid-cols-2">
          {/* left: details + address lookup */}
          <Reveal>
            <div className="flex h-full flex-col gap-6">
              {/* quick contact cards */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <a
                  href={`tel:${business.phoneTel}`}
                  className="group rounded-2xl border border-white/5 bg-charcoal-700 p-4 transition-colors hover:border-gold/30 sm:p-5"
                >
                  <Icon name="phone" className="h-6 w-6 text-gold" />
                  <p className="mt-3 text-xs uppercase tracking-wider text-sand">
                    Call us
                  </p>
                  <p className="font-display text-base text-cream sm:text-lg">
                    {business.phoneDisplay}
                  </p>
                </a>
                <a
                  href={business.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-2xl border border-white/5 bg-charcoal-700 p-4 transition-colors hover:border-gold/30 sm:p-5"
                >
                  <Icon name="whatsapp" className="h-6 w-6 text-gold" />
                  <p className="mt-3 text-xs uppercase tracking-wider text-sand">
                    WhatsApp
                  </p>
                  <p className="font-display text-base text-cream sm:text-lg">Chat with us</p>
                </a>
              </div>

              <div className="rounded-2xl border border-white/5 bg-charcoal-700 p-5">
                <div className="flex items-start gap-3">
                  <Icon name="mapPin" className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                  <div>
                    <p className="text-xs uppercase tracking-wider text-sand">
                      Address
                    </p>
                    <p className="text-cream">{business.address.line1}</p>
                    <p className="text-sand/90">
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
                    <span className="block text-xs text-sand/90">
                      {business.hours.note}
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-gold/20 bg-charcoal-700 p-5 sm:p-9">
                <Icon name="mapPin" className="h-7 w-7 text-gold" />
                <h3 className="mt-4 font-display text-2xl text-cream">Find the showroom</h3>
                <p className="mt-3 text-sm leading-relaxed text-sand/90">
                  Look up our address in Maps to plan your visit. Call us for help finding the entrance.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <a href={business.mapLink} target="_blank" rel="noopener noreferrer" className="btn-outline">
                    Find address in Maps
                    <Icon name="arrowRight" className="h-4 w-4" />
                  </a>
                  <a href={`tel:${business.phoneTel}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-gold underline underline-offset-4 hover:text-gold-light">
                    <Icon name="phone" className="h-4 w-4" />
                    Call for directions
                  </a>
                </div>
              </div>
            </div>
          </Reveal>

          {/* right: enquiry form */}
          <Reveal delay={0.1}>
            <div className="rounded-3xl border border-white/5 bg-charcoal-700 p-5 shadow-card sm:p-9">
              <h3 className="font-display text-2xl text-cream">Send an Enquiry</h3>
              <p className="mt-2 text-sm text-sand/90">
                WhatsApp opens with your draft. Review it and press Send to reach us.
              </p>

              <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
                <Field
                  id="enquiry-name"
                  name="name"
                  label="Your Name"
                  value={form.name}
                  onChange={update('name')}
                  autoComplete="name"
                  maxLength={80}
                  error={errors.name}
                  placeholder="e.g. Rahul Sahu"
                  required
                />
                <Field
                  id="enquiry-phone"
                  name="phone"
                  label="Phone Number"
                  value={form.phone}
                  onChange={update('phone')}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={24}
                  error={errors.phone}
                  placeholder="10-digit mobile"
                  required
                />
                <div>
                  <label htmlFor="enquiry-interest" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-sand">
                    Interested In <span className="normal-case tracking-normal">(optional)</span>
                  </label>
                  <select
                    id="enquiry-interest"
                    name="interest"
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
                </div>
                <div>
                  <label htmlFor="enquiry-message" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-sand">
                    Message <span className="normal-case tracking-normal">(optional)</span>
                  </label>
                  <textarea
                    id="enquiry-message"
                    name="message"
                    value={form.message}
                    onChange={update('message')}
                    rows={5}
                    maxLength={2000}
                    placeholder="Tell us about your project, sizes, budget…"
                    className="w-full resize-none rounded-xl border border-white/10 bg-charcoal-800 px-4 py-3 text-cream outline-none transition-colors placeholder:text-sand focus:border-gold"
                  />
                </div>
                <button type="submit" className="btn-gold w-full">
                  <Icon name="send" className="h-4 w-4" />
                  Continue to WhatsApp
                </button>
                <div className="min-h-[5.5rem] text-center text-sm" role="status" aria-live="polite" aria-atomic="true">
                  {draftUrl ? (
                    <>
                      <p className="text-sand/90">Your draft is ready. Review it and press Send in WhatsApp.</p>
                      <a href={draftUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-gold underline underline-offset-4 hover:text-gold-light">
                        Open your WhatsApp draft again
                      </a>
                    </>
                  ) : (
                    <p className="text-xs leading-relaxed text-sand/90">Your details are added to a WhatsApp draft. Nothing is sent until you choose Send in WhatsApp.</p>
                  )}
                </div>
              </form>
            </div>
          </Reveal>
        </div>

        <div className="mx-auto mt-8 max-w-3xl sm:mt-12">
          <h3 className="font-display text-2xl text-cream">Before your visit</h3>
          <div className="mt-3 divide-y divide-sand/20 border-y border-sand/20">
            <details className="group">
              <summary className="min-h-11 py-3 text-sm font-medium text-cream">Which products can I browse online?</summary>
              <p className="pb-4 text-sm leading-relaxed text-sand/90">
                Browse tiles and sanitaryware in our <a href="/catalogue/" className="text-gold underline underline-offset-4">online catalogue</a>.
                {' '}For marble, granite and quartz, contact {business.name} or visit our Nuapada showroom to see the selection.
              </p>
            </details>
            <details className="group">
              <summary className="min-h-11 py-3 text-sm font-medium text-cream">Can I see how tiles will look in a room?</summary>
              <p className="pb-4 text-sm leading-relaxed text-sand/90">
                Our <a href="#visualizer" className="text-gold underline underline-offset-4">3D visualizer</a> previews tiles on bathroom walls, stairs, a feature wall and a basin wall.
                {' '}Bathroom floors stay fixed while you compare wall tiles. Check physical samples at the showroom before choosing colours and finishes.
              </p>
            </details>
            <details className="group">
              <summary className="min-h-11 py-3 text-sm font-medium text-cream">How do I confirm prices and availability?</summary>
              <p className="pb-4 text-sm leading-relaxed text-sand/90">
                Share the product name, size and required quantity through our enquiry form, or call {business.phoneDisplay}.
                {' '}Our showroom team can confirm current pricing and availability for your project.
              </p>
            </details>
          </div>
        </div>
      </div>
    </section>
  )
}

function Field({ id, label, type = 'text', error, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-sand">
        {label}
      </label>
      <input
        id={id}
        type={type}
        {...props}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-xl border bg-charcoal-800 px-4 py-3 text-cream outline-none transition-colors placeholder:text-sand focus:border-gold ${error ? 'border-terracotta' : 'border-white/10'}`}
      />
      <p id={`${id}-error`} className="mt-1 min-h-8 text-xs leading-4 text-cream">{error || '\u00a0'}</p>
    </div>
  )
}
