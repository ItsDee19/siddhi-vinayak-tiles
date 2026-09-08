import { useEffect } from 'react'
import { cancelSectionNavigation, scrollToSection } from '../../utils/sectionNavigation'

export default function SectionNavigation() {
  useEffect(() => {
    const restore = () => {
      if (window.location.hash.length > 1) scrollToSection(window.location.hash.slice(1), { history: 'none' })
    }
    const onClick = event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target.closest?.('a[href^="#"]')
      if (!link || link.target || link.hasAttribute('download')) return
      const id = link.getAttribute('href').slice(1)
      if (scrollToSection(id, { focus: event.detail === 0 })) event.preventDefault()
    }
    document.addEventListener('click', onClick)
    window.addEventListener('hashchange', restore)
    restore()
    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('hashchange', restore)
      cancelSectionNavigation()
    }
  }, [])
  return null
}
