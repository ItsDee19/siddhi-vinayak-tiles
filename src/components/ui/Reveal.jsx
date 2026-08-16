import { motion } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'

// Fade + slide-up on scroll into view. Wrap any block to animate it.
// Respects prefers-reduced-motion (PRD §2.5 / NF5).
export default function Reveal({
  children,
  delay = 0,
  y = 14,
  className = '',
  once = true,
}) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      // amount 0.25 held the animation back until a quarter of a tall block had
      // scrolled in, which on long sections fired well after it was already on
      // screen. A small pixel margin starts it just before the edge instead.
      viewport={{ once, amount: 0.05, margin: '0px 0px -8% 0px' }}
      transition={
        reduce
          ? { duration: 0.01, delay }
          : { duration: 0.34, delay, ease: [0.16, 1, 0.3, 1] }
      }
    >
      {children}
    </motion.div>
  )
}
