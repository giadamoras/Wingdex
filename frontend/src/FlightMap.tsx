import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { timeOfDay } from './attributes'
import { CountryBorders } from './CountryBorders'
import { curveThrough } from './geo'
import { centredOn, centreOf, fitBounds } from './panzoom'
import { PlaneIcon } from './PlaneIcon'
import { DEFAULT_CENTER, project, unprojectLongitude } from './projection'
import { FIT_MS, prefersReducedMotion, type ReplayState } from './replay'
import { RouteLayer } from './RouteLayer'
import type { Flight, WeatherArea } from './types'
import { usePanZoom } from './usePanZoom'
import { WeatherLayer } from './WeatherLayer'
import { WorldLand } from './WorldLand'

const NO_JUMPS = new Set<string>()
const NO_FEATURED = new Set<string>()
const NO_WEATHER: WeatherArea[] = []

// Opening view: zoomed in on Europe, roughly the old Europe-only map.
const europe = project(DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude)
const START_VIEW = centredOn(europe.x / 100, europe.y / 100, 5)

// The view that shows a flight's whole route (the curve through the plane).
function routeView(flight: Flight) {
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
  )
}

// World map with one clickable plane per flight, positioned in percent of the
// world layer, which pans and zooms as a whole. Planes glide between polls;
// ids in `jumped` snap to their new position instead, ids in `featuredIds`
// get a ring, and `targetId` a bolder one. Clicking a plane selects
// it (or deselects it if already selected); clicking the map background
// deselects. A drag never counts as a click. Weather areas (under the planes)
// are selected the same way, by clicking one of their icons; selecting a
// weather area deselects the flight and the other way round.
export function FlightMap({
  flights,
  selectedId,
  jumped = NO_JUMPS,
  featuredIds = NO_FEATURED,
  targetId = null,
  replay = null,
  weather = NO_WEATHER,
  onSelect,
}: {
  flights: Flight[]
  selectedId: string | null
  jumped?: Set<string>
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
  const { view, handlers, zoomIn, zoomOut, reset, animateTo } = usePanZoom(
    mapRef,
    START_VIEW,
  )
  const selected = flights.find((f) => f.id === selectedId) ?? null

  // The map box's rendered width in real pixels, so CountryBorders can turn
  // the fractional pan/zoom view into real pixel gaps for its label
  // collision check. 0 until the first layout, which CountryBorders treats
  // as "nothing fits yet" rather than guessing.
  const [mapWidthPx, setMapWidthPx] = useState(0)
  useEffect(() => {
    const el = mapRef.current
    // jsdom (tests) has no ResizeObserver; mapWidthPx just stays 0, and
    // CountryBorders treats that as "nothing fits yet" - no crash either way.
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setMapWidthPx(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // When a replay starts, move the camera so the whole route fits.
  const replayStart = replay?.startedAt
  useEffect(() => {
    if (replay)
      animateTo(routeView(replay.flight), prefersReducedMotion() ? 0 : FIT_MS)
    // Only on a new replay, not on every animation frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayStart])

  // Translate is in % of the layer (= the map box), so the view is resize-proof.
  // --zoom lets planes scale themselves back to a constant size.
  const worldStyle = {
    transform: `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.zoom})`,
    '--zoom': view.zoom,
  } as CSSProperties

  // The map's sea/land palette follows the solar time at the centre of the
  // current view, so panning to another part of the world can shift it (see
  // index.css's [data-map-time] rules). Recomputed on every render, which
  // already happens on pan/zoom and every 5 s poll, so no timer is needed.
  const { px } = centreOf(view)
  const mapTime = timeOfDay(unprojectLongitude(px))

  // Control buttons must not reach the map's deselect.
  const control = (action: () => void) => (e: MouseEvent) => {
    e.stopPropagation()
    action()
  }

  // Focus mode (index.css): the other planes dim while a flight is selected and
  // all but vanish during its journey replay, so its route stays readable.
  const focus = replay ? 'replay' : selected ? 'selected' : undefined

  return (
    <div
      className="map"
      data-map-time={mapTime}
      data-focus={focus}
      ref={mapRef}
      onClick={() => {
        setWeatherId(null)
        onSelect(null)
      }}
      {...handlers}
    >
      <div className="map-world" style={worldStyle}>
        <WorldLand />
        <CountryBorders view={view} mapWidthPx={mapWidthPx} />
        {showWeather && (
          <WeatherLayer
            areas={weather}
            zoom={view.zoom}
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
        {flights.map((f) => {
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
