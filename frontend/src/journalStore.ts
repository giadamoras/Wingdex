import { createContext } from 'react'
import type { Flight, JournalEntry } from './types'

export interface JournalContextValue {
  journal: JournalEntry[]
  // `fact` is the one the card showed. questId is set only when this catch
  // completes that day's quest.
  addCatch(flight: Flight, fact: string, questId?: string): void
}

// No default value: components must render under JournalProvider (App.tsx
// via main.tsx), enforced by useJournalContext's null check.
export const JournalContext = createContext<JournalContextValue | null>(null)
