import type { Flight } from './types'

// The single hardcoded quest for Milestone 1. The parameterized quest-template
// system (see docs/plan.md) replaces this in a later milestone.
export const QUEST = {
  title: 'Catch a long-haul flight (over 6 hours)',
  // Concept-level fact shown when the quest is completed.
  conceptFact:
    "Long flights often look curved on a flat map, but they're taking the shortest path. On a globe, the shortest route between two cities is a 'great circle', which bends toward the poles. That's why flights from Europe to North America pass near Iceland and Greenland.",
  // True if a caught flight completes the quest (360 min = 6 hours).
  matches(flight: Flight) {
    return flight.duration_min > 360
  },
}
