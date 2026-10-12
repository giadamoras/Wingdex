import { motion } from 'framer-motion'
import type { Flight, FlightRoute } from './types'
import { formatClimb, formatDuration } from './format'
import { springIn } from './springIn'
import { Stamp } from './Stamp'
import type { RouteStatus } from './useFlightRoute'

// Passport-page card for the selected flight. `lost` means it dropped out
// of the feed and is shown at its last known position. The journey button
// replays the route on the map (only when the route is known). Type,
// duration and route are shown only when known: a live flight gets them from
// a lookup (`routeStatus`), so while it runs the card says so, and if it
// finds nothing the fields stay hidden. `details` is what that lookup also
// learned (airline, tail number, ...), listed under the route when present.
export function FlightCard({
  flight,
  fact,
  routeStatus,
  details,
  lost,
  caught,
  replaying,
  replayed,
  onCatch,
  onReplay,
  onStopReplay,
}: {
  flight: Flight
  fact: string // from useCardFact: stays the same while the card is open
  routeStatus: RouteStatus
  details: FlightRoute | null
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

  const cities =
    flight.origin?.city && flight.destination?.city
      ? `${flight.origin.city} → ${flight.destination.city}`
      : null
  const climb = formatClimb(flight.vertical_rate_fpm)
  const detailLines = describe(flight, details)

  const content = (
    <>
      <p className="passport-strip">Airspace Explorer · Flight Passport</p>
      <header className="card-head">
        <h2>{flight.callsign}</h2>
        {flight.aircraft_type && (
          <span className="chip">{flight.aircraft_type}</span>
        )}
        <span className="chip">
          {flight.altitude_ft.toLocaleString('en-US')} ft
        </span>
        <span className="chip">{Math.round(flight.heading)}°</span>
        <span className="chip">{flight.speed_kt} kt</span>
        {climb && (
          <span className="chip" title="Climb or descent rate">
            {climb}
          </span>
        )}
        {flight.duration_min !== null && (
          <span
            className={flight.duration_estimated ? 'chip estimate' : 'chip'}
            title={
              flight.duration_estimated
                ? 'Estimated from the distance, not a scheduled time'
                : undefined
            }
          >
            {flight.duration_estimated && '~'}
            {formatDuration(flight.duration_min)}
          </span>
        )}
      </header>
      {/* Route only when known: the feed has it, or the lookup found it. */}
      {flight.origin && flight.destination ? (
        <p
          className="route"
          title={`${flight.origin.name} → ${flight.destination.name}`}
        >
          {flight.origin.iata} → {flight.destination.iata}
        </p>
      ) : routeStatus === 'loading' ? (
        <p className="route-note">Looking up route…</p>
      ) : routeStatus === 'unknown' ? (
        <p className="route-note">Route unknown</p>
      ) : null}
      {cities && <p className="cities">{cities}</p>}
      {detailLines.length > 0 && (
        <ul className="details">
          {detailLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {lost && (
        <p className="lost">Signal lost - showing last known position.</p>
      )}
      <p className="fact">
        <strong>Did you know?</strong> {fact}
      </p>
      <div className="card-actions">
        {caught ? (
          <Stamp>Caught today ✓</Stamp>
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
    </>
  )

  return (
    <motion.section
      className="card passport-page"
      {...springIn({ scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1 })}
    >
      {content}
    </motion.section>
  )
}

// The card's detail lines, only for what is known: the airline, the aircraft
// with its tail number, the owner when it isn't the airline, and where the
// plane is registered.
function describe(flight: Flight, details: FlightRoute | null): string[] {
  const lines: string[] = []
  if (details?.airline)
    lines.push(
      details.airline_country
        ? `${details.airline} · ${details.airline_country}`
        : details.airline,
    )
  const model = details?.model
  const make =
    details?.manufacturer && model && !model.startsWith(details.manufacturer)
      ? `${details.manufacturer} ${model}`
      : (model ?? details?.manufacturer)
  const aircraft = [make, details?.registration].filter(Boolean).join(' · ')
  if (aircraft) lines.push(aircraft)
  if (
    details?.operator &&
    details.operator.toLowerCase() !== details.airline?.toLowerCase()
  )
    lines.push(`Operated by ${details.operator}`)
  if (flight.registered_country)
    lines.push(`Registered in ${flight.registered_country}`)
  return lines
}
