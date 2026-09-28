import { expect, test } from 'vitest'
import { isToday } from './dates'

const now = new Date(2026, 8, 25, 15, 0)

test('counts an earlier time on the same day as today', () => {
  expect(isToday(new Date(2026, 8, 25, 12, 0).toISOString(), now)).toBe(true)
})

test('does not count the day before as today', () => {
  expect(isToday(new Date(2026, 8, 24, 12, 0).toISOString(), now)).toBe(false)
})

test('treats 23:55 as the previous day once it is past midnight', () => {
  expect(
    isToday(
      new Date(2026, 8, 24, 23, 55).toISOString(),
      new Date(2026, 8, 25, 0, 5),
    ),
  ).toBe(false)
})
