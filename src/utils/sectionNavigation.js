let cancelPending = () => {}

export function scrollBehavior() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
}

// One navigation owner for links, catalogue handoffs and lazy sections.
// A newer request cancels an earlier target that is still mounting.
export function scrollToSection(id, { focus = false, history = 'push' } = {}) {
  if (typeof document === 'undefined' || !/^[a-z][a-z0-9-]*$/i.test(id)) return false
  cancelPending()
  let observer, stabilizer, timer
  const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown']
  const finish = () => {
    observer?.disconnect()
    stabilizer?.disconnect()
    clearTimeout(timer)
    inputs.forEach(name => window.removeEventListener?.(name, finish))
  }
  cancelPending = finish
  const listenForInput = () => inputs.forEach(name => window.addEventListener?.(name, finish, { passive: true, once: true }))
  const reveal = () => {
    let target = document.getElementById(id)
    if (!target) return false
    finish()
    if (history !== 'none' && window.location.hash !== `#${id}`) {
      window.history[history === 'replace' ? 'replaceState' : 'pushState'](null, '', `#${id}`)
    }
    const focusTarget = () => {
      const heading = target.querySelector('h1, h2') || target
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
      heading.focus({ preventScroll: true })
    }
    if (focus) focusTarget()
    target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
    // Sections above the destination can finish loading during a long jump.
    // Follow that layout change briefly, yielding immediately to user input.
    if (typeof ResizeObserver !== 'undefined') {
      let previousTop = target.getBoundingClientRect().top + window.scrollY
      const settle = () => {
        const currentTarget = document.getElementById(id)
        if (!currentTarget) return
        const replaced = currentTarget !== target
        target = currentTarget
        const nextTop = target.getBoundingClientRect().top + window.scrollY
        if (!replaced && Math.abs(nextTop - previousTop) <= 1) return
        previousTop = nextTop
        if (replaced && focus) focusTarget()
        target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
      }
      stabilizer = new ResizeObserver(settle)
      stabilizer.observe(document.getElementById('root') || document.body)
      observer = new MutationObserver(settle)
      observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true })
      listenForInput()
      timer = setTimeout(finish, 1500)
    }
    return true
  }
  if (reveal()) return true
  observer = new MutationObserver(reveal)
  observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true })
  listenForInput()
  timer = setTimeout(finish, 5000)
  return true
}

export function cancelSectionNavigation() { cancelPending() }
