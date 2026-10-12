import { useEffect, useState } from 'react'
import { fetchWeather } from './api'
import type { WeatherArea } from './types'

// Weather changes slowly, so poll far less often than flights.
export const WEATHER_POLL_MS = 5 * 60 * 1000
// After a failed request, ask again after this long; each further failure doubles
// the wait, up to the normal poll pace.
export const WEATHER_RETRY_MS = 30_000

// Polls /weather. Null until the first request settles, so the daily quest can
// wait for weather before it is picked. A failed request settles to an empty
// list (and later failures keep the last good data, minus areas that have
// expired meanwhile): weather is decoration and quest flavour, so a failure must
// never get in the way of the flight map, and it is retried quietly.
export function useWeather(): WeatherArea[] | null {
  const [areas, setAreas] = useState<WeatherArea[] | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0 // consecutive failed requests

    // Chained after each request settles, so two requests never overlap.
    const schedule = (ms: number) => {
      timer = setTimeout(load, ms)
    }
    const load = () => {
      fetchWeather(controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return
          failures = 0
          setAreas(data)
          schedule(WEATHER_POLL_MS)
        })
        .catch(() => {
          if (controller.signal.aborted) return
          failures++
          const nowSeconds = Date.now() / 1000
          setAreas((prev) => {
            const kept = (prev ?? []).filter((a) => a.valid_to >= nowSeconds)
            // Same list when nothing expired, so the map is not redrawn for nothing.
            return prev && kept.length === prev.length ? prev : kept
          })
          schedule(
            Math.min(WEATHER_RETRY_MS * 2 ** (failures - 1), WEATHER_POLL_MS),
          )
        })
    }

    load()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [])

  return areas
}
