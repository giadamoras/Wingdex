import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFlights } from './api'
import { jumpedFlightIds } from './motion'
import type { Flight } from './types'

export const POLL_INTERVAL_MS = 5000
// After this many failed polls in a row the feed counts as stalled: the screen
// asks for a manual retry instead of only saying "retrying".
export const STALLED_AFTER = 3
// The most poll ticks skipped between retries (5 ticks = a retry every 30 s).
const MAX_SKIPPED_TICKS = 5
// `retrying` stays on at least this long, so a retry that fails at once (offline)
// still visibly "tried" instead of flashing back to the error.
export const RETRY_FEEDBACK_MS = 800

// Polls /flights. `flights` is null until the first response; after that a
// failed poll keeps the last good data and only sets `error`. `jumped` holds
// the ids of flights that moved implausibly far since the previous response,
// and `departed` their previous positions, so the map can fade them out.
// While polls keep failing, retries back off (every 10 s, 20 s, then 30 s) so a
// struggling backend is not hammered; `stalled` is set after STALLED_AFTER
// failures in a row. `retry` asks again at once, and `retrying` is on while
// that request is out.
export function useFlights() {
  const [flights, setFlights] = useState<Flight[] | null>(null)
  const [jumped, setJumped] = useState<Set<string>>(new Set())
  const [departed, setDeparted] = useState<Flight[]>([])
  const [failures, setFailures] = useState(0) // consecutive failed polls
  const [retrying, setRetrying] = useState(false)
  // Previous good response and when it arrived, to measure each move.
  const last = useRef<{ flights: Flight[]; at: number } | null>(null)
  // The effect below owns the request state; this lets the component reach retry.
  const retryNow = useRef(() => {})

  useEffect(() => {
    let pending: AbortController | null = null // the request in flight, if any
    let failureCount = 0
    let skipTicks = 0 // poll ticks to let pass before the next attempt
    let retryStartedAt = 0
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const request = (fromRetry = false) => {
      const controller = new AbortController()
      pending = controller
      fetchFlights(controller.signal)
        .then((data) => {
          // Aborted (unmount, or replaced by a retry): ignore the result.
          if (controller.signal.aborted) return
          const now = Date.now()
          const prev = last.current
          const jumps = prev
            ? jumpedFlightIds(prev.flights, data, (now - prev.at) / 1000)
            : new Set<string>()
          setJumped(jumps)
          setDeparted(prev ? prev.flights.filter((f) => jumps.has(f.id)) : [])
          last.current = { flights: data, at: now }
          setFlights(data)
          failureCount = 0
          skipTicks = 0
          setFailures(0)
        })
        .catch(() => {
          if (controller.signal.aborted) return
          failureCount++
          // 1 failure: skip 1 tick, 2: skip 3, then the cap.
          skipTicks = Math.min(2 ** failureCount - 1, MAX_SKIPPED_TICKS)
          setFailures(failureCount)
        })
        .finally(() => {
          if (pending === controller) pending = null
          if (fromRetry && !controller.signal.aborted) {
            const shown = Date.now() - retryStartedAt
            retryTimer = setTimeout(
              () => setRetrying(false),
              Math.max(0, RETRY_FEEDBACK_MS - shown),
            )
          }
        })
    }

    const tick = () => {
      // The feed can be several MB on a slow connection. Skip this tick while the
      // previous request is pending, so an old response never lands after a new one.
      if (pending) return
      if (skipTicks > 0) {
        skipTicks--
        return
      }
      request()
    }

    retryNow.current = () => {
      pending?.abort() // a hung request must not make the button do nothing
      clearTimeout(retryTimer)
      skipTicks = 0
      retryStartedAt = Date.now()
      setRetrying(true)
      request(true)
    }

    request()
    const id = setInterval(tick, POLL_INTERVAL_MS)
    return () => {
      pending?.abort() // cancels the request and makes its handlers ignore it
      clearTimeout(retryTimer)
      clearInterval(id)
    }
  }, [])

  const retry = useCallback(() => retryNow.current(), [])
  return {
    flights,
    jumped,
    departed,
    error: failures > 0,
    stalled: failures >= STALLED_AFTER,
    retrying,
    retry,
  }
}
