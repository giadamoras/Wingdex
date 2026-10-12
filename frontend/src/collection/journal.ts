import type { JournalEntry } from '../data/types'
import { isJournalEntry, keepValid } from '../data/validate'

// Versioned key: if the entry shape ever changes, bump to v2 instead of
// loading old data that no longer fits.
export const STORAGE_KEY = 'airspace-explorer:journal:v1'

// Saves the whole Journal as JSON in localStorage.
export function saveJournal(entries: JournalEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage full or blocked (e.g. privacy mode): keep the in-memory
    // Journal rather than crash; it just won't survive a reload.
  }
}

// Loads the saved Journal. Returns [] if nothing is saved, the JSON is
// corrupt, or it isn't a list, so the app always starts in a usable state.
// An entry missing something every entry must have is dropped (and counted in
// the console); entries that only lack newer details are kept. A dropped entry
// is gone for good once the Journal is next saved.
export function loadJournal(): JournalEntry[] {
  try {
    const entriesJSON = localStorage.getItem(STORAGE_KEY)
    if (entriesJSON === null) return []

    const entries: unknown = JSON.parse(entriesJSON)
    return Array.isArray(entries)
      ? keepValid(entries, isJournalEntry, 'Journal entries')
      : []
  } catch {
    return []
  }
}
