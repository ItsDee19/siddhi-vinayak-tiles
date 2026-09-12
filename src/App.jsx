import { Suspense, lazy } from 'react'
import { MotionConfig } from 'framer-motion'
import SectionNavigation from './components/ui/SectionNavigation'
import Navbar from './components/sections/Navbar'
import Hero from './components/sections/Hero'
import ProductCategories from './components/sections/ProductCategories'
import VisualizerLazy from './components/sections/VisualizerLazy'
import PrivacyNotice from './components/ui/PrivacyNotice'

const Catalogue = lazy(() => import('./components/sections/Catalogue'))
const WhyChooseUs = lazy(() => import('./components/sections/WhyChooseUs'))
const About = lazy(() => import('./components/sections/About'))
const Testimonials = lazy(() => import('./components/sections/Testimonials'))
const Contact = lazy(() => import('./components/sections/Contact'))
const Footer = lazy(() => import('./components/sections/Footer'))
const FloatingButtons = lazy(() => import('./components/sections/FloatingButtons'))

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <SectionNavigation />
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <ProductCategories />
        <VisualizerLazy />
        <Suspense fallback={null}><Catalogue /></Suspense>
        <Suspense fallback={null}><WhyChooseUs /></Suspense>
        <Suspense fallback={null}><About /></Suspense>
        <Suspense fallback={null}><Testimonials /></Suspense>
        <Suspense fallback={null}><Contact /></Suspense>
      </main>
      <Suspense fallback={null}><Footer /></Suspense>
      <Suspense fallback={null}><FloatingButtons /></Suspense>
      <PrivacyNotice />
    </MotionConfig>
  )
}
