import type {
  DataSources,
  Flight,
  FlightRoute,
  Taf,
  WeatherArea,
} from './types'
import {
  isDataSources,
  isFlight,
  isFlightRoute,
  isTaf,
  isWeatherArea,
  keepValid,
} from './validate'

// Backend base URL; override with VITE_API_URL in a .env file.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// How long a request may take, reading the body included, before it counts as
// failed. A refresh of the live feed can take 20 s on the backend
// (HTTP_TIMEOUT_S in backend/app/opensky.py), so leave room above that.
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

// GET one path and parse the JSON body. A failed status throws, except a 404
// when `notFound` is "null": then it means "nothing known" and gives null.
async function getJson(
  path: string,
  signal: AbortSignal,
  notFound: 'throw' | 'null' = 'throw',
): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, { signal })
  if (res.status === 404 && notFound === 'null') return null
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json()
}

export function fetchFlights(signal?: AbortSignal): Promise<Flight[]> {
  return withTimeout(signal, async (s) => {
    const data = await getJson('/flights', s)
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
    const path = `/flights/${encodeURIComponent(flightId)}/route`
    const data = await getJson(path, s, 'null')
    if (data === null) return null
    if (!isFlightRoute(data)) throw new Error('GET route: expected an object')
    return data
  })
}

// The callsigns a searched flight ("MU640") may be flying under, for the
// flight search when the feed has no such callsign itself. Empty when nothing
// is known; a failure (the lookup service down) throws.
export function fetchCallsigns(
  query: string,
  signal?: AbortSignal,
): Promise<string[]> {
  return withTimeout(signal, async (s) => {
    const data = await getJson(`/callsigns/${encodeURIComponent(query)}`, s)
    if (!Array.isArray(data) || !data.every((c) => typeof c === 'string'))
      throw new Error('GET callsigns: expected a list of strings')
    return data
  })
}

export function fetchWeather(signal?: AbortSignal): Promise<WeatherArea[]> {
  return withTimeout(signal, async (s) => {
    const data = await getJson('/weather', s)
    if (!Array.isArray(data)) throw new Error('GET /weather: expected a list')
    return keepValid(data, isWeatherArea, 'weather areas')
  })
}

// An airport's forecast (TAF). null means the airport issues none (404);
// anything else that goes wrong throws.
export function fetchTaf(
  icao: string,
  signal?: AbortSignal,
): Promise<Taf | null> {
  return withTimeout(signal, async (s) => {
    const path = `/airports/${encodeURIComponent(icao)}/taf`
    const data = await getJson(path, s, 'null')
    if (data === null) return null
    if (!isTaf(data)) throw new Error('GET taf: unexpected shape')
    return data
  })
}

// Which sources the backend uses (mock or live), for the credit line.
export function fetchDataSources(signal?: AbortSignal): Promise<DataSources> {
  return withTimeout(signal, async (s) => {
    const data = await getJson('/health', s)
    if (!isDataSources(data)) throw new Error('GET /health: unexpected shape')
    return { source: data.source, weather_source: data.weather_source }
  })
}
