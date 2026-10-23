import { useEffect, useRef, useState } from 'react'
import type { FormEvent, SyntheticEvent } from 'react'
import { fetchCallsigns } from '../data/api'
import type { Flight } from '../data/types'
import {
  DOWN_WORDS,
  findByCallsign,
  INVALID_WORDS,
  normaliseSearch,
  notFoundWords,
} from './findFlight'

// A press in the input must not start a drag of the map under it: selecting
// the text would pan. (Clicks in the map controls never deselect: FlightMap.)
const keepFromMap = (e: SyntheticEvent) => e.stopPropagation()

// "Find a flight": a magnifier with the map controls that opens a small form.
// The text is looked for in the whole feed first (a callsign, "CES640"), then
// sent to the backend, which says which callsigns a flight number ("MU640")
// may fly under. A plane found is handed to `onFound` (App flies the map in
// on it and opens its card); otherwise the form says why it may be missing.
// Not a list of results or a filter: one flight, for a player who knows which.
export function FlightSearch({
  flights,
  onFound,
}: {
  flights: Flight[]
  onFound: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  // The lookup in progress, cancelled by a new search or by closing.
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  // Opening the form puts the cursor in it, ready to type.
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  const close = () => {
    pending.current?.abort()
    setOpen(false)
    setSearching(false)
    setMessage(null)
  }

  const found = (flight: Flight) => {
    close()
    setText('')
    onFound(flight.id)
  }

  const search = async (e: FormEvent) => {
    e.preventDefault()
    pending.current?.abort()
    const query = normaliseSearch(text)
    if (query === null) return setMessage(INVALID_WORDS)
    // The feed first: a callsign needs no request.
    const direct = findByCallsign(flights, [query])
    if (direct) return found(direct)
    const controller = new AbortController()
    pending.current = controller
    setSearching(true)
    setMessage(null)
    try {
      const callsigns = await fetchCallsigns(query, controller.signal)
      if (controller.signal.aborted) return
      const flight = findByCallsign(flights, callsigns)
      if (flight) found(flight)
      else setMessage(notFoundWords(query, callsigns))
    } catch {
      if (!controller.signal.aborted) setMessage(DOWN_WORDS)
    } finally {
      if (pending.current === controller) {
        pending.current = null
        setSearching(false)
      }
    }
  }

  return (
    <div className="flight-search">
      <button
        aria-label="Find a flight"
        title="Find a flight"
        aria-expanded={open}
        aria-pressed={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {/* A magnifier, drawn: the fonts have none. */}
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="4.5" />
          <path d="M10 10l4.5 4.5" />
        </svg>
      </button>
      {open && (
        <div className="flight-search-panel">
          <form role="search" onSubmit={search}>
            <input
              ref={input}
              aria-label="Flight number or callsign"
              onPointerDown={keepFromMap}
              onKeyDown={(e) => {
                if (e.key === 'Escape') close()
              }}
              placeholder="MU640 or CES640"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={12}
            />
            <button type="submit" disabled={searching}>
              {searching ? 'Looking…' : 'Find'}
            </button>
          </form>
          {/* Announced when it appears: the region stays mounted. */}
          <p className="flight-search-message" role="status">
            {message}
          </p>
        </div>
      )}
    </div>
  )
}
