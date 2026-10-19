import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Collection } from './Collection'
import { JournalProvider } from './JournalContext'
import { saveJournal } from './journal'
import { FACTS } from '../card/facts'
import { navigate, usePath } from '../shared-lib/usePath'
import { makeFlight } from '../testFlight'

// A fact from the pool, so it lands in a named group (an aircraft one).
const POOL_FACT = FACTS.find((f) => f.kind === 'family')!.text

beforeEach(() => {
  saveJournal([
    {
      flight: makeFlight({ id: 'f1', callsign: 'TST1' }),
      fact: 'A learned fact.',
      caughtAt: '2026-09-25T14:03:00.000Z',
    },
    {
      flight: makeFlight({ id: 'f2', callsign: 'BAW2' }),
      fact: POOL_FACT,
      caughtAt: '2026-09-25T15:03:00.000Z',
    },
  ])
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

// Reads the URL as App does and hands it down.
function Routed() {
  return <Collection path={usePath()} />
}

const renderCollection = () => render(<Routed />, { wrapper: JournalProvider })

// The count pill's text, with its screen-reader noun ("✈️ 2 catches").
const countPill = () => document.querySelector('.count-row')?.textContent

const pressed = (name: string) =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed')

test('opens on the Journal, with only that button pressed', () => {
  renderCollection()
  expect(countPill()).toBe('✈️ 2 catches')
  expect(pressed('Journal')).toBe('true')
  expect(pressed('Dex')).toBe('false')
  expect(pressed('Badges')).toBe('false')
  expect(pressed('Facts')).toBe('false')
})

test('the buttons switch between Journal, Badges and Facts', () => {
  renderCollection()

  fireEvent.click(screen.getByRole('button', { name: 'Badges' }))
  expect(screen.getByText('First Catch')).toBeTruthy()
  expect(countPill()).toBeUndefined()
  expect(pressed('Badges')).toBe('true')
  expect(pressed('Journal')).toBe('false')

  fireEvent.click(screen.getByRole('button', { name: 'Facts' }))
  expect(screen.getByText('A learned fact.')).toBeTruthy()
  expect(pressed('Facts')).toBe('true')

  fireEvent.click(screen.getByRole('button', { name: 'Journal' }))
  expect(countPill()).toBe('✈️ 2 catches')
})

test('the tab and Dex section are kept in the URL', () => {
  renderCollection()
  fireEvent.click(screen.getByRole('button', { name: 'Dex' }))
  fireEvent.click(screen.getByRole('button', { name: 'Airlines' }))
  fireEvent.click(screen.getByRole('button', { name: /^Low-cost/ }))
  expect(window.location.pathname).toBe('/collection/dex/airlines/lowCost')

  // Opening that URL lands on the same place; an unknown part falls back.
  cleanup()
  act(() => navigate(['collection', 'dex', 'passport']))
  renderCollection()
  expect(pressed('Dex')).toBe('true')
  expect(pressed('Passport')).toBe('true')
  act(() => navigate(['collection', 'nonsense']))
  expect(pressed('Journal')).toBe('true')
  // The URL always spells out the place, defaults included.
  expect(window.location.pathname).toBe('/collection/journal')
  act(() => navigate(['collection', 'dex']))
  expect(window.location.pathname).toBe('/collection/dex/aircraft/narrowBody')
})

test('the Dex counts what the Journal has caught', () => {
  renderCollection()
  fireEvent.click(screen.getByRole('button', { name: 'Dex' }))
  // Two A320s, one by a catalog airline (BAW), neither with a destination.
  expect(pressed('Aircraft')).toBe('true')
  expect(screen.getByText(/of \d+ types · 1 of \d+ families/)).toBeTruthy()

  // A family tile opens a pop-up listing its types, the caught one ticked.
  const family = screen.getByRole('button', { name: /^Airbus A320 family/ })
  expect(family.textContent).toContain('1 of 7 types caught')
  fireEvent.click(family)
  expect(
    screen.getByRole('dialog', { name: 'Airbus A320 family' }),
  ).toBeTruthy()
  expect(screen.getByText('Airbus A320', { selector: '.seen' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'OK' }))
  expect(screen.queryByRole('dialog')).toBeNull()

  // Airlines: only what was caught, plus how many of that kind are left.
  fireEvent.click(screen.getByRole('button', { name: 'Airlines' }))
  expect(screen.getByText('British Airways')).toBeTruthy()
  expect(screen.getByText('+49 to find')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^Cargo/ }))
  expect(screen.getByText('+7 to find')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Passport' }))
  expect(screen.getByText('+195 to find')).toBeTruthy()
})

test('a badge shows its description in a pop-up once tapped', () => {
  renderCollection()
  fireEvent.click(screen.getByRole('button', { name: 'Badges' }))
  const description = "Catch a flight where it's night."
  expect(screen.queryByText(description)).toBeNull()
  fireEvent.click(
    screen.getByRole('button', { name: /^Night Owl.*\(locked\)$/ }),
  )
  const dialog = screen.getByRole('dialog', { name: 'Night Owl' })
  expect(dialog.textContent).toContain(description)
  expect(dialog.textContent).toContain('Locked')
  fireEvent.click(screen.getByRole('button', { name: 'OK' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('facts are grouped by subject, with a count', () => {
  renderCollection()
  fireEvent.click(screen.getByRole('button', { name: 'Facts' }))
  expect(countPill()).toBe('💡 2 facts')
  const aircraft = screen.getByRole('heading', { name: /^Aircraft/ })
  expect(aircraft.nextElementSibling?.textContent).toBe(POOL_FACT)
  // A fact no longer in the pool is kept, under Other.
  const other = screen.getByRole('heading', { name: /^Other/ })
  expect(other.nextElementSibling?.textContent).toBe('A learned fact.')
})

test('a Journal stamp opens the details of that catch', () => {
  renderCollection()
  // Newest first: BAW2, a British Airways A320.
  fireEvent.click(screen.getAllByRole('button', { name: /ENTRY STAMP/i })[0])
  const dialog = screen.getByRole('dialog', { name: 'BAW2' })
  expect(dialog.textContent).toContain('“Speedbird 2”')
  expect(dialog.textContent).toContain('Airbus A320')
  expect(dialog.textContent).toContain('British Airways · United Kingdom')
  // Only the flight: the fact lives in the Facts tab.
  expect(dialog.textContent).not.toContain(POOL_FACT)
  fireEvent.click(screen.getByRole('button', { name: 'OK' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('a flag shows a spinner until its image has loaded', () => {
  saveJournal([
    {
      flight: makeFlight({
        destination: {
          icao: 'LFPG',
          iata: 'CDG',
          name: 'Paris',
          latitude: 49,
          longitude: 2.5,
        },
      }),
      fact: 'A fact.',
      caughtAt: '2026-09-25T14:03:00.000Z',
    },
  ])
  act(() => navigate(['collection', 'dex', 'passport']))
  const { container } = renderCollection()
  const frame = container.querySelector('.flag-frame')!
  expect(frame.classList.contains('loading')).toBe(true)
  fireEvent.load(frame.querySelector('img')!)
  expect(frame.classList.contains('loading')).toBe(false)
})

test('the streak pills only show once there is a streak', () => {
  // The saved entries completed no quest.
  renderCollection()
  fireEvent.click(screen.getByRole('button', { name: 'Dex' }))
  expect(screen.queryByText(/day streak/)).toBeNull()
})
