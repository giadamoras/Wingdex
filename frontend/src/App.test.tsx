import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { saveDailyQuest } from './dailyQuest'
import { dayKey } from './dates'
import { saveJournal } from './journal'
import { QUEST_TEMPLATES } from './quest'
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
beforeEach(() => {
  vi.useFakeTimers()
  scrollTo.mockClear()
  window.scrollTo = scrollTo
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear() // the Journal persists, so wipe it between tests
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
  const { container } = render(<App />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  expect(screen.getByRole('heading', { name: 'TST1' })).toBeTruthy()
  expect(screen.getByText(/36,000 ft/)).toBeTruthy()
  // Which fact shows depends on the flight and day, so only check there is one.
  expect(container.querySelector('.fact')?.textContent).toBeTruthy()
  expect(screen.getByText('450 kt')).toBeTruthy()
  expect(screen.getByText('LHR → CDG')).toBeTruthy()
})

test('the fact on the card stays the same across polls', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  const { container } = render(<App />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  const fact = container.querySelector('.fact')?.textContent
  await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3))
  expect(container.querySelector('.fact')?.textContent).toBe(fact)
})

test('the card hides the route when the source does not know it', async () => {
  const noRoute = { ...flights[0], origin: null, destination: null }
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([noRoute]) }),
    ),
  )
  const { container } = render(<App />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST1'))
  expect(screen.queryByText(/→/)).toBeNull()
  // No route: no journey button and no route line on the map.
  expect(screen.queryByRole('button', { name: 'See the journey' })).toBeNull()
  expect(container.querySelector('.route-lines')).toBeNull()
})

test('selecting a flight draws its route with both airport codes', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  const { container } = render(<App />)
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
  const { container } = render(<App />)
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
  const { container } = render(<App />)
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
  render(<App />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByTitle('TST1').classList.contains('jump')).toBe(false)
  await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
  expect(screen.getByTitle('TST1').classList.contains('jump')).toBe(true)
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

// Locks in today's quest, so tests don't depend on which one the date picks.
const pinQuest = (questId: string) => saveDailyQuest({ day: dayKey(), questId })

test('catching a long-haul flight completes the quest', async () => {
  pinQuest('long-haul')
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

test('a flight caught today cannot be caught again', async () => {
  vi.stubGlobal('fetch', vi.fn(ok))
  render(<App />)
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
  render(<App />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByText(/No catches yet/)).toBeTruthy()

  fireEvent.click(screen.getByTitle('TST1'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  fireEvent.click(screen.getByTitle('TST3'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))

  expect(screen.getByRole('heading', { name: 'Journal (2)' })).toBeTruthy()
  const items = screen.getAllByRole('listitem')
  expect(items).toHaveLength(2)
  expect(items[0].textContent).toContain('TST3')
  expect(items[1].textContent).toContain('TST1')
})

test('catches and the quest stamp survive a reload', async () => {
  pinQuest('long-haul')
  vi.stubGlobal('fetch', vi.fn(withLongHaul))
  render(<App />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST3'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))

  // Unmount and render a fresh App: state is gone, only localStorage remains.
  cleanup()
  render(<App />)
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
  render(<App />)
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
  const { container } = render(<App />)
  expect(questTitle(container)).toBe("Finding today's quest...")
  await act(() => vi.advanceTimersByTimeAsync(0))
  const title = questTitle(container)
  expect(QUEST_TEMPLATES.map((q) => q.title)).toContain(title)

  // Fresh App with a different feed: the saved pick wins.
  cleanup()
  vi.stubGlobal('fetch', vi.fn(ok))
  const again = render(<App />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(questTitle(again.container)).toBe(title)
})

test("yesterday's quest is replaced by a new pick", async () => {
  vi.setSystemTime(new Date(2026, 8, 28, 12, 0))
  saveDailyQuest({ day: '2026-09-27', questId: 'ocean' })
  vi.stubGlobal('fetch', vi.fn(withLongHaul))
  const { container } = render(<App />)
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
  render(<App />)
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
  render(<App />)
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
  render(<App />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(screen.getByTitle('TST3'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  fireEvent.click(screen.getByTitle('TST4'))
  fireEvent.click(screen.getByRole('button', { name: 'Catch' }))
  expect(scrollTo).toHaveBeenCalledTimes(1)
})
