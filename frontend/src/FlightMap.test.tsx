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

test('renders one dot per flight in view at its projected position', () => {
  const { west, north } = MAP_BOUNDS
  render(
    <FlightMap
      flights={[flight('1', 50, 10), flight('2', 49, 5)]}
      selectedId={null}
      onSelect={() => {}}
    />,
  )

  // The map opens zoomed in on Europe; 50N 10E is at x = 190/360, y = 30/140.
  const first = screen.getByTitle('CS1')
  expect(parseFloat(first.style.left)).toBeCloseTo(((10 - west) / 360) * 100)
  expect(parseFloat(first.style.top)).toBeCloseTo(((north - 50) / 140) * 100)
  expect(screen.getByTitle('CS2')).toBeTruthy()
})

test('planes outside the view are not drawn, unless selected', () => {
  const { west, north } = MAP_BOUNDS
  const flights = [flight('1', north, west), flight('2', 49, 5)]
  const { rerender } = render(
    <FlightMap flights={flights} selectedId={null} onSelect={() => {}} />,
  )
  expect(screen.queryByTitle('CS1')).toBeNull()
  expect(screen.getByTitle('CS2')).toBeTruthy()

  rerender(<FlightMap flights={flights} selectedId="1" onSelect={() => {}} />)
  expect(screen.getByTitle('CS1')).toBeTruthy()
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

test('each plane is a button named by its callsign, pressed while selected', () => {
  const { rerender } = render(
    <FlightMap
      flights={[flight('1', 50, 0), flight('2', 51, 1)]}
      selectedId={null}
      onSelect={() => {}}
    />,
  )
  const named = (pressed: boolean) =>
    screen.getByRole('button', { name: 'CS1', pressed })
  expect(named(false)).toBeTruthy()

  rerender(
    <FlightMap
      flights={[flight('1', 50, 0), flight('2', 51, 1)]}
      selectedId="1"
      onSelect={() => {}}
    />,
  )
  expect(named(true)).toBeTruthy()
  // Only the selected plane is pressed.
  expect(
    screen.getByRole('button', { name: 'CS2', pressed: false }),
  ).toBeTruthy()
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

test('focus mode: the map is marked while a flight is selected, and during a replay', () => {
  const lhr = {
    icao: 'EGLL',
    iata: 'LHR',
    name: 'Heathrow',
    latitude: 51.47,
    longitude: -0.45,
  }
  const jfk = {
    icao: 'KJFK',
    iata: 'JFK',
    name: 'JFK',
    latitude: 40.64,
    longitude: -73.78,
  }
  const routed = { ...flight('1', 52, -30), origin: lhr, destination: jfk }
  const focusOf = (container: HTMLElement) =>
    container.querySelector('.map')!.getAttribute('data-focus')

  const { container, rerender } = render(
    <FlightMap
      flights={[routed, flight('2', 49, 5)]}
      selectedId={null}
      onSelect={() => {}}
    />,
  )
  expect(focusOf(container)).toBeNull() // nothing selected: nothing dims

  rerender(
    <FlightMap
      flights={[routed, flight('2', 49, 5)]}
      selectedId="1"
      onSelect={() => {}}
    />,
  )
  expect(focusOf(container)).toBe('selected')

  rerender(
    <FlightMap
      flights={[routed, flight('2', 49, 5)]}
      selectedId="1"
      replay={{ flight: routed, startedAt: 0, phase: 'flying', progress: 0.5 }}
      onSelect={() => {}}
    />,
  )
  expect(focusOf(container)).toBe('replay')
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

test('a live area is labelled with its severity and name', () => {
  const live: WeatherArea = {
    ...storm,
    hazard: 'tropical_cyclone',
    severity: null,
    name: 'Koguma',
  }
  const { container } = render(
    <FlightMap
      flights={[]}
      selectedId={null}
      onSelect={() => {}}
      weather={[live]}
    />,
  )
  fireEvent.click(
    screen.getAllByTitle('Tropical cyclone (Koguma), North Atlantic')[0],
  )
  expect(container.querySelector('.weather-label')!.textContent).toContain(
    'Tropical cyclone (Koguma)',
  )
})

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

test('there is no weather control without weather, and it returns with it', () => {
  const props = {
    flights: [flight('1', 50, 0)],
    selectedId: null,
    onSelect: () => {},
  }
  const { rerender } = render(<FlightMap {...props} weather={[]} />)
  expect(screen.queryByRole('button', { name: 'Weather' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy() // the others stay

  rerender(<FlightMap {...props} weather={[storm]} />)
  expect(screen.getByRole('button', { name: 'Weather' })).toBeTruthy()
})

test('a weather control switched off stays off when the weather drops out and returns', () => {
  const props = {
    flights: [flight('1', 50, 0)],
    selectedId: null,
    onSelect: () => {},
  }
  const { rerender } = render(<FlightMap {...props} weather={[storm]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Weather' }))

  rerender(<FlightMap {...props} weather={[]} />)
  rerender(<FlightMap {...props} weather={[storm]} />)
  const toggle = screen.getByRole('button', { name: 'Weather' })
  expect(toggle.getAttribute('aria-pressed')).toBe('false')
  expect(screen.queryByTitle('Thunderstorm, North Atlantic')).toBeNull()
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
  render(
    <FlightMap
      flights={[]}
      selectedId="1"
      weather={[storm]}
      onSelect={onSelect}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Weather' }))
  expect(onSelect).not.toHaveBeenCalled()
})

test('the world layer is drawn larger and scaled down, so the view is unchanged', () => {
  const { container } = render(
    <FlightMap flights={[]} selectedId={null} onSelect={() => {}} />,
  )
  const world = container.querySelector<HTMLElement>('.map-world')!
  const zoom = Number(world.style.getPropertyValue('--real-zoom'))
  const scale = Number(world.style.getPropertyValue('--zoom'))
  // Larger than the box by the factor it is scaled down by: same size on screen.
  const larger = parseFloat(world.style.width) / 100
  expect(larger).toBeGreaterThan(1)
  expect(scale * larger).toBeCloseTo(zoom)
  expect(world.style.transform).toContain(`scale(${scale})`)
})
