import { getFact } from './facts'
import type { Flight } from './types'

// Card for the selected flight. `lost` means it dropped out of the feed and
// is shown at its last known position.
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
      <h2>{flight.callsign}</h2>
      {lost && <p>Signal lost - showing last known position.</p>}
      <p>
        {flight.aircraft_type} at {flight.altitude_ft.toLocaleString('en-US')}{' '}
        ft
      </p>
      <p>{getFact(flight)}</p>
      <button onClick={onCatch}>Catch</button>
    </section>
  )
}
