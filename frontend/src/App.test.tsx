import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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

const second = {
  ...flights[0],
  id: 'f2',
  callsign: 'TST2',
  aircraft_type: 'B748',
}
const two = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([...flights, second]),
  })

test('clicking a dot opens a card with details and a fact', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  render(<App />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  expect(screen.getByRole('heading', { name: 'TST1' })).toBeTruthy()
  expect(screen.getByText(/36,000 ft/)).toBeTruthy()
  expect(screen.getByText(/digital fly-by-wire/)).toBeTruthy()
})

test('selecting another dot replaces the card; Catch closes it', async () => {
  vi.stubGlobal('fetch', vi.fn(two))
  render(<App />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  fireEvent.click(screen.getByTitle('TST2'))
  expect(screen.queryByRole('heading', { name: 'TST1' })).toBeNull()
  expect(screen.getByRole('heading', { name: 'TST2' })).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  expect(screen.queryByRole('heading', { name: 'TST2' })).toBeNull()
})

test('a flight that leaves the feed stays on the map until dismissed', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementationOnce(two).mockImplementation(ok),
  )
  render(<App />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST2'))
  await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
  expect(screen.getByTitle('TST2')).toBeTruthy()
  expect(screen.getByText(/Signal lost/)).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  expect(screen.queryByTitle('TST2')).toBeNull()
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

const longHaul = {
  ...flights[0],
  id: 'f3',
  callsign: 'TST3',
  duration_min: 500,
}

const withLongHaul = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([...flights, longHaul]),
  })

test('catching a long-haul flight completes the quest', async () => {
  vi.stubGlobal('fetch', vi.fn(withLongHaul))
  render(<App />)
  await act(() => vi.advanceTimersByTimeAsync(0))

  // Short flight: no stamp
  fireEvent.click(screen.getByTitle('TST1'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  expect(screen.queryByText('Done!')).toBeNull()

  // Long-haul flight: stamp appears
  fireEvent.click(screen.getByTitle('TST3'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  expect(screen.getByText('Done!')).toBeTruthy()
})
