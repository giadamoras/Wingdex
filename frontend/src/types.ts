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
