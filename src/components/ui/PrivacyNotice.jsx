import { useEffect, useRef, useState } from 'react'

const acknowledgementKey = 'sbt-privacy-notice-v1'

export default function PrivacyNotice() {
  const [visible, setVisible] = useState(false)
  const noticeRef = useRef(null)

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(acknowledgementKey) !== 'dismissed')
    } catch {
      setVisible(true)
    }
  }, [])

  useEffect(() => {
    if (!visible || !noticeRef.current) return
    const notice = noticeRef.current
    const measure = () => {
      document.documentElement.style.setProperty('--privacy-notice-height', `${Math.ceil(notice.getBoundingClientRect().height)}px`)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(notice)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      document.documentElement.style.removeProperty('--privacy-notice-height')
    }
  }, [visible])

  function dismiss() {
    // This preference is optional to store: browsing still works when storage
    // is blocked. It is an acknowledgement, not consent to tracking.
    try { localStorage.setItem(acknowledgementKey, 'dismissed') } catch { /* unavailable */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside ref={noticeRef} aria-label="Privacy notice" className="fixed inset-x-0 bottom-0 z-[60] border-t border-sand/30 bg-charcoal px-5 py-3 shadow-soft sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 gap-y-2">
        <p className="max-w-3xl text-xs leading-relaxed text-sand sm:text-sm">
          We use no advertising or analytics cookies. We only remember when you dismiss this notice.
          {' '}<a href="/privacy-policy/" className="text-cream underline underline-offset-4 hover:text-gold-light">Privacy & cookies</a>
        </p>
        <button type="button" onClick={dismiss} className="min-h-11 rounded-btn border border-sand/40 px-4 text-sm font-semibold text-cream transition-colors hover:bg-white/5">
          Dismiss notice
        </button>
      </div>
    </aside>
  )
}
