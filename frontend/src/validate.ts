import { HAZARDS } from './types'
import type {
  DataSources,
  Flight,
  FlightRoute,
  JournalEntry,
  WeatherArea,
} from './types'

// Checks for data that comes from outside the app (the backend, localStorage).
// A bad row would otherwise crash a render or put a plane at NaN, and one bad
// row among thousands must not take the whole feed down. Each guard checks only
// the fields the code cannot work without; optional and display-only fields are
// not checked, so a row that merely lacks detail is kept. The guards are hand
// written, not a schema library: they run over the whole world feed every 5 s,
// and a library would build a copy of every row on each pass.

type Raw = Record<string, unknown>

const isRecord = (v: unknown): v is Raw =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
export const isString = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v)
// A field typed `X | null`: absent or null is fine, anything else must be an X.
const isNullOr = (check: (v: unknown) => boolean) => (v: unknown) =>
  v === null || v === undefined || check(v)

const isPoint = (v: unknown): boolean =>
  isRecord(v) && isNumber(v.latitude) && isNumber(v.longitude)
const isAirportOrNull = isNullOr(isPoint)
const isStringOrNull = isNullOr(isString)
const isNumberOrNull = isNullOr(isNumber)

// A flight from /flights.
export function isFlight(v: unknown): v is Flight {
  return (
    isRecord(v) &&
    isString(v.id) &&
    isString(v.callsign) &&
    isNumber(v.latitude) &&
    isNumber(v.longitude) &&
    isNumber(v.altitude_ft) &&
    isNumber(v.heading) &&
    isNumber(v.speed_kt) &&
    isStringOrNull(v.aircraft_type) &&
    isNumberOrNull(v.duration_min) &&
    isAirportOrNull(v.origin) &&
    isAirportOrNull(v.destination)
  )
}

// The source names from /health.
export function isDataSources(v: unknown): v is DataSources {
  return isRecord(v) && isString(v.source) && isString(v.weather_source)
}

// The route lookup is display only and every part of it is optional.
export function isFlightRoute(v: unknown): v is FlightRoute {
  return isRecord(v)
}

const HAZARD_SET: ReadonlySet<unknown> = new Set(HAZARDS)

// A weather area from /weather: a known hazard and a ring the map can draw.
export function isWeatherArea(v: unknown): v is WeatherArea {
  return (
    isRecord(v) &&
    isString(v.id) &&
    isString(v.region) &&
    HAZARD_SET.has(v.hazard) &&
    isNumber(v.altitude_min_ft) &&
    isNumber(v.altitude_max_ft) &&
    isNumber(v.valid_from) &&
    isNumber(v.valid_to) &&
    Array.isArray(v.polygon) &&
    v.polygon.length >= 4 &&
    v.polygon.every(isPoint)
  )
}

// A saved Journal entry. Entries from older versions lack some flight details
// (speed, route), so only what every entry always had is required.
export function isJournalEntry(v: unknown): v is JournalEntry {
  return (
    isRecord(v) &&
    isRecord(v.flight) &&
    isString(v.flight.id) &&
    isString(v.flight.callsign) &&
    isNumber(v.flight.latitude) &&
    isNumber(v.flight.longitude) &&
    isString(v.fact) &&
    isString(v.caughtAt) &&
    !Number.isNaN(Date.parse(v.caughtAt)) &&
    (v.questId === undefined || isString(v.questId))
  )
}

// How many were dropped the last time, per kind of data. A feed polled every 5 s
// would repeat the same warning, so it is logged when the count changes.
const lastDropped = new Map<string, number>()

// Keeps the items that pass `guard` and says how many were dropped. Returns the
// same array when every item is fine, which is the usual case.
export function keepValid<T>(
  items: unknown[],
  guard: (v: unknown) => v is T,
  what: string,
): T[] {
  if (items.every(guard)) {
    lastDropped.set(what, 0)
    return items as T[]
  }
  const kept = items.filter(guard)
  const dropped = items.length - kept.length
  if (lastDropped.get(what) !== dropped) {
    console.warn(
      `Dropped ${dropped} of ${items.length} ${what} with an unexpected shape`,
    )
  }
  lastDropped.set(what, dropped)
  return kept
}
