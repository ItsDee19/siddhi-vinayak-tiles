import { motion } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { MOTION_DURATION, MOTION_EASE } from '../../utils/motion'

// Fade + slide-up on scroll into view. Wrap any block to animate it.
// Respects prefers-reduced-motion (PRD §2.5 / NF5).
export default function Reveal({
  children,
  delay = 0,
  y = 18,
  className = '',
  once = true,
}) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={reduce ? { opacity: 1, y: 0 } : undefined}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.25 }}
      transition={
        reduce
          ? { duration: 0, delay: 0 }
          : { duration: MOTION_DURATION.reveal, delay: Math.min(delay, 0.24), ease: MOTION_EASE }
      }
    >
      {children}
    </motion.div>
  )
}
