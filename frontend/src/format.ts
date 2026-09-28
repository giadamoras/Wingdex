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
