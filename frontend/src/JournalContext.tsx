import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { isToday } from './dates'
import { getFact } from './facts'
import { JournalContext } from './journalStore'
import { loadJournal, saveJournal } from './journal'
import type { Flight, JournalEntry, WeatherArea } from './types'

// Owns the Journal: loaded once from localStorage, saved on every change.
// Wraps the app so the map view, Collection and badge logic all read the
// same state without prop drilling (see useJournalContext).
export function JournalProvider({ children }: { children: ReactNode }) {
  const [journal, setJournal] = useState(loadJournal)

  useEffect(() => {
    saveJournal(journal)
  }, [journal])

  // Records a catch with its fact and time. questId is set only when this
  // catch completes that day's quest (badges derive from it, see badges.ts).
  // The once-a-day rule lives here too: the same flight is not added twice in
  // one day, whoever calls this.
  const addCatch = (
    flight: Flight,
    questId?: string,
    weather?: WeatherArea[],
  ) => {
    const now = new Date() // one moment for the fact and the time
    const entry: JournalEntry = {
      flight,
      fact: getFact(flight, now, weather),
      caughtAt: now.toISOString(),
      questId,
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
