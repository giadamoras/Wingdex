import { isString, keepValid } from '../data/validate'

// Which badges have already shown their unlock popup. Badge *unlocked*
// state itself is never stored (see badges.ts) — only this "seen" set is,
// so a badge that's already unlocked on first load doesn't pop up again.
export const BADGES_SEEN_KEY = 'airspace-explorer:badges-seen:v1'

export function saveSeenBadges(ids: string[]) {
  try {
    localStorage.setItem(BADGES_SEEN_KEY, JSON.stringify(ids))
  } catch {
    // Storage full or blocked: keep the seen set in memory, it just won't
    // survive a reload.
  }
}

// Loads the saved seen set. Returns [] if nothing is saved, the JSON is
// corrupt, or it isn't a list; anything in the list that isn't an id is dropped.
export function loadSeenBadges(): string[] {
  try {
    const json = localStorage.getItem(BADGES_SEEN_KEY)
    if (json === null) return []
    const ids: unknown = JSON.parse(json)
    return Array.isArray(ids) ? keepValid(ids, isString, 'seen badge ids') : []
  } catch {
    return []
  }
}
