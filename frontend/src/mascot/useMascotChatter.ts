import { useCallback, useEffect, useRef, useState } from 'react'
import { hasSeenOnboarding } from '../onboarding/onboardingSeen'
import { dayKey } from '../shared-lib/dates'
import { hintLine, welcomeLine } from './lines'
import type { DockLine } from './MascotDock'
import type { Quest } from '../quest/quest'
import type { Flight, JournalEntry } from '../data/types'

// How long each kind of line stays up before the mascot goes quiet again.
export const SAY_MS = 8000 // a catch reaction
export const WELCOME_MS = 10_000
export const HINT_MS = 20_000
// How long the quest must stay open on the map before the hint.
export const HINT_AFTER_MS = 2 * 60 * 1000

// The day the welcome was last said. Keeps the app's old name, like the
// other keys.
const WELCOME_KEY = 'airspace-explorer:mascot-welcome:v1'

function welcomedToday(): boolean {
  try {
    return localStorage.getItem(WELCOME_KEY) === dayKey()
  } catch {
    return false
  }
}

// Also used by tests, to start as if the welcome was already said today.
export function markWelcomed() {
  try {
    localStorage.setItem(WELCOME_KEY, dayKey())
  } catch {
    // Storage blocked: the welcome may just come again on a reload.
  }
}

// A line with how long it stays, and the plane it points at, if any (the
// map rings that plane like onboarding's target while the line shows).
type Said = DockLine & { ms: number; pointsAt?: string }

// What the docked mascot says on the map once onboarding is over, one line
// at a time, each going away by itself (or with its ×):
// - a welcome, once per local day, for a player who has done onboarding
//   before (a first-time player just had it), when there is a streak to keep;
// - a hint pointing at the ringed plane that fits the quest, once per
//   session, when the quest is still open after HINT_AFTER_MS;
// - whatever `say` is given (App's catch reactions).
// `enabled` is false during onboarding and off the map. `ready` is true once
// the feed and weather have loaded, so the quest is settled.
export function useMascotChatter({
  enabled,
  ready,
  quest,
  questDone,
  hintFlight,
  journal,
  onShowHint,
}: {
  enabled: boolean
  ready: boolean
  quest: Quest | null
  questDone: boolean
  hintFlight: Flight | null // the featured flight that fits the quest
  journal: JournalEntry[]
  onShowHint: (id: string) => void
}) {
  const [said, setSaid] = useState<Said | null>(null)
  const counter = useRef(0)
  // Read at mount, before onboarding marks itself seen on this visit.
  const [returning] = useState(hasSeenOnboarding)
  const hinted = useRef(false)
  // The latest values, for the timers below without restarting them.
  const latest = useRef({ quest, journal, hintFlight, onShowHint })
  useEffect(() => {
    latest.current = { quest, journal, hintFlight, onShowHint }
  })

  const say = useCallback(
    (
      text: string,
      ms = SAY_MS,
      action?: DockLine['action'],
      pointsAt?: string,
    ) => {
      counter.current++
      setSaid({ key: String(counter.current), text, ms, action, pointsAt })
    },
    [],
  )
  const dismiss = useCallback(() => setSaid(null), [])

  // Each line goes away by itself after its time.
  useEffect(() => {
    if (!said) return
    const timer = setTimeout(() => setSaid(null), said.ms)
    return () => clearTimeout(timer)
  }, [said])

  // The welcome, once the quest is settled.
  useEffect(() => {
    if (!enabled || !ready || !returning || welcomedToday()) return
    markWelcomed() // checked once a day, even when there is nothing to say
    const { quest, journal } = latest.current
    const line = welcomeLine(quest, journal)
    if (line) say(line, WELCOME_MS)
  }, [enabled, ready, returning, say])

  // The hint, after the quest has been open a while.
  const hintId = hintFlight?.id ?? null
  useEffect(() => {
    if (!enabled || questDone || hintId === null || hinted.current) return
    const timer = setTimeout(() => {
      const { hintFlight, onShowHint } = latest.current
      if (!hintFlight) return
      hinted.current = true
      say(
        hintLine(hintFlight),
        HINT_MS,
        {
          label: 'Show me',
          onClick: () => {
            setSaid(null)
            onShowHint(hintFlight.id)
          },
        },
        hintFlight.id,
      )
    }, HINT_AFTER_MS)
    return () => clearTimeout(timer)
  }, [enabled, questDone, hintId, say])

  const line = enabled ? said : null
  // The plane the line points at, for the map's target ring.
  return { line, pointingAt: line?.pointsAt ?? null, say, dismiss }
}
