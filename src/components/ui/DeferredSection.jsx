import { Component, Suspense, useEffect, useRef, useState } from 'react'

class SectionBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <section id={this.props.id} className="section-pad container-px" role="alert">
        <h2 className="font-display text-3xl text-cream">This section could not load</h2>
        <p className="mt-3 text-sand">Check your connection, then reload to try again.</p>
        <button type="button" className="btn-outline mt-5" onClick={() => window.location.reload()}>Reload page</button>
      </section>
    )
  }
}

function SectionContent({ id, children }) {
  useEffect(() => {
    if (window.location.hash !== `#${id}`) return
    // The catalogue owns positioning for shared links to a particular design.
    if (id === 'visualizer' && new URLSearchParams(window.location.search).has('catalogue')) return
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' }))
    return () => cancelAnimationFrame(frame)
  }, [id])
  return children
}

// Import expensive sections only near the viewport or when explicitly selected.
// Hash navigation is also observed so a distant section never needs a second click.
export default function DeferredSection({ id, title, description, children }) {
  const [ready, setReady] = useState(() => window.location.hash === `#${id}`)
  const anchor = useRef(null)
  useEffect(() => {
    if (ready) return undefined
    const activate = () => { if (window.location.hash === `#${id}`) setReady(true) }
    window.addEventListener('hashchange', activate)
    if (!('IntersectionObserver' in window)) {
      setReady(true)
      return () => window.removeEventListener('hashchange', activate)
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setReady(true)
    }, { rootMargin: '320px' })
    if (anchor.current) observer.observe(anchor.current)
    return () => {
      observer.disconnect()
      window.removeEventListener('hashchange', activate)
    }
  }, [id, ready])

  const placeholder = (
    <section id={id} className="section-pad container-px flex min-h-[560px] flex-col items-start justify-center" aria-busy={ready || undefined}>
      <h2 className="font-display text-3xl text-cream sm:text-4xl">{title}</h2>
      <p className="mt-4 max-w-xl text-sand">{description}</p>
      {ready ? <p className="mt-5 text-sm text-sand" role="status">Loading…</p> : <button type="button" className="btn-outline mt-5" onClick={() => setReady(true)}>Explore</button>}
    </section>
  )
  return (
    <div ref={anchor} data-deferred-section={id}>
      {ready ? <SectionBoundary id={id}><Suspense fallback={placeholder}><SectionContent id={id}>{children}</SectionContent></Suspense></SectionBoundary> : placeholder}
    </div>
  )
}
