import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { fetchRoute } from '../data/api'
import type { Flight, FlightRoute } from '../data/types'
import {
  ROUTE_LOOKUP_DELAY_MS,
  ROUTE_TTL_MS,
  useFlightRoute,
} from './useFlightRoute'

vi.mock('../data/api', () => ({ fetchRoute: vi.fn() }))

// A live flight: no route yet, so the hook has to look it up.
const flight: Flight = {
  id: 'f1',
  callsign: 'TST1',
  aircraft_type: null,
  latitude: 50,
  longitude: 0,
  altitude_ft: 36000,
  heading: 90,
  speed_kt: 450,
  duration_min: null,
  origin: null,
  destination: null,
}
const route: FlightRoute = {
  aircraft_type: 'A320',
  origin: null,
  destination: null,
  duration_min: null,
  duration_estimated: false,
}

const calls = () => vi.mocked(fetchRoute).mock.calls.length
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
// Waits out the pause before a selected flight is looked up.
const settle = () => advance(ROUTE_LOOKUP_DELAY_MS)

// Selects a flight, lets the lookup finish, then deselects it.
async function tapAndLeave(
  rerender: (props: { f: Flight | null }) => void,
  f: Flight,
) {
  rerender({ f })
  await settle()
  rerender({ f: null })
}

function setup() {
  return renderHook(({ f }) => useFlightRoute(f), {
    initialProps: { f: null as Flight | null },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(fetchRoute).mockReset()
})
afterEach(() => vi.useRealTimers())

test('an answer is reused within the time limit', async () => {
  vi.mocked(fetchRoute).mockResolvedValue(route)
  const { result, rerender } = setup()
  await tapAndLeave(rerender, flight)
  await advance(ROUTE_TTL_MS - 1000)

  rerender({ f: flight })
  expect(result.current.status).toBe('ready')
  expect(calls()).toBe(1)
})

test('an old answer stays on screen while it is looked up again', async () => {
  vi.mocked(fetchRoute).mockResolvedValue(route)
  const { result, rerender } = setup()
  await tapAndLeave(rerender, flight)
  await advance(ROUTE_TTL_MS)

  let answer!: (r: FlightRoute | null) => void
  vi.mocked(fetchRoute).mockReturnValue(
    new Promise((resolve) => (answer = resolve)),
  )
  rerender({ f: flight })
  expect(result.current.status).toBe('ready') // the old answer, not "loading"
  await settle()
  expect(calls()).toBe(2)

  await act(async () => answer({ ...route, aircraft_type: 'B77W' }))
  expect(result.current.route?.aircraft_type).toBe('B77W') // replaced
})

test('a selected flight does not get stuck when its answer grows old', async () => {
  vi.mocked(fetchRoute).mockResolvedValue(route)
  const { result, rerender } = setup()
  rerender({ f: flight })
  await settle()
  await advance(ROUTE_TTL_MS + 1000) // the poll keeps re-rendering the open card

  rerender({ f: { ...flight, latitude: 51 } })
  expect(result.current.status).toBe('ready') // never "loading" with nothing coming
})

test('an old answer is kept when the new lookup fails', async () => {
  vi.mocked(fetchRoute).mockResolvedValue(route)
  const { result, rerender } = setup()
  await tapAndLeave(rerender, flight)
  await advance(ROUTE_TTL_MS)

  vi.mocked(fetchRoute).mockRejectedValue(new Error('503'))
  rerender({ f: flight })
  await settle()
  expect(result.current.status).toBe('ready')
})

test('leaving the flight cancels the lookup in progress', async () => {
  vi.mocked(fetchRoute).mockReturnValue(new Promise(() => {}))
  const { rerender } = setup()
  rerender({ f: flight })
  await settle()
  const signal = vi.mocked(fetchRoute).mock.calls[0][1]
  expect(signal?.aborted).toBe(false)

  rerender({ f: null })
  expect(signal?.aborted).toBe(true)
})

test('"unknown" is asked again after the time limit', async () => {
  vi.mocked(fetchRoute).mockResolvedValue(null)
  const { result, rerender } = setup()
  await tapAndLeave(rerender, flight)

  rerender({ f: flight })
  expect(result.current.status).toBe('unknown')
  expect(calls()).toBe(1) // still remembered
  rerender({ f: null })

  await advance(ROUTE_TTL_MS)
  vi.mocked(fetchRoute).mockResolvedValue(route) // adsbdb has learned the plane
  rerender({ f: flight })
  await settle()
  expect(result.current.status).toBe('ready')
  expect(calls()).toBe(2)
})

test('after a failure, tapping again shows loading, then the answer', async () => {
  vi.mocked(fetchRoute).mockRejectedValueOnce(new Error('503'))
  const { result, rerender } = setup()
  rerender({ f: flight })
  await settle()
  expect(result.current.status).toBe('unknown') // the lookup failed

  rerender({ f: null })
  let answer!: (r: FlightRoute) => void
  vi.mocked(fetchRoute).mockReturnValue(
    new Promise<FlightRoute>((resolve) => (answer = resolve)),
  )
  rerender({ f: flight })
  expect(result.current.status).toBe('loading') // not the old failure
  await settle()
  expect(calls()).toBe(2)

  await act(async () => answer(route))
  expect(result.current.status).toBe('ready')
})

test('only the plane you stop on is looked up', async () => {
  vi.mocked(fetchRoute).mockResolvedValue(route)
  const { result, rerender } = setup()
  const other = { ...flight, id: 'f2' }
  rerender({ f: flight })
  await advance(ROUTE_LOOKUP_DELAY_MS - 1)
  rerender({ f: other }) // tapped another plane before the pause was over
  expect(result.current.status).toBe('loading')
  expect(calls()).toBe(0)

  await settle()
  expect(calls()).toBe(1)
  expect(vi.mocked(fetchRoute).mock.calls[0][0]).toBe('f2')
})

test('a plane deselected within the pause is never looked up', async () => {
  const { rerender } = setup()
  rerender({ f: flight })
  await advance(ROUTE_LOOKUP_DELAY_MS - 1)
  rerender({ f: null })
  await advance(ROUTE_TTL_MS)
  expect(calls()).toBe(0)
})

test('a plane with a recent answer is shown at once, with no pause', async () => {
  vi.mocked(fetchRoute).mockResolvedValue(route)
  const { result, rerender } = setup()
  await tapAndLeave(rerender, flight)

  rerender({ f: flight })
  expect(result.current.status).toBe('ready') // no waiting
  await advance(ROUTE_LOOKUP_DELAY_MS * 2)
  expect(calls()).toBe(1)
})

test('a flight that already has its route needs no lookup', () => {
  const full = {
    ...flight,
    origin: { icao: 'EGLL', iata: 'LHR', latitude: 51, longitude: 0 },
    destination: { icao: 'KJFK', iata: 'JFK', latitude: 40, longitude: -73 },
  } as Flight
  const { result } = renderHook(() => useFlightRoute(full))
  expect(result.current.status).toBe('idle')
  expect(calls()).toBe(0)
})
