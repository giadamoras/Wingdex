import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { fetchWeather } from './api'
import type { WeatherArea } from './types'
import { useWeather, WEATHER_POLL_MS, WEATHER_RETRY_MS } from './useWeather'

vi.mock('./api', () => ({ fetchWeather: vi.fn() }))

// An area that stays valid for `validForS` seconds from the test's start.
const nowS = () => Date.now() / 1000
const area = (id: string, validForS: number): WeatherArea => ({
  id,
  hazard: 'thunderstorm',
  region: 'Test',
  altitude_min_ft: 0,
  altitude_max_ft: 45000,
  valid_from: nowS() - 3600,
  valid_to: nowS() + validForS,
  polygon: [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 },
    { latitude: 1, longitude: 1 },
    { latitude: 0, longitude: 0 },
  ],
  movement_dir: null,
  movement_speed_kt: null,
})

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
const calls = () => vi.mocked(fetchWeather).mock.calls.length

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(fetchWeather).mockReset()
})
afterEach(() => vi.useRealTimers())

test('is null until the first request settles, then holds the areas', async () => {
  const fresh = [area('w1', 7200)]
  vi.mocked(fetchWeather).mockResolvedValue(fresh)
  const { result } = renderHook(() => useWeather())
  expect(result.current).toBeNull()
  await advance(0)
  expect(result.current).toEqual(fresh)
})

test('a failed first request settles to an empty list', async () => {
  vi.mocked(fetchWeather).mockRejectedValue(new Error('network'))
  const { result } = renderHook(() => useWeather())
  await advance(0)
  expect(result.current).toEqual([])
})

test('failed requests are retried after 30 s, doubling up to the normal pace', async () => {
  vi.mocked(fetchWeather).mockRejectedValue(new Error('network'))
  renderHook(() => useWeather())

  await advance(0)
  expect(calls()).toBe(1)
  await advance(WEATHER_RETRY_MS - 1)
  expect(calls()).toBe(1)
  await advance(1) // 30 s
  expect(calls()).toBe(2)
  await advance(60_000 - 1)
  expect(calls()).toBe(2)
  await advance(1) // 90 s: waited 60 s
  expect(calls()).toBe(3)
  await advance(120_000) // 210 s
  expect(calls()).toBe(4)
  await advance(240_000) // 450 s
  expect(calls()).toBe(5)
  await advance(WEATHER_POLL_MS - 1) // the next wait is capped at 5 minutes
  expect(calls()).toBe(5)
  await advance(1)
  expect(calls()).toBe(6)
})

test('a success goes back to the normal pace and restarts the back-off', async () => {
  vi.mocked(fetchWeather)
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce([area('w1', 7200)])
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue([area('w1', 7200)])
  renderHook(() => useWeather())

  await advance(WEATHER_RETRY_MS) // fails at 0 s, succeeds at 30 s
  expect(calls()).toBe(2)
  await advance(WEATHER_POLL_MS - 1)
  expect(calls()).toBe(2) // the normal pace again, not 30 s
  await advance(1) // fails once more...
  expect(calls()).toBe(3)
  await advance(WEATHER_RETRY_MS) // ...and the wait is back to 30 s
  expect(calls()).toBe(4)
})

test('a failure keeps the last good areas but drops the expired ones', async () => {
  const soon = area('soon', 100) // expires before the next poll
  const later = area('later', 7200)
  vi.mocked(fetchWeather)
    .mockResolvedValueOnce([soon, later])
    .mockRejectedValue(new Error('network'))
  const { result } = renderHook(() => useWeather())
  await advance(0)
  expect(result.current).toEqual([soon, later])

  await advance(WEATHER_POLL_MS) // the poll fails; `soon` ran out meanwhile
  expect(result.current).toEqual([later])
})

test('a failure with nothing expired keeps the very same list', async () => {
  vi.mocked(fetchWeather)
    .mockResolvedValueOnce([area('later', 7200)])
    .mockRejectedValue(new Error('network'))
  const { result } = renderHook(() => useWeather())
  await advance(0)
  const before = result.current

  await advance(WEATHER_POLL_MS)
  expect(result.current).toBe(before)
})

test('unmounting aborts the request and stops retrying', async () => {
  vi.mocked(fetchWeather).mockRejectedValue(new Error('network'))
  const { unmount } = renderHook(() => useWeather())
  await advance(0)
  const signal = vi.mocked(fetchWeather).mock.calls[0][0]

  unmount()
  expect(signal?.aborted).toBe(true)
  await advance(WEATHER_POLL_MS * 2)
  expect(calls()).toBe(1)
})
