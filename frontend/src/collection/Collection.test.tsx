import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Collection } from './Collection'
import { JournalProvider } from './JournalContext'
import { saveJournal } from './journal'
import { makeFlight } from '../testFlight'

beforeEach(() => {
  saveJournal([
    {
      flight: makeFlight({ id: 'f1', callsign: 'TST1' }),
      fact: 'A learned fact.',
      caughtAt: '2026-09-25T14:03:00.000Z',
    },
  ])
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const renderCollection = () =>
  render(<Collection />, { wrapper: JournalProvider })

const pressed = (name: string) =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed')

test('opens on the Journal, with only that button pressed', () => {
  renderCollection()
  expect(screen.getByText('Journal (1)')).toBeTruthy()
  expect(pressed('Journal')).toBe('true')
  expect(pressed('Badges')).toBe('false')
  expect(pressed('Facts')).toBe('false')
})

test('the buttons switch between Journal, Badges and Facts', () => {
  renderCollection()

  fireEvent.click(screen.getByRole('button', { name: 'Badges' }))
  expect(screen.getByText('First Catch')).toBeTruthy()
  expect(screen.queryByText('Journal (1)')).toBeNull()
  expect(pressed('Badges')).toBe('true')
  expect(pressed('Journal')).toBe('false')

  fireEvent.click(screen.getByRole('button', { name: 'Facts' }))
  expect(screen.getByText('A learned fact.')).toBeTruthy()
  expect(pressed('Facts')).toBe('true')

  fireEvent.click(screen.getByRole('button', { name: 'Journal' }))
  expect(screen.getByText('Journal (1)')).toBeTruthy()
})
