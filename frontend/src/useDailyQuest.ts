import { useEffect, useState } from 'react'
import { loadDailyQuest, saveDailyQuest } from './dailyQuest'
import { dayKey, isToday } from './dates'
import { isQuestDone, pickQuest, QUEST_TEMPLATES, type Quest } from './quest'
import type { Flight, JournalEntry, WeatherArea } from './types'

// Today's quest. Picked once per local day from the first feed that can
// satisfy a template, then saved so reloads (and later feeds) keep it.
// Null until the first feed arrives. `weather` is null until the weather has
// loaded (or failed): the pick waits for it, otherwise a weather quest could
// never be chosen just because weather arrived a moment after the flights.
// A saved weather quest that is not done and that no flight can satisfy any
// more (its hazard has gone) is replaced; a done quest is never changed.
export function useDailyQuest(
  flights: Flight[] | null,
  weather: WeatherArea[] | null,
  journal: JournalEntry[],
): Quest | null {
  const [saved, setSaved] = useState(loadDailyQuest)
  const today = dayKey()

  // Saved for today and still a known template (ids can be removed later).
  let current =
    saved?.day === today
      ? (QUEST_TEMPLATES.find((q) => q.id === saved.questId) ?? null)
      : null

  if (current?.id.startsWith('weather-') && flights && weather) {
    const now = new Date()
    const stale =
      !flights.some((f) => current!.matches(f, now, weather)) &&
      !isQuestDone(
        current,
        journal.filter((e) => isToday(e.caughtAt)),
        weather,
      )
    if (stale) current = null
  }

  // No quest yet today: pick one as soon as a feed can satisfy a template.
  // Set during render (like App does for the selected flight) so it shows at once.
  if (!current && flights && weather) {
    const picked = pickQuest(
      QUEST_TEMPLATES,
      flights,
      today,
      new Date(),
      weather,
    )
    if (picked) {
      setSaved({ day: today, questId: picked.id })
      current = picked
    }
  }

  useEffect(() => {
    if (saved) saveDailyQuest(saved)
  }, [saved])

  return current
}
