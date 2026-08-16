import { useEffect, useMemo, useRef, useState } from 'react'
import { composeRoom } from './composeRoom'

/**
 * 2D room compositor canvas.
 * Mobile: lite first for speed, then HQ upgrade.
 * Desktop: full quality first paint.
 */
export default function RoomCanvas({
  room,
  zoneTextures,
  tileScale = 1,
  groutEnabled = false,
  canvasRef: externalRef,
  className = '',
  displayMaxWidth = 1600,
  preferLiteFirst = false,
  maxHeight = 'none',
}) {
  const localRef = useRef(null)
  const canvasRef = externalRef || localRef
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState([])
  const [tier, setTier] = useState(preferLiteFirst ? 'lite' : 'full')
  const genRef = useRef(0)

  const textureKey = useMemo(() => {
    if (!zoneTextures) return ''
    return Object.keys(zoneTextures)
      .sort()
      .map((k) => `${k}:${zoneTextures[k]?.id || zoneTextures[k]?.url || ''}`)
      .join('|')
  }, [zoneTextures])

  // Prefer room-native aspect when known; fallback wide lifestyle ratio
  const aspectStyle = useMemo(() => {
    // Packs are ~1920×1072 (16:9-ish) or bathroom-01 ~16:9
    return { aspectRatio: '16 / 9' }
  }, [])

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas || !room) return undefined

    const gen = ++genRef.current
    setStatus('loading')
    setError('')
    setWarnings([])
    setTier(preferLiteFirst ? 'lite' : 'full')

    const run = async () => {
      const common = {
        tileScale,
        roomWidthMM: room.roomWidthMM || 3600,
        groutEnabled,
      }

      const paint = async (tierName, maxW) =>
        composeRoom(canvas, room, zoneTextures, {
          ...common,
          tier: tierName,
          maxWidth: maxW,
        })

      try {
        if (preferLiteFirst) {
          // Fast first frame on phones
          const lite = await paint('lite', Math.min(displayMaxWidth, 880))
          if (cancelled || gen !== genRef.current) return
          setWarnings(lite.errors || [])
          setStatus('ready')
          setTier('lite')

          const schedule =
            typeof window !== 'undefined' && window.requestIdleCallback
              ? (fn) => window.requestIdleCallback(fn, { timeout: 700 })
              : (fn) => setTimeout(fn, 100)

          schedule(async () => {
            if (cancelled || gen !== genRef.current) return
            try {
              const full = await paint('full', displayMaxWidth)
              if (cancelled || gen !== genRef.current) return
              setWarnings(full.errors || [])
              setTier('full')
            } catch {
              // keep lite
            }
          })
        } else {
          const full = await paint('full', displayMaxWidth)
          if (cancelled || gen !== genRef.current) return
          setWarnings(full.errors || [])
          setStatus('ready')
          setTier('full')
        }
      } catch (err) {
        if (cancelled || gen !== genRef.current) return
        try {
          const lite = await paint('lite', Math.min(displayMaxWidth, 880))
          if (cancelled || gen !== genRef.current) return
          setWarnings(lite.errors || [])
          setStatus('ready')
          setTier('lite')
        } catch (err2) {
          if (cancelled || gen !== genRef.current) return
          setStatus('error')
          setError(err2?.message || err?.message || 'Could not compose room')
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, textureKey, tileScale, groutEnabled, displayMaxWidth, canvasRef, preferLiteFirst])

  // Two nested boxes on purpose. The outer one is allowed to run the full width
  // of the screen; the inner one shrink-wraps the canvas, which keeps its 16:9
  // ratio while obeying maxHeight. Overlays hang off the inner box so the HQ
  // badge sits on the image corner rather than out at the viewport edge when
  // the height cap makes the canvas narrower than its container.
  return (
    <div className={`relative flex justify-center ${className}`}>
      <div className="relative max-w-full">
        <canvas
          ref={canvasRef}
          className="block max-w-full object-contain object-center"
          style={{ ...aspectStyle, maxHeight, width: 'auto' }}
        />

        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-charcoal/40 backdrop-blur-[1px] transition-opacity duration-200 ease-out ${
            status === 'loading' ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="inline-flex items-center gap-2 text-sm text-sand/80">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
            Composing room…
          </span>
        </div>

        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-charcoal/70 p-6 text-center">
            <p className="text-sm text-terracotta">{error}</p>
          </div>
        )}
        <div
          className={`pointer-events-none absolute right-2 top-2 rounded-full border border-white/10 bg-charcoal/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-sand/70 transition-opacity duration-200 ease-out ${
            status === 'ready' ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {tier === 'full' ? 'HQ' : 'Preview'}
        </div>
        {status === 'ready' && warnings.length > 0 && (
          <div className="absolute bottom-2 left-2 right-2 rounded-btn border border-gold/30 bg-charcoal/90 px-3 py-2 text-[11px] text-sand/90">
            {warnings.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
