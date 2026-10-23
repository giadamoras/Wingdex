import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import type { Flight, FlightRoute } from '../data/types'
import { aircraftType } from '../shared-lib/aircraftTypes'
import { airlineFor, radioCallsign } from '../shared-lib/airlines'
import {
  climbDirection,
  formatAltitude,
  formatClimb,
  formatDuration,
  formatHeading,
  formatSpeed,
} from '../shared-lib/format'
import { springIn } from '../shared-lib/springIn'
import { Stamp } from '../shared-ui/Stamp'
import { PlaneIcon } from '../map/PlaneIcon'
import { journeyProgress, timeLeftWords } from './route'
import { WeatherOnArrival } from './WeatherOnArrival'
import type { RouteStatus } from './useFlightRoute'

// Passport-page card for the selected flight: labelled fields in plain words,
// each with its aviation unit (see describe below). `lost` means it dropped out
// of the feed and is shown at its last known position. The journey button
// replays the route on the map (only when the route is known). Type,
// duration and route are shown only when known: a live flight gets them from
// a lookup (`routeStatus`), so while it runs the card says so, and if it
// finds nothing the fields stay hidden. `details` is what that lookup also
// learned (airline, tail number, ...), shown as more fields when present.
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
  const sections = describe(flight, details)

  return (
    <motion.section
      className="card passport-page"
      {...springIn({ scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1 })}
    >
      <p className="passport-strip">Wingdex · Flight Passport</p>
      {/* A sticker on the card's top corner (positioned in card.css). */}
      <WeatherOnArrival flight={flight} />
      {/* Flight and route side by side, each with its passport label. */}
      <header className="card-head">
        <div>
          <p className="field-label">Flight</p>
          <h2>{flight.callsign}</h2>
        </div>
        {/* The route when known (the feed has it, or the lookup found it),
            else the lookup's progress; nothing when there is no lookup. */}
        {(hasRoute ||
          routeStatus === 'loading' ||
          routeStatus === 'unknown') && (
          <div className="card-route">
            <p className="field-label">Route</p>
            {flight.origin && flight.destination ? (
              <p className="route">
                {flight.origin.iata} → {flight.destination.iata}
              </p>
            ) : (
              <p className="route-note">
                {routeStatus === 'loading' ? 'Looking up…' : 'Unknown'}
              </p>
            )}
          </div>
        )}
        {cities && <p className="cities">{cities}</p>}
        <JourneyProgress flight={flight} />
      </header>
      {/* Boarding-pass small print: a thin coloured band per section, then
          one field per row, label left and value right. Two columns on wider
          screens (see .pass in card.css). */}
      <div className="pass">
        {sections.map(({ title, group, fields }) => (
          <section key={title} className={`pass-section ${group}`}>
            <h3 className="pass-band">{title}</h3>
            <dl>
              {fields.map(({ label, value, icon }) => (
                <div key={label} className="pass-row">
                  <dt className="field-label">{label}</dt>
                  <dd>
                    {icon}
                    {gluedUnits(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
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
    </motion.section>
  )
}

// How far along the route the plane is: a line from origin to destination,
// solid where it has flown and dashed ahead, with the plane's own silhouette
// on it, and the time left under it. Only when both ends are known. Worked
// out from where the plane is now, so it moves with each refresh.
function JourneyProgress({ flight }: { flight: Flight }) {
  const progress = journeyProgress(flight)
  if (progress === null) return null
  const percent = Math.round(progress * 100)
  const timeLeft = timeLeftWords(flight)
  return (
    <div className="journey-progress">
      <div
        className="journey-line"
        role="img"
        aria-label={`${percent}% of the way there`}
      >
        <div className="journey-flown" style={{ width: `${percent}%` }} />
        <div className="journey-plane" style={{ left: `${percent}%` }}>
          {/* Pointing right, along the line, whatever its real heading. */}
          <PlaneIcon heading={90} aircraftType={flight.aircraft_type} />
        </div>
      </div>
      {/* No time for a plane too slow for an estimate (taxiing). */}
      {timeLeft && (
        <p className="journey-left">
          {timeLeft === 'Landing soon' ? timeLeft : `${timeLeft} to go`}
        </p>
      )}
    </div>
  )
}

interface Field {
  label: string
  value: string
  icon?: ReactNode // a small symbol before the value, for skimming
}

// One drawn arrow for skimming, turned clockwise from pointing up (north on
// the map). Decorative: the value says the same in words. Drawn, not a text
// arrow, because the fonts have none and the fallback ones look uneven.
function Arrow({ degrees }: { degrees: number }) {
  return (
    <svg
      className="pass-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      style={{ rotate: `${degrees}deg` }}
    >
      <path d="M8 14V2M3 7l5-5 5 5" />
    </svg>
  )
}

// The climb arrow's turn: up-right, down-right, or flat to the right.
const CLIMB_DEGREES = { up: 45, down: 135, level: 90 }

// One section of the card; `group` picks its band colour.
interface Section {
  title: string
  group: 'flight' | 'aircraft' | 'airline'
  fields: Field[]
}

// The card's sections and fields, only for what is known; a section with no
// known field is left out. The owner is left out when it is the airline.
function describe(flight: Flight, details: FlightRoute | null): Section[] {
  const inFlight: Field[] = [
    { label: 'Altitude', value: formatAltitude(flight.altitude_ft) },
    { label: 'Speed', value: formatSpeed(flight.speed_kt) },
    {
      label: 'Heading',
      value: formatHeading(flight.heading),
      // An up arrow turned to the heading: north is up, as on the map.
      icon: <Arrow degrees={Math.round(flight.heading)} />,
    },
  ]
  const climb = formatClimb(flight.vertical_rate_fpm)
  const direction = climbDirection(flight.vertical_rate_fpm)
  if (climb && direction)
    inFlight.push({
      label: 'Climb rate',
      value: climb,
      icon: <Arrow degrees={CLIMB_DEGREES[direction]} />,
    })
  if (flight.duration_min !== null)
    inFlight.push({
      label: 'Flight time',
      // An estimate is worked out from the distance, not a scheduled time.
      value: `${flight.duration_estimated ? 'About ' : ''}${formatDuration(flight.duration_min)}`,
    })

  const aircraft: Field[] = []
  const type = aircraftValue(flight.aircraft_type, details)
  if (type) aircraft.push({ label: 'Type', value: type })
  if (details?.registration)
    aircraft.push({ label: 'Tail number', value: details.registration })
  if (flight.registered_country)
    aircraft.push({ label: 'Registered in', value: flight.registered_country })

  // The airline catalog first, so mock flights get it too; the lookup's
  // answer for an airline the catalog lacks.
  const airline: Field[] = []
  const known = airlineFor(flight.callsign)
  const name = known?.name ?? details?.airline
  const country = known?.country ?? details?.airline_country
  if (name)
    airline.push({
      label: 'Name', // under the "Airline" band
      value: country ? `${name} · ${country}` : name,
    })
  const radio = radioCallsign(flight.callsign)
  if (radio) airline.push({ label: 'Radio callsign', value: radio })
  const owner = details?.operator
  const sameAsAirline = (other: string | null | undefined) =>
    other?.toLowerCase() === owner?.toLowerCase()
  if (owner && !sameAsAirline(name) && !sameAsAirline(details?.airline))
    airline.push({ label: 'Owner', value: owner })

  const sections: Section[] = [
    { title: 'In flight', group: 'flight', fields: inFlight },
    { title: 'Aircraft', group: 'aircraft', fields: aircraft },
    { title: 'Airline', group: 'airline', fields: airline },
  ]
  return sections.filter((section) => section.fields.length > 0)
}

// A narrow row may wrap a value at any space except between a number and
// its unit: "7.9 km" or "1,900 ft/min" never splits, "Airbus A320neo (A20N)"
// can.
const gluedUnits = (value: string) =>
  value.replace(/(\d) (?=[a-z°])/gi, '$1\u00a0') // a no-break space

// "Boeing 777-300ER (B77W)", the name alone when it already says the code
// ("Embraer E190"); the lookup's model when the catalog lacks the code; the
// bare code when nothing else is known.
function aircraftValue(
  code: string | null,
  details: FlightRoute | null,
): string | null {
  const name = aircraftType(code)?.name
  if (name && code) return name.includes(code) ? name : `${name} (${code})`
  const model = details?.model
  const make =
    details?.manufacturer && model && !model.startsWith(details.manufacturer)
      ? `${details.manufacturer} ${model}`
      : (model ?? details?.manufacturer)
  return make ?? code
}
