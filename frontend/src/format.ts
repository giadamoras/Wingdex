// Formats minutes as "9h 00m", or "45m" for flights under an hour.
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = String(minutes % 60).padStart(2, '0')
  return hours > 0 ? `${hours}h ${mins}m` : `${minutes}m`
}
