import {
  aircraftType,
  type AircraftCategory,
} from '../shared-lib/aircraftTypes'
import { regionsOf, timeOfDay } from '../shared-lib/attributes'
import { dayKey } from '../shared-lib/dates'
import { questStreak, seenAirlines, seenCountries, seenTypes } from './dex'
import type { JournalEntry } from '../data/types'

// A badge: a name, a description, and a pure test over the whole Journal.
// Unlocked state is always derived, never stored (only which badges the
// player has already seen a popup for is persisted, see badgesSeen.ts).
export interface Badge {
  id: string
  name: string
  description: string
  icon: string // an emoji, shown once unlocked
  isUnlocked(journal: JournalEntry[]): boolean
}

// The Arctic and Antarctic circles, in degrees of latitude.
const POLAR_CIRCLE_DEG = 66.56

const caughtA = (category: AircraftCategory) => (journal: JournalEntry[]) =>
  journal.some(
    (e) => aircraftType(e.flight.aircraft_type)?.category === category,
  )

export const BADGES: Badge[] = [
  {
    id: 'first-catch',
    name: 'First Catch',
    description: 'Catch your first flight.',
    icon: '🎉',
    isUnlocked: (journal) => journal.length > 0,
  },
  {
    id: 'five-types',
    name: 'Plane Spotter',
    description: 'Catch 5 different aircraft types.',
    icon: '🔭',
    // Catches of a plane with no known type don't count towards a type.
    isUnlocked: (journal) => seenTypes(journal).size >= 5,
  },
  {
    id: 'twenty-five-types',
    name: 'Type Collector',
    description: 'Catch 25 different aircraft types.',
    icon: '📚',
    isUnlocked: (journal) => seenTypes(journal).size >= 25,
  },
  {
    id: 'ten-airlines',
    name: 'Frequent Flyer',
    description: 'Catch flights from 10 different airlines.',
    icon: '🎫',
    isUnlocked: (journal) => seenAirlines(journal).size >= 10,
  },
  {
    id: 'ten-countries',
    name: 'Globetrotter',
    description: 'Collect passport stamps from 10 destination countries.',
    icon: '🛂',
    isUnlocked: (journal) => seenCountries(journal).size >= 10,
  },
  {
    id: 'three-quest-days',
    name: 'Quest Regular',
    description: 'Complete the daily quest on 3 different days.',
    icon: '🗺️',
    // questId is only set on the entry that completed that day's quest
    // (see JournalContext), so each entry here stands for one quest day.
    isUnlocked: (journal) =>
      new Set(
        journal
          .filter((e) => e.questId !== undefined)
          .map((e) => dayKey(new Date(e.caughtAt))),
      ).size >= 3,
  },
  {
    id: 'streak-3',
    name: 'On a Roll',
    description: 'Complete the daily quest 3 days in a row.',
    icon: '🔥',
    // The best streak, so the badge stays once the streak breaks.
    isUnlocked: (journal) => questStreak(journal).best >= 3,
  },
  {
    id: 'streak-7',
    name: 'Week Without Fail',
    description: 'Complete the daily quest 7 days in a row.',
    icon: '📅',
    isUnlocked: (journal) => questStreak(journal).best >= 7,
  },
  {
    id: 'ocean-crossing',
    name: 'Ocean Crosser',
    description: 'Catch a flight over the open ocean.',
    icon: '🌊',
    // Region isn't stored on the entry, so it's recomputed from the flight
    // snapshot's position at catch time.
    isUnlocked: (journal) =>
      journal.some((e) =>
        regionsOf(e.flight.latitude, e.flight.longitude).includes('open-ocean'),
      ),
  },
  {
    id: 'polar',
    name: 'Polar Explorer',
    description: 'Catch a flight inside the Arctic or Antarctic Circle.',
    icon: '❄️',
    isUnlocked: (journal) =>
      journal.some((e) => Math.abs(e.flight.latitude) >= POLAR_CIRCLE_DEG),
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: "Catch a flight where it's night.",
    icon: '🦉',
    // Night where the plane was at catch time, as the night quests judge it.
    isUnlocked: (journal) =>
      journal.some(
        (e) => timeOfDay(e.flight.longitude, new Date(e.caughtAt)) === 'night',
      ),
  },
  {
    id: 'storm-chaser',
    name: 'Storm Chaser',
    description: 'Catch a flight inside a thunderstorm area.',
    icon: '⛈️',
    // Entries from before hazards were saved still count through the
    // thunderstorm quest they completed.
    isUnlocked: (journal) =>
      journal.some(
        (e) =>
          e.hazards?.includes('thunderstorm') ||
          e.questId === 'weather-thunderstorm',
      ),
  },
  {
    id: 'four-engines',
    name: 'Four of a Kind',
    description: 'Catch a four-engine jet.',
    icon: '🃏',
    isUnlocked: (journal) =>
      journal.some((e) => aircraftType(e.flight.aircraft_type)?.engines === 4),
  },
  {
    id: 'helicopter',
    name: 'Rotor Spotter',
    description: 'Catch a helicopter.',
    icon: '🚁',
    isUnlocked: caughtA('helicopter'),
  },
  {
    id: 'biz-jet',
    name: 'Jet Set',
    description: 'Catch a business jet.',
    icon: '💼',
    isUnlocked: caughtA('bizJet'),
  },
  {
    id: 'glider',
    name: 'Silent Flight',
    description: 'Catch a glider.',
    icon: '🪂',
    isUnlocked: caughtA('glider'),
  },
]

// Ids of every badge currently unlocked, in BADGES order.
export function unlockedBadgeIds(journal: JournalEntry[]): string[] {
  return BADGES.filter((b) => b.isUnlocked(journal)).map((b) => b.id)
}
