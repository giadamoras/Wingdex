// Mirrors the backend Airport model.
export interface Airport {
  icao: string // four-letter code pilots use, e.g. "EGLL"
  iata: string // three-letter code passengers see, e.g. "LHR"
  name: string
  latitude: number // degrees
  longitude: number // degrees
  // Only a live route lookup knows these.
  city?: string | null
  country?: string | null
}

// Mirrors the backend Flight model (GET /flights).
export interface Flight {
  id: string
  callsign: string
  // ICAO type code, e.g. "A320". null when unknown: a live plane missing from
  // the backend's type database.
  aircraft_type: string | null
  latitude: number // degrees
  longitude: number // degrees
  altitude_ft: number
  heading: number // degrees clockwise from north
  speed_kt: number // ground speed, knots
  duration_min: number | null // null when unknown (live flights have no route yet)
  // True when worked out from the route, not scheduled. Missing in entries
  // saved before live data, where it means false.
  duration_estimated?: boolean
  // null when the data source doesn't know the route (e.g. live feeds).
  origin: Airport | null
  destination: Airport | null
  // Live feed only: feet per minute (+ climbing, - descending) and the country
  // the plane is registered in. Missing for the mock and in older Journal entries.
  vertical_rate_fpm?: number | null
  registered_country?: string | null
}

// Mirrors the backend FlightRoute model (GET /flights/{id}/route): what a
// lookup learned about one flight. Every part can be missing on its own.
export interface FlightRoute {
  aircraft_type: string | null
  origin: Airport | null
  destination: Airport | null
  duration_min: number | null
  duration_estimated: boolean
  // Extra detail for the card, shown as text; never used for gameplay.
  airline?: string | null
  airline_country?: string | null
  registration?: string | null // the tail number
  manufacturer?: string | null
  model?: string | null
  operator?: string | null // the registered owner, who may not be the airline
}

export interface JournalEntry {
  // Snapshot at catch time. Entries saved before Milestone 2 lack speed_kt,
  // origin and destination, so the Journal must not rely on those fields.
  flight: Flight
  fact: string
  caughtAt: string // ISO timestamp, e.g. "2026-09-25T14:03:00.000Z"
  // Set only when this catch completed that day's quest (entries saved
  // before Milestone 4 lack it, same as speed_kt above).
  questId?: string
  // The weather hazards the plane was in at catch time; missing when none, and
  // in entries saved before the Dex (badges then fall back on questId).
  hazards?: Hazard[]
}

export interface LatLon {
  latitude: number // degrees
  longitude: number // degrees
}

// A list as well as a type, so incoming weather can be checked at runtime.
export const HAZARDS = [
  'thunderstorm',
  'turbulence',
  'mountain_wave',
  'icing',
  'volcanic_ash',
  'tropical_cyclone',
] as const
export type Hazard = (typeof HAZARDS)[number]

// Mirrors the backend WeatherArea model (GET /weather): a hazard area with an
// altitude band and a closed polygon.
export interface WeatherArea {
  id: string
  hazard: Hazard
  region: string // airspace it was issued for, e.g. "North Atlantic"
  altitude_min_ft: number // the hazard only affects flights between the bounds
  altitude_max_ft: number
  valid_from: number // Unix seconds
  valid_to: number // Unix seconds
  polygon: LatLon[] // closed ring: the last point repeats the first
  movement_dir: number | null // degrees towards, when known
  movement_speed_kt: number | null
  // Display only, live data only: e.g. "Severe", and the volcano or storm name.
  severity?: string | null
  name?: string | null
}

// Where the backend gets its data from, as /health reports it ("mock",
// "opensky", "awc", ...). Decides which credits are shown.
export interface DataSources {
  source: string
  weather_source: string
}
