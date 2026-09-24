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
