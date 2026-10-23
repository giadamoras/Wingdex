import { useState } from 'react'
import type { Flight, Taf } from '../data/types'
import { DetailDialog } from '../shared-ui/DetailDialog'
import { arrivalTime } from './route'
import { clockTime, codeTimeExample, prevailingAt } from './taf'
import { decodeTaf } from './tafDecode'
import {
  landingPeriod,
  laterLines,
  stats,
  summaryWords,
  ticketMoment,
  weatherIcon,
} from './tafTicket'
import { useAirportZone } from './timeZone'
import { useTaf } from './useTaf'

// Later changes shown on the summary; all of them are on the code side.
const MAX_LATER = 4

// The card's weather sticker, on its top corner, and the pop-up it opens:
// the destination's forecast (TAF), as pilots read before a flight. The pop-up
// has two sides. The summary, like a weather app: the landing's weather as an
// icon and a few words, three numbers, and a short line for each later
// change. Turned over, the code pilots read, word by word, each word next to
// what it means. The sticker shows only once the forecast has loaded, so it
// never opens an empty pop-up. The summary's times are on the destination's
// clock, the code's in UTC as pilots read it.
export function WeatherOnArrival({ flight }: { flight: Flight }) {
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<'summary' | 'code'>('summary')
  const destination = flight.destination
  const { taf } = useTaf(destination?.icao ?? null)
  // Looked up when the pop-up opens; null until then and while loading.
  const zone = useAirportZone(destination ?? null, open)
  if (!destination || !taf) return null

  const arrival = arrivalTime(flight)
  const moment = ticketMoment(taf, arrival)
  const main = prevailingAt(taf, moment.t)
  if (!main) return null
  const icon = weatherIcon(main)
  // Spells running at the landing are the first of these, "Until …".
  const allLater = zone ? laterLines(taf, moment.t, zone) : []
  const later = allLater.slice(0, MAX_LATER)
  const more = allLater.length - later.length
  const close = () => {
    setOpen(false)
    setSide('summary')
  }

  return (
    <>
      <button
        className="weather-btn"
        aria-haspopup="dialog"
        aria-label={`Weather on arrival at ${destination.iata}: ${summaryWords(main)}`}
        title="Weather on arrival"
        onClick={() => setOpen(true)}
      >
        {/* A teaser: the weather at a glance, the tap for the rest. */}
        <span className="weather-btn-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="weather-btn-code" aria-hidden="true">
          {destination.iata}
        </span>
      </button>
      {open && (
        <DetailDialog
          icon={null}
          title={`Weather at ${destination.city ?? destination.name}`}
          onClose={close}
          turnKey={side}
        >
          {side === 'summary' && !zone ? (
            // A spinner until the zone is known (the first open only), so
            // the times never change under the player's eyes.
            <p className="ticket-loading" role="status">
              <span className="visually-hidden">Loading local time…</span>
            </p>
          ) : side === 'summary' ? (
            <>
              <div className="ticket-hero">
                <span className="ticket-icon" aria-hidden="true">
                  {icon}
                </span>
                <div>
                  <p className="ticket-when">
                    {/* The clock is named once here; "UTC" only when the
                        zone couldn't be found. */}
                    {moment.isArrival
                      ? `Landing ~${clockTime(moment.t, zone!)} ${clockName(zone!, destination.city)}`
                      : 'Now · it lands after this forecast ends'}
                  </p>
                  <p className="ticket-summary">{summaryWords(main)}</p>
                </div>
              </div>
              <ul className="ticket-stats">
                {stats(main).map((s) => (
                  <li key={s.icon}>
                    <span aria-hidden="true">{s.icon}</span>
                    <strong>{s.value}</strong>
                    {s.label}
                  </li>
                ))}
              </ul>
              {later.length > 0 && (
                <ul className="ticket-later">
                  {later.map((line) => (
                    <li key={`${line.when}-${line.what}`}>
                      <span className="ticket-later-when">{line.when}</span>
                      <span aria-hidden="true">{line.icon}</span>
                      <span>{line.what}</span>
                    </li>
                  ))}
                </ul>
              )}
              {more > 0 && (
                <p className="ticket-note">
                  And {more} more in the code pilots read.
                </p>
              )}
              <button className="ticket-turn" onClick={() => setSide('code')}>
                Show the code pilots read
              </button>
            </>
          ) : (
            <CodeSide
              taf={taf}
              landing={landingPeriod(taf, moment.isArrival ? moment.t : null)}
              onTurn={() => setSide('summary')}
            />
          )}
        </DetailDialog>
      )}
    </>
  )
}

// The clock the summary's times are on: "Leipzig time", "local time"
// without a city, "UTC" when the lookup fell back to it.
const clockName = (zone: string, city: string | null | undefined) =>
  zone === 'UTC' ? 'UTC' : city ? `${city} time` : 'local time'

// The pop-up's back: the code as pilots read it, split into its opening and
// one block per group, each word in a chip next to what it means. The block
// in force at the landing is marked.
function CodeSide({
  taf,
  landing,
  onTurn,
}: {
  taf: Taf
  landing: number | null
  onTurn: () => void
}) {
  const { opening, blocks } = decodeTaf(taf, landing)
  return (
    <>
      <p className="ticket-where">The code pilots read, word by word</p>
      {/* The code as pilots see it, on one line (it scrolls sideways). */}
      <p className="code-line">
        <code>{taf.raw}</code>
      </p>
      <p className="ticket-note">
        Times are UTC, written day and hour: {codeTimeExample(taf)}.
      </p>
      <div className="code-side">
        <div className="code-block">
          <dl>
            {opening.map((w) => (
              <div key={w.code} className="code-word">
                <dt>
                  <code>{w.code}</code>
                </dt>
                <dd>{w.meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
        {blocks.map((block, index) => (
          <div
            key={index}
            className={block.atLanding ? 'code-block at-landing' : 'code-block'}
          >
            {block.atLanding && (
              <p className="code-landing">
                <span aria-hidden="true">✈</span> When you land
              </p>
            )}
            <dl>
              {block.words.map((w, i) => (
                // A group's keyword with its times ("PROB40 TEMPO 2221/2303")
                // is long: its meaning goes under it, not beside it.
                <div
                  key={`${i}-${w.code}`}
                  className={
                    w.code.includes(' ') ? 'code-word lead' : 'code-word'
                  }
                >
                  <dt>
                    <code>{w.code}</code>
                  </dt>
                  <dd>{w.meaning}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <button className="ticket-turn" onClick={onTurn}>
        Show the forecast summary
      </button>
    </>
  )
}
