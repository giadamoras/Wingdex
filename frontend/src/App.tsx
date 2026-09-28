import { useState } from 'react'
import { isToday } from './dates'
import { FlightCard } from './FlightCard'
import { FlightMap } from './FlightMap'
import { JournalList } from './JournalList'
import { QUEST } from './quest'
import { QuestBanner } from './QuestBanner'
import { useReplay } from './replay'
import type { Flight } from './types'
import { useFlights } from './useFlights'
import { useJournal } from './useJournal'

function App() {
  const { flights, jumped, error } = useFlights()
  const { journal, addCatch } = useJournal()
  const { replay, playedId, start, stop } = useReplay()

  // Snapshot of the selected flight, so it survives dropping out of the feed.
  const [selected, setSelected] = useState<Flight | null>(null)

  // Refresh the snapshot on each poll while the flight is still in the feed.
  const live = selected && flights?.find((f) => f.id === selected.id)
  if (live && live !== selected) setSelected(live)

  // Selecting another flight or closing the card cancels a replay.
  const select = (id: string | null) => {
    stop()
    setSelected(flights?.find((f) => f.id === id) ?? null)
  }

  // Catch button: records the flight in the Journal, then closes the card.
  // The quest completes by itself once a matching catch is in today's entries.
  const catchFlight = () => {
    if (selected) addCatch(selected)
    stop()
    setSelected(null)
  }

  const lost = selected !== null && !live
  // Derived from the Journal on every render, never stored separately.
  const todaysCatches = journal.filter((e) => isToday(e.caughtAt))
  const questDone = todaysCatches.some((e) => QUEST.matches(e.flight))
  const caughtToday = todaysCatches.some((e) => e.flight.id === selected?.id)

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
            jumped={jumped}
            replay={replay}
            onSelect={select}
          />
          {selected && (
            <FlightCard
              flight={selected}
              lost={lost}
              caught={caughtToday}
              replaying={replay?.flight.id === selected.id}
              replayed={playedId === selected.id}
              onCatch={catchFlight}
              onReplay={() => start(selected)}
              onStopReplay={stop}
            />
          )}
        </>
      )}
      {/* Outside the loading branch: past catches show even if flights fail to load. */}
      <JournalList entries={journal} />
    </main>
  )
}

export default App
