import { afterEach, expect, test } from 'vitest'
import { loadDailyQuest, QUEST_STORAGE_KEY, saveDailyQuest } from './dailyQuest'

afterEach(() => localStorage.clear())

test('loads what was saved', () => {
  saveDailyQuest({ day: '2026-09-28', questId: 'ocean' })
  expect(loadDailyQuest()).toEqual({ day: '2026-09-28', questId: 'ocean' })
})

test('loads null when nothing is saved', () => {
  expect(loadDailyQuest()).toBeNull()
})

test('loads null for corrupt or wrongly shaped data', () => {
  localStorage.setItem(QUEST_STORAGE_KEY, '{not json')
  expect(loadDailyQuest()).toBeNull()
  localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify({ day: 5 }))
  expect(loadDailyQuest()).toBeNull()
  localStorage.setItem(QUEST_STORAGE_KEY, 'null')
  expect(loadDailyQuest()).toBeNull()
})
