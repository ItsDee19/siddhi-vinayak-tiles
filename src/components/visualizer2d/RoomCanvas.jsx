import { useEffect, useMemo, useRef, useState } from 'react'
import { composeRoom } from './composeRoom'

/**
 * Progressive 2D room compositor:
 * 1) lite (mobile @1024) for fast feedback
 * 2) full (desktop @2048) upgrade when idle / after lite paints
 */
export default function RoomCanvas({
  room,
  zoneTextures,
  tileScale = 1,
  canvasRef: externalRef,
  className = '',
  displayMaxWidth = 1800,
}) {
  const localRef = useRef(null)
  const canvasRef = externalRef || localRef
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState([])
  const [tier, setTier] = useState('lite')
  const genRef = useRef(0)

  const textureKey = useMemo(() => {
    if (!zoneTextures) return ''
    return Object.keys(zoneTextures)
      .sort()
      .map((k) => `${k}:${zoneTextures[k]?.id || zoneTextures[k]?.url || ''}`)
      .join('|')
  }, [zoneTextures])

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas || !room) return undefined

    const gen = ++genRef.current
    setStatus('loading')
    setError('')
    setWarnings([])
    setTier('lite')

    const run = async () => {
      // Pass 1 — fast lite textures
      try {
        const lite = await composeRoom(canvas, room, zoneTextures, {
          tileScale,
          maxWidth: Math.min(displayMaxWidth, 1400),
          tier: 'lite',
          roomWidthMM: room.roomWidthMM || 3600,
        })
        if (cancelled || gen !== genRef.current) return
        setWarnings(lite.errors || [])
        setStatus('ready')
        setTier('lite')
      } catch (err) {
        if (cancelled || gen !== genRef.current) return
        setStatus('error')
        setError(err?.message || 'Could not compose room')
        return
      }

      // Pass 2 — full quality when browser is idle
      const schedule =
        typeof window !== 'undefined' && window.requestIdleCallback
          ? (fn) => window.requestIdleCallback(fn, { timeout: 600 })
          : (fn) => setTimeout(fn, 80)

      schedule(async () => {
        if (cancelled || gen !== genRef.current) return
        try {
          const full = await composeRoom(canvas, room, zoneTextures, {
            tileScale,
            maxWidth: displayMaxWidth,
            tier: 'full',
            roomWidthMM: room.roomWidthMM || 3600,
          })
          if (cancelled || gen !== genRef.current) return
          setWarnings(full.errors || [])
          setTier('full')
        } catch {
          // Keep lite frame if full upgrade fails.
        }
      })
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, textureKey, tileScale, displayMaxWidth, canvasRef])

  return (
    <div className={`relative overflow-hidden rounded-card bg-charcoal-800 ${className}`}>
      <canvas
        ref={canvasRef}
        className="block h-auto w-full"
        style={{ aspectRatio: '3344 / 1882' }}
      />
      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-charcoal/40">
          <span className="text-sm text-sand/80">Composing room…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-charcoal/70 p-6 text-center">
          <p className="text-sm text-terracotta">{error}</p>
        </div>
      )}
      {status === 'ready' && (
        <div className="pointer-events-none absolute right-2 top-2 rounded-full border border-white/10 bg-charcoal/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-sand/70">
          {tier === 'full' ? 'HQ' : 'Preview'}
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
