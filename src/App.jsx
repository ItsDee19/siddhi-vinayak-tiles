import { lazy } from 'react'
import Navbar from './components/sections/Navbar'
import Hero from './components/sections/Hero'
import ProductCategories from './components/sections/ProductCategories'
import DeferredSection from './components/ui/DeferredSection'
import ConsentProvider from './components/privacy/ConsentProvider'
import About from './components/sections/About'
import Testimonials from './components/sections/Testimonials'
import Contact from './components/sections/Contact'
import Footer from './components/sections/Footer'
import FloatingButtons from './components/sections/FloatingButtons'
import './styles/site-glass.css'

const CatalogueLibrary = lazy(() => import('./components/catalogue/CatalogueLibrary'))
const SizeCalculator = lazy(() => import('./components/sections/SizeCalculator'))

export default function App() {
  return (
    <ConsentProvider>
      <Navbar />
      <main>
        <Hero />
        <ProductCategories />
        <DeferredSection id="visualizer" title="The catalogue viewing room" description="Explore all 14 supplier catalogues, complete tile designs and original printed details.">
          <CatalogueLibrary />
        </DeferredSection>
        <DeferredSection id="size-calculator" title="Plan your tile quantity" description="Estimate the tiles and boxes for your space.">
          <SizeCalculator />
        </DeferredSection>
        <About />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
      <FloatingButtons />
    </ConsentProvider>
  )
}
