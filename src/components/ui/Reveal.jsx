import { motion } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'

// Fade + slide-up on scroll into view. Wrap any block to animate it.
// Respects prefers-reduced-motion (PRD §2.5 / NF5).
export default function Reveal({
  children,
  delay = 0,
  y = 28,
  className = '',
  once = true,
}) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.25 }}
      transition={
        reduce
          ? { duration: 0.01, delay }
          : { duration: 0.5, delay, ease: [0.4, 0, 0.2, 1] }
      }
    >
      {children}
    </motion.div>
  )
}
