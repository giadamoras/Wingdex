import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FocusEvent, MouseEvent } from 'react'
import { timeOfDay } from './attributes'
import { CountryBorders } from './CountryBorders'
import { curveThrough } from './geo'
import {
  centredOn,
  centreOf,
  fitBounds,
  panBy,
  shapeFor,
  type Shape,
} from './panzoom'
import { PlaneIcon } from './PlaneIcon'
import { DEFAULT_CENTER, project, unprojectLongitude } from './projection'
import { FIT_MS, prefersReducedMotion, type ReplayState } from './replay'
import { RouteLayer } from './RouteLayer'
import type { Flight, WeatherArea } from './types'
import { usePanZoom } from './usePanZoom'
import { visibleFlights } from './visiblePlanes'
import { WeatherLayer } from './WeatherLayer'
import { WorldLand } from './WorldLand'

// The world layer is drawn this many times larger than the map box and scaled
// down by the same factor, so a phone browser, which draws the layer once and
// then only stretches that picture, has more detail to stretch when you zoom in.
const WORLD_SCALE = 3

const NO_JUMPS = new Set<string>()
const NO_DEPARTED: Flight[] = []
const NO_FEATURED = new Set<string>()
const NO_WEATHER: WeatherArea[] = []

// Opening view: zoomed in on Europe, roughly the old Europe-only map. In a box
// that shows only part of the world (a phone held upright) the zoom is lower by
// the same factor, so about as much of Europe is in view as on a wide map.
const europe = project(DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude)
const START_ZOOM = 5
const startView = (shape: Shape) =>
  centredOn(
    europe.x / 100,
    europe.y / 100,
    Math.max(1, START_ZOOM / Math.max(shape.lx, shape.ly)),
    shape,
  )

// The view that shows a flight's whole route (the curve through the plane).
function routeView(flight: Flight, shape: Shape) {
  const points = curveThrough(flight.origin!, flight.destination!, flight).map(
    (p) => project(p.latitude, p.longitude),
  )
  const xs = points.map((p) => p.x / 100)
  const ys = points.map((p) => p.y / 100)
  return fitBounds(
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs),
    Math.max(...ys),
    undefined,
    shape,
  )
}

// World map with one clickable plane per flight, positioned in percent of the
// world layer, which pans and zooms as a whole. Planes glide between polls;
// ids in `jumped` snap to their new position and fade in there instead, while
// their old position in `departed` fades out, ids in `featuredIds`
// get a ring, and `targetId` a bolder one. Clicking a plane selects
// it (or deselects it if already selected); clicking the map background
// deselects. A drag never counts as a click. Weather areas (under the planes)
// are selected the same way, by clicking one of their icons; selecting a
// weather area deselects the flight and the other way round.
export function FlightMap({
  flights,
  selectedId,
  jumped = NO_JUMPS,
  departed = NO_DEPARTED,
  featuredIds = NO_FEATURED,
  targetId = null,
  replay = null,
  weather = NO_WEATHER,
  onSelect,
}: {
  flights: Flight[]
  selectedId: string | null
  jumped?: Set<string>
  departed?: Flight[]
  featuredIds?: Set<string>
  targetId?: string | null
  replay?: ReplayState | null
  weather?: WeatherArea[]
  onSelect: (id: string | null) => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [weatherId, setWeatherId] = useState<string | null>(null)
  // The map controls' weather switch, for anyone who finds the map too busy.
  const [showWeather, setShowWeather] = useState(true)
  // The map box's rendered size in real pixels. CountryBorders turns the
  // fractional pan/zoom view into real pixel gaps for its label collision check
  // with it, and its shape decides how the world covers the box (see Shape).
  // 0 until the first layout, which CountryBorders treats as "nothing fits yet"
  // rather than guessing, and which counts as a box shaped like the world.
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = mapRef.current
    // jsdom (tests) has no ResizeObserver; the size just stays 0, and both
    // CountryBorders and the shape treat that as "unknown" - no crash either way.
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const { lx, ly } = shapeFor(size.width, size.height)
  // The same object while the shape is the same, so nothing reacts to a resize
  // that does not change it.
  const shape = useMemo(() => ({ lx, ly }), [lx, ly])

  const { view, handlers, zoomIn, zoomOut, reset, animateTo } = usePanZoom(
    mapRef,
    shape,
    startView,
  )
  const selected = flights.find((f) => f.id === selectedId) ?? null
  // Only the planes in view, thinned when crowded; the selected, featured and
  // target planes are always drawn.
  const drawn = visibleFlights(
    flights,
    view,
    [selectedId, targetId, ...featuredIds],
    shape,
  )

  // When a replay starts, move the camera so the whole route fits.
  const replayStart = replay?.startedAt
  useEffect(() => {
    if (replay)
      animateTo(
        routeView(replay.flight, shape),
        prefersReducedMotion() ? 0 : FIT_MS,
      )
    // Only on a new replay, not on every animation frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayStart])

  // The layer is WORLD_SCALE times the size the world has at zoom 1 (the box
  // times the shape), so translate (in % of the layer) and scale are divided by
  // it: the view is the same, just drawn at more detail and resize-proof. --zoom
  // is the scale actually applied, which planes, labels and strokes undo to keep
  // a constant size; --real-zoom is how many world widths the layer spans.
  const worldZoom = view.zoom * Math.max(shape.lx, shape.ly)
  const worldStyle = {
    width: `${WORLD_SCALE * shape.lx * 100}%`,
    height: `${WORLD_SCALE * shape.ly * 100}%`,
    transform: `translate(${(view.x * 100) / (WORLD_SCALE * shape.lx)}%, ${(view.y * 100) / (WORLD_SCALE * shape.ly)}%) scale(${view.zoom / WORLD_SCALE})`,
    '--zoom': view.zoom / WORLD_SCALE,
    '--real-zoom': worldZoom,
  } as CSSProperties

  // The map's sea/land palette follows the solar time at the centre of the
  // current view, so panning to another part of the world can shift it (see
  // styles/map.css's [data-map-time] rules). Recomputed on every render, which
  // already happens on pan/zoom and every 5 s poll, so no timer is needed.
  const { px } = centreOf(view, shape)
  const mapTime = timeOfDay(unprojectLongitude(px))

  // Control buttons must not reach the map's deselect.
  const control = (action: () => void) => (e: MouseEvent) => {
    e.stopPropagation()
    action()
  }

  // Tabbing to a plane or weather icon outside the visible box pans the map to
  // it (the box is overflow: clip, so the browser can't scroll it into view).
  // Mouse and touch focus are left alone: those targets are already on screen.
  const panToFocus = (e: FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (!target.matches(':focus-visible')) return
    const box = e.currentTarget.getBoundingClientRect()
    const r = target.getBoundingClientRect()
    if (
      r.left >= box.left &&
      r.right <= box.right &&
      r.top >= box.top &&
      r.bottom <= box.bottom
    )
      return
    // Move the target's centre to the box's centre (fractions of the box).
    const dx = (box.left + box.width / 2 - (r.left + r.width / 2)) / box.width
    const dy = (box.top + box.height / 2 - (r.top + r.height / 2)) / box.height
    animateTo(panBy(view, dx, dy, shape), prefersReducedMotion() ? 0 : 300)
  }

  // Focus mode (styles/planes.css): the other planes dim while a flight is selected and
  // all but vanish during its journey replay, so its route stays readable.
  const focus = replay ? 'replay' : selected ? 'selected' : undefined

  return (
    <div
      className="map"
      data-map-time={mapTime}
      data-focus={focus}
      // Clicking the background deselects: a pointer convenience, not a control
      // (keyboard users deselect with the plane's own button), so it is
      // marked as presentation for the linter and screen readers.
      role="presentation"
      ref={mapRef}
      onFocus={panToFocus}
      onClick={() => {
        setWeatherId(null)
        onSelect(null)
      }}
      {...handlers}
    >
      <div className="map-world" style={worldStyle}>
        <WorldLand />
        <CountryBorders
          view={view}
          shape={shape}
          mapWidthPx={size.width}
          mapHeightPx={size.height}
        />
        {showWeather && (
          <WeatherLayer
            areas={weather}
            zoom={worldZoom}
            selectedId={weatherId}
            onSelect={(id) => {
              setWeatherId(id)
              if (id !== null) onSelect(null) // one selection at a time
            }}
          />
        )}
        {selected && (
          <RouteLayer
            flight={selected}
            replay={replay?.flight.id === selected.id ? replay : null}
          />
        )}
        {departed.map((f) => {
          const { x, y } = project(f.latitude, f.longitude)
          return (
            <div
              key={`${f.id}-departed`}
              className="plane-departing"
              style={{ left: `${x}%`, top: `${y}%` }}
              aria-hidden="true"
            >
              <PlaneIcon heading={f.heading} aircraftType={f.aircraft_type} />
            </div>
          )
        })}
        {drawn.map((f) => {
          const { x, y } = project(f.latitude, f.longitude)
          const className = [
            'plane',
            f.id === selectedId && 'selected',
            jumped.has(f.id) && 'jump',
            featuredIds.has(f.id) && 'featured',
            f.id === targetId && 'target', // onboarding's "catch this one"
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button
              key={f.id}
              className={className}
              title={f.callsign}
              aria-label={f.callsign}
              aria-pressed={f.id === selectedId}
              style={{ left: `${x}%`, top: `${y}%` }}
              onClick={(e) => {
                e.stopPropagation() // don't trigger the map's deselect
                setWeatherId(null)
                onSelect(f.id === selectedId ? null : f.id)
              }}
            >
              <PlaneIcon heading={f.heading} aircraftType={f.aircraft_type} />
            </button>
          )
        })}
      </div>
      <div className="map-controls">
        {/* No switch without weather (not loaded, failed or none): nothing to hide. */}
        {weather.length > 0 && (
          <button
            aria-label="Weather"
            title="Show or hide weather"
            aria-pressed={showWeather}
            onClick={control(() => {
              setShowWeather((on) => !on)
              setWeatherId(null) // hiding the weather drops any selected area
            })}
          >
            ☁
          </button>
        )}
        <button aria-label="Zoom in" onClick={control(zoomIn)}>
          +
        </button>
        <button aria-label="Zoom out" onClick={control(zoomOut)}>
          −
        </button>
        <button aria-label="Reset view" onClick={control(reset)}>
          ⟲
        </button>
      </div>
    </div>
  )
}
