import { useContext } from 'react'
import { JournalContext, type JournalContextValue } from './journalStore'

export function useJournalContext(): JournalContextValue {
  const ctx = useContext(JournalContext)
  if (ctx === null) {
    throw new Error('useJournalContext must be used within a JournalProvider')
  }
  return ctx
}
