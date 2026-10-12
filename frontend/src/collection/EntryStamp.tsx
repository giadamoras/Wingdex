import { formatStampDate } from '../shared-lib/format'
import type { JournalEntry } from '../data/types'

// Ink stamp for a Journal entry: like a real immigration stamp, it leads
// with the destination, not the route. Falls back to the callsign for
// flights with no known destination (older entries, or a live feed with
// no route).
export function EntryStamp({ entry }: { entry: JournalEntry }) {
  const code = entry.flight.destination?.iata ?? entry.flight.callsign
  return (
    <div className="entry-stamp">
      <span className="entry-stamp-label">✈ Entry Stamp</span>
      <span className="entry-stamp-code">{code}</span>
      <span className="entry-stamp-date">
        {formatStampDate(entry.caughtAt)}
      </span>
      <span className="entry-stamp-callsign">{entry.flight.callsign}</span>
    </div>
  )
}
