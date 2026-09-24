import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { POLL_INTERVAL_MS } from './useFlights'

const flights = [
  {
    id: 'f1',
    callsign: 'TST1',
    aircraft_type: 'A320',
    latitude: 50,
    longitude: 0,
    altitude_ft: 36000,
    heading: 90,
    duration_min: 95,
  },
]

const ok = () =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(flights) })

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('shows a loading message until the first response', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  ) // never resolves
  render(<App />)
  expect(screen.getByText('Loading flights...')).toBeTruthy()
})

test('renders flights once loaded', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  render(<App />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByTitle('TST1')).toBeTruthy()
})

test('polls /flights on an interval', async () => {
  const fetchMock = vi.fn(ok)
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('shows an error if the first load fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
  render(<App />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByText('Could not load flights.')).toBeTruthy()
})

test('keeps the last flights when a later poll fails', async () => {
  const fetchMock = vi
    .fn()
    .mockImplementationOnce(ok)
    .mockRejectedValue(new Error('network'))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
  expect(screen.getByTitle('TST1')).toBeTruthy()
  expect(screen.getByText('Connection lost, retrying...')).toBeTruthy()
})
