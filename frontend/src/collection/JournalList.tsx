import { EntryStamp } from './EntryStamp'
import type { JournalEntry } from '../data/types'

// A page of entry stamps, one per catch, newest first, shown in the
// Collection screen's Journal tab. (Not named Journal.tsx: on Windows that
// would clash with journal.ts, since file names there ignore case.)
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
              <EntryStamp entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
