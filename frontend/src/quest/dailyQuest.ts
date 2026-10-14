// Which quest was picked for which local day. Only the choice is stored, never
// whether it is done: completion is derived from today's Journal entries.
export interface SavedQuest {
  day: string // local day, see dayKey, e.g. "2026-09-28"
  questId: string
}

// Versioned key, same idea as the Journal's.
// Keeps the app's old name on purpose: a new key would lose saved progress.
export const QUEST_STORAGE_KEY = 'airspace-explorer:quest:v1'

export function saveDailyQuest(saved: SavedQuest) {
  try {
    localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(saved))
  } catch {
    // Storage full or blocked: keep the pick in memory, it just won't survive a reload.
  }
}

// Loads the saved pick, or null if nothing valid is saved.
export function loadDailyQuest(): SavedQuest | null {
  try {
    const json = localStorage.getItem(QUEST_STORAGE_KEY)
    if (json === null) return null
    const saved = JSON.parse(json)
    return typeof saved?.day === 'string' && typeof saved?.questId === 'string'
      ? { day: saved.day, questId: saved.questId }
      : null
  } catch {
    return null
  }
}
