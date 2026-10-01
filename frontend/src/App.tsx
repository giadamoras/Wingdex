import { AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { BadgePopup } from './BadgePopup'
import { Collection } from './Collection'
import { dayKey, isToday } from './dates'
import { pickFeatured } from './featured'
import { FlightCard } from './FlightCard'
import { FlightMap } from './FlightMap'
import { Onboarding } from './Onboarding'
import { QuestBanner } from './QuestBanner'
import { prefersReducedMotion, useReplay } from './replay'
import type { Flight } from './types'
import { useBadgeUnlocks } from './useBadgeUnlocks'
import { useDailyQuest } from './useDailyQuest'
import { useFlights } from './useFlights'
import { useJournalContext } from './useJournalContext'
import { useOnboarding } from './useOnboarding'

function App() {
  const { flights, jumped, error } = useFlights()
  const { journal, addCatch } = useJournalContext()
  const quest = useDailyQuest(flights)
  const { replay, playedId, start, stop } = useReplay()
  const { popupBadge, dismiss: dismissBadge } = useBadgeUnlocks(journal)
  const onboarding = useOnboarding(flights, journal.length)

  // 'map' vs the Collection screen (Journal + Badges tabs); a plain view
  // state, no router, per the Milestone 4 plan.
  const [view, setView] = useState<'map' | 'collection'>('map')

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
    if (!selected) return
    const questId =
      quest !== null && !questDone && quest.matches(selected)
        ? quest.id
        : undefined
    addCatch(selected, questId)
    if (questId !== undefined)
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      })
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
    // has-onboarding leaves room under the page for the docked mascot.
    <main className={onboarding.step ? 'has-onboarding' : undefined}>
      <div className="app-header">
        <h1>✈ Airspace Explorer</h1>
        <button
          className={`collection-btn${onboarding.step === 'done' ? ' nudge' : ''}`}
          onClick={() => setView(view === 'map' ? 'collection' : 'map')}
        >
          {view === 'map' ? '📘 Collection' : '🗺 Map'}
        </button>
      </div>
      {view === 'collection' ? (
        <Collection />
      ) : (
        <>
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
                targetId={onboarding.targetId}
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
          <AnimatePresence>
            {popupBadge && (
              <BadgePopup
                key={popupBadge.id}
                badge={popupBadge}
                onDismiss={dismissBadge}
              />
            )}
          </AnimatePresence>
          <Onboarding
            // While a card is open only the mascot stays: the speech bubble
            // could cover the card's own buttons on a short viewport.
            step={onboarding.step}
            cardOpen={selected !== null}
            hasTarget={onboarding.targetId !== null}
            onAdvance={onboarding.advance}
            onDismiss={onboarding.dismiss}
          />
        </>
      )}
    </main>
  )
}

export default App
