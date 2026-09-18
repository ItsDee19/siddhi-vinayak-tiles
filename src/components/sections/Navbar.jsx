import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import Icon from '../Icons'
import Logo from '../Logo'
import { business, navLinks } from '../../data/siteConfig'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const headerRef = useRef(null)
  const menuButtonRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeAtDesktop = () => { if (desktop.matches) setOpen(false) }
    desktop.addEventListener('change', closeAtDesktop)
    return () => desktop.removeEventListener('change', closeAtDesktop)
  }, [])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event) => {
      if (!headerRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      menuButtonRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <motion.header
      ref={headerRef}
      initial={reduceMotion ? false : { y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={`site-navigation${scrolled ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}
    >
      <nav className="site-navigation__bar" aria-label="Primary navigation">
        <a href="#home" className="site-navigation__brand" onClick={() => setOpen(false)} aria-label="Sidhhi Binayak Tiles home">
          <Logo variant="dark" />
        </a>

        {/* Desktop links */}
        <ul className="site-navigation__links">
          {navLinks.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="site-navigation__link"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Call now + mobile toggle */}
        <div className="site-navigation__actions">
          <a
            href={`tel:${business.phoneTel}`}
            className="btn-gold site-navigation__call"
          >
            <Icon name="phone" className="h-4 w-4" />
            Call now
          </a>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={open}
            aria-controls="site-mobile-navigation"
            className="site-navigation__toggle"
          >
            <Icon name={open ? 'close' : 'menu'} className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.nav
            id="site-mobile-navigation"
            aria-label="Mobile navigation"
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="site-navigation__menu"
          >
            <ul className="site-navigation__mobile-links">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="site-navigation__link"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li className="site-navigation__mobile-actions">
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
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
