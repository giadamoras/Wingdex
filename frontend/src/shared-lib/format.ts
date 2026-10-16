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

// Climb or descent in plain words with the rate, e.g. "Climbing · 1,900
// ft/min", or "Flying level" when it is under 300 ft/min either way (cruise
// wobble). null when unknown.
const LEVEL_FPM = 300 // below this either way counts as level
const ROUND_FPM = 100 // rates are shown to the nearest 100

// Which way the plane is going vertically, or null when unknown.
export function climbDirection(
  fpm: number | null | undefined,
): 'up' | 'down' | 'level' | null {
  if (fpm === null || fpm === undefined) return null
  if (Math.abs(fpm) < LEVEL_FPM) return 'level'
  return fpm > 0 ? 'up' : 'down'
}

export function formatClimb(fpm: number | null | undefined): string | null {
  if (fpm === null || fpm === undefined) return null
  if (climbDirection(fpm) === 'level') return 'Flying level'
  const rate = Math.round(Math.abs(fpm) / ROUND_FPM) * ROUND_FPM
  return `${fpm > 0 ? 'Climbing' : 'Descending'} · ${rate.toLocaleString('en-US')} ft/min`
}

// The card's values: the aviation unit first, then the everyday one, so the
// player sees what it means and learns the unit.

// "39,000 ft · 11.9 km", or metres under 1 km ("1,500 ft · 460 m").
const M_PER_FT = 0.3048
export function formatAltitude(ft: number): string {
  const m = ft * M_PER_FT
  const metric =
    m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`
  return `${ft.toLocaleString('en-US')} ft · ${metric}`
}

// "419 kt · 776 km/h". A knot is one nautical mile (1.852 km) an hour.
const KMH_PER_KT = 1.852
export function formatSpeed(kt: number): string {
  const kmh = Math.round(kt * KMH_PER_KT).toLocaleString('en-US')
  return `${kt.toLocaleString('en-US')} kt · ${kmh} km/h`
}

// "Northwest (316°)": the nearest of 8 compass points, then the degrees.
const COMPASS = [
  'North',
  'Northeast',
  'East',
  'Southeast',
  'South',
  'Southwest',
  'West',
  'Northwest',
]
export function formatHeading(degrees: number): string {
  const rounded = Math.round(degrees) % 360
  return `${COMPASS[Math.round(rounded / 45) % 8]} (${rounded}°)`
}
