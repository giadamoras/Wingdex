// True if the ISO timestamp falls on the same local calendar day as `now`
// (default: today). Tests pass a fixed `now` to stay independent of the clock.
export function isToday(iso: string, now = new Date()): boolean {
  return new Date(iso).toDateString() === now.toDateString()
}
