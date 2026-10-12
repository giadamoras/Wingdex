import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { JournalProvider } from './JournalContext'
import { useJournalContext } from './useJournalContext'
import type { Flight } from '../data/types'
import { makeFlight } from '../testFlight'

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})

const flight = (id: string): Flight =>
  makeFlight({ id, callsign: id, altitude_ft: 36000 })

const renderJournal = () =>
  renderHook(() => useJournalContext(), { wrapper: JournalProvider })

test('the same flight is added once a day, another flight is added', () => {
  const { result } = renderJournal()
  act(() => result.current.addCatch(flight('f1'), 'A fact.'))
  act(() => result.current.addCatch(flight('f1'), 'A fact.'))
  expect(result.current.journal).toHaveLength(1)
  act(() => result.current.addCatch(flight('f2'), 'A fact.'))
  expect(result.current.journal).toHaveLength(2)
})

test('the same flight can be caught again the next day', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 25, 12))
  const { result } = renderJournal()
  act(() => result.current.addCatch(flight('f1'), 'A fact.'))
  vi.setSystemTime(new Date(2026, 8, 26, 12))
  act(() => result.current.addCatch(flight('f1'), 'A fact.'))
  expect(result.current.journal).toHaveLength(2)
})
