import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { FlightMap } from './FlightMap'
import { MAP_BOUNDS } from './projection'
import type { Flight } from './types'

afterEach(cleanup) // unmount between tests so titles don't collide

const flight = (id: string, latitude: number, longitude: number): Flight => ({
  id,
  callsign: `CS${id}`,
  aircraft_type: 'A320',
  latitude,
  longitude,
  altitude_ft: 30000,
  heading: 90,
  speed_kt: 450,
  duration_min: 60,
  origin: null,
  destination: null,
})

test('renders one dot per flight at its projected position', () => {
  const { west, north } = MAP_BOUNDS
  render(
    <FlightMap
      flights={[flight('1', north, west), flight('2', 49, 5)]}
      selectedId={null}
      onSelect={() => {}}
    />,
  )

  const first = screen.getByTitle('CS1')
  expect(first.style.left).toBe('0%')
  expect(first.style.top).toBe('0%')
  expect(screen.getByTitle('CS2')).toBeTruthy()
})

test('rotates each plane to its heading', () => {
  render(
    <FlightMap
      flights={[flight('1', 50, 0)]}
      selectedId={null}
      onSelect={() => {}}
    />,
  )
  const icon = screen.getByTitle('CS1').querySelector('svg')!
  expect(icon.style.transform).toBe('rotate(90deg)')
})

test('only jumped planes get the snap class', () => {
  render(
    <FlightMap
      flights={[flight('1', 50, 0), flight('2', 49, 5)]}
      selectedId={null}
      jumped={new Set(['2'])}
      onSelect={() => {}}
    />,
  )
  expect(screen.getByTitle('CS1').classList.contains('jump')).toBe(false)
  expect(screen.getByTitle('CS2').classList.contains('jump')).toBe(true)
})

test('clicking a dot selects it, clicking the selected dot deselects', () => {
  const onSelect = vi.fn()
  const { rerender } = render(
    <FlightMap
      flights={[flight('1', 50, 0)]}
      selectedId={null}
      onSelect={onSelect}
    />,
  )
  fireEvent.click(screen.getByTitle('CS1'))
  expect(onSelect).toHaveBeenLastCalledWith('1')

  rerender(
    <FlightMap
      flights={[flight('1', 50, 0)]}
      selectedId="1"
      onSelect={onSelect}
    />,
  )
  fireEvent.click(screen.getByTitle('CS1'))
  expect(onSelect).toHaveBeenLastCalledWith(null)
})

test('clicking the map background deselects', () => {
  const onSelect = vi.fn()
  const { container } = render(
    <FlightMap
      flights={[flight('1', 50, 0)]}
      selectedId="1"
      onSelect={onSelect}
    />,
  )
  fireEvent.click(container.querySelector('.map')!)
  expect(onSelect).toHaveBeenCalledWith(null)
})
