import type { TargetAndTransition } from 'framer-motion'
import { prefersReducedMotion } from './replay'

export const SPRING = { type: 'spring' as const, stiffness: 400, damping: 22 }

// Framer Motion props for an element that springs in from `from` and, when
// given, back out to `exit` (the caller needs an <AnimatePresence> for the
// exit). Under reduced motion it appears and unmounts at once.
export function springIn(
  from: TargetAndTransition,
  to: TargetAndTransition,
  exit?: TargetAndTransition,
) {
  const reduced = prefersReducedMotion()
  return {
    initial: reduced ? false : from,
    animate: to,
    exit: reduced ? undefined : exit,
    transition: SPRING,
  } as const
}
