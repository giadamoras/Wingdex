import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { fetchFlights } from './api'
import type { Flight } from './types'
import {
  POLL_INTERVAL_MS,
  RETRY_FEEDBACK_MS,
  STALLED_AFTER,
  useFlights,
} from './useFlights'

vi.mock('./api', () => ({ fetchFlights: vi.fn() }))

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

// A request the test resolves or rejects by hand, to control when it finishes.
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
const calls = () => vi.mocked(fetchFlights).mock.calls.length

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(fetchFlights).mockReset()
})
// Unmount each test's hook, so its listeners don't answer the next test's events.
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

test('a slow request is not overtaken: ticks are skipped until it finishes', async () => {
  const first = deferred<Flight[]>()
  vi.mocked(fetchFlights)
    .mockReturnValueOnce(first.promise)
    .mockResolvedValue([flight])
  renderHook(() => useFlights())

  await advance(POLL_INTERVAL_MS * 3)
  expect(calls()).toBe(1)

  await act(async () => first.resolve([flight]))
  await advance(POLL_INTERVAL_MS)
  expect(calls()).toBe(2)
})

test('unmounting aborts the pending request and ignores its result', async () => {
  const pending = deferred<Flight[]>()
  vi.mocked(fetchFlights).mockReturnValue(pending.promise)
  const { result, unmount } = renderHook(() => useFlights())
  const signal = vi.mocked(fetchFlights).mock.calls[0][0]
  expect(signal?.aborted).toBe(false)

  unmount()
  expect(signal?.aborted).toBe(true)

  await act(async () => pending.resolve([flight]))
  expect(result.current.flights).toBeNull()
})

test('retries back off while polls keep failing, up to every 30 s', async () => {
  vi.mocked(fetchFlights).mockRejectedValue(new Error('network'))
  renderHook(() => useFlights())

  await advance(0)
  expect(calls()).toBe(1)
  await advance(5_000) // 5 s: skipped
  expect(calls()).toBe(1)
  await advance(5_000) // 10 s: second attempt
  expect(calls()).toBe(2)
  await advance(15_000) // 25 s: three ticks skipped
  expect(calls()).toBe(2)
  await advance(5_000) // 30 s: third attempt
  expect(calls()).toBe(3)
  await advance(25_000) // 55 s: five ticks skipped, the cap
  expect(calls()).toBe(3)
  await advance(5_000) // 60 s
  expect(calls()).toBe(4)
  await advance(30_000) // 90 s: still every 30 s
  expect(calls()).toBe(5)
})

test('the feed is stalled after three failures in a row', async () => {
  vi.mocked(fetchFlights).mockRejectedValue(new Error('network'))
  const { result } = renderHook(() => useFlights())
  expect(STALLED_AFTER).toBe(3)

  await advance(0) // 1st failure
  expect(result.current.error).toBe(true)
  expect(result.current.stalled).toBe(false)
  await advance(10_000) // 2nd failure
  expect(result.current.stalled).toBe(false)
  await advance(20_000) // 3rd failure
  expect(result.current.stalled).toBe(true)
})

test('a success resets the failures and the normal pace', async () => {
  vi.mocked(fetchFlights)
    .mockRejectedValueOnce(new Error('network'))
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue([flight])
  const { result } = renderHook(() => useFlights())

  await advance(30_000) // fails at 0 s and 10 s, succeeds at 30 s
  expect(calls()).toBe(3)
  expect(result.current.error).toBe(false)
  expect(result.current.flights).toEqual([flight])

  await advance(POLL_INTERVAL_MS) // back to polling every tick
  expect(calls()).toBe(4)
})

test('retry asks again at once, even while backing off', async () => {
  vi.mocked(fetchFlights)
    .mockRejectedValueOnce(new Error('network'))
    .mockRejectedValueOnce(new Error('network'))
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue([flight])
  const { result } = renderHook(() => useFlights())

  await advance(30_000)
  expect(result.current.stalled).toBe(true)
  expect(calls()).toBe(3)

  await act(async () => result.current.retry())
  expect(calls()).toBe(4)
  expect(result.current.stalled).toBe(false)
  expect(result.current.flights).toEqual([flight])
})

test('retrying shows for a moment even when the retry fails at once', async () => {
  vi.mocked(fetchFlights).mockRejectedValue(new Error('network'))
  const { result } = renderHook(() => useFlights())
  await advance(0)
  expect(result.current.retrying).toBe(false)

  await act(async () => result.current.retry())
  expect(result.current.retrying).toBe(true)
  await advance(RETRY_FEEDBACK_MS - 1)
  expect(result.current.retrying).toBe(true)
  await advance(1)
  expect(result.current.retrying).toBe(false)
})

test('a slow retry stays on until the request answers', async () => {
  const slow = deferred<Flight[]>()
  vi.mocked(fetchFlights)
    .mockRejectedValueOnce(new Error('network'))
    .mockReturnValueOnce(slow.promise)
  const { result } = renderHook(() => useFlights())
  await advance(0)

  await act(async () => result.current.retry())
  await advance(RETRY_FEEDBACK_MS * 5)
  expect(result.current.retrying).toBe(true)

  await act(async () => slow.resolve([flight]))
  await advance(0)
  expect(result.current.retrying).toBe(false)
  expect(result.current.flights).toEqual([flight])
})

test('retry replaces a request that is hanging', async () => {
  const hung = deferred<Flight[]>()
  vi.mocked(fetchFlights)
    .mockReturnValueOnce(hung.promise)
    .mockResolvedValue([flight])
  const { result } = renderHook(() => useFlights())
  const hungSignal = vi.mocked(fetchFlights).mock.calls[0][0]

  await act(async () => result.current.retry())
  expect(hungSignal?.aborted).toBe(true)
  expect(calls()).toBe(2)
  expect(result.current.flights).toEqual([flight])

  // The abandoned request finishing late changes nothing.
  await act(async () => hung.resolve([{ ...flight, id: 'old' }]))
  expect(result.current.flights).toEqual([flight])
})

// Hides or shows the tab, as the browser does when the player switches away.
function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

test('polling pauses while the tab is hidden and resumes at once on return', async () => {
  vi.mocked(fetchFlights).mockResolvedValue([flight])
  renderHook(() => useFlights())
  await advance(0)
  expect(calls()).toBe(1)

  try {
    await act(async () => setHidden(true))
    await advance(POLL_INTERVAL_MS * 10)
    expect(calls()).toBe(1) // nothing while hidden

    await act(async () => setHidden(false))
    expect(calls()).toBe(2) // straight away, not at the next tick
    await advance(POLL_INTERVAL_MS)
    expect(calls()).toBe(3) // and the usual pace again
  } finally {
    // Back to jsdom's own getter (always visible) for the other tests.
    delete (document as { hidden?: boolean }).hidden
  }
})
