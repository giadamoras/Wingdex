import { expect, test } from 'vitest'
import {
  formatAltitude,
  formatAltitudeBand,
  formatCaughtAt,
  formatClimb,
  formatDuration,
  formatHeading,
  formatSpeed,
  formatStampDate,
} from './format'

test('pads zero minutes as "00"', () => {
  expect(formatDuration(540)).toBe('9h 00m')
})

test('pads single-digit minutes with a leading zero', () => {
  expect(formatDuration(125)).toBe('2h 05m')
})

test('shows only minutes for flights under an hour', () => {
  expect(formatDuration(45)).toBe('45m')
})

test('switches to hours at exactly 60 minutes', () => {
  expect(formatDuration(60)).toBe('1h 00m')
})

test('shows a catch time as short local date and 24h time', () => {
  // Built from a local time, so the result doesn't depend on the time zone.
  const iso = new Date(2026, 8, 28, 14, 3).toISOString()
  expect(formatCaughtAt(iso)).toBe('Sep 28, 14:03')
})

test('shows a stamp date as day, uppercase month, year', () => {
  const iso = new Date(2026, 8, 4, 14, 3).toISOString()
  expect(formatStampDate(iso)).toBe('04 SEP 2026')
})

test('shows an altitude band from the ground as "up to"', () => {
  expect(formatAltitudeBand(0, 45000)).toBe('up to 45,000 ft')
})

test('shows an altitude band with both bounds', () => {
  expect(formatAltitudeBand(20000, 38000)).toBe('20,000–38,000 ft')
})

test('formatClimb says climbing or descending, with a rounded rate', () => {
  expect(formatClimb(1850)).toBe('Climbing · 1,900 ft/min')
  expect(formatClimb(-2210)).toBe('Descending · 2,200 ft/min')
})

test('formatClimb calls a small rate level and an unknown one nothing', () => {
  expect(formatClimb(0)).toBe('Flying level')
  expect(formatClimb(-299)).toBe('Flying level')
  expect(formatClimb(null)).toBeNull()
  expect(formatClimb(undefined)).toBeNull()
})

test('formatAltitude adds km, or metres under 1 km', () => {
  expect(formatAltitude(39000)).toBe('39,000 ft · 11.9 km')
  expect(formatAltitude(1500)).toBe('1,500 ft · 460 m')
  expect(formatAltitude(0)).toBe('0 ft · 0 m')
})

test('formatSpeed adds km/h', () => {
  expect(formatSpeed(419)).toBe('419 kt · 776 km/h')
  expect(formatSpeed(90)).toBe('90 kt · 167 km/h')
})

test('formatHeading names the nearest compass point', () => {
  expect(formatHeading(316)).toBe('Northwest (316°)')
  expect(formatHeading(90.4)).toBe('East (90°)')
  expect(formatHeading(22)).toBe('North (22°)')
  expect(formatHeading(23)).toBe('Northeast (23°)')
  expect(formatHeading(359.6)).toBe('North (0°)') // rounds to 360, which is 0
})
