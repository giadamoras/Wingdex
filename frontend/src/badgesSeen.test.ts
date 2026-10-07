import { afterEach, expect, test, vi } from 'vitest'
import { BADGES_SEEN_KEY, loadSeenBadges, saveSeenBadges } from './badgesSeen'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

test('loads back what was saved', () => {
  saveSeenBadges(['first-catch', 'five-types'])
  expect(loadSeenBadges()).toEqual(['first-catch', 'five-types'])
})

test('returns an empty list when nothing is saved, or the data is unusable', () => {
  expect(loadSeenBadges()).toEqual([])
  localStorage.setItem(BADGES_SEEN_KEY, 'not json')
  expect(loadSeenBadges()).toEqual([])
  localStorage.setItem(BADGES_SEEN_KEY, '{"a":1}')
  expect(loadSeenBadges()).toEqual([])
})

test('drops anything in the list that is not an id', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  localStorage.setItem(
    BADGES_SEEN_KEY,
    JSON.stringify(['first-catch', 7, null, { id: 'x' }]),
  )
  expect(loadSeenBadges()).toEqual(['first-catch'])
  expect(warn).toHaveBeenCalledWith(
    'Dropped 3 of 4 seen badge ids with an unexpected shape',
  )
})
