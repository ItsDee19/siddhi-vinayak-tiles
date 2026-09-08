// ---------------------------------------------------------------------------
// Single source of truth for business details. Edit here to update the whole
// site — name, address, phone, hours, links, taglines, stats.
// ---------------------------------------------------------------------------

const showroomAddress = 'Ward No. 03, Gayatri Mandir Chowk, Patora Road, Motanuapada, Nuapada, Odisha 766105'
const mapAddressQuery = encodeURIComponent(showroomAddress)

export const business = {
  name: 'Sidhhi Binayak Tiles',
  shortName: 'Sidhhi Binayak',
  tagline: 'Enter as Friend, Leave as Family',
  intro:
    'A family-run showroom in Nuapada for Tiles, Marble, Granite, Quartz & Sanitaryware — chosen with care, priced fairly, and finished beautifully.',

  address: {
    line1: 'Ward No. 03, Gayatri Mandir Chowk',
    line2: 'Patora Road, Motanuapada',
    city: 'Nuapada',
    state: 'Odisha',
    pin: '766105',
    full: showroomAddress,
  },

  // Display number vs. dial number (E.164 for tel: / wa.me)
  phoneDisplay: '06371 255411',
  phoneTel: '+916371255411',
  whatsapp: 'https://wa.me/916371255411',
  whatsappMessage:
    "Hello Sidhhi Binayak Tiles! I'd like to know more about your collection.",

  hours: {
    label: 'Showroom hours',
    time: '9:00 AM – 8:00 PM',
    note: 'Open daily · Closes 8 PM',
  },

  // Address lookup, not a verified shop pin. Replace both with the Google
  // Business profile's verified location when the owner supplies it.
  mapEmbedSrc: `https://www.google.com/maps?q=${mapAddressQuery}&output=embed`,
  mapLink: `https://www.google.com/maps/search/?api=1&query=${mapAddressQuery}`,

  // Set only when the real Google Business review URL is available.
  googleReviewLink: null,

  // Add verified account URLs here; unconfigured accounts are not displayed.
  socials: [],
}

export const navLinks = [
  { label: 'Home', href: '#home' },
  { label: 'Products', href: '#products' },
  { label: 'Visualizer', href: '#visualizer' },
  { label: 'Catalogue', href: '#catalogue' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
]

// Animated stats in the "Why Choose Us" row. Editable.
export const stats = [
  { value: 10, suffix: '+', label: 'Years of Trust' },
  { value: 500, suffix: '+', label: 'Happy Families' },
  { value: 5, suffix: '', label: 'Product Categories' },
  { value: 1000, suffix: '+', label: 'Designs in Store' },
]

export const whyChooseUs = [
  {
    title: 'Trusted Quality',
    body: 'Every slab and tile is hand-picked for finish, strength and consistency — only what we would lay in our own home.',
    icon: 'shield',
  },
  {
    title: 'Honest Pricing',
    body: 'Fair, transparent rates with no surprises. Family business means a fair deal, every single visit.',
    icon: 'tag',
  },
  {
    title: 'Endless Variety',
    body: 'Tiles, Marble, Granite, Quartz and Sanitaryware under one roof — hundreds of designs, sizes and finishes.',
    icon: 'grid',
  },
  {
    title: 'Guidance You Can Lean On',
    body: 'From your first idea to the final grout line, we help you choose what truly fits your space and budget.',
    icon: 'compass',
  },
]

// Publish genuine customer reviews only, with permission and source details.
export const testimonials = []
