import { motion } from 'framer-motion'
import { useEffect } from 'react'
import type { Badge } from './badges'
import { prefersReducedMotion } from './replay'

// A distinct visual language from the entry stamp: badges are their own
// kind of reward, shown as a small toast rather than a stamped card.
const POPUP_MS = 4000

// The caller (App.tsx) wraps this in <AnimatePresence>, which is what makes
// the exit transition below actually run - the old CSS version had no exit
// animation at all, since removing the DOM node cut it off immediately.
// Under reduced motion, this skips Framer Motion entirely (a plain <div>),
// which also sidesteps AnimatePresence's exit tracking - it just unmounts
// the moment `badge` becomes null, same as before Milestone 5.
export function BadgePopup({
  badge,
  onDismiss,
}: {
  badge: Badge
  onDismiss: () => void
}) {
  // Auto-dismiss, but restart the timer if a different badge replaces this one.
  useEffect(() => {
    const timer = setTimeout(onDismiss, POPUP_MS)
    return () => clearTimeout(timer)
  }, [badge, onDismiss])

  const content = (
    <>
      <span className="badge-popup-icon" aria-hidden="true">
        🏅
      </span>
      <div>
        <strong>Badge unlocked!</strong>
        <p>{badge.name}</p>
      </div>
      <button
        className="badge-popup-close"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
    </>
  )

  if (prefersReducedMotion())
    return (
      <div className="badge-popup" role="status">
        {content}
      </div>
    )
  return (
    <motion.div
      className="badge-popup"
      role="status"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
    >
      {content}
    </motion.div>
  )
}
