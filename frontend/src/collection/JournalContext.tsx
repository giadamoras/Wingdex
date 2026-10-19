import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { isToday } from '../shared-lib/dates'
import { JournalContext } from './journalStore'
import { loadJournal, saveJournal } from './journal'
import type { Flight, Hazard, JournalEntry } from '../data/types'

// Owns the Journal: loaded once from localStorage, saved on every change.
// Wraps the app so the map view, Collection and badge logic all read the
// same state without prop drilling (see useJournalContext).
export function JournalProvider({ children }: { children: ReactNode }) {
  const [journal, setJournal] = useState(loadJournal)

  useEffect(() => {
    saveJournal(journal)
  }, [journal])

  // Records a catch with the fact the card showed and the time. questId is set only when this
  // catch completes that day's quest (badges derive from it, see badges.ts).
  // The once-a-day rule lives here too: the same flight is not added twice in
  // one day, whoever calls this.
  // hazards is only saved when there are some, to keep entries small.
  const addCatch = (
    flight: Flight,
    fact: string,
    questId?: string,
    hazards: Hazard[] = [],
  ) => {
    const now = new Date()
    const entry: JournalEntry = {
      flight,
      fact,
      caughtAt: now.toISOString(),
      questId,
      ...(hazards.length > 0 && { hazards }),
    }
    setJournal((prev) =>
      prev.some((e) => e.flight.id === flight.id && isToday(e.caughtAt, now))
        ? prev
        : [...prev, entry],
    )
  }

  return (
    <JournalContext.Provider value={{ journal, addCatch }}>
      {children}
    </JournalContext.Provider>
  )
}
