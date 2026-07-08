// PRD §1 — Logo. Typographic placeholder: "SVT" monogram + wordmark.
// To swap with a real logo later, replace the <Monogram> SVG with an
// <img src="/assets/logo.svg" /> import — the API stays the same.

const WORDMARK_LINES = ['Siddhi Vinayak', 'Tiles & Stone']

function Monogram({ variant }) {
  const styles = {
    dark: { bg: '#3D2512', stroke: '#C49A3C', text: '#C49A3C' },
    reversed: { bg: '#F5E6C8', stroke: '#2C1A0E', text: '#2C1A0E' },
    mono: { bg: 'transparent', stroke: 'currentColor', text: 'currentColor' },
  }
  const s = styles[variant] || styles.dark

  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden="true">
      <rect x="0" y="0" width="48" height="48" rx="4" fill={s.bg} />
      <g fill="none" stroke={s.stroke} strokeWidth="1.5" opacity="0.35">
        <rect x="4" y="4" width="13" height="13" rx="1" />
        <rect x="31" y="4" width="13" height="13" rx="1" />
        <rect x="4" y="31" width="13" height="13" rx="1" />
        <rect x="31" y="31" width="13" height="13" rx="1" />
      </g>
      <text
        x="24" y="30" textAnchor="middle"
        fontFamily="'Playfair Display', Georgia, serif"
        fontWeight="700" fontSize="16" fill={s.text} letterSpacing="-0.5"
      >SVT</text>
    </svg>
  )
}

export default function Logo({ variant = 'dark', compact = false, className = '' }) {
  const textColor = variant === 'reversed' ? 'text-[#2C1A0E]' : 'text-cream'
  const subColor = variant === 'reversed' ? 'text-[#3D2512]' : 'text-gold'

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center">
        <Monogram variant={variant} />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className={`block font-display text-base font-semibold ${textColor}`}>
            {WORDMARK_LINES[0]}
          </span>
          <span className={`block text-[10px] font-semibold uppercase tracking-[0.2em] ${subColor}`}>
            {WORDMARK_LINES[1]}
          </span>
        </span>
      )}
    </span>
  )
}
