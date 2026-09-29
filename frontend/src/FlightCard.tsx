import type { Flight } from './types'
import { formatDuration } from './format'
import { getFact } from './facts'

// Passport-page card for the selected flight. `lost` means it dropped out
// of the feed and is shown at its last known position. The journey button
// replays the route on the map (only when the route is known).
export function FlightCard({
  flight,
  lost,
  caught,
  replaying,
  replayed,
  onCatch,
  onReplay,
  onStopReplay,
}: {
  flight: Flight
  lost: boolean
  caught: boolean
  replaying: boolean
  replayed: boolean
  onCatch: () => void
  onReplay: () => void
  onStopReplay: () => void
}) {
  const hasRoute = flight.origin !== null && flight.destination !== null
  const journeyLabel = replaying
    ? 'Stop'
    : replayed
      ? 'Replay journey'
      : 'See the journey'
  return (
    <section className="card passport-page">
      <p className="passport-strip">Airspace Explorer · Flight Passport</p>
      <header className="card-head">
        <h2>{flight.callsign}</h2>
        <span className="chip">{flight.aircraft_type}</span>
        <span className="chip">
          {flight.altitude_ft.toLocaleString('en-US')} ft
        </span>
        <span className="chip">{Math.round(flight.heading)}°</span>
        <span className="chip">{flight.speed_kt} kt</span>
        <span className="chip">{formatDuration(flight.duration_min)}</span>
      </header>
      {/* Route only when the data source knows it. */}
      {flight.origin && flight.destination && (
        <p
          className="route"
          title={`${flight.origin.name} → ${flight.destination.name}`}
        >
          {flight.origin.iata} → {flight.destination.iata}
        </p>
      )}
      {lost && (
        <p className="lost">Signal lost - showing last known position.</p>
      )}
      <p className="fact">
        <strong>Did you know?</strong> {getFact(flight)}
      </p>
      <div className="card-actions">
        {caught ? (
          <span className="stamp">Caught today ✓</span>
        ) : (
          <button className="catch" onClick={onCatch}>
            Catch
          </button>
        )}
        {hasRoute && (
          <button
            className="journey"
            onClick={replaying ? onStopReplay : onReplay}
          >
            {journeyLabel}
          </button>
        )}
      </div>
    </section>
  )
}
