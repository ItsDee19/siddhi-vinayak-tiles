// PRD §1 — Logo. Typographic placeholder: "SVT" monogram + wordmark.
// To swap with a real logo later, replace the <Monogram> SVG with an
// <img src="/assets/logo.svg" /> import — the API stays the same.

const WORDMARK_LINES = ['Sidhhi Binayak', 'Tiles & Stone']

function Monogram({ variant }) {
  return (
    <div className="h-full w-full rounded-full overflow-hidden flex items-center justify-center">
      <img 
        src="/logo-emblem.png" 
        alt="Sidhhi Binayak Logo"
        className="w-full h-full object-cover"
        style={{ transform: 'scale(1.02)' }}
      />
    </div>
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
