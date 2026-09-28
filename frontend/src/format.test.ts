import { expect, test } from 'vitest'
import { formatCaughtAt, formatDuration } from './format'

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
