import { useEffect } from 'react'
import type { Badge } from './badges'

// A distinct visual language from the entry stamp: badges are their own
// kind of reward, shown as a small toast rather than a stamped card.
const POPUP_MS = 4000

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

  return (
    <div className="badge-popup" role="status">
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
    </div>
  )
}
