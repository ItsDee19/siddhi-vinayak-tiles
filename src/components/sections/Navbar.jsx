import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '../Icons'
import Logo from '../Logo'
import { business, navLinks } from '../../data/siteConfig'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { MOTION_DURATION, MOTION_EASE } from '../../utils/motion'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('home')
  const headerRef = useRef(null)
  const toggleRef = useRef(null)
  const menuRef = useRef(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      setScrolled(window.scrollY > 24)
      const current = navLinks.map(link => document.getElementById(link.href.slice(1)))
        .filter(Boolean).filter(section => section.getBoundingClientRect().top <= 160).at(-1)
      if (current) setActive(current.id)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [])

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector('a')?.focus({ preventScroll: true })
    const closeOnEscape = event => {
      if (event.key !== 'Escape') return
      setOpen(false)
      toggleRef.current?.focus({ preventScroll: true })
    }
    const closeOutside = event => { if (!headerRef.current?.contains(event.target)) setOpen(false) }
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = event => { if (event.matches) setOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOutside)
    desktop.addEventListener('change', closeOnDesktop)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOutside)
      desktop.removeEventListener('change', closeOnDesktop)
    }
  }, [open])

  return (
    <header
      ref={headerRef}
      onBlurCapture={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      className={`fixed inset-x-0 top-0 z-50 h-20 border-b transition-[background-color,border-color] duration-200 ${
        scrolled || open
          ? 'border-white/10 bg-charcoal/95'
          : 'border-transparent bg-transparent'
      }`}
    >
      <nav aria-label="Main navigation" className="container-px flex h-full items-center justify-between">
        {/* Brand — PRD §1 L4: full on desktop, icon-only on mobile, shrinks on scroll */}
        <a href="#home" className="group flex items-center">
          <span className="lg:hidden">
            <Logo
              compact
              variant="dark"
              className={`transition-transform duration-300 ${scrolled ? 'scale-90' : 'scale-100'}`}
            />
          </span>
          <span className="hidden lg:block">
            <Logo
              variant="dark"
              className={`transition-transform duration-300 ${scrolled ? 'scale-90' : 'scale-100'}`}
            />
          </span>
        </a>

        {/* Desktop links */}
        <ul className="hidden items-center gap-8 lg:flex">
          {navLinks.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                aria-current={active === l.href.slice(1) ? 'location' : undefined}
                className={`link-underline py-3 text-sm font-medium hover:text-cream ${active === l.href.slice(1) ? 'text-cream after:scale-x-100' : 'text-sand'}`}
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
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            className="grid h-11 w-11 place-items-center rounded-lg text-cream ring-1 ring-white/15 transition-colors hover:bg-white/10 lg:hidden"
          >
            <Icon name={open ? 'close' : 'menu'} className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-navigation"
            ref={menuRef}
            initial={{ opacity: 0, y: reduce ? 0 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : -4 }}
            transition={{ duration: reduce ? 0 : MOTION_DURATION.fast, ease: MOTION_EASE }}
            className="absolute inset-x-0 top-full max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain border-b border-gold/20 bg-charcoal shadow-soft lg:hidden"
          >
            <ul className="container-px flex flex-col gap-1 py-4">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    aria-current={active === l.href.slice(1) ? 'location' : undefined}
                    className="block rounded-lg px-3 py-3 text-base font-medium text-sand transition-colors hover:bg-white/5 hover:text-cream aria-[current=location]:bg-gold/10 aria-[current=location]:text-cream"
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
    </header>
  )
}
