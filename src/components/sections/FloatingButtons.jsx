import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '../Icons'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { business } from '../../data/siteConfig'
import { usePageVisible } from '../../hooks/usePageVisible'
import { MOTION_DURATION, MOTION_EASE } from '../../utils/motion'

// Leave the reading space and contact form unobstructed on every screen.
export default function FloatingButtons() {
  const [show, setShow] = useState(false)
  const reduce = useReducedMotion()
  const pageVisible = usePageVisible()

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const needsClearSpace = ['catalogue', 'contact', ...(window.innerWidth < 1024 ? ['products'] : [])].some(id => {
        const section = document.getElementById(id)?.getBoundingClientRect()
        return section && section.top < window.innerHeight && section.bottom > 0
      })
      setShow(window.scrollY > window.innerHeight * 0.6 && !needsClearSpace)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  const waHref = `${business.whatsapp}?text=${encodeURIComponent(
    business.whatsappMessage,
  )}`

  return (
    <AnimatePresence>
      {show && pageVisible && (
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : 8 }}
          transition={{ duration: reduce ? 0 : MOTION_DURATION.fast, ease: MOTION_EASE }}
          className="fixed bottom-5 right-5 z-40 flex flex-col gap-3"
          style={{ bottom: 'calc(1.25rem + var(--privacy-notice-height, 0px))' }}
        >
          {/* WhatsApp */}
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            aria-label="Chat on WhatsApp"
            className="group relative grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-soft transition-transform hover:scale-110"
          >
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
