import { business } from './siteConfig.js'
import { escapeHtml, renderStaticHeader, renderStaticFooter } from './seo.js'

// Factual website-use information. Sales, refunds and warranties must come from
// the showroom's actual arrangements; this file does not invent those policies.
export const policyUpdated = '12 September 2026'
export const policyPages = [
  {
    path: '/privacy-policy/',
    title: `Privacy Policy | ${business.name}`,
    heading: 'Privacy policy',
    description: 'How Sidhhi Binayak Tiles handles website enquiries, WhatsApp drafts, local tile photographs and the privacy-notice preference.',
    intro: `This page explains information used by the ${business.name} website and what happens when you choose to contact our showroom.`,
    sections: [
      {
        heading: 'Enquiries and WhatsApp drafts',
        paragraphs: [
          'The enquiry form asks for your name and phone number, with an optional product category and message. These fields stay in the browser while you prepare your enquiry; the website does not submit them to a website enquiry database.',
          'Choosing “Continue to WhatsApp” opens a link containing your entered details so WhatsApp can prepare the message. Opening this link passes the draft text to WhatsApp. Your message reaches the showroom only if you choose Send in WhatsApp; this website cannot confirm its delivery.',
          'When you send an enquiry, the showroom uses the details you share to understand your request and respond about products or your project. For questions about information you have sent, including requests to correct or delete it, contact the showroom using the details below.',
        ],
      },
      {
        heading: 'Tile photographs and saved room previews',
        paragraphs: [
          'A tile photograph selected for the 3D visualizer is processed locally in your browser. The website code does not upload that selected file to the showroom or a website server. Saving a room preview downloads an image to your device.',
          'Sharing a photograph or a saved preview through WhatsApp or another service is a separate action that you choose to take.',
        ],
      },
      {
        heading: 'Your privacy-notice preference',
        paragraphs: [
          'When you dismiss the privacy notice, the website stores an acknowledgement preference in your browser’s local storage so the same notice does not keep appearing. This preference does not contain your enquiry details or tile photographs.',
          'You can remove this preference by clearing this website’s stored data in your browser. The notice may then appear again. Dismissing the notice does not enable advertising or analytics tracking.',
        ],
      },
      {
        heading: 'Cookies, analytics and website delivery',
        paragraphs: [
          'The website application does not set advertising or analytics cookies and does not include advertising pixels or visitor-analytics scripts. Its fonts and product images are served from this website.',
          'The website is hosted on Vercel. Hosting and security services may process technical request information, such as an IP address, requested URL, request time and browser information, to deliver and protect the site. Handling and retention of provider records depend on the service and its settings.',
        ],
        links: [{ label: 'Vercel privacy notice', href: 'https://vercel.com/legal/privacy-notice' }],
      },
      {
        heading: 'External services you choose to open',
        paragraphs: [
          'WhatsApp and Google Maps links open services operated by other companies. Their own privacy policies explain how they process information, including any cookies or account information used by those services.',
          'The map link looks up the showroom address. You can call the showroom for directions instead of opening Maps or WhatsApp.',
        ],
        links: [
          { label: 'WhatsApp privacy policy', href: 'https://www.whatsapp.com/legal/privacy-policy' },
          { label: 'Google privacy policy', href: 'https://policies.google.com/privacy' },
        ],
      },
      {
        heading: 'Contact about privacy',
        paragraphs: [
          `For questions about this website or information shared with the showroom, call ${business.phoneDisplay} or visit ${business.address.full}.`,
          'This page describes the website at the date shown above. Its description will need to reflect any future changes to enquiry handling, storage or tracking.',
        ],
      },
    ],
  },
  {
    path: '/terms-and-conditions/',
    title: `Website Terms & Conditions | ${business.name}`,
    heading: 'Website terms & conditions',
    description: 'Information about using the Sidhhi Binayak Tiles online catalogue, 3D visualizer, product enquiries and external links.',
    intro: 'These terms explain the purpose and use of this website’s catalogue, room previews and enquiry tools.',
    sections: [
      {
        heading: 'Browsing products and making enquiries',
        paragraphs: [
          'The website helps you explore products and discuss your requirements with the showroom. It does not provide online checkout or take payments. Browsing, selecting a product or opening a WhatsApp draft does not place an order or reserve stock.',
          'Confirm the product name, dimensions, finish, required quantity, current price and availability with the showroom before deciding to purchase. Catalogue information and photographs are provided to help you compare options.',
        ],
      },
      {
        heading: 'Understanding the 3D visualizer',
        paragraphs: [
          'Room views are illustrative previews for comparing designs. Screen settings, lighting, reflections, image quality and representative model geometry affect how a tile or basin appears. A preview is not a physical sample or a manufacturer’s technical drawing.',
          'Check physical samples and confirmed product specifications before making a final selection. Use the Save room tool to keep a preview for planning or discussing your project with the showroom.',
        ],
      },
      {
        heading: 'Using your own photographs',
        paragraphs: [
          'Choose photographs that you have permission to use. The visualizer processes selected files in your browser; it does not send those files to the showroom. If you want the showroom to see a photograph or saved preview, share it separately through your chosen contact method.',
          'Use the website’s tools for browsing and planning, without attempting to disrupt the site or interfere with other visitors.',
        ],
      },
      {
        heading: 'WhatsApp and directions',
        paragraphs: [
          'The enquiry form prepares a WhatsApp draft. Opening the draft passes its text to WhatsApp; review it and choose Send to message the showroom. The website cannot confirm whether a message was delivered or read.',
          'External services, including WhatsApp and Google Maps, have their own terms and privacy policies. The Maps action looks up the published address; call the showroom if you need help finding the entrance.',
        ],
      },
      {
        heading: 'Purchase arrangements',
        paragraphs: [
          'Discuss payment, delivery, cancellation, returns and any applicable manufacturer warranty with the showroom before a purchase. These website-use terms do not set or replace the arrangements for an individual sale.',
        ],
      },
      {
        heading: 'Contact the showroom',
        paragraphs: [
          `For product questions or help using the website, call ${business.phoneDisplay} or visit ${business.name} at ${business.address.full}.`,
        ],
      },
    ],
  },
]

export function renderPolicyBody(page) {
  const sections = page.sections.map(section => `<section class="mt-8">
    <h2 class="font-display text-2xl text-cream">${escapeHtml(section.heading)}</h2>
    ${section.paragraphs.map(paragraph => `<p class="mt-3 text-base leading-relaxed text-sand">${escapeHtml(paragraph)}</p>`).join('')}
    ${section.links ? `<div class="mt-2 flex flex-wrap gap-x-5 gap-y-1">${section.links.map(link => `<a href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center text-sm text-gold underline underline-offset-4">${escapeHtml(link.label)}</a>`).join('')}</div>` : ''}
  </section>`).join('')
  return `<a href="#page-content" class="skip-link">Skip to content</a>${renderStaticHeader()}
    <main id="page-content" tabindex="-1" class="container-px py-12 sm:py-16">
      <div class="mx-auto max-w-3xl">
        <p class="text-sm text-sand">Updated ${policyUpdated}</p>
        <h1 class="mt-4 font-display text-3xl text-cream sm:text-4xl">${escapeHtml(page.heading)}</h1>
        <p class="mt-5 text-base leading-relaxed text-sand">${escapeHtml(page.intro)}</p>
        ${sections}
      </div>
    </main>${renderStaticFooter()}`
}

export const notFoundPage = {
  path: '/404.html',
  title: `Page Not Found | ${business.name}`,
  description: 'Find the Sidhhi Binayak Tiles catalogue, 3D room visualizer and showroom contact details.',
  noindex: true,
  canonical: false,
  includeStructuredData: false,
}

export function renderNotFoundBody() {
  return `<a href="#page-content" class="skip-link">Skip to content</a>${renderStaticHeader()}
    <main id="page-content" tabindex="-1" class="container-px py-16 sm:py-24">
      <div class="mx-auto max-w-2xl">
        <p class="text-sm font-semibold uppercase tracking-wider text-gold">404 · Page not found</p>
        <h1 class="mt-5 font-display text-4xl text-cream sm:text-5xl">This page isn’t here.</h1>
        <p class="mt-5 text-base leading-relaxed text-sand">The address may be incomplete or the page may have moved. Explore our collection or return to the showroom homepage.</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a href="/" class="btn-gold">Back to home</a>
          <a href="/catalogue/" class="btn-outline">Browse catalogue</a>
        </div>
      </div>
    </main>${renderStaticFooter()}`
}
