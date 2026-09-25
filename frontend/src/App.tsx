import { useState } from 'react'
import { FlightCard } from './FlightCard'
import { FlightMap } from './FlightMap'
import { QUEST } from './quest'
import { QuestBanner } from './QuestBanner'
import type { Flight } from './types'
import { useFlights } from './useFlights'

function App() {
  const { flights, error } = useFlights()
  // Snapshot of the selected flight, so it survives dropping out of the feed.
  const [selected, setSelected] = useState<Flight | null>(null)

  // Whether the quest is completed. In memory only: a reload resets it until
  // the Journal milestone step adds localStorage persistence.
  const [questDone, setQuestDone] = useState(false)

  // Refresh the snapshot on each poll while the flight is still in the feed.
  const live = selected && flights?.find((f) => f.id === selected.id)
  if (live && live !== selected) setSelected(live)

  const select = (id: string | null) =>
    setSelected(flights?.find((f) => f.id === id) ?? null)

  // Catch button: completes the quest if the flight matches, then closes the
  // card. The Journal (next milestone step) will also record the catch here.
  const catchFlight = () => {
    if (selected && QUEST.matches(selected)) setQuestDone(true)
    setSelected(null)
  }

  const lost = selected !== null && !live
  // A lost flight stays on the map at its last position until dismissed.
  const mapFlights = lost ? [...(flights ?? []), selected] : (flights ?? [])

  return (
    <main>
      <h1>✈ Airspace Explorer</h1>
      <QuestBanner done={questDone} />
      {flights === null ? (
        <p>{error ? 'Could not load flights.' : 'Loading flights...'}</p>
      ) : (
        <>
          {error && <p>Connection lost, retrying...</p>}
          <FlightMap
            flights={mapFlights}
            selectedId={selected?.id ?? null}
            onSelect={select}
          />
          {selected && (
            <FlightCard flight={selected} lost={lost} onCatch={catchFlight} />
          )}
        </>
      )}
    </main>
  )
}

export default App
