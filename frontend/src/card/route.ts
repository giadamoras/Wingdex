import { angularDistance } from '../map/geo'
import { formatDuration } from '../shared-lib/format'
import type { Flight, FlightRoute } from '../data/types'

// A flight with what a lookup found filled in. Anything the lookup doesn't
// know keeps the flight's own value, so a type-only answer adds just the type.
export function mergeRoute(flight: Flight, route: FlightRoute | null): Flight {
  if (!route) return flight
  return {
    ...flight,
    aircraft_type: flight.aircraft_type ?? route.aircraft_type,
    origin: route.origin ?? flight.origin,
    destination: route.destination ?? flight.destination,
    duration_min: route.duration_min ?? flight.duration_min,
    duration_estimated: route.duration_min
      ? route.duration_estimated
      : flight.duration_estimated,
  }
}

// A flight that already has its route (the mock's) needs no lookup.
export function needsRoute(flight: Flight): boolean {
  return flight.origin === null || flight.destination === null
}

const EARTH_RADIUS_NM = 3440.065
const MIN_SPEED_KT = 60 // slower than this (taxiing, a hovering helicopter): no estimate

// When the plane should land, in Unix seconds: the remaining great-circle
// distance at its current ground speed. Rough (no approach, no holding, no wind
// change), so it tends to run a little short. null without a destination or
// speed. Used by the card's progress line and the forecast's landing time.
export function arrivalTime(flight: Flight, now = Date.now()): number | null {
  if (!flight.destination || flight.speed_kt < MIN_SPEED_KT) return null
  const nm = angularDistance(flight, flight.destination) * EARTH_RADIUS_NM
  return Math.round(now / 1000 + (nm / flight.speed_kt) * 3600)
}

// Below this many minutes left, a number would look more precise than it is.
const LANDING_SOON_MIN = 5

// The time left, under the card's progress line: "About 1h 20m",
// "Landing soon", or null when there is no estimate.
export function timeLeftWords(flight: Flight, now = Date.now()): string | null {
  const arrival = arrivalTime(flight, now)
  if (arrival === null) return null
  const minutes = Math.round((arrival - now / 1000) / 60)
  if (minutes < LANDING_SOON_MIN) return 'Landing soon'
  return `About ${formatDuration(minutes)}`
}

// How far along its route the plane is, as the share flown (0 to 1) of the
// great-circle distance. Measured from both ends, so a plane off the straight
// line (a live one routing around weather) still sits sensibly. null unless
// both ends are known.
export function journeyProgress(flight: Flight): number | null {
  if (!flight.origin || !flight.destination) return null
  const flown = angularDistance(flight.origin, flight)
  const total = flown + angularDistance(flight, flight.destination)
  return total > 0 ? flown / total : 0
}
