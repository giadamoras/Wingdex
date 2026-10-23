import { renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useFeatured } from './useFeatured'
import type { Quest } from './quest'
import type { Flight, JournalEntry } from '../data/types'
import { makeFlight } from '../testFlight'

// One plane each of six rare types, and the quest's planes: two A320s.
const rare = ['B748', 'AT76', 'A388', 'B789', 'E190', 'CRJ9'].map((t, i) =>
  makeFlight({ id: `r${i}`, callsign: `RARE${i}`, aircraft_type: t }),
)
const questers = ['q1', 'q2'].map((id) =>
  makeFlight({ id, callsign: id.toUpperCase(), aircraft_type: 'A320' }),
)
const common = Array.from({ length: 6 }, (_, i) =>
  makeFlight({ id: `c${i}`, callsign: `COM${i}`, aircraft_type: 'A20N' }),
)
const feed = [...rare, ...questers, ...common]

const quest: Quest = {
  id: 'q',
  title: 'Catch a quest plane',
  conceptFact: '',
  matches: (f) => f.id.startsWith('q'),
}

const caughtToday = (flight: Flight): JournalEntry => ({
  flight,
  fact: 'A fact.',
  caughtAt: new Date().toISOString(),
})

function setup() {
  const hook = renderHook(
    ({ flights, catches }) => useFeatured(flights, [], quest, catches),
    { initialProps: { flights: feed, catches: [] as JournalEntry[] } },
  )
  return hook
}

test('picks rare planes to ring and, apart, a plane for the quest', () => {
  const { result } = setup()
  expect(result.current.featuredIds.size).toBe(3)
  expect(
    [...result.current.featuredIds].every((id) => id.startsWith('r')),
  ).toBe(true)
  expect(result.current.questFlightId).toMatch(/^q/)
})

test('a featured plane that leaves the feed is replaced; the others stay', () => {
  const { result, rerender } = setup()
  const [gone, ...stay] = [...result.current.featuredIds]
  rerender({ flights: feed.filter((f) => f.id !== gone), catches: [] })
  const now = [...result.current.featuredIds]
  expect(now).toHaveLength(3)
  expect(now).not.toContain(gone)
  expect(now).toEqual(expect.arrayContaining(stay))
})

test('a featured plane caught today loses its ring and is not replaced', () => {
  const { result, rerender } = setup()
  const [caught] = [...result.current.featuredIds]
  const flight = feed.find((f) => f.id === caught)!
  rerender({ flights: feed, catches: [caughtToday(flight)] })
  expect(result.current.featuredIds.size).toBe(2)
  expect(result.current.featuredIds.has(caught)).toBe(false)
})

test("the quest's plane is picked again when it leaves the feed", () => {
  const { result, rerender } = setup()
  const first = result.current.questFlightId!
  rerender({ flights: feed.filter((f) => f.id !== first), catches: [] })
  expect(result.current.questFlightId).toMatch(/^q/)
  expect(result.current.questFlightId).not.toBe(first)
  // And none left that fits: no hint.
  rerender({
    flights: feed.filter((f) => !f.id.startsWith('q')),
    catches: [],
  })
  expect(result.current.questFlightId).toBeNull()
})
