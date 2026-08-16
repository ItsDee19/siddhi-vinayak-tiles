import Icon from '../Icons'
import Logo from '../Logo'
import { business, navLinks } from '../../data/siteConfig'

export default function Footer() {
  return (
    <footer className="relative border-t border-white/5 bg-charcoal grain-overlay">
      <div className="container-px py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr]">
          {/* brand */}
          <div>
            <div className="flex items-center gap-3">
              <Logo variant="dark" />
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-sand/75">
              {business.intro}
            </p>
            <p className="mt-5 font-display text-lg italic text-gold-light">
              “{business.tagline}”
            </p>
          </div>

          {/* links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
              Explore
            </h4>
            <ul className="mt-5 space-y-3">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-sm text-sand/75 transition-colors hover:text-gold"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* contact */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
              Visit / Contact
            </h4>
            <ul className="mt-5 space-y-4 text-sm text-sand/75">
              <li className="flex items-start gap-3">
                <Icon name="mapPin" className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>{business.address.full}</span>
              </li>
              <li className="flex items-center gap-3">
                <Icon name="phone" className="h-4 w-4 shrink-0 text-gold" />
                <a
                  href={`tel:${business.phoneTel}`}
                  className="transition-colors hover:text-gold"
                >
                  {business.phoneDisplay}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Icon name="clock" className="h-4 w-4 shrink-0 text-gold" />
                <span>
                  {business.hours.label} · {business.hours.time}
                </span>
              </li>
            </ul>

            {/* Social links are on hold at the client's request — this sits in
                their place rather than leaving the column short. */}
            <p className="mt-6 text-sm font-semibold tracking-wide text-gold">
              Made by Avlys AI
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-7 text-xs text-sand/50 sm:flex-row">
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
