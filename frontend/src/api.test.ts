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

test('a fast response returns its data and leaves no timer behind', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => [{ id: 'f1' }] })),
  )
  await expect(fetchFlights()).resolves.toEqual([{ id: 'f1' }])
  expect(vi.getTimerCount()).toBe(0)
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
