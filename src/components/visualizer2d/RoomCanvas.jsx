import { useEffect, useMemo, useRef, useState } from 'react'
import { composeRoom } from './composeRoom'

/**
 * Displays the composited 2D room. Re-renders when room or zone textures change.
 */
export default function RoomCanvas({
  room,
  zoneTextures,
  tileScale = 1,
  canvasRef: externalRef,
  className = '',
  onComposeInfo,
}) {
  const localRef = useRef(null)
  const canvasRef = externalRef || localRef
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState([])

  // Stable key so floor/wall product swaps always re-compose (object identity alone is fine,
  // but id-string is explicit and avoids subtle stale-closure bugs).
  const textureKey = useMemo(() => {
    if (!zoneTextures) return ''
    return Object.keys(zoneTextures)
      .sort()
      .map((k) => {
        const p = zoneTextures[k]
        return `${k}:${p?.id || p?.url || ''}`
      })
      .join('|')
  }, [zoneTextures])

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas || !room) return undefined

    setStatus('loading')
    setError('')
    setWarnings([])

    composeRoom(canvas, room, zoneTextures, {
      tileScale,
      maxWidth: 2800,
      roomWidthMM: room.roomWidthMM || 3600,
    })
      .then((result) => {
        if (cancelled) return
        const errs = result?.errors || []
        setWarnings(errs)
        if (typeof onComposeInfo === 'function') onComposeInfo(result)
        // Still "ready" if base+overlay painted; zone failures show as warnings.
        setStatus(errs.length && errs.length === (room.zones?.length || 0) ? 'error' : 'ready')
        if (errs.length === (room.zones?.length || 0)) {
          setError(errs.join(' · '))
        }
      })
      .catch((err) => {
        if (cancelled) return
        setStatus('error')
        setError(err?.message || 'Could not compose room')
      })

    return () => {
      cancelled = true
    }
    // textureKey captures zoneTextures content; room / tileScale explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, textureKey, tileScale, canvasRef])

  return (
    <div className={`relative overflow-hidden rounded-card bg-charcoal-800 ${className}`}>
      <canvas
        ref={canvasRef}
        className="block h-auto w-full"
        style={{ aspectRatio: '3344 / 1882' }}
      />
      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-charcoal/40">
          <span className="text-sm text-sand/80">Composing room at high quality…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-charcoal/70 p-6 text-center">
          <p className="text-sm text-terracotta">{error}</p>
        </div>
      )}
      {status === 'ready' && warnings.length > 0 && (
        <div className="absolute bottom-2 left-2 right-2 rounded-btn border border-gold/30 bg-charcoal/90 px-3 py-2 text-[11px] text-sand/90">
          {warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      )}
    </div>
  )
}
