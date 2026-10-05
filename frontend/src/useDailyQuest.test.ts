import { renderHook } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { dayKey } from './dates'
import { saveDailyQuest } from './dailyQuest'
import { QUEST_TEMPLATES } from './quest'
import type { Flight, JournalEntry, WeatherArea } from './types'
import { useDailyQuest } from './useDailyQuest'

// A high-flying plane (matches the 'high' quest), with no weather over it.
const flight: Flight = {
  id: 'f1',
  callsign: 'TST1',
  aircraft_type: 'A320',
  latitude: 48.5,
  longitude: 2.3,
  altitude_ft: 40000,
  heading: 90,
  speed_kt: 450,
  duration_min: 95,
  origin: null,
  destination: null,
}
const noWeather: WeatherArea[] = []

beforeEach(() => localStorage.clear())

test('a saved weather quest is replaced once its hazard is gone', () => {
  saveDailyQuest({ day: dayKey(), questId: 'weather-icing' })
  const { result } = renderHook(() => useDailyQuest([flight], noWeather, []))
  expect(result.current?.id).not.toBe('weather-icing')
  expect(result.current).not.toBeNull()
})

test('a done weather quest is kept after its hazard is gone', () => {
  saveDailyQuest({ day: dayKey(), questId: 'weather-icing' })
  const entry: JournalEntry = {
    flight,
    fact: '',
    caughtAt: new Date().toISOString(),
    questId: 'weather-icing',
  }
  const { result } = renderHook(() =>
    useDailyQuest([flight], noWeather, [entry]),
  )
  expect(result.current?.id).toBe('weather-icing')
})

test('a saved non-weather quest is kept', () => {
  const id = QUEST_TEMPLATES.find((q) => !q.id.startsWith('weather-'))!.id
  saveDailyQuest({ day: dayKey(), questId: id })
  const { result } = renderHook(() => useDailyQuest([flight], noWeather, []))
  expect(result.current?.id).toBe(id)
})
