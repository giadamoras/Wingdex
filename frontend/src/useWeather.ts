import { useEffect, useState } from 'react'
import { fetchWeather } from './api'
import type { WeatherArea } from './types'

// Weather changes slowly, so poll far less often than flights.
export const WEATHER_POLL_MS = 5 * 60 * 1000

// Polls /weather. Null until the first request settles, so the daily quest can
// wait for weather before it is picked. A failed request settles to an empty
// list (and later failures keep the last good data): weather is decoration and
// quest flavour, so a failure must never get in the way of the flight map.
export function useWeather(): WeatherArea[] | null {
  const [areas, setAreas] = useState<WeatherArea[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetchWeather()
        .then((data) => {
          if (!cancelled) setAreas(data)
        })
        .catch(() => {
          if (!cancelled) setAreas((prev) => prev ?? [])
        })

    load()
    const id = setInterval(load, WEATHER_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return areas
}
