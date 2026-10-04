import { useEffect, useState } from 'react'
import { fetchRoute } from './api'
import { needsRoute } from './route'
import type { Flight, FlightRoute } from './types'

// idle: nothing to look up. loading: waiting for the backend. ready: found.
// unknown: the backend knows nothing, or the lookup failed.
export type RouteStatus = 'idle' | 'loading' | 'ready' | 'unknown'

// Looks up the route of the selected flight when it has none (live data). An
// answer ("found" or "nothing known") is kept for the session, so reselecting
// a flight is instant; a failed lookup is not kept, so the next tap tries again.
export function useFlightRoute(flight: Flight | null): {
  status: RouteStatus
  route: FlightRoute | null
} {
  const id = flight && needsRoute(flight) ? flight.id : null
  const [answers, setAnswers] = useState<Record<string, FlightRoute | null>>({})
  const [failedId, setFailedId] = useState<string | null>(null)

  useEffect(() => {
    if (id === null || id in answers) return
    let cancelled = false
    fetchRoute(id)
      .then((route) => {
        if (cancelled) return
        setAnswers((a) => ({ ...a, [id]: route }))
        setFailedId(null)
      })
      .catch(() => {
        if (!cancelled) setFailedId(id)
      })
    return () => {
      cancelled = true
    }
  }, [id, answers])

  if (id === null) return { status: 'idle', route: null }
  if (id in answers) {
    const route = answers[id]
    return { status: route ? 'ready' : 'unknown', route }
  }
  return { status: failedId === id ? 'unknown' : 'loading', route: null }
}
