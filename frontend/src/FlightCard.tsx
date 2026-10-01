import { motion } from 'framer-motion'
import type { Flight, WeatherArea } from './types'
import { formatDuration } from './format'
import { getFact } from './facts'
import { prefersReducedMotion } from './replay'
import { Stamp } from './Stamp'

// Passport-page card for the selected flight. `lost` means it dropped out
// of the feed and is shown at its last known position. The journey button
// replays the route on the map (only when the route is known).
export function FlightCard({
  flight,
  weather,
  lost,
  caught,
  replaying,
  replayed,
  onCatch,
  onReplay,
  onStopReplay,
}: {
  flight: Flight
  weather: WeatherArea[] // hazards the flight may be in, for its fact
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

  const content = (
    <>
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
        <strong>Did you know?</strong> {getFact(flight, new Date(), weather)}
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

  // Reduced motion: skip Framer Motion entirely, not just shorten it.
  if (prefersReducedMotion())
    return <section className="card passport-page">{content}</section>
  return (
    <motion.section
      className="card passport-page"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
    >
      {content}
    </motion.section>
  )
}
