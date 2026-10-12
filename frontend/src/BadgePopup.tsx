import { motion } from 'framer-motion'
import { useEffect } from 'react'
import type { Badge } from './badges'
import { springIn } from './springIn'

// A distinct visual language from the entry stamp: badges are their own
// kind of reward, shown as a small toast rather than a stamped card.
const POPUP_MS = 4000

// The caller (App.tsx) wraps this in <AnimatePresence>, which is what makes
// the exit transition below actually run - the old CSS version had no exit
// animation at all, since removing the DOM node cut it off immediately.
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

  return (
    <motion.div
      className="badge-popup"
      role="status"
      {...springIn(
        { opacity: 0, scale: 0.6 },
        { opacity: 1, scale: 1 },
        { opacity: 0, scale: 0.8 },
      )}
    >
      {content}
    </motion.div>
  )
}
