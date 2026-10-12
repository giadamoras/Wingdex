import { expect, test } from 'vitest'
import { inRing } from '../shared-lib/attributes'
import type { LatLon, WeatherArea } from '../data/types'
import { hazardTitle, iconCount, iconOrder, MAX_ICONS } from './weatherIcons'

const area = (points: [number, number][]): WeatherArea => ({
  id: 'w',
  hazard: 'thunderstorm',
  region: 'Test',
  altitude_min_ft: 0,
  altitude_max_ft: 40000,
  valid_from: 0,
  valid_to: 1,
  polygon: [...points, points[0]].map(([latitude, longitude]) => ({
    latitude,
    longitude,
  })),
  movement_dir: null,
  movement_speed_kt: null,
})

// A box from (south, west) to (north, east).
const box = (south: number, west: number, north: number, east: number) =>
  area([
    [south, west],
    [south, east],
    [north, east],
    [north, west],
  ])

const inside = (p: LatLon, a: WeatherArea) =>
  inRing(
    p.latitude,
    p.longitude,
    a.polygon.map((q): [number, number] => [q.longitude, q.latitude]),
  )

// A "C": a box with a notch cut in from the east, so its middle is outside.
const cShape = area([
  [0, 0],
  [0, 10],
  [3, 10],
  [3, 3],
  [7, 3],
  [7, 10],
  [10, 10],
  [10, 0],
])

test('gives at most MAX_ICONS positions, all inside the area', () => {
  const big = box(0, 0, 20, 20)
  const order = iconOrder(big)
  expect(order).toHaveLength(MAX_ICONS)
  for (const p of order) expect(inside(p, big)).toBe(true)
})

test('the first icon is the most central one', () => {
  const [first] = iconOrder(box(0, 0, 10, 10))
  expect(first.latitude).toBeCloseTo(5, 0)
  expect(first.longitude).toBeCloseTo(5, 0)
})

test('icons stay inside a concave area, even where its centre is outside', () => {
  // The notch holds the box's centre point (5, 5), which is not in the shape.
  expect(inside({ latitude: 5, longitude: 5 }, cShape)).toBe(false)
  for (const p of iconOrder(cShape)) expect(inside(p, cShape)).toBe(true)
})

test('the order is the same every time', () => {
  const big = box(0, 0, 20, 20)
  expect(iconOrder(big)).toEqual(iconOrder(big))
})

test('later icons are spread apart, not stacked on the first', () => {
  const [a, b] = iconOrder(box(0, 0, 20, 20))
  const apart = Math.hypot(a.latitude - b.latitude, a.longitude - b.longitude)
  expect(apart).toBeGreaterThan(5)
})

test('a sliver too thin for the lattice still gets one icon', () => {
  // A thin chevron: neither arm passes near a lattice point.
  const sliver = area([
    [0, 0],
    [10, 5],
    [0, 10],
    [0.001, 10],
    [10.001, 5],
    [0.001, 0],
  ])
  expect(iconOrder(sliver)).toHaveLength(1)
})

test('one icon when zoomed out, more as you zoom in, capped at MAX_ICONS', () => {
  const a = box(40, 0, 50, 10)
  expect(iconCount(a, 1)).toBe(1)
  expect(iconCount(a, 6)).toBeGreaterThan(1)
  expect(iconCount(a, 16)).toBe(MAX_ICONS)
})

test('a bigger area gets at least as many icons as a smaller one', () => {
  expect(iconCount(box(40, 0, 50, 10), 6)).toBeGreaterThanOrEqual(
    iconCount(box(40, 0, 42, 2), 6),
  )
})

test('even a tiny area gets one icon', () => {
  expect(iconCount(box(40, 0, 40.1, 0.1), 1)).toBe(1)
})

test('hazardTitle names the hazard, with severity and name when live data has them', () => {
  const base = box(0, 0, 2, 2)
  expect(hazardTitle(base)).toBe('Thunderstorm')
  expect(
    hazardTitle({ ...base, severity: 'Severe', hazard: 'mountain_wave' }),
  ).toBe('Severe mountain wave')
  expect(
    hazardTitle({ ...base, hazard: 'tropical_cyclone', name: 'Koguma' }),
  ).toBe('Tropical cyclone (Koguma)')
  expect(hazardTitle({ ...base, severity: null, name: null })).toBe(
    'Thunderstorm',
  )
})
