import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function ReaderDialog({ children, onClose, titleId }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const previousFocus = document.activeElement
    const oldOverflow = document.body.style.overflow
    const oldRootOverflow = document.documentElement.style.overflow
    const dialog = dialogRef.current
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    dialog.querySelector('[data-close-reader]')?.focus()
    return () => {
      dialog.close()
      document.body.style.overflow = oldOverflow
      document.documentElement.style.overflow = oldRootOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <dialog ref={dialogRef} className="reader-dialog" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onClose() }}>
      {children}
    </dialog>, document.body,
  )
}
