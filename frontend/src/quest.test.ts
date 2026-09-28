import { expect, test } from 'vitest'
import { pickQuest, QUEST_TEMPLATES, type Quest } from './quest'

const flight = {
  id: 'f1',
  callsign: 'TST1',
  aircraft_type: 'A320',
  latitude: 48.5, // over land (near Paris)
  longitude: 2.3,
  altitude_ft: 30000,
  heading: 90,
  speed_kt: 450,
  duration_min: 95,
  origin: null,
  destination: null,
}

const quest = (id: string) => QUEST_TEMPLATES.find((q) => q.id === id)!

test('long-haul does not match exactly 6 hours, but matches just over', () => {
  expect(quest('long-haul').matches({ ...flight, duration_min: 360 })).toBe(
    false,
  )
  expect(quest('long-haul').matches({ ...flight, duration_min: 361 })).toBe(
    true,
  )
})

test('high and low altitude quests exclude their thresholds', () => {
  expect(quest('high').matches({ ...flight, altitude_ft: 36000 })).toBe(false)
  expect(quest('high').matches({ ...flight, altitude_ft: 36001 })).toBe(true)
  expect(quest('low').matches({ ...flight, altitude_ft: 20000 })).toBe(false)
  expect(quest('low').matches({ ...flight, altitude_ft: 19999 })).toBe(true)
})

test('aircraft category quests match by type', () => {
  expect(quest('wide-body').matches({ ...flight, aircraft_type: 'B77W' })).toBe(
    true,
  )
  expect(quest('wide-body').matches(flight)).toBe(false)
  expect(quest('turboprop').matches({ ...flight, aircraft_type: 'AT76' })).toBe(
    true,
  )
  expect(quest('turboprop').matches(flight)).toBe(false)
})

test('the ocean quest needs a position over open water', () => {
  expect(
    quest('ocean').matches({ ...flight, latitude: 50, longitude: -30 }),
  ).toBe(true)
  expect(quest('ocean').matches(flight)).toBe(false)
})

test('the night quest judges the given time at the flight, not the clock', () => {
  const noonUtc = new Date(Date.UTC(2026, 8, 28, 12, 0))
  expect(quest('night').matches({ ...flight, longitude: 0 }, noonUtc)).toBe(
    false,
  )
  expect(quest('night').matches({ ...flight, longitude: 180 }, noonUtc)).toBe(
    true,
  )
})

const always = (id: string): Quest => ({
  id,
  title: id,
  conceptFact: '',
  matches: () => true,
})
const never = (id: string): Quest => ({ ...always(id), matches: () => false })

test('the same day always picks the same quest', () => {
  const templates = [always('a'), always('b'), always('c')]
  expect(pickQuest(templates, [flight], '2026-09-28')?.id).toBe(
    pickQuest(templates, [flight], '2026-09-28')?.id,
  )
})

test('different days pick different quests', () => {
  const templates = [always('a'), always('b'), always('c')]
  const ids = new Set(
    Array.from(
      { length: 30 },
      (_, i) => pickQuest(templates, [flight], `2026-09-${i + 1}`)?.id,
    ),
  )
  expect(ids.size).toBeGreaterThan(1)
})

test('skips quests that no current flight can satisfy', () => {
  const templates = [never('a'), never('b'), always('c')]
  for (let i = 1; i <= 10; i++)
    expect(pickQuest(templates, [flight], `2026-09-${i}`)?.id).toBe('c')
})

test('returns null when nothing can be satisfied', () => {
  expect(pickQuest([never('a')], [flight], '2026-09-28')).toBeNull()
  expect(pickQuest(QUEST_TEMPLATES, [], '2026-09-28')).toBeNull()
})
