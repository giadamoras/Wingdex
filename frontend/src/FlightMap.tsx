import { EuropeLand } from './EuropeLand'
import { PlaneIcon } from './PlaneIcon'
import { project } from './projection'
import type { Flight } from './types'

// Placeholder map: flat land shapes with one clickable plane per flight,
// positioned in percent. Clicking a plane selects it (or deselects it if
// already selected); clicking the map background deselects.
export function FlightMap({
  flights,
  selectedId,
  onSelect,
}: {
  flights: Flight[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <div className="map" onClick={() => onSelect(null)}>
      <EuropeLand />
      {flights.map((f) => {
        const { x, y } = project(f.latitude, f.longitude)
        return (
          <button
            key={f.id}
            className={f.id === selectedId ? 'plane selected' : 'plane'}
            title={f.callsign}
            style={{ left: `${x}%`, top: `${y}%` }}
            onClick={(e) => {
              e.stopPropagation() // don't trigger the map's deselect
              onSelect(f.id === selectedId ? null : f.id)
            }}
          >
            <PlaneIcon heading={f.heading} />
          </button>
        )
      })}
    </div>
  )
}
