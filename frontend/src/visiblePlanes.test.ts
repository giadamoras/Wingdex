import { expect, test } from 'vitest'
import { centredOn, type View } from './panzoom'
import { project } from './projection'
import type { Flight } from './types'
import { hashString } from './hash'
import { visibleFlights, VIEW_CAP } from './visiblePlanes'

const plane = (id: string, latitude: number, longitude: number): Flight => ({
  id,
  callsign: id,
  aircraft_type: null,
  latitude,
  longitude,
  altitude_ft: 30000,
  heading: 0,
  speed_kt: 400,
  duration_min: null,
  origin: null,
  destination: null,
})

// n planes spread over the whole map in a grid.
const spread = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    plane(`P${i}`, -50 + ((i * 7) % 120), -170 + ((i * 53) % 340)),
  )

const world: View = { zoom: 1, x: 0, y: 0 }
const at = (lat: number, lon: number, zoom: number) => {
  const p = project(lat, lon)
  return centredOn(p.x / 100, p.y / 100, zoom)
}

test('a small feed (the mock) is drawn whole at world zoom', () => {
  const flights = spread(40)
  expect(visibleFlights(flights, world, [])).toHaveLength(40)
})

test('a full live feed is thinned to the view cap', () => {
  const shown = visibleFlights(spread(5000), world, []).length
  expect(shown).toBeGreaterThan(VIEW_CAP * 0.8)
  expect(shown).toBeLessThan(VIEW_CAP * 1.2)
})

test('fewer planes in view than the cap are all drawn', () => {
  const flights = spread(5000)
  const view = at(20, 0, 6)
  const inView = visibleFlights(flights, view, [])
  expect(inView.length).toBeGreaterThan(0)
  expect(inView.length).toBeLessThan(VIEW_CAP)
  // Nothing was thinned: every plane the cull keeps is the whole in-view set.
  expect(visibleFlights(inView, view, [])).toHaveLength(inView.length)
})

test('planes outside the view are not drawn', () => {
  const flights = [plane('in', 50, 10), plane('out', -40, 150)]
  const ids = visibleFlights(flights, at(50, 10, 8), []).map((f) => f.id)
  expect(ids).toEqual(['in'])
})

test('zooming in keeps the planes near the centre that were drawn', () => {
  const flights = spread(5000)
  const ids = (view: View) =>
    new Set(visibleFlights(flights, view, []).map((f) => f.id))
  const wide = ids(at(20, 0, 1.5))
  const closer = ids(at(20, 0, 2))
  // Within 20 degrees of the centre is inside both views.
  const near = flights.filter(
    (f) =>
      wide.has(f.id) &&
      Math.abs(f.latitude - 20) < 20 &&
      Math.abs(f.longitude) < 20,
  )
  expect(near.length).toBeGreaterThan(0)
  for (const f of near) expect(closer.has(f.id)).toBe(true)
})

test('the planes kept are the lowest-ranked ones, so none are swapped', () => {
  const flights = spread(5000)
  // At world zoom every plane is in view, so the cut is purely by rank.
  const kept = new Set(visibleFlights(flights, world, []).map((f) => f.id))
  const rank = (f: Flight) => hashString(f.id)
  const keptRanks = flights.filter((f) => kept.has(f.id)).map(rank)
  const droppedRanks = flights.filter((f) => !kept.has(f.id)).map(rank)
  expect(keptRanks.length).toBeGreaterThan(0)
  expect(Math.max(...keptRanks)).toBeLessThan(Math.min(...droppedRanks))
})

test('always-shown ids are drawn even off screen and over the cap', () => {
  const flights = spread(1500)
  const view = at(50, 10, 8)
  const hidden = flights.find((f) => !visibleFlights([f], view, []).length)!
  const ids = visibleFlights(flights, view, [hidden.id, null]).map((f) => f.id)
  expect(ids).toContain(hidden.id)
})
