import { getFact } from './facts'
import type { Flight } from './types'

// Ticket-style card for the selected flight. `lost` means it dropped out of
// the feed and is shown at its last known position.
export function FlightCard({
  flight,
  lost,
  onCatch,
}: {
  flight: Flight
  lost: boolean
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
      </header>
      {lost && (
        <p className="lost">Signal lost - showing last known position.</p>
      )}
      <p className="fact">{getFact(flight)}</p>
      <button className="catch" onClick={onCatch}>
        Catch
      </button>
    </section>
  )
}
