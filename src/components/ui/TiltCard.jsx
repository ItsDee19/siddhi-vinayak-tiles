import { useRef, useState } from 'react'

// 3D tilt-on-hover: tracks the cursor and applies a perspective transform with
// a soft glow that follows the pointer. Respects touch (no tilt on tap).
export default function TiltCard({ children, className = '', max = 12, onClick }) {
  const ref = useRef(null)
  const [style, setStyle] = useState({})
  const [glow, setGlow] = useState({ x: 50, y: 50, on: false })

  const handleMove = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    const rotX = (0.5 - py) * max
    const rotY = (px - 0.5) * max
    setStyle({
      transform: `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(6px)`,
    })
    setGlow({ x: px * 100, y: py * 100, on: true })
  }

  const reset = () => {
    setStyle({ transform: 'perspective(900px) rotateX(0deg) rotateY(0deg)' })
    setGlow((g) => ({ ...g, on: false }))
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      onClick={onClick}
      style={style}
      className={`relative transition-transform duration-200 ease-out will-change-transform ${className}`}
    >
      {/* cursor-following glow */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: glow.on ? 1 : 0,
          background: `radial-gradient(380px circle at ${glow.x}% ${glow.y}%, rgba(176,141,79,0.18), transparent 45%)`,
        }}
      />
      {children}
    </div>
  )
}
