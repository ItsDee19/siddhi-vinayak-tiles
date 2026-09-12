import imageManifest from '../data/responsiveImageManifest.js'

// Mirrors .container-px padding and the two/three-column catalogue grid.
export const CATALOGUE_IMAGE_SIZES = '(min-width: 1280px) calc(33.333vw - 77.333px), (min-width: 1024px) calc(33.333vw - 56px), (min-width: 640px) calc(50vw - 42px), calc(50vw - 26px)'
export const PRODUCT_DETAIL_IMAGE_SIZES = '(min-width: 800px) 768px, calc(100vw - 32px)'

export function getResponsiveImageProps(imageUrl, { sizes = CATALOGUE_IMAGE_SIZES } = {}) {
  const entry = Object.hasOwn(imageManifest, imageUrl) ? imageManifest[imageUrl] : null
  if (!entry) return { src: imageUrl }
  // Put selection attributes before src when spreading into a client <img>.
  // The original remains the native-resolution candidate and browser fallback.
  return {
    ...(entry.variants.length ? {
      sizes,
      srcSet: [...entry.variants.map(variant => `${variant.src} ${variant.width}w`), `${imageUrl} ${entry.width}w`].join(', '),
    } : {}),
    src: imageUrl,
    width: entry.width,
    height: entry.height,
  }
}
