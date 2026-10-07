import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { fetchWeather } from './api'
import { QUEST_STORAGE_KEY, saveDailyQuest } from './dailyQuest'
import { dayKey } from './dates'
import { saveJournal } from './journal'
import { JournalProvider } from './JournalContext'
import { markOnboardingSeen } from './onboardingSeen'
import { QUEST_TEMPLATES } from './quest'
import type { WeatherArea } from './types'
import { POLL_INTERVAL_MS, RETRY_FEEDBACK_MS } from './useFlights'
import { WEATHER_POLL_MS, WEATHER_RETRY_MS } from './useWeather'

// Only the weather request is replaced. The tests below stub the global fetch
// in the order flights are requested, and a second request on mount would
// break that, so weather gets its own mock (set per test in beforeEach).
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  fetchWeather: vi.fn(),
}))

// Every render needs the Journal Context that main.tsx normally provides.
const renderApp = () => render(<App />, { wrapper: JournalProvider })

const flights = [
  {
    id: 'f1',
    callsign: 'TST1',
    aircraft_type: 'A320',
    latitude: 50,
    longitude: 0,
    altitude_ft: 36000,
    heading: 90.4, // not a whole number, like a real live-data heading
    speed_kt: 450,
    duration_min: 95,
    origin: {
      icao: 'EGLL',
      iata: 'LHR',
      name: 'London Heathrow',
      latitude: 51.47,
      longitude: -0.45,
    },
    destination: {
      icao: 'LFPG',
      iata: 'CDG',
      name: 'Paris Charles de Gaulle',
      latitude: 49.01,
      longitude: 2.55,
    },
  },
]

const ok = () =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(flights) })

// jsdom doesn't implement scrollTo, so stub it (and let tests check it).
const scrollTo = vi.fn()
// jsdom has no matchMedia at all. Most tests leave it unset (prefersReducedMotion
// then defaults to false, same as a real browser with no preference set) -
// the replay tests specifically need that, to see the actual ghost animation.
// Tests that don't care about animation and just want Framer Motion's
// components to behave synchronously (see the badge popup tests) can stub it
// to "reduced" themselves.
const reducedMotion = () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true })
}

beforeEach(() => {
  vi.useFakeTimers()
  scrollTo.mockClear()
  window.scrollTo = scrollTo
  vi.mocked(fetchWeather).mockResolvedValue([]) // no weather unless a test adds some
  // Onboarding is a separate feature (see the dedicated tests near the
  // bottom of this file), so keep it out of everything else's way.
  markOnboardingSeen()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  // @ts-expect-error test-only cleanup of the per-test stub above
  delete window.matchMedia
  localStorage.clear() // the Journal persists, so wipe it between tests
})

test('shows a loading message until the first response', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  ) // never resolves
  renderApp()
  expect(screen.getByText('Loading flights...')).toBeTruthy()
})

test('renders flights once loaded', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByTitle('TST1')).toBeTruthy()
})

test('polls /flights on an interval', async () => {
  const fetchMock = vi.fn(ok)
  vi.stubGlobal('fetch', fetchMock)
  renderApp()
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
  const { container } = renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  expect(screen.getByRole('heading', { name: 'TST1' })).toBeTruthy()
  expect(screen.getByText(/36,000 ft/)).toBeTruthy()
  // Which fact shows depends on the flight and day, so only check there is one.
  expect(container.querySelector('.fact')?.textContent).toBeTruthy()
  expect(screen.getByText('90°')).toBeTruthy() // rounded from 90.4
  expect(screen.getByText('450 kt')).toBeTruthy()
  expect(screen.getByText('LHR → CDG')).toBeTruthy()
})

test('the fact on the card stays the same across polls', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  const { container } = renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  const fact = container.querySelector('.fact')?.textContent
  await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3))
  expect(container.querySelector('.fact')?.textContent).toBe(fact)
})

// A live feed: no type, duration or route in /flights, and the backend's
// /flights/{id}/route answered by `route` (a status, a body, or "down").
const liveFlight = {
  ...flights[0],
  aircraft_type: null,
  duration_min: null,
  origin: null,
  destination: null,
}
const liveFeed = (route: 'down' | { status: number; body?: unknown }) =>
  vi.fn((url: string) => {
    if (!url.includes('/route'))
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([liveFlight]),
      })
    if (route === 'down') return Promise.reject(new Error('down'))
    return Promise.resolve({
      ok: route.status < 400,
      status: route.status,
      json: () => Promise.resolve(route.body),
    })
  })

const foundRoute = {
  aircraft_type: 'B77W',
  origin: flights[0].origin,
  destination: flights[0].destination,
  duration_min: 95,
  duration_estimated: true,
}

test('the card hides the route when the source does not know it', async () => {
  vi.stubGlobal('fetch', liveFeed({ status: 404 }))
  const { container } = renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.queryByText(/→/)).toBeNull()
  expect(screen.getByText('Route unknown')).toBeTruthy()
  // No route: no journey button, no route line, and no type or duration chip.
  expect(screen.queryByRole('button', { name: 'See the journey' })).toBeNull()
  expect(container.querySelector('.route-lines')).toBeNull()
  expect(container.querySelector('.chip.estimate')).toBeNull()
  expect(container.querySelectorAll('.card-head .chip')).toHaveLength(3) // ft, heading, kt
})

test('a live flight is looked up when tapped, and the card fills in', async () => {
  const fetchMock = liveFeed({ status: 200, body: foundRoute })
  vi.stubGlobal('fetch', fetchMock)
  const { container } = renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  expect(screen.getByText('Looking up route…')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'See the journey' })).toBeNull()

  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.queryByText('Looking up route…')).toBeNull()
  expect(screen.getByText('LHR → CDG')).toBeTruthy()
  expect(screen.getByText('B77W')).toBeTruthy() // the type, learned by the lookup
  // The duration is an estimate, so it is marked with "~" and a dashed chip.
  const estimate = container.querySelector('.chip.estimate')
  expect(estimate?.textContent).toBe('~1h 35m')
  expect(screen.getByRole('button', { name: 'See the journey' })).toBeTruthy()
  expect(container.querySelector('.route-flown')).toBeTruthy()
  expect(String(fetchMock.mock.calls.at(-1)?.[0])).toMatch(
    /\/flights\/f1\/route$/,
  )
})

test('the route is kept: reselecting a flight does not look it up again', async () => {
  const fetchMock = liveFeed({ status: 200, body: foundRoute })
  vi.stubGlobal('fetch', fetchMock)
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1')) // deselect
  fireEvent.click(screen.getByTitle('TST1'))
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByText('LHR → CDG')).toBeTruthy()
  const routeCalls = fetchMock.mock.calls.filter(([url]) =>
    String(url).includes('/route'),
  )
  expect(routeCalls).toHaveLength(1)
})

test('when the lookup service is down the card says the route is unknown', async () => {
  vi.stubGlobal('fetch', liveFeed('down'))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByText('Route unknown')).toBeTruthy()
  // The rest of the card still works, including catching.
  expect(screen.getByRole('button', { name: 'Catch' })).toBeTruthy()
})

test('a catch keeps the looked-up route in the Journal', async () => {
  vi.stubGlobal('fetch', liveFeed({ status: 200, body: foundRoute }))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  fireEvent.click(screen.getByRole('button', { name: '📘 Collection' }))
  // The Journal stamp is about the destination, which only the lookup knew.
  expect(screen.getByRole('listitem').textContent).toContain('CDG')
})

test('a flight whose feed already has a route makes no lookup', async () => {
  const fetchMock = vi.fn((url: string) => {
    void url // typed so the calls below can be inspected
    return ok()
  })
  vi.stubGlobal('fetch', fetchMock)
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByText('LHR → CDG')).toBeTruthy()
  expect(
    fetchMock.mock.calls.some(([url]) => String(url).includes('/route')),
  ).toBe(false)
})

test('selecting a flight draws its route with both airport codes', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  const { container } = renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(container.querySelector('.route-lines')).toBeNull()

  fireEvent.click(screen.getByTitle('TST1'))
  expect(container.querySelector('.route-flown')).toBeTruthy()
  expect(container.querySelector('.route-ahead')).toBeTruthy()
  expect(screen.getByText('LHR')).toBeTruthy()
  expect(screen.getByText('CDG')).toBeTruthy()
})

test('the journey replay flies a ghost, then offers to replay', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  const { container } = renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  fireEvent.click(screen.getByRole('button', { name: 'See the journey' }))

  // 95 min flight: 3 s of flying (the minimum), plus fitting and landing.
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy()
  expect(container.querySelector('.ghost')).toBeTruthy()
  expect(container.querySelector('.route-trail')).toBeTruthy()

  await act(() => vi.advanceTimersByTimeAsync(3500))
  expect(container.querySelector('.ghost')).toBeNull()
  expect(screen.getByRole('button', { name: 'Replay journey' })).toBeTruthy()
})

test('Stop and selecting another flight both end the replay', async () => {
  vi.stubGlobal('fetch', vi.fn(two))
  const { container } = renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))

  fireEvent.click(screen.getByRole('button', { name: 'See the journey' }))
  await act(() => vi.advanceTimersByTimeAsync(1000))
  fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
  expect(container.querySelector('.ghost')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Replay journey' }))
  await act(() => vi.advanceTimersByTimeAsync(1000))
  fireEvent.click(screen.getByTitle('TST2'))
  expect(container.querySelector('.ghost')).toBeNull()
  // A fresh flight starts with the first-time label.
  expect(screen.getByRole('button', { name: 'See the journey' })).toBeTruthy()
})

test('a flight that jumps between polls snaps instead of sliding', async () => {
  // Second poll: the flight is back near its origin, far from where it was.
  const restarted = { ...flights[0], latitude: 40, longitude: -10 }
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementationOnce(ok)
      .mockImplementation(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve([restarted]) }),
      ),
  )
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByTitle('TST1').classList.contains('jump')).toBe(false)
  await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
  expect(screen.getByTitle('TST1').classList.contains('jump')).toBe(true)
})

test('selecting another dot replaces the card; Catch closes it', async () => {
  vi.stubGlobal('fetch', vi.fn(two))
  renderApp()
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
  renderApp()
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
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByText('Could not load flights.')).toBeTruthy()
})

test('keeps the last flights when a later poll fails', async () => {
  const fetchMock = vi
    .fn()
    .mockImplementationOnce(ok)
    .mockRejectedValue(new Error('network'))
  vi.stubGlobal('fetch', fetchMock)
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
  expect(screen.getByTitle('TST1')).toBeTruthy()
  expect(screen.getByText('Connection lost, retrying...')).toBeTruthy()
})

test('after three failed polls in a row it asks for a manual retry', async () => {
  const fetchMock = vi
    .fn()
    .mockImplementationOnce(ok)
    .mockRejectedValue(new Error('network'))
  vi.stubGlobal('fetch', fetchMock)
  renderApp()
  // First poll works; the next three attempts (at 5, 15 and 35 s) fail.
  await act(() => vi.advanceTimersByTimeAsync(35_000))
  expect(screen.getByTitle('TST1')).toBeTruthy() // the last planes stay
  expect(screen.getByText(/reach the flight feed/)).toBeTruthy()
  expect(screen.queryByText(/Connection lost/)).toBeNull()

  fetchMock.mockImplementation(ok)
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  // The tap shows at once that a request is out, and the button goes away.
  expect(screen.getByText('Trying again...')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.queryByText(/reach the flight feed/)).toBeNull()
  expect(screen.getByTitle('TST1')).toBeTruthy()
})

test('the first load can be retried by hand', async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error('network'))
  fetchMock.mockImplementation(ok)
  vi.stubGlobal('fetch', fetchMock)
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByText('Could not load flights.')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  // The tap shows at once that a request is out, and the button goes away.
  expect(screen.getByText('Loading flights...')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByTitle('TST1')).toBeTruthy()
})

test('a retry that fails at once still shows that it tried', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await act(() => vi.advanceTimersByTimeAsync(0)) // it has failed again by now
  expect(screen.getByText('Loading flights...')).toBeTruthy()

  await act(() => vi.advanceTimersByTimeAsync(RETRY_FEEDBACK_MS))
  expect(screen.getByText('Could not load flights.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
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

// Locks in today's quest, so tests don't depend on which one the date picks.
const pinQuest = (questId: string) => saveDailyQuest({ day: dayKey(), questId })

test('catching a long-haul flight completes the quest', async () => {
  pinQuest('long-haul')
  vi.stubGlobal('fetch', vi.fn(withLongHaul))
  renderApp()
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

test('a flight caught today cannot be caught again', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))

  // Reopening the card shows the caught marker instead of the button.
  fireEvent.click(screen.getByTitle('TST1'))
  expect(screen.queryByRole('button', { name: 'Catch' })).toBeNull()
  expect(screen.getByText('Caught today ✓')).toBeTruthy()
})

test('catches appear in the Journal, newest first', async () => {
  vi.stubGlobal('fetch', vi.fn(withLongHaul))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))

  // The Journal lives in the Collection screen, reached from the header.
  fireEvent.click(screen.getByRole('button', { name: '📘 Collection' }))
  expect(screen.getByText(/No catches yet/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '🗺 Map' }))

  fireEvent.click(screen.getByTitle('TST1'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  fireEvent.click(screen.getByTitle('TST3'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))

  fireEvent.click(screen.getByRole('button', { name: '📘 Collection' }))
  expect(screen.getByRole('heading', { name: 'Journal (2)' })).toBeTruthy()
  const items = screen.getAllByRole('listitem')
  expect(items).toHaveLength(2)
  expect(items[0].textContent).toContain('TST3')
  expect(items[1].textContent).toContain('TST1')
})

test('catches and the quest stamp survive a reload', async () => {
  pinQuest('long-haul')
  vi.stubGlobal('fetch', vi.fn(withLongHaul))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST3'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))

  // Unmount and render a fresh App: state is gone, only localStorage remains.
  cleanup()
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByText('Done!')).toBeTruthy()
  fireEvent.click(screen.getByTitle('TST3'))
  expect(screen.getByText('Caught today ✓')).toBeTruthy()
})

test("yesterday's catches don't count for today", async () => {
  // Pin the clock so "yesterday" is exact, whatever day the tests run.
  vi.setSystemTime(new Date(2026, 8, 28, 12, 0))
  pinQuest('long-haul')
  saveJournal([
    {
      flight: longHaul,
      fact: 'A test fact.',
      caughtAt: new Date(2026, 8, 27, 12, 0).toISOString(),
    },
  ])
  vi.stubGlobal('fetch', vi.fn(withLongHaul))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))

  // The quest isn't done, and the flight can be caught again today.
  expect(screen.queryByText('Done!')).toBeNull()
  fireEvent.click(screen.getByTitle('TST3'))
  expect(screen.getByRole('button', { name: 'Catch' })).toBeTruthy()
})

const questTitle = (container: HTMLElement) =>
  container.querySelector('.quest h2')?.textContent

test('the quest is picked once per day and kept after a reload', async () => {
  vi.stubGlobal('fetch', vi.fn(withLongHaul))
  const { container } = renderApp()
  expect(questTitle(container)).toBe("Finding today's quest...")
  await act(() => vi.advanceTimersByTimeAsync(0))
  const title = questTitle(container)
  expect(QUEST_TEMPLATES.map((q) => q.title)).toContain(title)

  // Fresh App with a different feed: the saved pick wins.
  cleanup()
  vi.stubGlobal('fetch', vi.fn(ok))
  const again = renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(questTitle(again.container)).toBe(title)
})

test('a quest picked earlier today shows even when the backend is down', async () => {
  pinQuest('long-haul')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
  const { container } = renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  const pinned = QUEST_TEMPLATES.find((q) => q.id === 'long-haul')!
  expect(questTitle(container)).toBe(pinned.title)
})

test('the quest stays when the signal is lost after the first load', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementationOnce(withLongHaul)
      .mockRejectedValue(new Error('network')),
  )
  const { container } = renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  const title = questTitle(container)
  expect(QUEST_TEMPLATES.map((q) => q.title)).toContain(title)

  // Long enough for three polls in a row to fail: the feed is stalled.
  await act(() => vi.advanceTimersByTimeAsync(35_000))
  expect(screen.getByText(/reach the flight feed/)).toBeTruthy()
  expect(questTitle(container)).toBe(title)
})

test('with no quest yet and the first load failing, it says the quest will appear', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
  const { container } = renderApp()
  expect(questTitle(container)).toBe("Finding today's quest...")
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(questTitle(container)).toBe(
    "Today's quest will appear once flights load.",
  )

  // A retry goes back to "finding", and a working feed gives the quest.
  vi.stubGlobal('fetch', vi.fn(withLongHaul))
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(questTitle(container)).toBe("Finding today's quest...")
  await act(() => vi.advanceTimersByTimeAsync(RETRY_FEEDBACK_MS))
  expect(QUEST_TEMPLATES.map((q) => q.title)).toContain(questTitle(container))
})

test("yesterday's quest is replaced by a new pick", async () => {
  vi.setSystemTime(new Date(2026, 8, 28, 12, 0))
  saveDailyQuest({ day: '2026-09-27', questId: 'ocean' })
  vi.stubGlobal('fetch', vi.fn(withLongHaul))
  const { container } = renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  // Nothing in the test feed is over open ocean, so it can't be the new pick.
  const ocean = QUEST_TEMPLATES.find((q) => q.id === 'ocean')!
  expect(questTitle(container)).not.toBe(ocean.title)
  expect(questTitle(container)).not.toBe("Finding today's quest...")
})

test('featured flights get a ring until they are caught', async () => {
  pinQuest('long-haul')
  // TST3 completes the quest; TST2 is the only B748, so the rarest type.
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([...flights, second, longHaul]),
      }),
    ),
  )
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  const featured = (title: string) =>
    screen.getByTitle(title).classList.contains('featured')
  expect(featured('TST3')).toBe(true)
  expect(featured('TST2')).toBe(true)
  expect(featured('TST1')).toBe(false)

  fireEvent.click(screen.getByTitle('TST2'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  expect(featured('TST2')).toBe(false)
})

test('catching the quest flight scrolls back up to the quest strip', async () => {
  pinQuest('long-haul')
  vi.stubGlobal('fetch', vi.fn(withLongHaul))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))

  // A flight that doesn't complete the quest leaves the scroll alone.
  fireEvent.click(screen.getByTitle('TST1'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  expect(scrollTo).not.toHaveBeenCalled()

  fireEvent.click(screen.getByTitle('TST3'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  expect(scrollTo).toHaveBeenCalledTimes(1)
  expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
})

test('catching more matching flights after the quest is done does not scroll again', async () => {
  pinQuest('long-haul')
  const another = { ...longHaul, id: 'f4', callsign: 'TST4' }
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([...flights, longHaul, another]),
      }),
    ),
  )
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST3'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  fireEvent.click(screen.getByTitle('TST4'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  expect(scrollTo).toHaveBeenCalledTimes(1)
})

test('catching a flight for the first time unlocks a badge popup', async () => {
  reducedMotion()
  vi.stubGlobal('fetch', vi.fn(ok))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))

  expect(screen.getByText('Badge unlocked!')).toBeTruthy()
  expect(screen.getByText('First Catch')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  expect(screen.queryByText('Badge unlocked!')).toBeNull()
})

test('a badge popup auto-dismisses, and a seen badge does not pop up again on reload', async () => {
  reducedMotion()
  vi.stubGlobal('fetch', vi.fn(ok))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  await act(() => vi.advanceTimersByTimeAsync(5000))
  expect(screen.queryByText('Badge unlocked!')).toBeNull()

  cleanup()
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.queryByText('Badge unlocked!')).toBeNull()
})

test('the Badges tab reflects unlocked and locked badges', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))

  fireEvent.click(screen.getByRole('button', { name: '📘 Collection' }))
  fireEvent.click(screen.getByRole('tab', { name: 'Badges' }))

  expect(screen.getByText('First Catch').closest('li')?.className).toContain(
    'unlocked',
  )
  expect(screen.getByText('Ocean Crosser').closest('li')?.className).toContain(
    'locked',
  )
})

test('Journal entries show only the stamp, not the fact', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  const { container } = renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  const fact = (container.querySelector('.fact')?.textContent ?? '')
    .replace('Did you know?', '')
    .trim()
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))

  fireEvent.click(screen.getByRole('button', { name: '📘 Collection' }))
  const entry = screen.getAllByRole('listitem')[0]
  expect(entry.textContent).not.toContain(fact)
  expect(entry.textContent).toContain('TST1') // the stamp still identifies the catch
})

test('the Facts tab shows each learned fact once, even from repeat catches', async () => {
  saveJournal([
    {
      flight: { ...flights[0], id: 'f1', callsign: 'TST1' },
      fact: 'Repeated fact.',
      caughtAt: '2026-09-20T10:00:00.000Z',
    },
    {
      flight: { ...flights[0], id: 'f5', callsign: 'TST5' },
      fact: 'Repeated fact.',
      caughtAt: '2026-09-21T10:00:00.000Z',
    },
  ])
  vi.stubGlobal('fetch', vi.fn(ok))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))

  fireEvent.click(screen.getByRole('button', { name: '📘 Collection' }))
  fireEvent.click(screen.getByRole('tab', { name: 'Facts' }))

  expect(screen.getByRole('heading', { name: 'Facts (1)' })).toBeTruthy()
  expect(screen.getAllByText('Repeated fact.')).toHaveLength(1)
})

// beforeEach marks onboarding as already seen for every test above, so these
// undo that first to exercise the "first ever visit" flow.
test('onboarding greets, prompts a catch, celebrates it, then is remembered', async () => {
  reducedMotion()
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(ok))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))

  expect(
    screen.getByText(
      'Welcome aboard! Tap a plane on the map to see it up close.',
    ),
  ).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Got it!' }))
  // Only flight in the fixture, so it's always the highlighted target.
  expect(
    screen.getByText(
      'Try catching that circled plane - or any other you like!',
    ),
  ).toBeTruthy()

  fireEvent.click(screen.getByTitle('TST1'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  expect(
    screen.getByText('Nice catch! Peek at your Collection to see it.'),
  ).toBeTruthy()
  expect(
    screen.getByRole('button', { name: /Collection/ }).className,
  ).toContain('nudge')

  await act(() => vi.advanceTimersByTimeAsync(6000)) // auto-dismiss
  expect(
    screen.queryByText('Nice catch! Peek at your Collection to see it.'),
  ).toBeNull()

  cleanup()
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.queryByText(/Welcome aboard/)).toBeNull()
})

test('onboarding can be skipped at any point, and stays skipped', async () => {
  reducedMotion()
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(ok))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))

  fireEvent.click(screen.getByRole('button', { name: 'Dismiss onboarding' }))
  expect(screen.queryByText(/Welcome aboard/)).toBeNull()

  cleanup()
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.queryByText(/Welcome aboard/)).toBeNull()
})

test("onboarding turns its bubble into a click-through hint while a card is open, so it cannot block the card's own buttons", async () => {
  reducedMotion()
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(ok))
  const { container } = renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(container.querySelector('.onboarding-bubble')).not.toBeNull()

  fireEvent.click(screen.getByTitle('TST1'))
  expect(container.querySelector('.onboarding-mascot')).not.toBeNull()
  expect(container.querySelector('.onboarding-bubble.hint')).not.toBeNull()
  expect(screen.getByText(/Hit Catch/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Got it!' })).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Dismiss onboarding' }),
  ).toBeNull()

  // Deselecting (not catching) brings the normal bubble back.
  fireEvent.click(screen.getByTitle('TST1'))
  expect(container.querySelector('.onboarding-bubble.hint')).toBeNull()
  expect(screen.getByRole('button', { name: 'Got it!' })).toBeTruthy()
})

test('the catch step rings the target plane, and the ring stays on it as the feed updates', async () => {
  reducedMotion()
  localStorage.clear()
  const feed = [
    flights[0],
    { ...flights[0], id: 'f2', callsign: 'TST2', latitude: -40 },
  ]
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(feed) }),
    ),
  )
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByTitle('TST1').className).not.toContain('target')

  fireEvent.click(screen.getByRole('button', { name: 'Got it!' }))
  expect(screen.getByTitle('TST1').className).toContain('target')

  // TST2 drifts closer to the default view than TST1; the ring must not hop.
  feed[1] = { ...feed[1], latitude: 50, longitude: 10 }
  feed[0] = { ...feed[0], latitude: 30 }
  await act(() => vi.advanceTimersByTimeAsync(6000))
  expect(screen.getByTitle('TST1').className).toContain('target')
  expect(screen.getByTitle('TST2').className).not.toContain('target')
})

test('catching a different flight than the highlighted one still completes onboarding', async () => {
  reducedMotion()
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            flights[0],
            { ...flights[0], id: 'f2', callsign: 'TST2', latitude: -40 },
          ]),
      }),
    ),
  )
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByRole('button', { name: 'Got it!' }))

  // TST1 (closer to the default view) is the highlighted one; catch TST2 instead.
  fireEvent.click(screen.getByTitle('TST2'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  expect(
    screen.getByText('Nice catch! Peek at your Collection to see it.'),
  ).toBeTruthy()
})

const storm: WeatherArea = {
  id: 'w1',
  hazard: 'thunderstorm',
  region: 'North Atlantic',
  altitude_min_ft: 0,
  altitude_max_ft: 45000,
  valid_from: 0,
  valid_to: 1,
  polygon: [
    { latitude: 46, longitude: -52 },
    { latitude: 46, longitude: -44 },
    { latitude: 51, longitude: -44 },
    { latitude: 51, longitude: -52 },
    { latitude: 46, longitude: -52 },
  ],
  movement_dir: null,
  movement_speed_kt: null,
}

test('shows weather icons from /weather on the map', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  vi.mocked(fetchWeather).mockResolvedValue([storm])
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(
    screen.getAllByTitle('Thunderstorm, North Atlantic').length,
  ).toBeGreaterThan(0)
})

test('the flight map still works when /weather fails', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  vi.mocked(fetchWeather).mockRejectedValue(new Error('network'))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByTitle('TST1')).toBeTruthy()
  expect(screen.queryByText(/Connection lost/)).toBeNull()
})

test('weather is polled far less often than flights', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3))
  expect(fetchWeather).toHaveBeenCalledTimes(1)
  await act(() => vi.advanceTimersByTimeAsync(WEATHER_POLL_MS))
  expect(fetchWeather).toHaveBeenCalledTimes(2)
})

test('the weather switch is hidden until weather loads, and a failed request is retried', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  vi.mocked(fetchWeather)
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue([storm])
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByTitle('TST1')).toBeTruthy() // the flights are fine
  expect(screen.queryByRole('button', { name: 'Weather' })).toBeNull()

  await act(() => vi.advanceTimersByTimeAsync(WEATHER_RETRY_MS))
  expect(fetchWeather).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button', { name: 'Weather' })).toBeTruthy()
})

// A storm over TST1 (50N, 0E, 36,000 ft), as opposed to the Atlantic one above.
const stormOverTst1: WeatherArea = {
  ...storm,
  id: 'w2',
  valid_to: 4_000_000_000, // storm above expired in 1970; this one is current
  polygon: [
    { latitude: 45, longitude: -5 },
    { latitude: 45, longitude: 5 },
    { latitude: 55, longitude: 5 },
    { latitude: 55, longitude: -5 },
    { latitude: 45, longitude: -5 },
  ],
}

test('catching a flight inside a thunderstorm completes the weather quest', async () => {
  pinQuest('weather-thunderstorm')
  vi.stubGlobal('fetch', vi.fn(withLongHaul))
  vi.mocked(fetchWeather).mockResolvedValue([stormOverTst1])
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))

  // TST3 shares TST1's position, so both are in the storm; a flight far away is not.
  fireEvent.click(screen.getByTitle('TST1'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  expect(screen.getByText('Done!')).toBeTruthy()
})

test('a catch outside the weather does not complete the weather quest', async () => {
  pinQuest('weather-thunderstorm')
  const faraway = { ...flights[0], id: 'f9', callsign: 'TST9', latitude: 40 }
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([flights[0], faraway]),
      }),
    ),
  )
  vi.mocked(fetchWeather).mockResolvedValue([stormOverTst1])
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))

  fireEvent.click(screen.getByTitle('TST9'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  expect(screen.queryByText('Done!')).toBeNull()
})

test('the quest stays done after the weather it was caught in has moved on', async () => {
  pinQuest('weather-thunderstorm')
  vi.stubGlobal('fetch', vi.fn(ok))
  vi.mocked(fetchWeather).mockResolvedValue([stormOverTst1])
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  expect(screen.getByText('Done!')).toBeTruthy()

  // The next weather poll has no storm any more.
  vi.mocked(fetchWeather).mockResolvedValue([])
  await act(() => vi.advanceTimersByTimeAsync(WEATHER_POLL_MS))
  expect(screen.getByText('Done!')).toBeTruthy()
})

test('a flight in a hazard shows a fact about it on its card', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  vi.mocked(fetchWeather).mockResolvedValue([stormOverTst1])
  const { container } = renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  expect(container.querySelector('.fact')?.textContent).toMatch(/thunderstorm/i)
})

test('the daily quest is not picked until the weather has loaded', async () => {
  vi.stubGlobal('fetch', vi.fn(withLongHaul))
  let resolveWeather!: (areas: WeatherArea[]) => void
  vi.mocked(fetchWeather).mockReturnValue(
    new Promise((resolve) => {
      resolveWeather = resolve
    }),
  )
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  // Flights are on the map, but no quest is chosen yet.
  expect(screen.getByTitle('TST1')).toBeTruthy()
  expect(localStorage.getItem(QUEST_STORAGE_KEY)).toBeNull()

  resolveWeather([])
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(localStorage.getItem(QUEST_STORAGE_KEY)).not.toBeNull()
})

test('a failed weather request does not block the daily quest', async () => {
  vi.stubGlobal('fetch', vi.fn(withLongHaul))
  vi.mocked(fetchWeather).mockRejectedValue(new Error('network'))
  renderApp()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(localStorage.getItem(QUEST_STORAGE_KEY)).not.toBeNull()
})
