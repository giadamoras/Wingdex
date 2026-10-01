import { createContext } from 'react'
import type { Flight, JournalEntry, WeatherArea } from './types'

export interface JournalContextValue {
  journal: JournalEntry[]
  // questId is set only when this catch completes that day's quest. `weather`
  // is what the card knew, so the saved fact matches the one it showed.
  addCatch(flight: Flight, questId?: string, weather?: WeatherArea[]): void
}

// No default value: components must render under JournalProvider (App.tsx
// via main.tsx), enforced by useJournalContext's null check.
export const JournalContext = createContext<JournalContextValue | null>(null)
