# Plan 1: Foundation — Theme, Logo, NFRs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing color palette with exact PRD tokens, build a swappable Logo component (SVT monogram + 3 variants), add favicon assets, enforce 8px grid + 4px/2px radii + motion tokens, and complete `prefers-reduced-motion` coverage across all animation components.

**Architecture:** Map existing Tailwind color names (charcoal/sand/cream/gold/terracotta) to PRD hex values so every existing class auto-reskins without a mass rename. Layer PRD semantic token names as CSS custom properties in `:root` + parallel Tailwind aliases for new code. Create a shared `useReducedMotion` hook to DRY up the scattered checks.

**Tech Stack:** Tailwind CSS 3.4, React 18, Framer Motion 11, Vite 5.

## Global Constraints

- PRD hex values are exact: `#2C1A0E, #3D2512, #4A2E1A, #F5E6C8, #C9A97A, #C49A3C, #B85C38, #1A0E05`, border `rgba(197,154,60,0.2)`
- Fonts: Playfair Display (headings 700/900), Manrope (body 400/500, labels 600 uppercase 0.12em tracking) — already loaded, keep
- Radii: cards 4px, buttons 2px (sharp luxury feel)
- Motion: micro 150ms, reveals 400–600ms, easing `cubic-bezier(0.4,0,0.2,1)`
- `prefers-reduced-motion: reduce` → all animations degrade to instant/opacity-only
- Business config stays at `src/data/siteConfig.js` (per user decision)

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `tailwind.config.js` | PRD colors + spacing/radius/motion tokens |
| Modify | `src/index.css` | `:root` CSS vars, base styles, button/card radii |
| Modify | `index.html` | theme-color, favicon links |
| Create | `src/hooks/useReducedMotion.js` | Shared reduced-motion hook |
| Create | `src/components/Logo.jsx` | SVT monogram + wordmark, 3 variants |
| Modify | `public/favicon.svg` | SVT monogram, PRD colors |
| Create | `public/favicon-192.png`, `public/favicon.ico` | PNG/ICO fallbacks |
| Modify | `src/components/sections/Navbar.jsx` | Use Logo, mobile icon-only |
| Modify | `src/components/sections/Footer.jsx` | Use Logo |
| Modify | `src/components/ui/Reveal.jsx` | Reduced-motion guard |
| Modify | `src/components/ui/TiltCard.jsx` | Reduced-motion guard |
| Modify | `src/components/ui/StatCounter.jsx` | Reduced-motion guard |
| Modify | `src/components/sections/FloatingButtons.jsx` | Reduced-motion on pulse |
| Modify | `src/components/three/TileWall3D.jsx` | Reduced-motion on drift |
| Modify | `src/components/three/Room3D.jsx` | Reduced-motion on autoRotate |
| Modify | `src/components/sections/Gallery.jsx` | Use shared hook |
| Modify | `src/hooks/useWebGL.js` | Use shared hook |

---

### Task 1: Update `tailwind.config.js` — PRD palette + tokens

**Files:** Modify `tailwind.config.js`

**Produces:** Tailwind colors mapped to PRD hex values; new semantic aliases; spacing scale (8px grid); border-radius scale (4px cards / 2px buttons); motion duration + easing tokens.

- [ ] **Step 1: Replace the `colors` block** (lines 6–30) with PRD-mapped values. Keep existing names so all current classes auto-reskin; add semantic aliases for new code:

```js
colors: {
  // PRD tokens — existing names remapped to exact PRD hex values.
  charcoal: {
    DEFAULT: '#2C1A0E',   // --bg-primary  (was #1c1a18)
    800: '#3D2512',       // --bg-secondary (was #232120)
    700: '#4A2E1A',       // --bg-surface   (was #2e2b29)
    600: '#5C3A22',       // hover/elevated (was #3a3633)
  },
  graphite: '#6B4A2E',
  sand: {
    DEFAULT: '#C9A97A',   // --text-secondary
    light: '#E0C99B',
    dark: '#A8884F',
  },
  cream: '#F5E6C8',        // --text-primary
  gold: {
    DEFAULT: '#C49A3C',   // --accent-gold
    light: '#D9B156',
    dark: '#9A7530',
  },
  terracotta: '#B85C38',   // --accent-terracotta
  ink: '#1A0E05',         // --text-on-accent (NEW)

  // Semantic aliases — PRD token names for new code.
  primary: '#2C1A0E',
  secondary: '#3D2512',
  surface: '#4A2E1A',
  'text-primary': '#F5E6C8',
  'text-secondary': '#C9A97A',
  'accent-gold': '#C49A3C',
  'accent-terracotta': '#B85C38',
  'text-on-accent': '#1A0E05',
},
```

- [ ] **Step 2: Add spacing + border-radius + motion scales** to the `extend` block:

```js
spacing: {
  '7': '1.75rem',  '9': '2.25rem',  '15': '3.75rem',
  '17': '4.25rem', '18': '4.5rem',
},
borderRadius: {
  'card': '4px',
  'btn': '2px',
},
transitionDuration: {
  '150': '150ms', '400': '400ms', '500': '500ms', '600': '600ms',
},
transitionTimingFunction: {
  'pr': 'cubic-bezier(0.4, 0, 0.2, 1)',
},
```

- [ ] **Step 3: Update boxShadow** rgba values to match new palette:

```js
boxShadow: {
  soft: '0 10px 40px -12px rgba(44, 26, 14, 0.35)',
  glow: '0 0 50px -8px rgba(196, 154, 60, 0.45)',
  card: '0 22px 60px -20px rgba(44, 26, 14, 0.55)',
},
```

- [ ] **Step 4: Update the `fade-up` animation** to use PRD easing/duration:

```js
animation: {
  'pulse-ring': 'pulse-ring 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
  'fade-up': 'fade-up 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
  shimmer: 'shimmer 3s linear infinite',
},
```

- [ ] **Step 5: Verify dev server hot-reloads without errors.**
Run: `npm run dev` — Expected: No console errors; site loads with darker-brown background.

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.js
git commit -m "feat: adopt PRD color tokens, spacing/radius/motion scales"
```

---

### Task 2: Update `src/index.css` — CSS custom properties + radii

**Files:** Modify `src/index.css`

**Produces:** `:root` CSS custom properties (PRD token names), fixed button/card radii (4px/2px), updated scrollbar/border colors, reduced-motion global guard.

- [ ] **Step 1: Add `:root` CSS custom properties** — replace the existing `:root` block (lines 6–8):

```css
:root {
  color-scheme: dark;

  /* PRD §2.2 — Color System */
  --bg-primary: #2C1A0E;
  --bg-secondary: #3D2512;
  --bg-surface: #4A2E1A;
  --text-primary: #F5E6C8;
  --text-secondary: #C9A97A;
  --accent-gold: #C49A3C;
  --accent-terracotta: #B85C38;
  --text-on-accent: #1A0E05;
  --border: rgba(197, 154, 60, 0.2);

  /* PRD §2.5 — Motion */
  --duration-micro: 150ms;
  --duration-reveal: 500ms;
  --ease-ui: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-reveal: ease-out;
}
```

- [ ] **Step 2: Fix button and card border-radius** — PRD §2.4: cards 4px, buttons 2px. Update `.btn-gold` and `.btn-outline` (lines 59–70) — change `rounded-full` to `rounded-btn`, `text-charcoal` to `text-ink`:

```css
.btn-gold {
  @apply inline-flex items-center justify-center gap-2 rounded-btn bg-gold px-7 py-3.5
    text-sm font-semibold uppercase tracking-wider text-ink transition-all duration-150 ease-pr
    hover:bg-gold-light hover:shadow-glow active:scale-[0.97];
}

.btn-outline {
  @apply inline-flex items-center justify-center gap-2 rounded-btn border border-sand/40
    px-7 py-3.5 text-sm font-semibold uppercase tracking-wider text-cream transition-all
    duration-150 ease-pr hover:border-gold hover:text-gold active:scale-[0.97];
}
```

- [ ] **Step 3: Update scrollbar hover** (line 37):

```css
::-webkit-scrollbar-thumb:hover {
  @apply bg-gold;
}
```

- [ ] **Step 4: Add a reduced-motion global guard** at the end of `@layer base`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 5: Verify in browser** — buttons have sharp 2px corners, background is deeper brown #2C1A0E.

- [ ] **Step 6: Commit**

```bash
git add src/index.css
git commit -m "feat: PRD CSS custom properties, 4px/2px radii, reduced-motion guard"
```

---

### Task 3: Create `useReducedMotion` hook

**Files:** Create `src/hooks/useReducedMotion.js`

**Produces:** Shared hook returning a boolean; replaces scattered inline checks in Gallery.jsx and useWebGL.js.

- [ ] **Step 1: Create the hook file:**

```js
import { useEffect, useState } from 'react'

// PRD §2.5 / NF5: respects prefers-reduced-motion across all animated
// components. Returns true when the user has requested reduced motion.
// SSR-safe and listener-updating (responds to OS setting changes live).
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useReducedMotion.js
git commit -m "feat: shared useReducedMotion hook"
```

---

### Task 4: Create `Logo.jsx` — SVT monogram + 3 variants

**Files:** Create `src/components/Logo.jsx`

**Produces:** A `<Logo>` component with `variant` (dark/reversed/mono), `compact` (icon-only), and `className` props. Single import path for easy future swap to a real SVG asset (PRD L5).

- [ ] **Step 1: Create the Logo component:**

```jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Logo.jsx
git commit -m "feat: Logo component with SVT monogram, 3 variants, compact mode"
```

---

### Task 5: Update favicon + index.html

**Files:** Modify `public/favicon.svg`, Modify `index.html`

**Produces:** Favicon SVG with SVT monogram + PRD colors; PNG/ICO references in HTML; theme-color updated.

- [ ] **Step 1: Replace `public/favicon.svg`:**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="8" fill="#2C1A0E" />
  <g fill="none" stroke="#C49A3C" stroke-width="2" opacity="0.3">
    <rect x="6" y="6" width="17" height="17" rx="1" />
    <rect x="41" y="6" width="17" height="17" rx="1" />
    <rect x="6" y="41" width="17" height="17" rx="1" />
    <rect x="41" y="41" width="17" height="17" rx="1" />
  </g>
  <text x="32" y="40" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="22" fill="#C49A3C" letter-spacing="-1">SVT</text>
</svg>
```

- [ ] **Step 2: Generate PNG/ICO from the SVG** — create `public/favicon-192.png` (192×192) and `public/favicon.ico` (32×32 + 192×192 multi-res). Use an online converter or local tool. If unavailable, SVG alone works for modern browsers — note as follow-up.

- [ ] **Step 3: Update `index.html`** — replace favicon link (line 5) and theme-color (line 11):

```html
<!-- Favicon: SVG primary + PNG/ICO fallbacks (PRD L3) -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="apple-touch-icon" sizes="192x192" href="/favicon-192.png" />
```

```html
<meta name="theme-color" content="#2C1A0E" />
```

- [ ] **Step 4: Verify** — browser tab shows new SVT favicon; no 404s in DevTools Network tab.

- [ ] **Step 5: Commit**

```bash
git add public/favicon.svg public/favicon-192.png public/favicon.ico index.html
git commit -m "feat: SVT favicon, theme-color, PNG/ICO fallbacks"
```

---

### Task 6: Update Navbar — use Logo, mobile icon-only

**Files:** Modify `src/components/sections/Navbar.jsx`

**Produces:** Navbar uses `<Logo>` component; full logo on desktop, icon-only (`compact`) on mobile; logo scales down on scroll (existing behavior preserved).

- [ ] **Step 1: Add the Logo import** (after line 3):

```jsx
import Logo from '../Logo'
```

- [ ] **Step 2: Replace the inline brand markup** (lines 30–42):

```jsx
{/* Brand — PRD §1 L4: full on desktop, icon-only on mobile, shrinks on scroll */}
<a href="#home" className="group flex items-center">
  <span className="lg:hidden">
    <Logo compact variant="dark" className={`transition-transform duration-300 ${scrolled ? 'scale-90' : 'scale-100'}`} />
  </span>
  <span className="hidden lg:block">
    <Logo variant="dark" className={`transition-transform duration-300 ${scrolled ? 'scale-90' : 'scale-100'}`} />
  </span>
</a>
```

- [ ] **Step 3: Verify** — desktop (≥1024px) shows full logo + wordmark; below 1024px shows only SVT monogram. Scroll down and logo shrinks.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/Navbar.jsx
git commit -m "feat: Navbar uses Logo component, mobile icon-only variant"
```

---

### Task 7: Update Footer — use Logo

**Files:** Modify `src/components/sections/Footer.jsx`

- [ ] **Step 1: Add the import** (after line 1):

```jsx
import Logo from '../Logo'
```

- [ ] **Step 2: Replace the inline brand markup** (lines 11–18):

```jsx
<div className="flex items-center gap-3">
  <Logo variant="dark" />
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/Footer.jsx
git commit -m "feat: Footer uses Logo component"
```

---

### Task 8: Reduced-motion in `Reveal.jsx`

**Files:** Modify `src/components/ui/Reveal.jsx`

- [ ] **Step 1: Replace the component body** to use the shared hook:

```jsx
import { motion } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'

export default function Reveal({
  children, delay = 0, y = 28, className = '', once = true,
}) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.25 }}
      transition={
        reduce
          ? { duration: 0.01, delay }
          : { duration: 0.5, delay, ease: [0.4, 0, 0.2, 1] }
      }
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/Reveal.jsx
git commit -m "feat: Reveal respects reduced-motion, PRD motion tokens"
```

---

### Task 9: Reduced-motion in `TiltCard.jsx`

**Files:** Modify `src/components/ui/TiltCard.jsx`

- [ ] **Step 1: Add the hook import and guard:**

```jsx
import { useRef, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

export default function TiltCard({ children, className = '', max = 12, onClick }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const [style, setStyle] = useState({})
  const [glow, setGlow] = useState({ x: 50, y: 50, on: false })

  const handleMove = (e) => {
    if (reduce) return
    // ... existing handleMove body unchanged
  }

  const reset = () => {
    if (reduce) return
    setStyle({ transform: 'perspective(900px) rotateX(0deg) rotateY(0deg)' })
    setGlow((g) => ({ ...g, on: false }))
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/TiltCard.jsx
git commit -m "feat: TiltCard respects reduced-motion"
```

---

### Task 10: Reduced-motion in `StatCounter.jsx`

**Files:** Modify `src/components/ui/StatCounter.jsx`

- [ ] **Step 1: Add the hook and short-circuit the animation:**

```jsx
import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'

export default function StatCounter({ value, suffix = '', duration = 1600 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const reduce = useReducedMotion()
  const [n, setN] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (reduce) { setN(value); return }
    let raf
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setN(Math.round(eased * value))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, duration, reduce])

  return (
    <span ref={ref}>
      {n.toLocaleString('en-IN')}
      {suffix}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/StatCounter.jsx
git commit -m "feat: StatCounter respects reduced-motion"
```

---

### Task 11: Reduced-motion in `FloatingButtons.jsx`

**Files:** Modify `src/components/sections/FloatingButtons.jsx`

- [ ] **Step 1: Add the hook import:**

```jsx
import { useReducedMotion } from '../../hooks/useReducedMotion'
```

- [ ] **Step 2: Use it in the component and conditionally render the pulse rings:**

```jsx
const reduce = useReducedMotion()

// WhatsApp button pulse:
{!reduce && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-[#25D366]" />}

// Call button pulse:
{!reduce && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-gold" />}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/FloatingButtons.jsx
git commit -m "feat: FloatingButtons respects reduced-motion (no pulse ring)"
```

---

### Task 12: Reduced-motion in 3D components

**Files:** Modify `src/components/three/TileWall3D.jsx`, Modify `src/components/three/Room3D.jsx`

- [ ] **Step 1: In TileWall3D.jsx** — add `useReducedMotion` import and skip the bob/drift animation when reduced. Guard the `useFrame` tick.

- [ ] **Step 2: In Room3D.jsx** — guard `OrbitControls` autoRotate:

```jsx
const reduce = useReducedMotion()
// ...
<OrbitControls
  enablePan={false}
  minDistance={5}
  maxDistance={13}
  autoRotate={!reduce}
  autoRotateSpeed={0.4}
/>
```

Add the import: `import { useReducedMotion } from '../../hooks/useReducedMotion'`

- [ ] **Step 3: Commit**

```bash
git add src/components/three/TileWall3D.jsx src/components/three/Room3D.jsx
git commit -m "feat: 3D components respect reduced-motion (no autoRotate/drift)"
```

---

### Task 13: Refactor Gallery + useWebGL to use shared hook

**Files:** Modify `src/components/sections/Gallery.jsx`, Modify `src/hooks/useWebGL.js`

- [ ] **Step 1: In Gallery.jsx** — remove lines 10–12 (`prefersReducedMotion` function) and line 25 (`reduce` ref). Add:

```jsx
import { useReducedMotion } from '../../hooks/useReducedMotion'
// inside the component:
const reduce = useReducedMotion()
```

Replace all `reduce.current` references with `reduce`.

- [ ] **Step 2: In useWebGL.js** — replace the inline matchMedia check with the shared hook:

```jsx
import { useEffect, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

export function useWebGL() {
  const [supported, setSupported] = useState(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) { setSupported(false); return }
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) { setSupported(false); return }
      const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2
      const lowMem = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2
      setSupported(!(lowCores && lowMem))
    } catch { setSupported(false) }
  }, [reduce])

  return supported
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/Gallery.jsx src/hooks/useWebGL.js
git commit -m "refactor: use shared useReducedMotion hook in Gallery + useWebGL"
```

---

### Task 14: Verify + visual QA

- [ ] **Step 1: Run the dev server** — open http://localhost:5173/
- [ ] **Step 2: Verify the theme** — background deep brown (#2C1A0E), text beige (#F5E6C8), accents gold (#C49A3C). Buttons 2px corners, cards 4px.
- [ ] **Step 3: Verify the logo** — SVT monogram + wordmark in navbar (desktop) and footer. Mobile (<1024px) navbar shows only SVT monogram.
- [ ] **Step 4: Verify favicon** — browser tab shows SVT favicon.
- [ ] **Step 5: Test reduced-motion** — DevTools → Rendering → "prefers-reduced-motion: reduce". Reload. Confirm: no Reveal slide-up, no TiltCard tilt, no StatCounter count-up, no FloatingButtons pulse, no 3D autoRotate.
- [ ] **Step 6: Run a production build:** `npm run build` — Expected: succeeds, no errors.
- [ ] **Step 7: Final commit if any fixes were needed.**

---

## Self-Review

**Spec coverage:**
- L1 (wordmark + icon) → Task 4 ✓
- L2 (3 color variants) → Task 4 ✓
- L3 (SVG + PNG + ICO) → Task 5 ✓
- L4 (navbar full desktop / icon mobile / shrink on scroll) → Task 6 ✓
- L5 (typographic SVT placeholder, single import) → Task 4 ✓
- §2.2 colors → Task 1+2 ✓
- §2.3 typography → already present ✓
- §2.4 spacing 8px / radii 4px+2px → Task 1+2 ✓
- §2.5 motion 150ms/500ms + cubic-bezier → Task 1+2+8 ✓
- NF5 (reduced-motion everywhere) → Tasks 3,8-13 ✓
- NF6 (business data location) → kept at siteConfig.js per user decision ✓

**Gaps:** NF3 (WebP textures) and NF1 (FCP measurement) deferred to Plan 2.
