import type { Flight } from './types'

// Backend base URL; override with VITE_API_URL in a .env file.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export async function fetchFlights(): Promise<Flight[]> {
  const res = await fetch(`${API_URL}/flights`)
  if (!res.ok) throw new Error(`GET /flights failed: ${res.status}`)
  return res.json()
}
