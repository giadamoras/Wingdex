import { useState } from 'react'
import { dayKey, isToday } from './dates'
import { pickFeatured } from './featured'
import { FlightCard } from './FlightCard'
import { FlightMap } from './FlightMap'
import { JournalList } from './JournalList'
import { QuestBanner } from './QuestBanner'
import { prefersReducedMotion, useReplay } from './replay'
import type { Flight } from './types'
import { useDailyQuest } from './useDailyQuest'
import { useFlights } from './useFlights'
import { useJournal } from './useJournal'

function App() {
  const { flights, jumped, error } = useFlights()
  const { journal, addCatch } = useJournal()
  const quest = useDailyQuest(flights)
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
  // A catch that finishes the quest also scrolls to the top, where the quest
  // strip and its "Done!" stamp are, so it's noticed while reading the card.
  const catchFlight = () => {
    if (selected) {
      addCatch(selected)
      if (quest && !questDone && quest.matches(selected))
        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        })
    }
    stop()
    setSelected(null)
  }

  const lost = selected !== null && !live
  // Derived from the Journal on every render, never stored separately.
  const todaysCatches = journal.filter((e) => isToday(e.caughtAt))
  // Each catch is judged at its own catch time (matters for night quests).
  const questDone =
    quest !== null &&
    todaysCatches.some((e) => quest.matches(e.flight, new Date(e.caughtAt)))
  const caughtToday = todaysCatches.some((e) => e.flight.id === selected?.id)

  // Featured flights: picked once per session, when the feed and quest are
  // ready. The ring goes away once the flight is caught today.
  const [featured, setFeatured] = useState<string[] | null>(null)
  if (featured === null && flights && quest)
    setFeatured(
      pickFeatured(
        flights,
        quest,
        new Set(todaysCatches.map((e) => e.flight.id)),
        dayKey(),
      ),
    )
  const featuredIds = new Set(
    (featured ?? []).filter(
      (id) => !todaysCatches.some((e) => e.flight.id === id),
    ),
  )

  // A lost flight stays on the map at its last position until dismissed.
  const mapFlights = lost ? [...(flights ?? []), selected] : (flights ?? [])

  return (
    <main>
      <h1>✈ Airspace Explorer</h1>
      <QuestBanner quest={quest} done={questDone} />
      {flights === null ? (
        <p>{error ? 'Could not load flights.' : 'Loading flights...'}</p>
      ) : (
        <>
          {error && <p>Connection lost, retrying...</p>}
          <FlightMap
            flights={mapFlights}
            selectedId={selected?.id ?? null}
            jumped={jumped}
            featuredIds={featuredIds}
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
