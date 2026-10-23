import { expect, test } from 'vitest'
import {
  catchLine,
  closestFamily,
  collectionLine,
  hintLine,
  nearestBadge,
  questDoneLine,
  welcomeLine,
} from './lines'
import type { Quest } from '../quest/quest'
import type { Flight, JournalEntry } from '../data/types'
import { makeFlight } from '../testFlight'

// Local times, since days and greetings are the player's own.
const NOON = new Date(2026, 9, 22, 12)
const daysAgo = (n: number, h = 10) => new Date(2026, 9, 22 - n, h)

const entry = (
  flight: Partial<Flight>,
  caughtAt = daysAgo(1),
  questId?: string,
): JournalEntry => ({
  flight: makeFlight(flight),
  fact: `A fact about ${flight.aircraft_type ?? 'A320'}.`,
  caughtAt: caughtAt.toISOString(),
  questId,
})

const quest: Quest = {
  id: 'cargo',
  title: 'Catch a cargo flight',
  conceptFact: '',
  matches: () => true,
}

const paris = {
  icao: 'LFPG',
  iata: 'CDG',
  name: 'Paris Charles de Gaulle',
  latitude: 49.01,
  longitude: 2.55,
}

// What the mascot says for a catch of `flight` at NOON, after `before`.
const said = (
  flight: Partial<Flight>,
  before: JournalEntry[],
  questId?: string,
  at = NOON,
) => catchLine(entry(flight, at, questId), before)

// Midnight UTC: night over the Channel (50N 0E, the test flight's position)
// whatever the test machine's time zone.
const MIDNIGHT_UTC = new Date(Date.UTC(2026, 9, 22, 0))

test('finishing the quest comes first, with a badge earned at the same time', () => {
  const before = [entry({})]
  expect(said({ id: 'f2' }, before, 'cargo')).toMatch(/quest|that one fits/i)
  // The first catch also earns First Catch: both in one line.
  expect(said({}, [], 'cargo')).toBe(
    "That's today's quest, and the First Catch badge too!",
  )
})

test('a new badge comes before the aircraft, and says why', () => {
  // Night where the plane is earns Night Owl, though the A321 is also a new
  // type.
  expect(
    said({ aircraft_type: 'A321' }, [entry({})], undefined, MIDNIGHT_UTC),
  ).toBe(
    "🦉 The Night Owl badge is yours: you caught a flight where it's night.",
  )
  // The first ever catch.
  expect(said({}, [])).toBe(
    '🎉 The First Catch badge is yours: you caught your first flight.',
  )
})

test('a catch milestone is celebrated', () => {
  const nine = Array.from({ length: 9 }, () => entry({}))
  expect(said({ id: 'f10' }, nine)).toBe(
    "That's catch number 10! Your Journal is filling up nicely.",
  )
})

test('the first of a rare kind of aircraft teaches something', () => {
  const before = [entry({})]
  // Its badge, and the lesson with it.
  expect(said({ aircraft_type: 'GLID' }, before)).toBe(
    '🪂 The Silent Flight badge is yours: you caught a glider. It has no engine at all: it climbs on rising warm air, like a soaring bird.',
  )
  // No badge for a light aircraft: the lesson alone.
  expect(said({ aircraft_type: 'C172' }, before)).toMatch(
    /^A light aircraft! This is the kind of plane most pilots learn on/,
  )
  // Not the second time: then it is only a new type, or nothing.
  const afterGlider = [...before, entry({ aircraft_type: 'GLID' })]
  expect(said({ aircraft_type: 'GLID' }, afterGlider)).toBeNull()
})

test('a new country is noticed; a new type or airline alone is not', () => {
  const before = [entry({})] // an A320, callsign TST1, no destination
  expect(said({ destination: paris }, before)).toBe(
    "A new passport stamp: France! That's where this one is headed.",
  )
  // The Dex records these; early on nearly every catch is one.
  expect(said({ aircraft_type: 'A321' }, before)).toBeNull()
  expect(said({ callsign: 'AFR12' }, before)).toBeNull()
})

test('a night or long-haul catch gets a word; an ordinary one gets none', () => {
  // Night Owl already earned, so a night catch gets the wing lights.
  const before = [
    entry({ destination: paris }),
    entry({ id: 'f0', destination: paris }, MIDNIGHT_UTC),
  ]
  const again = { destination: paris }
  expect(said(again, before, undefined, MIDNIGHT_UTC)).toMatch(
    /^Caught in the dark!/,
  )
  expect(said({ ...again, duration_min: 400 }, before)).toMatch(/^A long-haul!/)
  expect(said(again, before)).toBeNull()
})

test('the welcome speaks only when there is a streak to keep', () => {
  const yesterday = [entry({}, daysAgo(1), 'cargo')]
  expect(welcomeLine(quest, yesterday, daysAgo(0, 9))).toBe(
    "Good morning, Captain! You did yesterday's quest, make it two in a row! Today: catch a cargo flight.",
  )
  const twoDays = [entry({ id: 'f2' }, daysAgo(2), 'cargo'), ...yesterday]
  expect(welcomeLine(quest, twoDays, daysAgo(0, 19))).toMatch(
    /^Good evening, Captain! You're on a 2-day streak, keep it going!/,
  )
  expect(welcomeLine(quest, yesterday, daysAgo(0, 14))).toMatch(
    /^Good afternoon/,
  )
  expect(welcomeLine(quest, yesterday, daysAgo(0, 2))).toMatch(/^Up late/)
  // Nothing to say: no streak, no quest today, or today's already done.
  expect(welcomeLine(quest, [], NOON)).toBeNull()
  expect(welcomeLine(null, yesterday, NOON)).toBeNull()
  const doneToday = [...yesterday, entry({ id: 'f3' }, daysAgo(0, 9), 'cargo')]
  expect(welcomeLine(quest, doneToday, NOON)).toBeNull()
})

test('the hint says where to look and which way the plane flies', () => {
  expect(
    hintLine(makeFlight({ latitude: 42.5, longitude: 12.5, heading: 180 })),
  ).toBe(
    "Psst! Look over Italy: the ringed plane heading south fits today's quest.",
  )
  expect(
    hintLine(makeFlight({ latitude: 45, longitude: -35, heading: 265 })),
  ).toBe(
    "Psst! Look over the North Atlantic: the ringed plane heading west fits today's quest.",
  )
})

test('the quest cheer counts the streak', () => {
  const done = [
    entry({}, daysAgo(1), 'cargo'),
    entry({ id: 'f2' }, daysAgo(0, 11), 'cargo'),
  ]
  expect(questDoneLine(done, NOON)).toBe('Quest complete: 2 days in a row!')
  expect(questDoneLine(done.slice(1), NOON)).toMatch(/^(Quest|Nicely)/)
})

test('the closest family to complete is the one missing the fewest', () => {
  const a330s = ['A332', 'A333', 'A338'].map((t) => entry({ aircraft_type: t }))
  expect(closestFamily(a330s)).toEqual({ name: 'Airbus A330', missing: 1 })
  // Too far from complete (one A320 family type of seven): nothing.
  expect(closestFamily([entry({})])).toBeNull()
})

test('the Dex, Badges and Facts tabs each have a line', () => {
  for (const tab of ['dex', 'badges', 'facts'] as const)
    expect(collectionLine(tab, []).length).toBeGreaterThan(0)
  const a330s = ['A332', 'A333', 'A338'].map((t) => entry({ aircraft_type: t }))
  expect(collectionLine('dex', a330s)).toBe(
    "So close: one more type and you'll have the whole Airbus A330 family!",
  )
  // No fact under a subject yet: that subject is the goal (these test facts
  // are in none of them).
  expect(collectionLine('facts', a330s)).toBe(
    'Nothing under Aircraft yet. Keep catching, every plane can teach one.',
  )
})

test('the Badges line counts down to the nearest badge', () => {
  // Before any catch: the first badge.
  expect(collectionLine('badges', [])).toBe(
    'Next up: First Catch. Catch your first flight.',
  )
  // Three types of five: Plane Spotter is nearest.
  const a330s = ['A332', 'A333', 'A338'].map((t) => entry({ aircraft_type: t }))
  expect(collectionLine('badges', a330s)).toBe(
    'Just 2 more types for Plane Spotter!',
  )
  const four = [...a330s, entry({ aircraft_type: 'A339' })]
  expect(nearestBadge(four)).toEqual({
    name: 'Plane Spotter',
    missing: 'one more type',
  })
})
