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
