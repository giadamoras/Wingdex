import { bearing, interpolate, progressAlong, routePoints } from './geo'
import type { Point } from './geo'
import { PlaneIcon } from './PlaneIcon'
import { project } from './projection'
import type { ReplayState } from './replay'
import type { Airport, Flight } from './types'

// SVG "x,y x,y ..." for points, in the same 0-100 box as the land.
const toSvg = (points: Point[]) =>
  points
    .map((p) => {
      const { x, y } = project(p.latitude, p.longitude)
      return `${x.toFixed(3)},${y.toFixed(3)}`
    })
    .join(' ')

// Percent position for an HTML element on the world layer.
const placeAt = (p: Point) => {
  const { x, y } = project(p.latitude, p.longitude)
  return { left: `${x}%`, top: `${y}%` }
}

// Position for a continuously moving element, as a transform on a full-layer
// wrapper (percentages of the layer). Unlike left/top, browsers don't round it
// to whole layer pixels before the map's zoom, which made the ghost hop.
const trackAt = (p: Point) => {
  const { x, y } = project(p.latitude, p.longitude)
  return { transform: `translate(${x}%, ${y}%)` }
}

function Endpoint({ airport }: { airport: Airport }) {
  return (
    <div className="route-end" style={placeAt(airport)} title={airport.name}>
      <span className="route-code">{airport.iata}</span>
    </div>
  )
}

// The selected flight's great-circle route, drawn under the planes:
// - normally: solid from the origin to the plane, dashed ahead of it;
// - during a replay: all dashed, with a ghost plane leaving a solid trail;
// - while landing: the normal style, with the ghost and trail fading out.
// Nothing is drawn when the route is unknown.
export function RouteLayer({
  flight,
  replay,
}: {
  flight: Flight
  replay: ReplayState | null
}) {
  const { origin, destination } = flight
  if (!origin || !destination) return null

  const flying = replay !== null && replay.phase !== 'landing'
  const landing = replay?.phase === 'landing'
  const done = progressAlong(origin, destination, flight)

  // Ghost position, and its heading from just before the end so it never
  // has to aim at the point it's already on.
  const ghostAt = replay && interpolate(origin, destination, replay.progress)
  const ghostHeading =
    replay &&
    bearing(
      interpolate(origin, destination, Math.min(replay.progress, 0.999)),
      destination,
    )

  return (
    <>
      <svg
        className="route-lines"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {flying ? (
          <polyline
            className="route-ahead"
            points={toSvg(routePoints(origin, destination))}
          />
        ) : (
          <>
            <polyline
              className="route-flown"
              points={toSvg(routePoints(origin, destination, 0, done))}
            />
            <polyline
              className="route-ahead"
              points={toSvg(routePoints(origin, destination, done, 1))}
            />
          </>
        )}
        {replay && (
          <polyline
            className={landing ? 'route-trail fading' : 'route-trail'}
            points={toSvg(routePoints(origin, destination, 0, replay.progress))}
          />
        )}
      </svg>
      <Endpoint airport={origin} />
      <Endpoint airport={destination} />
      {ghostAt && ghostHeading !== null && (
        <div className="ghost-track" style={trackAt(ghostAt)}>
          <div
            className={landing ? 'ghost fading' : 'ghost'}
            aria-hidden="true"
          >
            <PlaneIcon
              heading={ghostHeading}
              aircraftType={flight.aircraft_type}
            />
          </div>
        </div>
      )}
    </>
  )
}
