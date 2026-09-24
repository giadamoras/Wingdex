import { project } from './projection'
import type { Flight } from './types'

// Plain placeholder map: one dot per flight, positioned in percent.
export function FlightMap({ flights }: { flights: Flight[] }) {
  return (
    <div className="map">
      {flights.map((f) => {
        const { x, y } = project(f.latitude, f.longitude)
        return (
          <div
            key={f.id}
            className="dot"
            title={f.callsign}
            style={{ left: `${x}%`, top: `${y}%` }}
          />
        )
      })}
    </div>
  )
}
