import { expect, test } from 'vitest'
import {
  angularDistance,
  bearing,
  curvePoint,
  curveThrough,
  interpolate,
  progressAlong,
  routePoints,
  splitAtDateLine,
} from './geo'

const LHR = { latitude: 51.47, longitude: -0.454 }
const JFK = { latitude: 40.641, longitude: -73.778 }
const pt = (latitude: number, longitude: number) => ({ latitude, longitude })

test('London to New York is about 2,990 nm', () => {
  // 3440 nm = Earth's mean radius, the same constant as the backend.
  expect(angularDistance(LHR, JFK) * 3440.065).toBeCloseTo(2990, -2)
})

test('interpolate hits both ends and the midpoint', () => {
  expect(interpolate(LHR, JFK, 0).latitude).toBeCloseTo(LHR.latitude)
  expect(interpolate(LHR, JFK, 1).longitude).toBeCloseTo(JFK.longitude)
  const mid = interpolate(pt(0, 0), pt(0, 90), 0.5)
  expect(mid.latitude).toBeCloseTo(0)
  expect(mid.longitude).toBeCloseTo(45)
})

test('the great circle to New York bends north of both airports', () => {
  expect(interpolate(LHR, JFK, 0.5).latitude).toBeGreaterThan(LHR.latitude)
})

test('bearing: east, north, and London to New York', () => {
  expect(bearing(pt(0, 0), pt(0, 10))).toBeCloseTo(90)
  expect(bearing(pt(0, 0), pt(10, 0))).toBeCloseTo(0)
  expect(bearing(LHR, JFK)).toBeCloseTo(288, -1)
})

test('progressAlong measures how far along the route a point is', () => {
  expect(progressAlong(LHR, JFK, LHR)).toBe(0)
  expect(progressAlong(LHR, JFK, interpolate(LHR, JFK, 0.3))).toBeCloseTo(0.3)
  expect(progressAlong(LHR, JFK, JFK)).toBeCloseTo(1)
})

// A plane some way along the route but off the great circle, as a real one is.
const offArc = () => {
  const onArc = interpolate(LHR, JFK, 0.4)
  return pt(onArc.latitude + 1.5, onArc.longitude - 2)
}

test('a plane on the great circle leaves the route unchanged', () => {
  const onArc = interpolate(LHR, JFK, 0.4)
  for (const t of [0, 0.2, 0.4, 0.7, 1]) {
    const curved = curvePoint(LHR, JFK, onArc, t)
    const straight = interpolate(LHR, JFK, t)
    expect(curved.latitude).toBeCloseTo(straight.latitude, 6)
    expect(curved.longitude).toBeCloseTo(straight.longitude, 6)
  }
})

test('the curve passes exactly through a plane that is off the great circle', () => {
  const plane = offArc()
  const peak = progressAlong(LHR, JFK, plane)
  // Both sections meet at the plane, which is where the line changes style.
  const flown = curveThrough(LHR, JFK, plane, 0, peak)
  const ahead = curveThrough(LHR, JFK, plane, peak, 1)
  for (const end of [flown[flown.length - 1], ahead[0]]) {
    expect(end.latitude).toBeCloseTo(plane.latitude, 6)
    expect(end.longitude).toBeCloseTo(plane.longitude, 6)
  }
})

test('the curve still starts at the origin and ends at the destination', () => {
  const all = curveThrough(LHR, JFK, offArc())
  expect(all[0].latitude).toBeCloseTo(LHR.latitude, 6)
  expect(all[0].longitude).toBeCloseTo(LHR.longitude, 6)
  expect(all[64].latitude).toBeCloseTo(JFK.latitude, 6)
  expect(all[64].longitude).toBeCloseTo(JFK.longitude, 6)
})

test('the curve is smooth at the plane: no kink where it bends', () => {
  const plane = offArc()
  const peak = progressAlong(LHR, JFK, plane)
  const at = (t: number) => curvePoint(LHR, JFK, plane, t)
  const e = 0.01
  // Direction of travel just before and just after the plane.
  const before = bearing(at(peak - e), at(peak))
  const after = bearing(at(peak), at(peak + e))
  expect(Math.abs(before - after)).toBeLessThan(2)
})

test('the offset takes the short way round across the date line', () => {
  const a = pt(0, 170)
  const b = pt(0, -170)
  const plane = pt(1, -179.9)
  const peak = progressAlong(a, b, plane)
  const p = curvePoint(a, b, plane, peak)
  expect(p.latitude).toBeCloseTo(1, 6)
  // Same place, whichever way the longitude is written (-179.9 or 180.1).
  expect((p.longitude + 360) % 360).toBeCloseTo(180.1, 6)
})

test('routePoints covers the requested section, ends included', () => {
  const all = routePoints(LHR, JFK)
  expect(all).toHaveLength(65)
  expect(all[0].latitude).toBeCloseTo(LHR.latitude)
  expect(all[64].longitude).toBeCloseTo(JFK.longitude)

  const second = routePoints(LHR, JFK, 0.5, 1)
  expect(second.length).toBeLessThan(all.length)
  expect(second[0].latitude).toBeCloseTo(interpolate(LHR, JFK, 0.5).latitude)
})

const AKL = { latitude: -37.008, longitude: 174.792 }
const BOG = { latitude: 4.702, longitude: -74.147 }

// The biggest longitude jump between neighbours inside any part.
const biggestJump = (parts: { longitude: number }[][]) =>
  Math.max(
    ...parts.flatMap((part) =>
      part.slice(1).map((p, i) => Math.abs(p.longitude - part[i].longitude)),
    ),
  )

test('a path that does not cross the date line stays in one part', () => {
  const path = routePoints(LHR, JFK)
  expect(splitAtDateLine(path)).toEqual([path])
})

test('Auckland to Bogota crosses the date line eastbound and is split there', () => {
  const path = routePoints(AKL, BOG)
  // Unsplit, the path jumps almost all the way round the world once.
  expect(biggestJump([path])).toBeGreaterThan(300)

  const parts = splitAtDateLine(path)
  expect(parts).toHaveLength(2)
  const [before, after] = parts
  expect(before[0]).toEqual(path[0]) // starts at Auckland
  expect(after[after.length - 1]).toEqual(path[path.length - 1]) // ends at Bogota
  // Each part runs to its edge, at the same latitude on both sides.
  const end = before[before.length - 1]
  const start = after[0]
  expect(end.longitude).toBe(180)
  expect(start.longitude).toBe(-180)
  expect(start.latitude).toBe(end.latitude)
  expect(biggestJump(parts)).toBeLessThan(20) // no line across the world
})

test('the same flight the other way (westbound) is split too', () => {
  const parts = splitAtDateLine(routePoints(BOG, AKL))
  expect(parts).toHaveLength(2)
  expect(parts[0][parts[0].length - 1].longitude).toBe(-180)
  expect(parts[1][0].longitude).toBe(180)
  expect(biggestJump(parts)).toBeLessThan(20)
})

test('the crossing latitude lies between the two points around it', () => {
  const path = [pt(-50, 170), pt(-40, -170)] // 20 degrees apart, the middle is the line
  const [before, after] = splitAtDateLine(path)
  expect(before[1].latitude).toBeCloseTo(-45)
  expect(after[0].latitude).toBeCloseTo(-45)
})

test('a longitude past 180 is the other side of the date line', () => {
  // 182 is -178: the path crosses the line between the first two points.
  const parts = splitAtDateLine([pt(0, 178), pt(0, 182), pt(0, 184)])
  expect(parts).toHaveLength(2)
  expect(parts[1].map((p) => p.longitude)).toEqual([-180, -178, -176])
})

test('a route that crosses back and forth is split every time', () => {
  const parts = splitAtDateLine([pt(0, 170), pt(0, -170), pt(0, 170)])
  expect(parts).toHaveLength(3)
})
