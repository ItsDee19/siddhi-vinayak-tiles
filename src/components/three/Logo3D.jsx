import { useRef, useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'

// ─── CSS-based 3D Logo with animations ──────────────────────────────
// Uses CSS 3D transforms + framer-motion for a premium, performant
// 3D logo that doesn't require a separate WebGL context.

function useMouseParallax() {
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const springX = useSpring(rotateX, { stiffness: 100, damping: 20 })
  const springY = useSpring(rotateY, { stiffness: 100, damping: 20 })

  useEffect(() => {
    const handleMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      rotateY.set(x * 8)
      rotateX.set(-y * 5)
    }
    window.addEventListener('mousemove', handleMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMove)
  }, [rotateX, rotateY])

  return { rotateX: springX, rotateY: springY }
}

export default function Logo3D() {
  const reduce = useReducedMotion()
  const { rotateX, rotateY } = useMouseParallax()
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="flex flex-col items-center gap-8 sm:flex-row sm:gap-10 lg:gap-14"
      style={{ perspective: '1200px' }}
    >
      {/* ─── Animated Disc with Emblem ──────────────────────────────── */}
      <motion.div
        className="relative shrink-0"
        style={reduce ? {} : { rotateX, rotateY, transformStyle: 'preserve-3d' }}
        initial={{ scale: 0, rotateZ: -30, opacity: 0 }}
        animate={{ scale: 1, rotateZ: 0, opacity: 1 }}
        transition={{
          type: 'spring',
          stiffness: 80,
          damping: 15,
          delay: 0.2,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Glow ring */}
        <motion.div
          className="absolute -inset-3 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(245,166,35,0.25) 0%, transparent 70%)',
            filter: 'blur(12px)',
          }}
          animate={reduce ? {} : {
            scale: [1, 1.08, 1],
            opacity: [0.6, 0.9, 0.6],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Outer ring shimmer */}
        <div
          className="absolute -inset-1 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, transparent, rgba(217,177,86,0.3), transparent, rgba(217,177,86,0.15), transparent)',
            animation: reduce ? 'none' : 'spin-slow 8s linear infinite',
          }}
        />

        {/* Main disc using the exact provided image */}
        <motion.div
          className="relative flex items-center justify-center rounded-full overflow-hidden"
          style={{
            width: 'clamp(140px, 22vw, 220px)',
            height: 'clamp(140px, 22vw, 220px)',
            boxShadow: `
              0 0 0 2px rgba(245,166,35,0.2),
              0 8px 32px -8px rgba(194,54,22,0.5),
              0 20px 60px -20px rgba(240,140,24,0.4),
              inset 0 -4px 12px rgba(0,0,0,0.15),
              inset 0 4px 12px rgba(255,255,255,0.1)
            `,
            transformStyle: 'preserve-3d',
            transform: 'translateZ(20px)',
          }}
          animate={reduce ? {} : {
            boxShadow: hovered
              ? [
                  '0 0 0 2px rgba(245,166,35,0.3), 0 8px 32px -8px rgba(194,54,22,0.6), 0 20px 80px -20px rgba(240,140,24,0.5), inset 0 -4px 12px rgba(0,0,0,0.15), inset 0 4px 12px rgba(255,255,255,0.1)',
                ]
              : [
                  '0 0 0 2px rgba(245,166,35,0.2), 0 8px 32px -8px rgba(194,54,22,0.5), 0 20px 60px -20px rgba(240,140,24,0.4), inset 0 -4px 12px rgba(0,0,0,0.15), inset 0 4px 12px rgba(255,255,255,0.1)',
                ],
          }}
        >
          <motion.img
            src="/logo-emblem.png"
            alt="Sidhhi Binayak Emblem"
            className="w-full h-full object-cover rounded-full"
            style={{
              transform: 'translateZ(10px) scale(1.02)',
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.02 }}
            transition={{ delay: 0.4, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          />

          {/* Surface highlight */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.08) 100%)',
              transform: 'translateZ(12px)',
            }}
          />
        </motion.div>

        {/* Floating particles */}
        {!reduce && (
          <div className="pointer-events-none absolute inset-0">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-gold-light"
                style={{
                  left: `${20 + Math.random() * 60}%`,
                  top: `${20 + Math.random() * 60}%`,
                }}
                animate={{
                  y: [0, -15, 0],
                  x: [0, (i % 2 ? 8 : -8), 0],
                  opacity: [0, 0.7, 0],
                  scale: [0.5, 1.2, 0.5],
                }}
                transition={{
                  duration: 2.5 + i * 0.5,
                  repeat: Infinity,
                  delay: i * 0.6,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* ─── Brand Text ──────────────────────────────────────────────── */}
      <motion.div
        style={reduce ? {} : {
          transformStyle: 'preserve-3d',
          transform: 'translateZ(10px)',
        }}
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* siddhi */}
        <motion.div
          className="text-cream"
          style={{
            fontFamily: "'Outfit', 'Manrope', system-ui, sans-serif",
            fontSize: 'clamp(2rem, 5.5vw, 4.2rem)',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '0.02em',
            textShadow: '0 2px 20px rgba(0,0,0,0.3), 0 0 40px rgba(245,166,35,0.1)',
          }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          sidhhi
        </motion.div>

        {/* vinayak */}
        <motion.div
          className="text-cream"
          style={{
            fontFamily: "'Outfit', 'Manrope', system-ui, sans-serif",
            fontSize: 'clamp(2rem, 5.5vw, 4.2rem)',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '0.02em',
            textShadow: '0 2px 20px rgba(0,0,0,0.3), 0 0 40px rgba(245,166,35,0.1)',
          }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          binayak
        </motion.div>

        {/* TILES */}
        <motion.div
          style={{
            fontFamily: "'Outfit', 'Manrope', system-ui, sans-serif",
            fontSize: 'clamp(0.8rem, 1.8vw, 1.4rem)',
            fontWeight: 400,
            letterSpacing: '0.4em',
            marginTop: '0.3em',
            color: '#D9B156',
            textShadow: '0 0 20px rgba(217,177,86,0.3)',
          }}
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.85, duration: 0.5 }}
        >
          TILES
        </motion.div>
      </motion.div>

      {/* Keyframes injected via style tag */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
