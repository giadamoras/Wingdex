// Mirrors the backend Airport model.
export interface Airport {
  icao: string // four-letter code pilots use, e.g. "EGLL"
  iata: string // three-letter code passengers see, e.g. "LHR"
  name: string
  latitude: number // degrees
  longitude: number // degrees
}

// Mirrors the backend Flight model (GET /flights).
export interface Flight {
  id: string
  callsign: string
  aircraft_type: string
  latitude: number // degrees
  longitude: number // degrees
  altitude_ft: number
  heading: number // degrees clockwise from north
  speed_kt: number // ground speed, knots
  duration_min: number
  // null when the data source doesn't know the route (e.g. live feeds).
  origin: Airport | null
  destination: Airport | null
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
}

export interface LatLon {
  latitude: number // degrees
  longitude: number // degrees
}

export type Hazard =
  'thunderstorm' | 'turbulence' | 'icing' | 'volcanic_ash' | 'tropical_cyclone'

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
}
