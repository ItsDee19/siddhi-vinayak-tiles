import Reveal from './Reveal'

// Shared section header: eyebrow label + display title + optional subtitle.
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  light = false,
}) {
  const alignment =
    align === 'left' ? 'items-start text-left' : 'items-center text-center'
  return (
    <Reveal className={`flex flex-col ${alignment}`}>
      {eyebrow && (
        <span className="eyebrow mb-3 sm:mb-4">
          <span className="h-px w-8 bg-gold" />
          {eyebrow}
        </span>
      )}
      <h2
        className={`heading-display text-3xl sm:text-5xl lg:text-[3.4rem] ${
          light ? 'text-charcoal' : 'text-cream'
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mt-3 max-w-2xl text-base leading-relaxed sm:mt-5 sm:text-lg ${
            light ? 'text-charcoal-600' : 'text-sand'
          }`}
        >
          {subtitle}
        </p>
      )}
    </Reveal>
  )
}
