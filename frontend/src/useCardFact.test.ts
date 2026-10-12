import { renderHook } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { getFact } from './facts'
import { useCardFact } from './useCardFact'
import type { RouteStatus } from './useFlightRoute'
import type { Flight } from './types'

// Each call returns a new fact, so a recompute shows up as a changed text.
vi.mock('./facts', () => ({ getFact: vi.fn() }))

beforeEach(() => {
  let n = 0
  vi.mocked(getFact).mockImplementation(() => `Fact ${++n}`)
})

const flight = (id: string, altitude_ft = 30000) =>
  ({ id, altitude_ft }) as Flight

type Props = { flight: Flight | null; status: RouteStatus }
const renderFact = (initial: Props) =>
  renderHook(({ flight, status }: Props) => useCardFact(flight, status, []), {
    initialProps: initial,
  })

test('the fact stays the same while the flight moves between polls', () => {
  const { result, rerender } = renderFact({
    flight: flight('a'),
    status: 'idle',
  })
  expect(result.current).toBe('Fact 1')
  rerender({ flight: flight('a', 36000), status: 'idle' }) // climbed: new poll
  rerender({ flight: flight('a', 38000), status: 'idle' })
  expect(result.current).toBe('Fact 1')
})

test('it is picked again once, when the route lookup finishes', () => {
  const { result, rerender } = renderFact({
    flight: flight('a'),
    status: 'loading',
  })
  expect(result.current).toBe('Fact 1')
  rerender({ flight: flight('a'), status: 'ready' }) // the type arrived
  expect(result.current).toBe('Fact 2')
  rerender({ flight: flight('a', 36000), status: 'ready' })
  expect(result.current).toBe('Fact 2') // and then it holds
})

test('a lookup that finds nothing also settles it once', () => {
  const { result, rerender } = renderFact({
    flight: flight('a'),
    status: 'loading',
  })
  rerender({ flight: flight('a'), status: 'unknown' })
  expect(result.current).toBe('Fact 2')
  rerender({ flight: flight('a'), status: 'unknown' })
  expect(result.current).toBe('Fact 2')
})

test('another flight, or reopening the card, picks a new fact', () => {
  const { result, rerender } = renderFact({
    flight: flight('a'),
    status: 'idle',
  })
  expect(result.current).toBe('Fact 1')
  rerender({ flight: flight('b'), status: 'idle' })
  expect(result.current).toBe('Fact 2')
  rerender({ flight: null, status: 'idle' }) // the card closes
  expect(result.current).toBeNull()
  rerender({ flight: flight('b'), status: 'idle' })
  expect(result.current).toBe('Fact 3')
})
