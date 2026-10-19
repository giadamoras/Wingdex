import { useState } from 'react'
import { CatchDetails } from './CatchDetails'
import { CountPill } from './CountPill'
import { EntryStamp } from './EntryStamp'
import type { JournalEntry } from '../data/types'

// A page of entry stamps, one per catch, newest first, shown in the
// Collection screen's Journal tab. (Not named Journal.tsx: on Windows that
// would clash with journal.ts, since file names there ignore case.) Tapping
// a stamp opens that catch's details.
export function JournalList({ entries }: { entries: JournalEntry[] }) {
  // Copy before reversing: reverse() changes the array in place, and
  // `entries` is React state that must never be modified directly.
  const newestFirst = [...entries].reverse()
  const [open, setOpen] = useState<JournalEntry | null>(null)

  return (
    <section className="journal">
      {entries.length > 0 && (
        <CountPill
          icon="✈️"
          count={entries.length}
          noun={entries.length === 1 ? 'catch' : 'catches'}
        />
      )}
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
              <button
                className="journal-stamp"
                aria-haspopup="dialog"
                onClick={() => setOpen(entry)}
              >
                <EntryStamp entry={entry} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <CatchDetails entry={open} onClose={() => setOpen(null)} />}
    </section>
  )
}
