import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { FlightMap } from './FlightMap'
import { MAP_BOUNDS } from './projection'
import type { Flight, WeatherArea } from './types'

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

// jsdom has no layout, so give the map a size and stub pointer capture.
const withMapBox = (map: HTMLElement) => {
  map.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1000, height: 400 }) as DOMRect
  map.setPointerCapture = vi.fn()
}

const worldTransform = (container: HTMLElement) =>
  (container.querySelector('.map-world') as HTMLElement).style.transform

test('a drag pans the map and does not count as a click', () => {
  const onSelect = vi.fn()
  const { container } = render(
    <FlightMap
      flights={[flight('1', 50, 0)]}
      selectedId={null}
      onSelect={onSelect}
    />,
  )
  const map = container.querySelector('.map') as HTMLElement
  withMapBox(map)
  const before = worldTransform(container)

  const plane = screen.getByTitle('CS1')
  fireEvent.pointerDown(plane, { pointerId: 1, clientX: 500, clientY: 200 })
  fireEvent.pointerMove(plane, { pointerId: 1, clientX: 540, clientY: 220 })
  fireEvent.pointerUp(plane, { pointerId: 1, clientX: 540, clientY: 220 })
  fireEvent.click(plane)

  expect(worldTransform(container)).not.toBe(before)
  expect(onSelect).not.toHaveBeenCalled()
})

test('zoom buttons change the view without deselecting; reset restores it', () => {
  const onSelect = vi.fn()
  const { container } = render(
    <FlightMap
      flights={[flight('1', 50, 0)]}
      selectedId="1"
      onSelect={onSelect}
    />,
  )
  const start = worldTransform(container)
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
  expect(worldTransform(container)).not.toBe(start)
  fireEvent.click(screen.getByRole('button', { name: 'Reset view' }))
  expect(worldTransform(container)).toBe(start)
  expect(onSelect).not.toHaveBeenCalled()
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

test('the map carries a time-of-day attribute for the palette CSS to key off', () => {
  const { container } = render(
    <FlightMap
      flights={[flight('1', 50, 0)]}
      selectedId={null}
      onSelect={() => {}}
    />,
  )
  const mapTime = container.querySelector('.map')!.getAttribute('data-map-time')
  expect(['dawn', 'day', 'dusk', 'night']).toContain(mapTime)
})

test('featured planes get the ring class', () => {
  render(
    <FlightMap
      flights={[flight('1', 50, 0), flight('2', 49, 5)]}
      selectedId={null}
      featuredIds={new Set(['2'])}
      onSelect={() => {}}
    />,
  )
  expect(screen.getByTitle('CS1').classList.contains('featured')).toBe(false)
  expect(screen.getByTitle('CS2').classList.contains('featured')).toBe(true)
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

test('draws weather icons for each area, and none without weather', () => {
  const { rerender } = render(
    <FlightMap flights={[]} selectedId={null} onSelect={() => {}} />,
  )
  expect(screen.queryByTitle('Thunderstorm, North Atlantic')).toBeNull()

  rerender(
    <FlightMap
      flights={[]}
      selectedId={null}
      weather={[storm]}
      onSelect={() => {}}
    />,
  )
  expect(
    screen.getAllByTitle('Thunderstorm, North Atlantic').length,
  ).toBeGreaterThan(0)
})

test('the area outline and label only show after clicking an icon', () => {
  const { container } = render(
    <FlightMap
      flights={[]}
      selectedId={null}
      weather={[storm]}
      onSelect={() => {}}
    />,
  )
  expect(container.querySelector('.weather-outline')).toBeNull()
  expect(container.querySelector('.weather-label')).toBeNull()

  fireEvent.click(screen.getAllByTitle('Thunderstorm, North Atlantic')[0])
  expect(container.querySelector('.weather-outline polygon')).toBeTruthy()
  const label = container.querySelector('.weather-label')!.textContent
  expect(label).toContain('Thunderstorm')
  expect(label).toContain('North Atlantic')
  expect(label).toContain('up to 45,000 ft')

  // Clicking the selected area's icon again closes it.
  fireEvent.click(screen.getAllByTitle('Thunderstorm, North Atlantic')[0])
  expect(container.querySelector('.weather-outline')).toBeNull()
})

test('selecting a weather area deselects the flight, and the map background clears it', () => {
  const onSelect = vi.fn()
  const { container } = render(
    <FlightMap
      flights={[flight('1', 50, 0)]}
      selectedId="1"
      weather={[storm]}
      onSelect={onSelect}
    />,
  )
  fireEvent.click(screen.getAllByTitle('Thunderstorm, North Atlantic')[0])
  expect(onSelect).toHaveBeenCalledTimes(1)
  expect(onSelect).toHaveBeenLastCalledWith(null)
  expect(container.querySelector('.weather-outline')).toBeTruthy()

  fireEvent.click(container.querySelector('.map')!)
  expect(container.querySelector('.weather-outline')).toBeNull()
})

test('selecting a plane clears the selected weather area', () => {
  const onSelect = vi.fn()
  const { container } = render(
    <FlightMap
      flights={[flight('1', 50, 0)]}
      selectedId={null}
      weather={[storm]}
      onSelect={onSelect}
    />,
  )
  fireEvent.click(screen.getAllByTitle('Thunderstorm, North Atlantic')[0])
  fireEvent.click(screen.getByTitle('CS1'))
  expect(container.querySelector('.weather-outline')).toBeNull()
  expect(onSelect).toHaveBeenLastCalledWith('1')
})

test('zooming in adds icons for a large area without moving the first', () => {
  const { container } = render(
    <FlightMap
      flights={[]}
      selectedId={null}
      weather={[storm]}
      onSelect={() => {}}
    />,
  )
  const icons = () =>
    [...container.querySelectorAll<HTMLElement>('.weather-icon')].map(
      (el) => `${el.style.left},${el.style.top}`,
    )
  const before = icons()
  for (let i = 0; i < 4; i++)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
  const after = icons()
  expect(after.length).toBeGreaterThan(before.length)
  expect(after[0]).toBe(before[0])
})

test('the weather control hides and shows the icons, planes stay', () => {
  render(
    <FlightMap
      flights={[flight('1', 50, 0)]}
      selectedId={null}
      weather={[storm]}
      onSelect={() => {}}
    />,
  )
  const toggle = screen.getByRole('button', { name: 'Weather' })
  expect(toggle.getAttribute('aria-pressed')).toBe('true')
  expect(
    screen.getAllByTitle('Thunderstorm, North Atlantic').length,
  ).toBeGreaterThan(0)

  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-pressed')).toBe('false')
  expect(screen.queryByTitle('Thunderstorm, North Atlantic')).toBeNull()
  expect(screen.getByTitle('CS1')).toBeTruthy()

  fireEvent.click(toggle)
  expect(
    screen.getAllByTitle('Thunderstorm, North Atlantic').length,
  ).toBeGreaterThan(0)
})

test('hiding the weather drops the selected area, and showing it again starts clean', () => {
  const { container } = render(
    <FlightMap
      flights={[]}
      selectedId={null}
      weather={[storm]}
      onSelect={() => {}}
    />,
  )
  fireEvent.click(screen.getAllByTitle('Thunderstorm, North Atlantic')[0])
  expect(container.querySelector('.weather-outline')).toBeTruthy()

  const toggle = screen.getByRole('button', { name: 'Weather' })
  fireEvent.click(toggle)
  expect(container.querySelector('.weather-outline')).toBeNull()
  expect(container.querySelector('.weather-label')).toBeNull()

  fireEvent.click(toggle)
  expect(container.querySelector('.weather-outline')).toBeNull()
})

test('the weather control does not deselect the flight', () => {
  const onSelect = vi.fn()
  render(<FlightMap flights={[]} selectedId="1" onSelect={onSelect} />)
  fireEvent.click(screen.getByRole('button', { name: 'Weather' }))
  expect(onSelect).not.toHaveBeenCalled()
})
