import { useEffect, useState } from 'react'
import { fetchRoute } from '../data/api'
import { needsRoute } from './route'
import type { Flight, FlightRoute } from '../data/types'

// idle: nothing to look up. loading: waiting for the backend. ready: found.
// unknown: the backend knows nothing, or the lookup failed.
export type RouteStatus = 'idle' | 'loading' | 'ready' | 'unknown'

// How long an answer is reused. The backend keeps its own, longer memory, so
// asking again after this is cheap. It also lets "unknown" and routes of planes
// that have since flown another leg be looked up again.
export const ROUTE_TTL_MS = 30 * 60 * 1000

// How long a plane has to stay selected before it is looked up.
export const ROUTE_LOOKUP_DELAY_MS = 250

type Answer = { route: FlightRoute | null; at: number }

// An old answer is looked up again, and replaced when the new one arrives.
const isFresh = (answer: Answer | undefined): answer is Answer =>
  answer !== undefined && Date.now() - answer.at < ROUTE_TTL_MS

// Looks up the route of the selected flight when it has none (live data). An
// answer ("found" or "nothing known") is reused for ROUTE_TTL_MS, so reselecting
// a flight is instant. An old answer is still shown while a new lookup runs in
// the background. A failed lookup is not kept, so the next tap tries again, and
// leaving the flight cancels a lookup in progress.
export function useFlightRoute(flight: Flight | null): {
  status: RouteStatus
  route: FlightRoute | null
} {
  const id = flight && needsRoute(flight) ? flight.id : null
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [failedId, setFailedId] = useState<string | null>(null)

  useEffect(() => {
    if (id === null) return
    if (isFresh(answers[id])) return
    const controller = new AbortController()
    let cancelled = false
    // Wait a moment first: when taps come in quick succession, only the plane
    // you stop on is looked up.
    const timer = setTimeout(() => {
      fetchRoute(id, controller.signal)
        .then((route) => {
          if (cancelled) return
          setAnswers((a) => ({ ...a, [id]: { route, at: Date.now() } }))
        })
        .catch(() => {
          if (!cancelled) setFailedId(id)
        })
    }, ROUTE_LOOKUP_DELAY_MS)
    return () => {
      clearTimeout(timer)
      cancelled = true
      controller.abort()
      setFailedId(null) // the next attempt shows "loading", not this failure
    }
  }, [id, answers])

  if (id === null) return { status: 'idle', route: null }
  const answer = answers[id]
  if (answer) {
    return { status: answer.route ? 'ready' : 'unknown', route: answer.route }
  }
  return { status: failedId === id ? 'unknown' : 'loading', route: null }
}
