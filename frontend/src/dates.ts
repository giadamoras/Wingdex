// True if the ISO timestamp falls on the same local calendar day as `now`
// (default: today). Tests pass a fixed `now` to stay independent of the clock.
export function isToday(iso: string, now = new Date()): boolean {
  return new Date(iso).toDateString() === now.toDateString()
}

// The local calendar day as a stable string, e.g. "2026-09-28". Used to seed
// the daily pick of facts and quests, and as the saved day of the quest.
export function dayKey(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
