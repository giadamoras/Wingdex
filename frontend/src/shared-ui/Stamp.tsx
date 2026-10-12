import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { prefersReducedMotion } from '../map/replay'

// Rubber-stamp thump: starts big and faded, lands at its -8deg tilt. Shared
// by the quest's "Done!" and the card's "Caught today" (Milestone 4's shared
// stamp look), now a spring instead of the old CSS `stamp` keyframes. Under
// reduced motion, skip Framer Motion entirely rather than just shortening the
// transition - a plain <span> with the final rotate baked into the CSS.
export function Stamp({ children }: { children: ReactNode }) {
  if (prefersReducedMotion())
    return <span className="stamp stamp-still">{children}</span>
  return (
    <motion.span
      className="stamp"
      initial={{ scale: 1.8, opacity: 0, rotate: -8 }}
      animate={{ scale: 1, opacity: 1, rotate: -8 }}
      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
    >
      {children}
    </motion.span>
  )
}
