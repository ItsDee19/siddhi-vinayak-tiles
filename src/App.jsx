import Navbar from './components/sections/Navbar'
import Hero from './components/sections/Hero'
import ProductCategories from './components/sections/ProductCategories'
import Visualizer from './components/sections/Visualizer'
import Catalogue from './components/sections/Catalogue'
import WhyChooseUs from './components/sections/WhyChooseUs'
import About from './components/sections/About'
import Testimonials from './components/sections/Testimonials'
import Contact from './components/sections/Contact'
import Footer from './components/sections/Footer'
import FloatingButtons from './components/sections/FloatingButtons'

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ProductCategories />
        <Visualizer />
        <Catalogue />
        <WhyChooseUs />
        <About />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
      <FloatingButtons />
    </>
  )
}
