import { useEffect, useRef, useState } from 'react'
import { fetchFlights } from './api'
import { jumpedFlightIds } from './motion'
import type { Flight } from './types'

export const POLL_INTERVAL_MS = 5000

// Polls /flights. `flights` is null until the first response; after that a
// failed poll keeps the last good data and only sets `error`. `jumped` holds
// the ids of flights that moved implausibly far since the previous response.
export function useFlights() {
  const [flights, setFlights] = useState<Flight[] | null>(null)
  const [jumped, setJumped] = useState<Set<string>>(new Set())
  const [error, setError] = useState(false)
  // Previous good response and when it arrived, to measure each move.
  const last = useRef<{ flights: Flight[]; at: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetchFlights()
        .then((data) => {
          if (cancelled) return
          const now = Date.now()
          const prev = last.current
          setJumped(
            prev
              ? jumpedFlightIds(prev.flights, data, (now - prev.at) / 1000)
              : new Set(),
          )
          last.current = { flights: data, at: now }
          setFlights(data)
          setError(false)
        })
        .catch(() => {
          if (!cancelled) setError(true)
        })

    load()
    const id = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return { flights, jumped, error }
}
