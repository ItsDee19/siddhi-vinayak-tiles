import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '../Icons'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { business } from '../../data/siteConfig'

// Floating Call + WhatsApp buttons with a pulse ring. Appear after the hero.
// Pulse ring is suppressed under prefers-reduced-motion (NF5).
export default function FloatingButtons() {
  const [show, setShow] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.6)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const waHref = `${business.whatsapp}?text=${encodeURIComponent(
    business.whatsappMessage,
  )}`

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          className="fixed bottom-5 right-5 z-40 flex flex-col gap-3"
        >
          {/* WhatsApp */}
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            aria-label="Chat on WhatsApp"
            className="group relative grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-soft transition-transform hover:scale-110"
          >
            {!reduce && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-[#25D366]" />}
            <Icon name="whatsapp" className="relative h-7 w-7" filled />
            <span className="pointer-events-none absolute right-16 whitespace-nowrap rounded-lg bg-charcoal px-3 py-1.5 text-xs text-cream opacity-0 shadow-soft transition-opacity group-hover:opacity-100">
              Chat with us
            </span>
          </a>

          {/* Call */}
          <a
            href={`tel:${business.phoneTel}`}
            aria-label="Call now"
            className="group relative grid h-14 w-14 place-items-center rounded-full bg-gold text-charcoal shadow-soft transition-transform hover:scale-110"
          >
            {!reduce && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-gold" />}
            <Icon name="phone" className="relative h-6 w-6" />
            <span className="pointer-events-none absolute right-16 whitespace-nowrap rounded-lg bg-charcoal px-3 py-1.5 text-xs text-cream opacity-0 shadow-soft transition-opacity group-hover:opacity-100">
              {business.phoneDisplay}
            </span>
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
