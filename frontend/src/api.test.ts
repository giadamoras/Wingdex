import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  fetchFlights,
  fetchRoute,
  fetchWeather,
  REQUEST_TIMEOUT_MS,
} from './api'

const aborted = () => new DOMException('Aborted', 'AbortError')

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// A fetch that never answers by itself and rejects, like the real one, when
// aborted (also when the signal is already aborted).
function hangingFetch() {
  return vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        if (init?.signal?.aborted) reject(aborted())
        init?.signal?.addEventListener('abort', () => reject(aborted()))
      }),
  )
}

test.each([
  ['flights', () => fetchFlights()],
  ['weather', () => fetchWeather()],
  ['a route', () => fetchRoute('f1')],
])('a request for %s fails after the timeout', async (_name, request) => {
  vi.stubGlobal('fetch', hangingFetch())
  let settled = false
  const result = request().finally(() => (settled = true))
  const failed = expect(result).rejects.toThrow()

  await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1)
  expect(settled).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  await failed
})

test('the timeout also covers reading the body', async () => {
  // Headers arrive at once, then the body stalls until the request is aborted.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      json: () =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(aborted()))
        }),
    })),
  )
  const failed = expect(fetchFlights()).rejects.toThrow()
  await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
  await failed
})

test("the caller's signal aborts the request", async () => {
  const fetchMock = hangingFetch()
  vi.stubGlobal('fetch', fetchMock)
  const controller = new AbortController()
  const failed = expect(fetchFlights(controller.signal)).rejects.toThrow()

  controller.abort()
  await failed
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true)
})

test('a signal that is already aborted fails without waiting', async () => {
  vi.stubGlobal('fetch', hangingFetch())
  const controller = new AbortController()
  controller.abort()
  await expect(fetchFlights(controller.signal)).rejects.toThrow()
})

// A response that answers at once with this body.
const answering = (body: unknown) =>
  vi.fn(async () => ({ ok: true, json: async () => body }))

const goodFlight = {
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

test('a fast response returns its data and leaves no timer behind', async () => {
  vi.stubGlobal('fetch', answering([goodFlight]))
  await expect(fetchFlights()).resolves.toEqual([goodFlight])
  expect(vi.getTimerCount()).toBe(0)
})

test('flights: a bad row is dropped and the rest are kept', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const bad = { ...goodFlight, id: 'f2', latitude: null }
  vi.stubGlobal('fetch', answering([goodFlight, bad, 'junk']))
  await expect(fetchFlights()).resolves.toEqual([goodFlight])
  expect(warn).toHaveBeenCalledWith(
    'Dropped 2 of 3 flights with an unexpected shape',
  )
  warn.mockRestore()
})

test.each([
  ['an object', { flights: [] }],
  ['null', null],
  ['text', 'hello'],
])(
  'flights: a response that is %s, not a list, fails the poll',
  async (_n, body) => {
    vi.stubGlobal('fetch', answering(body))
    await expect(fetchFlights()).rejects.toThrow('expected a list')
  },
)

test('weather: an area with an unknown hazard is dropped', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const area = {
    id: 'w1',
    hazard: 'icing',
    region: 'Test',
    altitude_min_ft: 0,
    altitude_max_ft: 30000,
    valid_from: 1,
    valid_to: 2,
    polygon: [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
      { latitude: 1, longitude: 1 },
      { latitude: 0, longitude: 0 },
    ],
    movement_dir: null,
    movement_speed_kt: null,
  }
  vi.stubGlobal(
    'fetch',
    answering([area, { ...area, id: 'w2', hazard: 'fog' }]),
  )
  await expect(fetchWeather()).resolves.toEqual([area])
  expect(warn).toHaveBeenCalledWith(
    'Dropped 1 of 2 weather areas with an unexpected shape',
  )
  warn.mockRestore()
})

test('weather: a response that is not a list fails the request', async () => {
  vi.stubGlobal('fetch', answering({ oops: true }))
  await expect(fetchWeather()).rejects.toThrow('expected a list')
})

test('a route that is not an object fails the lookup', async () => {
  vi.stubGlobal('fetch', answering(['route']))
  await expect(fetchRoute('f1')).rejects.toThrow('expected an object')
})

test('an unknown route is null, and other errors throw', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 404 })),
  )
  await expect(fetchRoute('f1')).resolves.toBeNull()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 503 })),
  )
  await expect(fetchRoute('f1')).rejects.toThrow('503')
})
