import { useId } from 'react'
import { cropViewBox } from '../../utils/catalogueGallery'

/** A faithful window into the publisher artwork, contained without stretching. */
export default function CatalogueCrop({ page, view, src, label, className = '' }) {
  const clip = useId().replace(/:/g, '')
  const [x, y, width, height] = cropViewBox(page, view.rect)
  return <svg className={`catalogue-crop ${className}`} viewBox={`${x} ${y} ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <defs><clipPath id={clip}><rect x={x} y={y} width={width} height={height} /></clipPath></defs>
    <image href={src} x="0" y="0" width={page.width} height={page.height} clipPath={`url(#${clip})`} />
  </svg>
}
