import { useEffect, useState } from 'react'
import type { Airport } from '../data/types'

// The destination's time zone, for the forecast pop-up's times. Airports
// carry only a position, so the zone comes from tz-lookup (offline, works for
// mock and live airports alike). The library is loaded with import() the
// first time a pop-up opens, so it is not in the app's first download.

// Zones already found, by airport: reopening the pop-up shows its times at once.
const zones = new Map<string, string>()

// For tests: forget every zone.
export function clearZoneCache() {
  zones.clear()
}

// The IANA zone at a position ("Europe/Berlin"), or UTC when the library
// can't be loaded (offline before it was ever fetched) or the position is
// invalid, so the pop-up never waits forever.
export async function zoneAt(lat: number, lon: number): Promise<string> {
  try {
    const { default: tzlookup } = await import('@photostructure/tz-lookup')
    return tzlookup(lat, lon)
  } catch {
    return 'UTC'
  }
}

// The airport's zone once `enabled` (the pop-up is open); null while it is
// still being looked up.
export function useAirportZone(
  airport: Airport | null,
  enabled: boolean,
): string | null {
  // Bumped when a zone arrives, to show it.
  const [, setVersion] = useState(0)
  const icao = airport?.icao ?? null
  const lat = airport?.latitude
  const lon = airport?.longitude

  useEffect(() => {
    if (!enabled || icao === null || zones.has(icao)) return
    let cancelled = false
    void zoneAt(lat!, lon!).then((zone) => {
      zones.set(icao, zone)
      if (!cancelled) setVersion((v) => v + 1)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, icao, lat, lon])

  return icao === null ? null : (zones.get(icao) ?? null)
}
