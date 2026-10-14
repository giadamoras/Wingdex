import { useMemo } from 'react'
import { formatAltitudeBand } from '../shared-lib/format'
import { HazardIcon } from './HazardIcon'
import { placeAt, svgPoints } from './projection'
import type { WeatherArea } from '../data/types'
import { hazardTitle, iconCount, iconOrder } from './weatherIcons'

// Weather hazards, drawn under the planes: a few round icons per area (how
// many depends on its size on screen, see weatherIcons.ts). The area's shape
// stays hidden until one of its icons is clicked, so the map stays calm; the
// selected area then gets an outline and a label.
export function WeatherLayer({
  areas,
  zoom,
  selectedId,
  onSelect,
}: {
  areas: WeatherArea[]
  zoom: number
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  // Icon order depends only on the area's shape, so work it out once per poll.
  const orders = useMemo(
    () => new Map(areas.map((a) => [a.id, iconOrder(a)])),
    [areas],
  )
  const selected = areas.find((a) => a.id === selectedId)

  return (
    <>
      {selected && (
        <svg
          className="weather-outline"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon points={svgPoints(selected.polygon, 3)} />
        </svg>
      )}
      {areas.flatMap((area) => {
        const spots = orders.get(area.id)!.slice(0, iconCount(area, zoom))
        const name = `${hazardTitle(area)}, ${area.region}`
        return spots.map((spot, i) => (
          <button
            key={`${area.id}-${i}`}
            className={
              area.id === selectedId ? 'weather-icon selected' : 'weather-icon'
            }
            data-hazard={area.hazard}
            title={name}
            aria-label={name}
            aria-pressed={area.id === selectedId}
            style={placeAt(spot)}
            onClick={(e) => {
              e.stopPropagation() // don't trigger the map's deselect
              onSelect(area.id === selectedId ? null : area.id)
            }}
          >
            <HazardIcon hazard={area.hazard} />
          </button>
        ))
      })}
      {selected && (
        <div
          className="weather-label"
          style={placeAt(orders.get(selected.id)![0])}
        >
          <strong>{hazardTitle(selected)}</strong> · {selected.region}
          <br />
          {formatAltitudeBand(
            selected.altitude_min_ft,
            selected.altitude_max_ft,
          )}
        </div>
      )}
    </>
  )
}
