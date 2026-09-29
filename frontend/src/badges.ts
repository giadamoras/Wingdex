import { regionsOf } from './attributes'
import { dayKey } from './dates'
import type { JournalEntry } from './types'

// A badge: a name, a description, and a pure test over the whole Journal.
// Unlocked state is always derived, never stored (only which badges the
// player has already seen a popup for is persisted, see badgesSeen.ts).
export interface Badge {
  id: string
  name: string
  description: string
  isUnlocked(journal: JournalEntry[]): boolean
}

export const BADGES: Badge[] = [
  {
    id: 'first-catch',
    name: 'First Catch',
    description: 'Catch your first flight.',
    isUnlocked: (journal) => journal.length > 0,
  },
  {
    id: 'five-types',
    name: 'Plane Spotter',
    description: 'Catch 5 different aircraft types.',
    isUnlocked: (journal) =>
      new Set(journal.map((e) => e.flight.aircraft_type)).size >= 5,
  },
  {
    id: 'three-quest-days',
    name: 'Quest Regular',
    description: 'Complete the daily quest on 3 different days.',
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
    id: 'ocean-crossing',
    name: 'Ocean Crosser',
    description: 'Catch a flight over the open ocean.',
    // Region isn't stored on the entry, so it's recomputed from the flight
    // snapshot's position at catch time.
    isUnlocked: (journal) =>
      journal.some((e) =>
        regionsOf(e.flight.latitude, e.flight.longitude).includes('open-ocean'),
      ),
  },
]

// Ids of every badge currently unlocked, in BADGES order.
export function unlockedBadgeIds(journal: JournalEntry[]): string[] {
  return BADGES.filter((b) => b.isUnlocked(journal)).map((b) => b.id)
}
