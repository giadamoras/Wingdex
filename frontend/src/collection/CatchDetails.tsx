import { aircraftType } from '../shared-lib/aircraftTypes'
import { airlineFor, radioCallsign } from '../shared-lib/airlines'
import {
  formatAltitude,
  formatCaughtAt,
  formatSpeed,
} from '../shared-lib/format'
import { HAZARD_NAMES } from '../map/weatherIcons'
import { PlaneIcon } from '../map/PlaneIcon'
import { DetailDialog } from './DetailDialog'
import type { Airport, JournalEntry } from '../data/types'

const airportLine = (a: Airport) => `${a.name} (${a.iata})`

// A Journal entry's pop-up: what the catch was, from the snapshot saved at
// catch time (so it reads the same whatever the plane does next). Only the
// flight: its fact lives in the Facts tab and its quest on the quest strip,
// which keeps the card short. Older entries lack some details (speed, route,
// hazards), so every row is optional.
export function CatchDetails({
  entry,
  onClose,
}: {
  entry: JournalEntry
  onClose: () => void
}) {
  const { flight } = entry
  const rows: [string, string][] = [['Caught', formatCaughtAt(entry.caughtAt)]]
  if (flight.origin) rows.push(['From', airportLine(flight.origin)])
  if (flight.destination) rows.push(['To', airportLine(flight.destination)])
  const type = aircraftType(flight.aircraft_type)?.name ?? flight.aircraft_type
  if (type) rows.push(['Aircraft', type])
  const airline = airlineFor(flight.callsign)
  if (airline) rows.push(['Airline', `${airline.name} · ${airline.country}`])
  if (typeof flight.altitude_ft === 'number')
    rows.push(['Altitude', formatAltitude(flight.altitude_ft)])
  if (typeof flight.speed_kt === 'number')
    rows.push(['Speed', formatSpeed(flight.speed_kt)])
  if (entry.hazards?.length)
    rows.push(['Weather', entry.hazards.map((h) => HAZARD_NAMES[h]).join(', ')])

  const radio = radioCallsign(flight.callsign)
  return (
    <DetailDialog
      icon={<PlaneIcon heading={0} aircraftType={flight.aircraft_type} />}
      title={flight.callsign}
      onClose={onClose}
    >
      {radio && <p className="catch-radio">“{radio}”</p>}
      <dl className="catch-rows">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </DetailDialog>
  )
}
