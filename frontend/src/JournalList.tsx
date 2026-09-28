import { formatCaughtAt } from './format'
import type { JournalEntry } from './types'

// Plain list of every catch, newest first. The Collection screen replaces
// this in a later milestone. (Not named Journal.tsx: on Windows that would
// clash with journal.ts, since file names there ignore case.)
export function JournalList({ entries }: { entries: JournalEntry[] }) {
  // Copy before reversing: reverse() changes the array in place, and
  // `entries` is React state that must never be modified directly.
  const newestFirst = [...entries].reverse()

  return (
    <section className="journal">
      <h2>Journal ({entries.length})</h2>
      {entries.length === 0 ? (
        <p className="journal-empty">
          No catches yet. Tap a plane and hit Catch!
        </p>
      ) : (
        <ul>
          {newestFirst.map((entry) => (
            // One catch per flight per day, so id + time is always unique.
            <li
              key={`${entry.flight.id}-${entry.caughtAt}`}
              className="journal-entry"
            >
              <div className="journal-head">
                <strong>{entry.flight.callsign}</strong>
                <span className="chip">{entry.flight.aircraft_type}</span>
                <time dateTime={entry.caughtAt}>
                  {formatCaughtAt(entry.caughtAt)}
                </time>
              </div>
              <p>{entry.fact}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
