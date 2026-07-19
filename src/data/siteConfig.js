// ---------------------------------------------------------------------------
// Single source of truth for business details. Edit here to update the whole
// site — name, address, phone, hours, links, taglines, stats.
// ---------------------------------------------------------------------------

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
    full:
      'Ward No. 03, Gayatri Mandir Chowk, Patora Road, Motanuapada, Nuapada, Odisha 766105',
  },

  // Display number vs. dial number (E.164 for tel: / wa.me)
  phoneDisplay: '06371 255411',
  phoneTel: '+916371255411',
  whatsapp: 'https://wa.me/916371255411',
  whatsappMessage:
    "Hello Sidhhi Binayak Tiles! I'd like to know more about your collection.",

  hours: {
    label: 'Open Today',
    time: '9:00 AM – 8:00 PM',
    note: 'Open daily · Closes 8 PM',
  },

  // Google Maps embed — centred on Motanuapada, Nuapada. The exact pin can be
  // replaced later with the shop's verified place ID / coordinates.
  mapEmbedSrc:
    'https://www.google.com/maps?q=Motanuapada,+Nuapada,+Odisha+766105&output=embed',
  mapLink: 'https://www.google.com/maps/search/?api=1&query=Motanuapada,+Nuapada,+Odisha+766105',

  // Placeholder review link — point to the Google Business profile once live.
  googleReviewLink: 'https://www.google.com/search?q=Siddhi+Vinayak+Tiles+Nuapada',

  socials: [
    { label: 'Facebook', href: '#', icon: 'facebook' },
    { label: 'Instagram', href: '#', icon: 'instagram' },
    { label: 'YouTube', href: '#', icon: 'youtube' },
  ],
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

// Editable placeholder testimonials (shop has no Google reviews yet).
export const testimonials = [
  {
    name: 'A Happy Customer',
    place: 'Nuapada',
    text: 'Replace this with a real review. Lovely range of tiles and the family made us feel completely at home while choosing.',
    rating: 5,
    placeholder: true,
  },
  {
    name: 'Your Review Here',
    place: 'Odisha',
    text: 'Be one of the first to share your experience with Sidhhi Binayak Tiles. Your words help other families choose with confidence.',
    rating: 5,
    placeholder: true,
  },
]
