import Icon from '../Icons'
import Logo from '../Logo'
import { business, navLinks } from '../../data/siteConfig'

export default function Footer() {
  const socials = business.socials.filter((social) => /^https?:\/\//.test(social.href || ''))
  return (
    <footer className="relative border-t border-white/5 bg-charcoal grain-overlay">
      <div className="container-px py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr]">
          {/* brand */}
          <div>
            <div className="flex items-center gap-3">
              <Logo variant="dark" />
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-sand">
              {business.intro}
            </p>
            <p className="mt-5 font-display text-lg italic text-gold-light">
              “{business.tagline}”
            </p>
          </div>

          {/* links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-light">
              Explore
            </h4>
            <ul className="mt-5 space-y-3">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-sm text-sand transition-colors hover:text-gold-light"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li><a href="/privacy-policy/" className="inline-flex min-h-11 items-center text-sm text-sand underline-offset-4 hover:text-gold-light hover:underline">Privacy & cookies</a></li>
              <li><a href="/terms-and-conditions/" className="inline-flex min-h-11 items-center text-sm text-sand underline-offset-4 hover:text-gold-light hover:underline">Terms & conditions</a></li>
            </ul>
          </div>

          {/* contact */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-light">
              Visit / Contact
            </h4>
            <ul className="mt-5 space-y-4 text-sm text-sand">
              <li className="flex items-start gap-3">
                <Icon name="mapPin" className="mt-0.5 h-4 w-4 shrink-0 text-gold-light" />
                <span>{business.address.full}</span>
              </li>
              <li className="flex items-center gap-3">
                <Icon name="phone" className="h-4 w-4 shrink-0 text-gold-light" />
                <a
                  href={`tel:${business.phoneTel}`}
                  className="transition-colors hover:text-gold-light"
                >
                  {business.phoneDisplay}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Icon name="clock" className="h-4 w-4 shrink-0 text-gold-light" />
                <span>
                  {business.hours.label} · {business.hours.time}
                </span>
              </li>
            </ul>

            {/* socials */}
            {socials.length > 0 && (
              <div className="mt-6 flex gap-3">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-sand transition-colors hover:border-gold hover:text-gold-light"
                  >
                    <Icon name={s.icon} className="h-5 w-5" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-7 text-xs text-sand sm:flex-row">
          <p>
            © {new Date().getFullYear()} {business.name}. All rights reserved.
          </p>
          <p>
            {business.address.city}, {business.address.state} · Made with care
            for our customers.
          </p>
        </div>
      </div>
    </footer>
  )
}
