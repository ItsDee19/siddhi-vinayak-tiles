import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import Icon from '../Icons'
import SwatchThumb from '../ui/SwatchThumb'
import { business } from '../../data/siteConfig'
import { canPreviewProduct } from '../../utils/visualizerPreview'
import { MOTION_DURATION, MOTION_EASE } from '../../utils/motion'
import { PRODUCT_DETAIL_IMAGE_SIZES } from '../../utils/responsiveImages'

function asSwatch(p) {
  return {
    id: p.id,
    name: p.name,
    type: p.category.toLowerCase(),
    color: p.color,
    accent: p.accent || p.color,
    image: p.imageUrl,
  }
}

export default function ProductLightbox({ product, onClose, onViewIn3D }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const afterCloseRef = useRef(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const dialog = dialogRef.current
    const trigger = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    closeRef.current?.focus({ preventScroll: true })

    // AnimatePresence retains the native modal until its exit finishes. The
    // background stays inert and scroll-locked for the whole transition.
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (afterCloseRef.current) {
        afterCloseRef.current()
      } else if (trigger?.isConnected) {
        trigger.focus({ preventScroll: true })
      }
    }
  }, [])

  const waText = encodeURIComponent(
    `Hi! I'd like to know more about "${product.name}" (${product.size}, ${product.finish}). Is it available?`
  )
  const waHref = `${business.whatsapp}?text=${waText}`

  return createPortal(
    <motion.dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : MOTION_DURATION.fast, ease: MOTION_EASE }}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const dialog = event.currentTarget
        const controls = Array.from(dialog.querySelectorAll('a[href], button:not([disabled]), [tabindex]'))
          .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') &&
            element.getClientRects().length > 0 && window.getComputedStyle(element).visibility !== 'hidden')
        const first = controls[0]
        const last = controls.at(-1)
        if (!first) {
          event.preventDefault()
          return
        }
        // Some browsers hand focus to their chrome at the modal's Tab edges.
        // Keep that cycle within the visible product actions instead.
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault()
          last.focus({ preventScroll: true })
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
          event.preventDefault()
          first.focus({ preventScroll: true })
        }
      }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none items-center justify-center overflow-hidden border-0 bg-charcoal/90 p-4 text-cream open:flex backdrop:bg-transparent"
    >
      <motion.div
        initial={{ y: reduceMotion ? 0 : 12 }}
        animate={{ y: 0 }}
        exit={{ y: reduceMotion ? 0 : 8 }}
        transition={{ duration: reduceMotion ? 0 : MOTION_DURATION.base, ease: MOTION_EASE }}
        className="max-h-full w-full max-w-3xl overflow-y-auto overscroll-contain rounded-card bg-charcoal-800 text-left shadow-card"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-charcoal-800 px-5 py-3 sm:px-6">
          <h3 id={titleId} className="font-display text-xl text-cream sm:text-2xl">{product.name}</h3>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close product details"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-cream transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <SwatchThumb swatch={asSwatch(product)} className="aspect-video w-full" eager size={640} sizes={PRODUCT_DETAIL_IMAGE_SIZES} />
        <div className="p-6">
          <span className="text-xs uppercase tracking-wider text-gold-light">
            {product.category} · {product.subCategory}
          </span>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-sand">Size</dt>
              <dd className="mt-1 text-cream">{product.size}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-sand">Finish</dt>
              <dd className="mt-1 text-cream">{product.finish}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-sand">Surface</dt>
              <dd className="mt-1 text-cream">{product.surface}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-sand">Price</dt>
              <dd className="mt-1 text-cream">{product.priceRange}</dd>
            </div>
          </dl>
          {product.tags?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {product.tags.map((t) => (
                <span key={t} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-sand">
                  #{t}
                </span>
              ))}
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={waHref} target="_blank" rel="noreferrer" className="btn-gold">
              <Icon name="whatsapp" className="h-4 w-4" filled /> Ask for this product
            </a>
            {canPreviewProduct(product) && (
              <button
                type="button"
                onClick={() => {
                  afterCloseRef.current = () => onViewIn3D(product)
                  onClose()
                }}
                className="btn-outline"
              >
                <Icon name="compass" className="h-4 w-4" /> View in 3D
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.dialog>,
    document.body,
  )
}
