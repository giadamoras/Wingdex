// Mirrors the backend Flight model (GET /flights).
export interface Flight {
  id: string
  callsign: string
  aircraft_type: string
  latitude: number // degrees
  longitude: number // degrees
  altitude_ft: number
  heading: number // degrees clockwise from north
  duration_min: number
}

export interface JournalEntry {
  flight: Flight
  fact: string
  caughtAt: string // ISO timestamp, e.g. "2026-09-25T14:03:00.000Z"
}
