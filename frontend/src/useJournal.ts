import { useEffect, useState } from 'react'
import { getFact } from './facts'
import { loadJournal, saveJournal } from './journal'
import type { Flight, JournalEntry } from './types'

// The user's caught flights, loaded from localStorage once and saved on every change.
export function useJournal() {
  const [journal, setJournal] = useState(loadJournal)

  useEffect(() => {
    saveJournal(journal)
  }, [journal])

  // Records a catch with its fact and time.
  const addCatch = (flight: Flight) => {
    const entry: JournalEntry = {
      flight,
      fact: getFact(flight),
      caughtAt: new Date().toISOString(),
    }
    setJournal([...journal, entry])
  }

  return { journal, addCatch }
}
