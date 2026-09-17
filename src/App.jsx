import { Suspense, lazy } from 'react'
import { MotionConfig } from 'framer-motion'
import Navbar from './components/sections/Navbar'
import Hero from './components/sections/Hero'
import CatalogueLibrary from './components/catalogue/CatalogueLibrary'
import ProductCategories from './components/sections/ProductCategories'
import PrivacyNotice from './components/ui/PrivacyNotice'
import './styles/catalogue.css'

const SizeCalculator = lazy(() => import('./components/sections/SizeCalculator'))
const About = lazy(() => import('./components/sections/About'))
const Contact = lazy(() => import('./components/sections/Contact'))
const Footer = lazy(() => import('./components/sections/Footer'))
const FloatingButtons = lazy(() => import('./components/sections/FloatingButtons'))

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <CatalogueLibrary />
        <ProductCategories />
        <div className="container-px bg-charcoal-800 pb-12">
          <details className="planning-tool">
            <summary><span>Planning how many tiles you need?</span><span>Open size calculator</span></summary>
            <Suspense fallback={<p className="p-6">Loading calculator…</p>}><SizeCalculator /></Suspense>
          </details>
        </div>
        <Suspense fallback={null}><About /></Suspense>
        <Suspense fallback={null}><Contact /></Suspense>
      </main>
      <Suspense fallback={null}><Footer /></Suspense>
      <Suspense fallback={null}><FloatingButtons /></Suspense>
      <PrivacyNotice />
    </MotionConfig>
  )
}
