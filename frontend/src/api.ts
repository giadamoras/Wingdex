import type { DataSources, Flight, FlightRoute, WeatherArea } from './types'
import {
  isDataSources,
  isFlight,
  isFlightRoute,
  isWeatherArea,
  keepValid,
} from './validate'

// Backend base URL; override with VITE_API_URL in a .env file.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// How long a request may take, reading the body included, before it counts as
// failed. A refresh of the live feed can take about 20 s on the backend, so leave
// room above that.
export const REQUEST_TIMEOUT_MS = 30_000

// Runs one request and aborts it after REQUEST_TIMEOUT_MS, or when the caller's
// signal aborts. The two signals are linked by hand: AbortSignal.any() and
// AbortSignal.timeout() need iOS 17.4 or later.
async function withTimeout<T>(
  signal: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  const timer = setTimeout(abort, REQUEST_TIMEOUT_MS)
  if (signal?.aborted) abort()
  signal?.addEventListener('abort', abort)
  try {
    return await run(controller.signal)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export function fetchFlights(signal?: AbortSignal): Promise<Flight[]> {
  return withTimeout(signal, async (s) => {
    const res = await fetch(`${API_URL}/flights`, { signal: s })
    if (!res.ok) throw new Error(`GET /flights failed: ${res.status}`)
    const data: unknown = await res.json()
    // Not a list: the poll fails and the last good flights stay. A bad row is
    // dropped, so one bad plane cannot take the whole feed down.
    if (!Array.isArray(data)) throw new Error('GET /flights: expected a list')
    return keepValid(data, isFlight, 'flights')
  })
}

// The route (and type) of one live flight. null means "nothing known" (404);
// anything else that goes wrong throws, so the caller can tell unknown from down.
export function fetchRoute(
  flightId: string,
  signal?: AbortSignal,
): Promise<FlightRoute | null> {
  return withTimeout(signal, async (s) => {
    const res = await fetch(
      `${API_URL}/flights/${encodeURIComponent(flightId)}/route`,
      { signal: s },
    )
    if (res.status === 404) return null
    if (!res.ok)
      throw new Error(`GET /flights/${flightId}/route failed: ${res.status}`)
    const data: unknown = await res.json()
    if (!isFlightRoute(data)) throw new Error('GET route: expected an object')
    return data
  })
}

export function fetchWeather(signal?: AbortSignal): Promise<WeatherArea[]> {
  return withTimeout(signal, async (s) => {
    const res = await fetch(`${API_URL}/weather`, { signal: s })
    if (!res.ok) throw new Error(`GET /weather failed: ${res.status}`)
    const data: unknown = await res.json()
    if (!Array.isArray(data)) throw new Error('GET /weather: expected a list')
    return keepValid(data, isWeatherArea, 'weather areas')
  })
}

// Which sources the backend uses (mock or live), for the credit line.
export function fetchDataSources(signal?: AbortSignal): Promise<DataSources> {
  return withTimeout(signal, async (s) => {
    const res = await fetch(`${API_URL}/health`, { signal: s })
    if (!res.ok) throw new Error(`GET /health failed: ${res.status}`)
    const data: unknown = await res.json()
    if (!isDataSources(data)) throw new Error('GET /health: unexpected shape')
    return { source: data.source, weather_source: data.weather_source }
  })
}
