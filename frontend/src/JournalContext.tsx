import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getFact } from './facts'
import { JournalContext } from './journalStore'
import { loadJournal, saveJournal } from './journal'
import type { Flight, JournalEntry } from './types'

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
  const addCatch = (flight: Flight, questId?: string) => {
    const entry: JournalEntry = {
      flight,
      fact: getFact(flight),
      caughtAt: new Date().toISOString(),
      questId,
    }
    setJournal((prev) => [...prev, entry])
  }

  return (
    <JournalContext.Provider value={{ journal, addCatch }}>
      {children}
    </JournalContext.Provider>
  )
}
