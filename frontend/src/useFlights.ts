import { useEffect, useState } from 'react'
import { fetchFlights } from './api'
import type { Flight } from './types'

export const POLL_INTERVAL_MS = 5000

// Polls /flights. `flights` is null until the first response; after that a
// failed poll keeps the last good data and only sets `error`.
export function useFlights() {
  const [flights, setFlights] = useState<Flight[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetchFlights()
        .then((data) => {
          if (cancelled) return
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

  return { flights, error }
}
