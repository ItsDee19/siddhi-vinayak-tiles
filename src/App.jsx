import { Suspense, lazy } from 'react'
import Navbar from './components/sections/Navbar'
import Hero from './components/sections/Hero'
import ProductCategories from './components/sections/ProductCategories'
import VisualizerLazy from './components/sections/VisualizerLazy'

const Catalogue = lazy(() => import('./components/sections/Catalogue'))
const WhyChooseUs = lazy(() => import('./components/sections/WhyChooseUs'))
const About = lazy(() => import('./components/sections/About'))
const Testimonials = lazy(() => import('./components/sections/Testimonials'))
const Contact = lazy(() => import('./components/sections/Contact'))
const Footer = lazy(() => import('./components/sections/Footer'))
const FloatingButtons = lazy(() => import('./components/sections/FloatingButtons'))

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ProductCategories />
        <VisualizerLazy />
        <Suspense fallback={null}>
          <Catalogue />
          <WhyChooseUs />
          <About />
          <Testimonials />
          <Contact />
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <Footer />
        <FloatingButtons />
      </Suspense>
    </>
  )
}
