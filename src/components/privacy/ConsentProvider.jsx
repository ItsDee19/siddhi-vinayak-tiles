import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CONSENT_KEY, readConsent, saveConsent } from '../../utils/consent'
import '../../styles/privacy.css'

const PREFERENCES_EVENT = 'sidhhi:cookie-preferences'
const ConsentContext = createContext(null)

function localPreferences() {
  try { return readConsent(window.localStorage) } catch { return null }
}

export function openCookiePreferences() {
  window.dispatchEvent(new Event(PREFERENCES_EVENT))
}

export function useConsent() {
  const context = useContext(ConsentContext)
  if (!context) throw new Error('useConsent must be used inside ConsentProvider')
  return context
}

export default function ConsentProvider({ children }) {
  const [preference, setPreference] = useState(localPreferences)
  const [isOpen, setOpen] = useState(() => !localPreferences() || window.location.hash === '#privacy-settings')
  const [storageError, setStorageError] = useState('')
  const [notice, setNotice] = useState('')
  const returnFocus = useRef(null)
  const banner = useRef(null)
  const focusOnOpen = useRef(window.location.hash === '#privacy-settings')
  const storageUnavailable = useRef(false)

  const openPreferences = useCallback(() => {
    returnFocus.current = document.activeElement
    focusOnOpen.current = true
    setStorageError('')
    setOpen(true)
    // Opening an already visible banner should still move keyboard focus there.
    banner.current?.querySelector('button')?.focus({ preventScroll: false })
  }, [])

  useEffect(() => {
    if (isOpen && focusOnOpen.current) {
      banner.current?.querySelector('button')?.focus({ preventScroll: false })
      focusOnOpen.current = false
    }
  }, [isOpen])

  const closePreferences = useCallback(() => {
    setOpen(false)
    if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true })
    returnFocus.current = null
  }, [])

  const choose = useCallback((maps) => {
    let saved = null
    try { saved = saveConsent(window.localStorage, maps) } catch { /* fail closed */ }
    storageUnavailable.current = !saved
    if (!saved) {
      // Never restore an older opt-in in this visit after a failed revocation.
      try { window.localStorage.removeItem(CONSENT_KEY) } catch { /* storage is restricted */ }
    }
    setPreference(saved)
    if (!saved && maps) {
      setStorageError('Your browser could not save this choice. The embedded map stays off. You can still use the Open in Maps link.')
      setOpen(true)
      return false
    }
    setNotice(saved
      ? (maps ? 'Preference saved. Google Maps is allowed.' : 'Preference saved. Google Maps is off.')
      : 'Google Maps is off for this visit. Your browser could not remember this choice.')
    setStorageError('')
    closePreferences()
    return true
  }, [closePreferences])

  useEffect(() => {
    const refresh = () => {
      if (storageUnavailable.current) return
      const current = localPreferences()
      setPreference(current)
      if (!current) setOpen(true)
    }
    const onStorage = (event) => {
      if (event.key === CONSENT_KEY || event.key === null) refresh()
    }
    const onHash = () => {
      if (window.location.hash === '#privacy-settings') openPreferences()
    }
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener(PREFERENCES_EVENT, openPreferences)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', refresh)
    window.addEventListener('hashchange', onHash)
    document.addEventListener('visibilitychange', onVisible)
    // Expiry also applies while a page is left open for a long time.
    const timer = window.setInterval(refresh, 60 * 60 * 1000)
    return () => {
      window.removeEventListener(PREFERENCES_EVENT, openPreferences)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('hashchange', onHash)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [openPreferences])

  useEffect(() => {
    if (!preference) return undefined
    const timer = window.setTimeout(() => {
      const current = localPreferences()
      setPreference(current)
      if (!current) setOpen(true)
    }, Math.min(preference.expiresAt - Date.now(), 2_147_483_647))
    return () => window.clearTimeout(timer)
  }, [preference])

  const value = useMemo(() => ({
    mapsAllowed: preference?.maps === true,
    openPreferences,
    allowMaps: () => choose(true),
  }), [preference, openPreferences, choose])

  return (
    <ConsentContext.Provider value={value}>
      {children}
      <div className="sr-only" role="status">{notice}</div>
      {isOpen && (
        <section ref={banner} className="cookie-preferences" aria-labelledby="cookie-preferences-title" aria-describedby="cookie-preferences-description">
          <div className="cookie-preferences__heading">
            <h2 id="cookie-preferences-title">Cookie preferences</h2>
            {preference && <button type="button" className="cookie-preferences__close" onClick={closePreferences} aria-label="Close cookie preferences">×</button>}
          </div>
          <p id="cookie-preferences-description">
            We remember your choice in this browser. Optional Google Maps can use cookies and receive your device information. You can browse all products with the map off.
          </p>
          <p className="cookie-preferences__details"><a href="/privacy-policy">Privacy policy</a> · Change your choice anytime in the footer.</p>
          {preference && <p className="cookie-preferences__details">Current choice: {preference.maps ? 'Google Maps allowed' : 'Essential only'}</p>}
          {storageError && <p className="privacy-error" role="alert">{storageError}</p>}
          <div className="cookie-preferences__actions">
            <button type="button" onClick={() => choose(false)}>Essential only</button>
            <button type="button" onClick={() => choose(true)}>Allow Google Maps</button>
          </div>
        </section>
      )}
    </ConsentContext.Provider>
  )
}
