import { BADGES, unlockedBadgeIds } from '../collection/badges'
import {
  questStreak,
  seenAirlines,
  seenCountries,
  seenTypes,
} from '../collection/dex'
import {
  aircraftType,
  AIRCRAFT_FAMILIES,
  AIRCRAFT_TYPES,
} from '../shared-lib/aircraftTypes'
import { timeOfDay } from '../shared-lib/attributes'
import { countryOfAirport } from '../shared-lib/countries'
import { placeWords } from '../shared-lib/places'
import { compassWord } from '../card/taf'
import { GROUPS, groupOf } from '../collection/factGroups'
import { dayKey } from '../shared-lib/dates'
import { hashString } from '../shared-lib/hash'
import type { Quest } from '../quest/quest'
import type { Flight, JournalEntry } from '../data/types'

// What the mascot says, outside onboarding: a reaction to a special catch, a
// welcome on a day with a streak to keep, a hint for an open quest, the
// quest's completion, and a line on top of the Dex, Badges and Facts tabs. Pure functions over the Journal; a line
// with variants picks one by a hash of `seed`, so it never changes between
// renders. null means "say nothing": an ordinary catch gets no comment.

const pickBy = (seed: string, options: string[]) =>
  options[hashString(seed) % options.length]

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

// Catch counts worth a word.
const MILESTONES = [10, 25, 50, 100, 250, 500]

// Gate to gate, the long-haul quest's threshold.
const LONG_HAUL_MIN = 360

// What the first catch of a rare kind of aircraft teaches: an exclamation,
// then the lesson (also added to the badge line when that catch earns one).
const FIRST_OF_CATEGORY: Partial<Record<string, [string, string]>> = {
  glider: [
    'A glider!',
    'It has no engine at all: it climbs on rising warm air, like a soaring bird.',
  ],
  helicopter: [
    'A helicopter!',
    'Its spinning rotor is a wing that goes round instead of forward.',
  ],
  light: [
    'A light aircraft!',
    "This is the kind of plane most pilots learn on, maybe you'll fly one too.",
  ],
  bizJet: [
    'A business jet!',
    'They often cruise higher than airliners, above most of the traffic.',
  ],
}

// Badges this catch unlocks: unlocked with it, not before it.
const newBadges = (entry: JournalEntry, before: JournalEntry[]) =>
  BADGES.filter(
    (b) => !b.isUnlocked(before) && b.isUnlocked([...before, entry]),
  )

// Why a badge was earned, from its description: "Catch a glider." -> "you
// caught a glider". null for a description that doesn't start with a verb
// it knows.
const PAST: Record<string, string> = {
  Catch: 'caught',
  Collect: 'collected',
  Complete: 'completed',
}
function badgeReason(description: string): string | null {
  const [verb, ...rest] = description.replace(/\.$/, '').split(' ')
  return PAST[verb] ? `you ${PAST[verb]} ${rest.join(' ')}` : null
}

// A reaction to a catch, or null when there is nothing special about it.
// `entry` is the new Journal entry, `before` the Journal without it. Only the
// most important thing is said: finishing the quest (with a badge earned by
// the same catch), a new badge (its popup shows too, so the mascot says why),
// then a catch milestone, the first of a rare kind, a new destination
// country, a night catch, a long-haul. A new type or airline alone gets no
// word: early on nearly every catch is one, the cat would never stop, and
// the Dex already records them.
export function catchLine(
  entry: JournalEntry,
  before: JournalEntry[],
): string | null {
  const flight = entry.flight
  const now = new Date(entry.caughtAt)
  const seed = flight.id + entry.caughtAt
  const badges = newBadges(entry, before)

  // Worded unlike the quest strip's own cheer ("Quest complete!").
  if (entry.questId !== undefined)
    return badges.length > 0
      ? `That's today's quest, and the ${badges[0].name} badge too!`
      : pickBy(seed, [
          "Spot on, that's today's quest!",
          'You found it, that one fits the quest!',
          "That's the one: quest done for today!",
        ])
  if (badges.length > 1)
    return `${badges.length} new badges at once: ${badges.map((b) => b.name).join(' and ')}!`
  // The first of a rare kind: its lesson, also when it earns a badge.
  const type = aircraftType(flight.aircraft_type)
  const firstOfCategory =
    type &&
    !before.some(
      (e) => aircraftType(e.flight.aircraft_type)?.category === type.category,
    )
  const lesson = firstOfCategory ? FIRST_OF_CATEGORY[type.category] : undefined

  if (badges.length === 1) {
    const [badge] = badges
    const reason = badgeReason(badge.description)
    const line = reason
      ? `${badge.icon} The ${badge.name} badge is yours: ${reason}.`
      : `${badge.icon} The ${badge.name} badge is yours!`
    return lesson ? `${line} ${lesson[1]}` : line
  }

  const count = before.length + 1
  if (MILESTONES.includes(count))
    return `That's catch number ${count}! Your Journal is filling up nicely.`
  if (lesson) return lesson.join(' ')

  const icao = flight.destination?.icao
  const country = icao ? countryOfAirport(icao) : null
  if (country && !seenCountries(before).has(country))
    return `A new passport stamp: ${country}! That's where this one is headed.`

  if (timeOfDay(flight.longitude, now) === 'night')
    return 'Caught in the dark! At night a plane shows a red light on its left wing and a green one on its right.'
  if (flight.duration_min !== null && flight.duration_min >= LONG_HAUL_MIN)
    return 'A long-haul! On flights this long the crew take turns to rest on board.'
  return null
}

// The player's part of the day, by their own clock.
function greeting(now: Date): string {
  const h = now.getHours()
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 17) return 'Good afternoon'
  if (h >= 17 && h < 22) return 'Good evening'
  return 'Up late'
}

// The first thing said on a new day to a returning player, only when there
// is a streak to keep (the quest strip just above already names the quest):
// a greeting, the streak and the day's quest. null otherwise.
export function welcomeLine(
  quest: Quest | null,
  journal: JournalEntry[],
  now = new Date(),
): string | null {
  const streak = questStreak(journal, now).current
  if (!quest || streak === 0 || questDoneToday(journal, now)) return null
  const keep =
    streak === 1
      ? "You did yesterday's quest, make it two in a row!"
      : `You're on a ${streak}-day streak, keep it going!`
  return `${greeting(now)}, Captain! ${keep} Today: ${lowerFirst(quest.title)}.`
}

// Whether today's quest is already done (the entry that finished it has its id).
const questDoneToday = (journal: JournalEntry[], now: Date) =>
  journal.some(
    (e) =>
      e.questId !== undefined && dayKey(new Date(e.caughtAt)) === dayKey(now),
  )

// A nudge towards the ringed plane that fits an open quest: where to look
// and which way it flies, not its type, since the icons look much alike and
// a ring can hide in a busy area.
export function hintLine(flight: Flight): string {
  const where = placeWords(flight.latitude, flight.longitude)
  const towards = compassWord(flight.heading)
  return `Psst! Look ${where}: the ringed plane heading ${towards} fits today's quest.`
}

// The quest strip's cheer above the concept fact, once the quest is done.
// `journal` includes today's completing catch.
export function questDoneLine(
  journal: JournalEntry[],
  now = new Date(),
): string {
  const streak = questStreak(journal, now).current
  if (streak >= 2) return `Quest complete: ${streak} days in a row!`
  return pickBy(now.toDateString(), [
    'Quest complete!',
    'Quest complete, well spotted!',
    'Nicely done, quest complete!',
  ])
}

// How to learn a fact of a group the player has none of.
const FACT_TIPS: Record<string, string> = {
  Weather: 'Catch a plane inside one of the weather stickers to learn one.',
  Airlines: 'Keep catching airline flights, one will turn up.',
}

// The tabs with a mascot line. The Journal has none: the list says it all.
export type CollectionTab = 'dex' | 'badges' | 'facts'

// Badges earned by reaching a count: how many are needed, the unit, and the
// count so far ("3 more types for Plane Spotter").
const questDays = (journal: JournalEntry[]) =>
  new Set(
    journal
      .filter((e) => e.questId !== undefined)
      .map((e) => dayKey(new Date(e.caughtAt))),
  ).size
const TYPES: [string, string] = ['type', 'types']
const IN_A_ROW: [string, string] = ['day in a row', 'days in a row']
const COUNT_BADGES: Record<
  string,
  { need: number; unit: [string, string]; have: (j: JournalEntry[]) => number }
> = {
  'five-types': { need: 5, unit: TYPES, have: (j) => seenTypes(j).size },
  'twenty-five-types': {
    need: 25,
    unit: TYPES,
    have: (j) => seenTypes(j).size,
  },
  'ten-airlines': {
    need: 10,
    unit: ['airline', 'airlines'],
    have: (j) => seenAirlines(j).size,
  },
  'ten-countries': {
    need: 10,
    unit: ['country stamp', 'country stamps'],
    have: (j) => seenCountries(j).size,
  },
  'three-quest-days': {
    need: 3,
    unit: ['quest day', 'quest days'],
    have: questDays,
  },
  'streak-3': { need: 3, unit: IN_A_ROW, have: (j) => questStreak(j).current },
  'streak-7': { need: 7, unit: IN_A_ROW, have: (j) => questStreak(j).current },
}

// The locked count badge closest to unlocking: its name and what is still
// missing ("2 more types"). null when every count badge is earned.
export function nearestBadge(
  journal: JournalEntry[],
): { name: string; missing: string } | null {
  const unlocked = unlockedBadgeIds(journal)
  let best: { name: string; left: number; unit: [string, string] } | null = null
  for (const badge of BADGES) {
    const count = COUNT_BADGES[badge.id]
    if (!count || unlocked.includes(badge.id)) continue
    const left = Math.max(1, count.need - count.have(journal))
    if (!best || left < best.left)
      best = { name: badge.name, left, unit: count.unit }
  }
  if (!best) return null
  return {
    name: best.name,
    missing:
      best.left === 1
        ? `one more ${best.unit[0]}`
        : `${best.left} more ${best.unit[1]}`,
  }
}

// The aircraft family the player is closest to completing: some caught, at
// most CLOSE_FAMILY types missing, the fewest missing first. null when none.
const CLOSE_FAMILY = 3
export function closestFamily(
  journal: JournalEntry[],
): { name: string; missing: number } | null {
  const seen = seenTypes(journal)
  const byFamily = new Map<string, string[]>()
  for (const [code, type] of Object.entries(AIRCRAFT_TYPES))
    if (type.family)
      byFamily.set(type.family, [...(byFamily.get(type.family) ?? []), code])
  let best: { name: string; missing: number } | null = null
  for (const [family, codes] of byFamily) {
    const caught = codes.filter((c) => seen.has(c)).length
    const missing = codes.length - caught
    if (caught === 0 || missing === 0 || missing > CLOSE_FAMILY) continue
    if (!best || missing < best.missing)
      best = { name: AIRCRAFT_FAMILIES[family].name, missing }
  }
  return best
}

// A line on top of the Dex, Badges and Facts tabs: what the tab is for, and
// a next goal the tab's own counts don't show.
export function collectionLine(
  tab: CollectionTab,
  journal: JournalEntry[],
): string {
  if (tab === 'dex') {
    const close = closestFamily(journal)
    if (close)
      return `So close: ${close.missing === 1 ? 'one more type' : `${close.missing} more types`} and you'll have the whole ${close.name} family!`
    return 'Every new type, airline and country you catch fills in a spot here. The outlines are still out there!'
  }
  if (tab === 'badges') {
    // Before any catch, the first badge; then the nearest count badge; then
    // any badge still locked.
    const unlocked = unlockedBadgeIds(journal)
    const next = BADGES.find((b) => !unlocked.includes(b.id))
    if (!next) return "Every single badge! You've earned your wings."
    const near = journal.length > 0 ? nearestBadge(journal) : null
    if (near) return `Just ${near.missing} for ${near.name}!`
    return `Next up: ${next.name}. ${next.description}`
  }
  if (journal.length === 0)
    return 'Every catch comes with a fact, and they all end up here.'
  // A subject with no fact yet is the goal; weather and airlines have a
  // clear way to get one.
  const have = new Set(journal.map((e) => groupOf(e.fact)))
  const missing = GROUPS.find((g) => !have.has(g.name))
  if (missing)
    return `Nothing under ${missing.name} yet. ${FACT_TIPS[missing.name] ?? 'Keep catching, every plane can teach one.'}`
  return 'Every fact you have learned, sorted by subject. Each catch adds one more.'
}
