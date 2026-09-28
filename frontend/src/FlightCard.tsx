import type { Flight } from './types'
import { formatDuration } from './format'
import { getFact } from './facts'

// Ticket-style card for the selected flight. `lost` means it dropped out of
// the feed and is shown at its last known position.
export function FlightCard({
  flight,
  lost,
  caught,
  onCatch,
}: {
  flight: Flight
  lost: boolean
  caught: boolean
  onCatch: () => void
}) {
  return (
    <section className="card">
      <header className="card-head">
        <h2>{flight.callsign}</h2>
        <span className="chip">{flight.aircraft_type}</span>
        <span className="chip">
          {flight.altitude_ft.toLocaleString('en-US')} ft
        </span>
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
      <p className="fact">{getFact(flight)}</p>
      {caught ? (
        <span className="stamp">Caught today ✓</span>
      ) : (
        <button className="catch" onClick={onCatch}>
          Catch
        </button>
      )}
    </section>
  )
}
