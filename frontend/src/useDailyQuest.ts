import { useEffect, useState } from 'react'
import { loadDailyQuest, saveDailyQuest } from './dailyQuest'
import { dayKey } from './dates'
import { pickQuest, QUEST_TEMPLATES, type Quest } from './quest'
import type { Flight, WeatherArea } from './types'

// Today's quest. Picked once per local day from the first feed that can
// satisfy a template, then saved so reloads (and later feeds) keep it.
// Null until the first feed arrives. `weather` is null until the weather has
// loaded (or failed): the pick waits for it, otherwise a weather quest could
// never be chosen just because weather arrived a moment after the flights.
export function useDailyQuest(
  flights: Flight[] | null,
  weather: WeatherArea[] | null,
): Quest | null {
  const [saved, setSaved] = useState(loadDailyQuest)
  const today = dayKey()

  // Saved for today and still a known template (ids can be removed later).
  const current =
    saved?.day === today
      ? (QUEST_TEMPLATES.find((q) => q.id === saved.questId) ?? null)
      : null

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
    if (picked) setSaved({ day: today, questId: picked.id })
  }

  useEffect(() => {
    if (saved) saveDailyQuest(saved)
  }, [saved])

  return current
}
