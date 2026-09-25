import { expect, test } from 'vitest'
import { formatDuration } from './format'

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
