import { EuropeLand } from './EuropeLand'
import { PlaneIcon } from './PlaneIcon'
import { project } from './projection'
import type { Flight } from './types'

const NO_JUMPS = new Set<string>()

// Placeholder map: flat land shapes with one clickable plane per flight,
// positioned in percent. Planes glide between polls; ids in `jumped` snap to
// their new position instead. Clicking a plane selects it (or deselects it if
// already selected); clicking the map background deselects.
export function FlightMap({
  flights,
  selectedId,
  jumped = NO_JUMPS,
  onSelect,
}: {
  flights: Flight[]
  selectedId: string | null
  jumped?: Set<string>
  onSelect: (id: string | null) => void
}) {
  return (
    <div className="map" onClick={() => onSelect(null)}>
      <EuropeLand />
      {flights.map((f) => {
        const { x, y } = project(f.latitude, f.longitude)
        const className = [
          'plane',
          f.id === selectedId && 'selected',
          jumped.has(f.id) && 'jump',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <button
            key={f.id}
            className={className}
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
