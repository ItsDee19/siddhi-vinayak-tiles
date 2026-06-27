import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '../Icons'
import { business, navLinks } from '../../data/siteConfig'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'border-b border-white/5 bg-charcoal/85 backdrop-blur-md py-3 shadow-soft'
          : 'bg-transparent py-5'
      }`}
    >
      <nav className="container-px flex items-center justify-between">
        {/* Brand */}
        <a href="#home" className="group flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-gold/15 ring-1 ring-gold/30 transition-colors group-hover:bg-gold/25">
            <Icon name="tiles" className="h-5 w-5 text-gold" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg font-semibold text-cream">
              {business.shortName}
            </span>
            <span className="block text-[10px] uppercase tracking-[0.3em] text-gold">
              Tiles & Stone
            </span>
          </span>
        </a>

        {/* Desktop links */}
        <ul className="hidden items-center gap-8 lg:flex">
          {navLinks.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="link-underline text-sm font-medium text-sand hover:text-cream"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Call now + mobile toggle */}
        <div className="flex items-center gap-3">
          <a
            href={`tel:${business.phoneTel}`}
            className="btn-gold hidden px-5 py-2.5 sm:inline-flex"
          >
            <Icon name="phone" className="h-4 w-4" />
            Call Now
          </a>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="grid h-10 w-10 place-items-center rounded-lg text-cream ring-1 ring-white/10 lg:hidden"
          >
            <Icon name={open ? 'close' : 'menu'} className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden lg:hidden"
          >
            <ul className="container-px flex flex-col gap-1 py-4">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-3 text-base font-medium text-sand hover:bg-white/5 hover:text-cream"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li className="mt-2 flex gap-3 px-3">
                <a href={`tel:${business.phoneTel}`} className="btn-gold flex-1">
                  <Icon name="phone" className="h-4 w-4" /> Call
                </a>
                <a
                  href={business.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline flex-1"
                >
                  <Icon name="whatsapp" className="h-4 w-4" /> WhatsApp
                </a>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
