// Canonical production origin — used to build absolute share/enquiry links for
// the catalogue reader. A per-deployment preview hostname is never canonical.
export const PRODUCTION_ORIGIN = 'https://sidhhibinayaktiles.com'

// Build-time metadata is emitted into HTML so search crawlers and sharing apps
// do not need to execute React. Catalogue query strings share this home canonical.
export const siteSeo = {
  title: 'Tiles & Sanitaryware in Nuapada | Sidhhi Binayak Tiles',
  description: 'Explore tile and sanitaryware catalogues from Sidhhi Binayak Tiles, Nuapada, Odisha. Find designs, sizes and finishes, then plan your showroom visit.',
  socialImage: '/social-preview.jpg',
  socialImageAlt: 'Sidhhi Binayak Tiles, Nuapada — tiles, marble, granite, quartz and sanitaryware, with a catalogue room setting.',
  privacyTitle: 'Privacy & Cookie Policy | Sidhhi Binayak Tiles',
  privacyDescription: 'How Sidhhi Binayak Tiles handles website enquiries, cookie preferences, optional Google Maps and information shared through WhatsApp.',
}
