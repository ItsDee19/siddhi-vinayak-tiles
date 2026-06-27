import { motion } from 'framer-motion'

// Fade + slide-up on scroll into view. Wrap any block to animate it.
export default function Reveal({
  children,
  delay = 0,
  y = 28,
  className = '',
  once = true,
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.25 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
