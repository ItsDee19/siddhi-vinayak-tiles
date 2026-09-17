import { useEffect, useId, useRef, useState } from 'react'
import Icon from '../Icons'
import Logo from '../Logo'
import { business, navLinks } from '../../data/siteConfig'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const headerRef = useRef(null)
  const toggleRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    const onPointerDown = (event) => {
      if (!headerRef.current?.contains(event.target)) setOpen(false)
    }
    const desktop = window.matchMedia('(min-width: 1024px)')
    const onBreakpointChange = () => { if (desktop.matches) setOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    desktop.addEventListener('change', onBreakpointChange)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      desktop.removeEventListener('change', onBreakpointChange)
    }
  }, [open])

  return (
    <header
      ref={headerRef}
      onBlurCapture={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      className={`fixed inset-x-0 top-0 z-50 border-b py-3 transition-colors duration-150 ${
        scrolled || open ? 'border-sand/20 bg-charcoal/95 shadow-soft backdrop-blur-md' : 'border-transparent bg-charcoal/90'
      }`}
    >
      <nav aria-label="Main navigation" className="container-px flex items-center justify-between gap-4">
        <a href="#home" aria-label={`${business.name} — home`} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">
          <Logo variant="dark" />
        </a>

        <ul className="hidden items-center gap-4 lg:flex xl:gap-8">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="inline-flex min-h-11 items-center rounded-btn text-sm font-medium text-sand-light transition-colors hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <a href={`tel:${business.phoneTel}`} className="btn-gold hidden min-h-11 px-5 py-2.5 sm:inline-flex">
            <Icon name="phone" className="h-4 w-4" /> Call showroom
          </a>
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={open}
            aria-controls={menuId}
            className="grid h-11 w-11 cursor-pointer place-items-center rounded-btn border border-sand/40 text-cream transition-colors hover:border-gold hover:bg-white/10 active:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold lg:hidden"
          >
            <Icon name={open ? 'close' : 'menu'} className="h-5 w-5" />
          </button>
        </div>
      </nav>

      <div id={menuId} hidden={!open} className="max-h-[calc(100svh-4.5rem)] overflow-y-auto lg:hidden">
        <nav aria-label="Mobile navigation" className="container-px py-4">
          <ul className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-btn px-3 py-3 text-base font-medium text-sand-light hover:bg-white/10 hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-3 border-t border-sand/20 pt-4">
            <a href={`tel:${business.phoneTel}`} onClick={() => setOpen(false)} className="btn-gold min-h-11 flex-1">
              <Icon name="phone" className="h-4 w-4" /> Call
            </a>
            <a href={business.whatsapp} onClick={() => setOpen(false)} target="_blank" rel="noreferrer" className="btn-outline min-h-11 flex-1">
              <Icon name="whatsapp" className="h-4 w-4" /> WhatsApp
            </a>
          </div>
        </nav>
      </div>
    </header>
  )
}
