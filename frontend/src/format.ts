// Formats minutes as "9h 00m", or "45m" for flights under an hour.
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = String(minutes % 60).padStart(2, '0')
  return hours > 0 ? `${hours}h ${mins}m` : `${minutes}m`
}

// Formats an ISO timestamp as a short local date and 24h time, e.g. "Sep 28, 14:03".
export function formatCaughtAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
}

const STAMP_MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
]

// Formats an ISO timestamp like an immigration stamp's date, e.g. "24 SEP 2026".
export function formatStampDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')} ${STAMP_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// Formats an altitude band in feet, e.g. "up to 45,000 ft" or
// "20,000–38,000 ft" (a band starting at the ground has no useful lower bound).
export function formatAltitudeBand(minFt: number, maxFt: number): string {
  const n = (ft: number) => ft.toLocaleString('en-US')
  return minFt <= 0 ? `up to ${n(maxFt)} ft` : `${n(minFt)}–${n(maxFt)} ft`
}
