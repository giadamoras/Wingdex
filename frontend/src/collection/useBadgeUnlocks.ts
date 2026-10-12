import { useEffect, useState } from 'react'
import { BADGES, unlockedBadgeIds, type Badge } from './badges'
import { loadSeenBadges, saveSeenBadges } from './badgesSeen'
import type { JournalEntry } from '../data/types'

// Tracks which unlocked badges still need their one-time popup. `journal`
// drives which badges are unlocked (derived every render); only the set of
// badges already shown persists.
export function useBadgeUnlocks(journal: JournalEntry[]) {
  const [seen, setSeen] = useState(loadSeenBadges)

  useEffect(() => {
    saveSeenBadges(seen)
  }, [seen])

  const unlockedIds = unlockedBadgeIds(journal)
  // The earliest-defined unlocked badge not yet seen, so popups appear in a
  // stable order even if several unlock from the same catch.
  const popupBadge: Badge | null =
    BADGES.find((b) => unlockedIds.includes(b.id) && !seen.includes(b.id)) ??
    null

  const dismiss = () => {
    if (popupBadge) setSeen((prev) => [...prev, popupBadge.id])
  }

  return { unlockedIds, popupBadge, dismiss }
}
