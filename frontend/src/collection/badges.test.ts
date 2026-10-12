import { expect, test } from 'vitest'
import { unlockedBadgeIds } from './badges'
import type { Flight, JournalEntry } from '../data/types'

const baseFlight: Flight = {
  id: 'f1',
  callsign: 'TST1',
  aircraft_type: 'A320',
  latitude: 50,
  longitude: 0,
  altitude_ft: 36000,
  heading: 90,
  speed_kt: 450,
  duration_min: 95,
  origin: null,
  destination: null,
}

const entry = (over: Partial<JournalEntry> = {}): JournalEntry => ({
  flight: baseFlight,
  fact: 'A test fact.',
  caughtAt: '2026-09-25T12:00:00.000Z',
  ...over,
})

test('no badges unlock for an empty Journal', () => {
  expect(unlockedBadgeIds([])).toEqual([])
})

test('first-catch unlocks on the first entry', () => {
  expect(unlockedBadgeIds([entry()])).toContain('first-catch')
})

test('five-types needs 5 distinct aircraft types, not 5 catches', () => {
  const sameType = [entry(), entry(), entry(), entry(), entry()]
  expect(unlockedBadgeIds(sameType)).not.toContain('five-types')

  const fiveTypes = ['A320', 'B738', 'A333', 'B744', 'E190'].map((type) =>
    entry({ flight: { ...baseFlight, aircraft_type: type } }),
  )
  expect(unlockedBadgeIds(fiveTypes)).toContain('five-types')
})

test('five-types does not count catches of a plane with no known type', () => {
  const types = ['A320', 'B738', 'A333', 'B744'].map((type) =>
    entry({ flight: { ...baseFlight, aircraft_type: type } }),
  )
  const unknown = [1, 2, 3].map((n) =>
    entry({ flight: { ...baseFlight, id: `u${n}`, aircraft_type: null } }),
  )
  expect(unlockedBadgeIds([...types, ...unknown])).not.toContain('five-types')
})

test('three-quest-days ignores catches that did not complete a quest', () => {
  const noQuest = [1, 2, 3].map((day) =>
    entry({ caughtAt: `2026-09-2${day}T12:00:00.000Z` }),
  )
  expect(unlockedBadgeIds(noQuest)).not.toContain('three-quest-days')
})

test('three-quest-days needs 3 different days, not 3 completions', () => {
  const sameDay = [
    entry({ questId: 'high', caughtAt: '2026-09-25T10:00:00.000Z' }),
    entry({ questId: 'ocean', caughtAt: '2026-09-25T14:00:00.000Z' }),
    entry({ questId: 'night', caughtAt: '2026-09-25T22:00:00.000Z' }),
  ]
  expect(unlockedBadgeIds(sameDay)).not.toContain('three-quest-days')

  const threeDays = [21, 22, 23].map((day) =>
    entry({ questId: 'high', caughtAt: `2026-09-${day}T12:00:00.000Z` }),
  )
  expect(unlockedBadgeIds(threeDays)).toContain('three-quest-days')
})

test('ocean-crossing needs a catch actually over open ocean', () => {
  const overLand = entry({
    flight: { ...baseFlight, latitude: 50, longitude: 0 },
  })
  expect(unlockedBadgeIds([overLand])).not.toContain('ocean-crossing')

  // Mid North Atlantic, far from any coast.
  const overOcean = entry({
    flight: { ...baseFlight, latitude: 45, longitude: -40 },
  })
  expect(unlockedBadgeIds([overOcean])).toContain('ocean-crossing')
})
