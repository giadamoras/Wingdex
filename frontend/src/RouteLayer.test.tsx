import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { interpolate, progressAlong } from './geo'
import { project } from './projection'
import type { ReplayState } from './replay'
import { RouteLayer } from './RouteLayer'
import type { Airport, Flight } from './types'

afterEach(cleanup)

const lhr: Airport = {
  icao: 'EGLL',
  iata: 'LHR',
  name: 'London Heathrow',
  latitude: 51.47,
  longitude: -0.45,
}
const jfk: Airport = {
  icao: 'KJFK',
  iata: 'JFK',
  name: 'New York JFK',
  latitude: 40.64,
  longitude: -73.78,
}

// A plane 40% of the way along, but well off the great circle (as real planes are).
const onArc = interpolate(lhr, jfk, 0.4)
const flight: Flight = {
  id: 'BAW117',
  callsign: 'BAW117',
  aircraft_type: 'B77W',
  latitude: onArc.latitude + 1.5,
  longitude: onArc.longitude - 2,
  altitude_ft: 36000,
  heading: 270,
  speed_kt: 480,
  duration_min: 433,
  origin: lhr,
  destination: jfk,
}

// "x,y x,y ..." -> its first or last point.
const endsOf = (el: Element) => {
  const points = el.getAttribute('points')!.split(' ')
  return { first: points[0], last: points[points.length - 1] }
}
const where = (lat: number, lon: number) => {
  const { x, y } = project(lat, lon)
  return `${x.toFixed(3)},${y.toFixed(3)}`
}

test('the solid line ends at the plane and the dashed line starts there', () => {
  const { container } = render(<RouteLayer flight={flight} replay={null} />)
  const plane = where(flight.latitude, flight.longitude)
  expect(endsOf(container.querySelector('.route-flown')!).last).toBe(plane)
  expect(endsOf(container.querySelector('.route-ahead')!).first).toBe(plane)
})

test('the route still runs from the origin to the destination', () => {
  const { container } = render(<RouteLayer flight={flight} replay={null} />)
  expect(endsOf(container.querySelector('.route-flown')!).first).toBe(
    where(lhr.latitude, lhr.longitude),
  )
  expect(endsOf(container.querySelector('.route-ahead')!).last).toBe(
    where(jfk.latitude, jfk.longitude),
  )
})

test('each route line has an outline underneath it', () => {
  const { container } = render(<RouteLayer flight={flight} replay={null} />)
  const lines = [...container.querySelectorAll('.route-lines polyline')]
  expect(lines.map((l) => l.getAttribute('class'))).toEqual([
    'route-casing',
    'route-flown',
    'route-casing',
    'route-ahead',
  ])
  // The outline traces exactly the line it sits under.
  expect(lines[0].getAttribute('points')).toBe(lines[1].getAttribute('points'))
  expect(lines[2].getAttribute('points')).toBe(lines[3].getAttribute('points'))
})

test('the replay ghost and trail follow the curve through the plane', () => {
  const replay: ReplayState = {
    flight,
    startedAt: 0,
    phase: 'flying',
    // As far along as the plane is. (It isn't exactly 0.4: the plane is off the arc.)
    progress: progressAlong(lhr, jfk, flight),
  }
  const { container } = render(<RouteLayer flight={flight} replay={replay} />)
  const plane = project(flight.latitude, flight.longitude)
  // Where the ghost is drawn: translate(x%, y%) on its track.
  const track = container.querySelector<HTMLElement>('.ghost-track')!
  const [x, y] = track.style.transform.match(/-?[\d.]+(?=%)/g)!.map(Number)
  expect(x).toBeCloseTo(plane.x, 1)
  expect(y).toBeCloseTo(plane.y, 1)
  expect(endsOf(container.querySelector('.route-trail')!).last).toBe(
    where(flight.latitude, flight.longitude),
  )
  // While flying the whole route is one dashed line (with its outline).
  expect(container.querySelector('.route-flown')).toBeNull()
  expect(container.querySelectorAll('.route-casing')).toHaveLength(1)
})
