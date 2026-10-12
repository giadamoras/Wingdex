import { Fragment } from 'react'
import {
  bearing,
  curvePoint,
  curveThrough,
  progressAlong,
  splitAtDateLine,
} from './geo'
import type { Point } from './geo'
import { PlaneIcon } from './PlaneIcon'
import { project } from './projection'
import type { ReplayState } from './replay'
import type { Airport, Flight } from './types'

// SVG "x,y x,y ..." for points, in the same 0-100 box as the land: one string
// for each part of the path, since a path that crosses the date line has to be
// drawn as separate lines (see splitAtDateLine).
const toSvg = (points: Point[]) =>
  splitAtDateLine(points).map((part) =>
    part
      .map((p) => {
        const { x, y } = project(p.latitude, p.longitude)
        return `${x.toFixed(3)},${y.toFixed(3)}`
      })
      .join(' '),
  )

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

// A route line with a paper-coloured outline underneath ("casing"), so it
// stays readable over the land, the borders and the planes around it.
function RouteLine({
  className,
  points,
}: {
  className: string
  points: string[]
}) {
  return (
    <>
      {points.map((part, i) => (
        <Fragment key={i}>
          <polyline className="route-casing" points={part} />
          <polyline className={className} points={part} />
        </Fragment>
      ))}
    </>
  )
}

// A part of the route shorter than this share of it is left out. A plane that
// has arrived (or has just left) has a part of almost no length, and a line
// that short, with its round ends, was drawn as a big grey oval on phones.
const MIN_PART = 0.005

// The selected flight's route, drawn above the other planes (but under the
// selected one, see styles/route.css). It is the great circle from origin to
// destination, bent so it passes exactly through the plane (see curveThrough):
// - normally: solid from the origin to the plane, dashed ahead of it;
// - during a replay: all dashed, with a ghost plane leaving a solid trail
//   along the same curve;
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

  // Every line and the ghost follow the curve through the plane.
  const curve = (from = 0, to = 1) =>
    curveThrough(origin, destination, flight, from, to)
  const curveAt = (t: number) => curvePoint(origin, destination, flight, t)

  // Ghost position, and its heading from a point just ahead of it on the curve
  // (stepping back near the end), so it never has to aim at where it already is.
  const ghostAt = replay && curveAt(replay.progress)
  const ghostHeading = replay
    ? bearing(
        curveAt(Math.min(replay.progress, 0.99)),
        curveAt(Math.min(replay.progress, 0.99) + 0.01),
      )
    : null

  return (
    <>
      <svg
        className="route-lines"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {flying ? (
          <RouteLine className="route-ahead" points={toSvg(curve())} />
        ) : (
          <>
            {done > MIN_PART && (
              <RouteLine
                className="route-flown"
                points={toSvg(curve(0, done))}
              />
            )}
            {done < 1 - MIN_PART && (
              <RouteLine
                className="route-ahead"
                points={toSvg(curve(done, 1))}
              />
            )}
          </>
        )}
        {replay &&
          toSvg(curve(0, replay.progress)).map((part, i) => (
            <polyline
              key={i}
              className={landing ? 'route-trail fading' : 'route-trail'}
              points={part}
            />
          ))}
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
