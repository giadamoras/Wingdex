import type { Flight, FlightRoute, WeatherArea } from './types'

// Backend base URL; override with VITE_API_URL in a .env file.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export async function fetchFlights(): Promise<Flight[]> {
  const res = await fetch(`${API_URL}/flights`)
  if (!res.ok) throw new Error(`GET /flights failed: ${res.status}`)
  return res.json()
}

// The route (and type) of one live flight. null means "nothing known" (404);
// anything else that goes wrong throws, so the caller can tell unknown from down.
export async function fetchRoute(
  flightId: string,
): Promise<FlightRoute | null> {
  const res = await fetch(
    `${API_URL}/flights/${encodeURIComponent(flightId)}/route`,
  )
  if (res.status === 404) return null
  if (!res.ok)
    throw new Error(`GET /flights/${flightId}/route failed: ${res.status}`)
  return res.json()
}

export async function fetchWeather(): Promise<WeatherArea[]> {
  const res = await fetch(`${API_URL}/weather`)
  if (!res.ok) throw new Error(`GET /weather failed: ${res.status}`)
  return res.json()
}
