import { useRef } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { centredOn } from './panzoom'
import { PlaneIcon } from './PlaneIcon'
import { project } from './projection'
import type { Flight } from './types'
import { usePanZoom } from './usePanZoom'
import { WorldLand } from './WorldLand'

const NO_JUMPS = new Set<string>()

// Opening view: zoomed in on Europe, roughly the old Europe-only map.
const europe = project(50, 10)
const START_VIEW = centredOn(europe.x / 100, europe.y / 100, 5)

// World map with one clickable plane per flight, positioned in percent of the
// world layer, which pans and zooms as a whole. Planes glide between polls;
// ids in `jumped` snap to their new position instead. Clicking a plane selects
// it (or deselects it if already selected); clicking the map background
// deselects. A drag never counts as a click.
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
  const mapRef = useRef<HTMLDivElement>(null)
  const { view, handlers, zoomIn, zoomOut, reset } = usePanZoom(
    mapRef,
    START_VIEW,
  )

  // Translate is in % of the layer (= the map box), so the view is resize-proof.
  // --zoom lets planes scale themselves back to a constant size.
  const worldStyle = {
    transform: `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.zoom})`,
    '--zoom': view.zoom,
  } as CSSProperties

  // Control buttons must not reach the map's deselect.
  const control = (action: () => void) => (e: MouseEvent) => {
    e.stopPropagation()
    action()
  }

  return (
    <div
      className="map"
      ref={mapRef}
      onClick={() => onSelect(null)}
      {...handlers}
    >
      <div className="map-world" style={worldStyle}>
        <WorldLand />
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
      <div className="map-controls">
        <button aria-label="Zoom in" onClick={control(zoomIn)}>
          +
        </button>
        <button aria-label="Zoom out" onClick={control(zoomOut)}>
          −
        </button>
        <button aria-label="Reset view" onClick={control(reset)}>
          ⟲
        </button>
      </div>
    </div>
  )
}
