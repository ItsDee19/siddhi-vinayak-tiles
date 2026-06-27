import { useState } from 'react'
import Icon from '../Icons'
import Reveal from '../ui/Reveal'
import SectionHeading from '../ui/SectionHeading'
import { business } from '../../data/siteConfig'
import { categories } from '../../data/products'

export default function Contact() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    interest: '',
    message: '',
  })
  const [sent, setSent] = useState(false)

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  // No backend: compose a pre-filled WhatsApp message so enquiries reach the
  // shop instantly. Swap for a real form handler / email service later.
  const handleSubmit = (e) => {
    e.preventDefault()
    const text = [
      `New enquiry for ${business.name}`,
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      `Interested in: ${form.interest || 'Not specified'}`,
      `Message: ${form.message || '-'}`,
    ].join('\n')
    window.open(
      `${business.whatsapp}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener',
    )
    setSent(true)
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
                <iframe
                  title="Siddhi Vinayak Tiles location"
                  src={business.mapEmbedSrc}
                  className="h-full min-h-[260px] w-full"
                  style={{ border: 0, filter: 'grayscale(0.3) contrast(1.05)' }}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  allowFullScreen
                />
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
              <h3 className="font-display text-2xl text-cream">Send an Enquiry</h3>
              <p className="mt-2 text-sm text-sand/70">
                Fill this in and we’ll get back to you on WhatsApp.
              </p>

              {sent ? (
                <div className="mt-8 rounded-2xl border border-gold/30 bg-gold/10 p-6 text-center">
                  <Icon
                    name="whatsapp"
                    className="mx-auto h-10 w-10 text-gold"
                  />
                  <p className="mt-3 font-display text-lg text-cream">
                    Thank you, {form.name || 'friend'}!
                  </p>
                  <p className="mt-1 text-sm text-sand/80">
                    Your WhatsApp should have opened with your enquiry. If not,
                    just call us at {business.phoneDisplay}.
                  </p>
                  <button
                    onClick={() => setSent(false)}
                    className="btn-outline mt-5 px-5 py-2.5 text-xs"
                  >
                    Send another
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                  <Field
                    label="Your Name"
                    value={form.name}
                    onChange={update('name')}
                    placeholder="e.g. Rahul Sahu"
                    required
                  />
                  <Field
                    label="Phone Number"
                    value={form.phone}
                    onChange={update('phone')}
                    type="tel"
                    placeholder="10-digit mobile"
                    required
                  />
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-sand/70">
                      Interested In
                    </label>
                    <select
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
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-sand/70">
                      Message
                    </label>
                    <textarea
                      value={form.message}
                      onChange={update('message')}
                      rows={4}
                      placeholder="Tell us about your project, sizes, budget…"
                      className="w-full resize-none rounded-xl border border-white/10 bg-charcoal-800 px-4 py-3 text-cream outline-none transition-colors placeholder:text-sand/40 focus:border-gold"
                    />
                  </div>
                  <button type="submit" className="btn-gold w-full">
                    <Icon name="send" className="h-4 w-4" />
                    Send via WhatsApp
                  </button>
                  <p className="text-center text-xs text-sand/50">
                    No spam — your details are only used to reply to your enquiry.
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

function Field({ label, type = 'text', ...props }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-sand/70">
        {label}
      </label>
      <input
        type={type}
        {...props}
        className="w-full rounded-xl border border-white/10 bg-charcoal-800 px-4 py-3 text-cream outline-none transition-colors placeholder:text-sand/40 focus:border-gold"
      />
    </div>
  )
}
