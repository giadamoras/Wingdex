import { AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { BadgePopup } from './collection/BadgePopup'
import { Collection } from './collection/Collection'
import { creditLine } from './data/credits'
import { isToday } from './shared-lib/dates'
import { FlightCard } from './card/FlightCard'
import { FlightMap } from './map/FlightMap'
import { Onboarding } from './onboarding/Onboarding'
import { flightsForMap } from './map/mapFlights'
import { isQuestDone, questIdForCatch } from './quest/quest'
import { QuestBanner } from './quest/QuestBanner'
import { useReplay } from './map/replay'
import { prefersReducedMotion } from './shared-lib/reducedMotion'
import { mergeRoute } from './card/route'
import type { Flight, WeatherArea } from './data/types'
import { useBadgeUnlocks } from './collection/useBadgeUnlocks'
import { useCardFact } from './card/useCardFact'
import { useDailyQuest } from './quest/useDailyQuest'
import { useDataSources } from './data/useDataSources'
import { useFeatured } from './quest/useFeatured'
import { useFlightRoute } from './card/useFlightRoute'
import { useFlights } from './data/useFlights'
import { useJournalContext } from './collection/useJournalContext'
import { useOnboarding } from './onboarding/useOnboarding'
import { useWeather } from './data/useWeather'

// Stable empty list for while weather is loading, so memoised map code doesn't
// see a new array on every render.
const NO_WEATHER: WeatherArea[] = []

// Button next to the "feed is down" messages: asks the server again at once.
function TryAgain({ onClick }: { onClick: () => void }) {
  return (
    <button className="retry-btn" onClick={onClick}>
      Try again
    </button>
  )
}

function App() {
  const { flights, jumped, departed, error, stalled, retrying, retry } =
    useFlights()
  // Null until the first response; quests and featured flights wait for it.
  // weatherAreas is the same list, empty until then.
  const weatherOrNull = useWeather()
  const weatherAreas = weatherOrNull ?? NO_WEATHER
  const credits = creditLine(useDataSources())
  const { journal, addCatch } = useJournalContext()
  const quest = useDailyQuest(flights, weatherOrNull, journal)
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

  // A live flight has no route in the feed: look it up once it is selected and
  // merge the answer in at render time (the snapshot above is replaced on every
  // poll). `current` is what the card, the map's route line, the replay and the
  // Journal all use.
  const lookup = useFlightRoute(selected)
  const current = selected && mergeRoute(selected, lookup.route)
  const fact = useCardFact(current, lookup.status, weatherAreas)

  // Selecting another flight or closing the card cancels a replay.
  const select = (id: string | null) => {
    stop()
    setSelected(flights?.find((f) => f.id === id) ?? null)
  }

  const scrollToTop = () =>
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })

  // Journey button: the map is at the top, and the card (tall in landscape)
  // can have been scrolled far below it, so bring the map back into view.
  const replayJourney = (flight: Flight) => {
    scrollToTop()
    start(flight)
  }

  const lost = selected !== null && !live
  // Derived from the Journal on every render, never stored separately.
  const todaysCatches = journal.filter((e) => isToday(e.caughtAt))
  const questDone =
    quest !== null && isQuestDone(quest, todaysCatches, weatherAreas)
  const caughtToday = todaysCatches.some((e) => e.flight.id === selected?.id)
  const featuredIds = useFeatured(flights, weatherOrNull, quest, todaysCatches)
  const mapFlights = flightsForMap(flights, current, lost)

  // Catch button: records the flight in the Journal. The card stays open, so
  // the Catch button turns into the "Caught today" stamp right under the
  // player's thumb. The quest completes by itself once a matching catch is in today's entries.
  // A catch that finishes the quest also scrolls to the top, where the quest
  // strip and its "Done!" stamp are, so it's noticed while reading the card.
  const catchFlight = () => {
    if (!current || fact === null) return
    const questId = questIdForCatch(
      quest,
      questDone,
      current,
      new Date(),
      weatherAreas,
    )
    addCatch(current, fact, questId)
    if (questId !== undefined) scrollToTop()
  }

  // What the feed status says. While a retry is out the message goes back to
  // "Loading"/"Trying again" and the button is hidden, so the tap visibly did
  // something. A failure that has stopped retrying is the alert.
  const loadFailed = flights === null && error && !retrying
  const feedDown = flights !== null && stalled && !retrying
  const feedNotice =
    flights === null
      ? loadFailed
        ? null
        : 'Loading flights...'
      : stalled
        ? retrying
          ? 'Trying again...'
          : null
        : error
          ? 'Connection lost, retrying...'
          : null

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
          <QuestBanner
            quest={quest}
            done={questDone}
            searching={flights === null || weatherOrNull === null}
            feedDown={loadFailed}
          />
          {/* Live regions stay mounted and only their text changes: a message
              is announced when it appears inside a region that already exists. */}
          <div role="status">{feedNotice && <p>{feedNotice}</p>}</div>
          <div role="alert">
            {loadFailed && (
              <p>
                Could not load flights.
                <TryAgain onClick={retry} />
              </p>
            )}
            {feedDown && (
              <p>
                Can&apos;t reach the flight feed. The planes may be out of date.
                <TryAgain onClick={retry} />
              </p>
            )}
          </div>
          {flights !== null && (
            <>
              <FlightMap
                flights={mapFlights}
                selectedId={selected?.id ?? null}
                jumped={jumped}
                departed={departed}
                featuredIds={featuredIds}
                targetId={onboarding.targetId}
                replay={replay}
                weather={weatherAreas}
                onSelect={select}
              />
              {current && (
                <FlightCard
                  flight={current}
                  fact={fact ?? ''}
                  routeStatus={lookup.status}
                  details={lookup.route}
                  lost={lost}
                  caught={caughtToday}
                  replaying={replay?.flight.id === current.id}
                  replayed={playedId === current.id}
                  onCatch={catchFlight}
                  onReplay={() => replayJourney(current)}
                  onStopReplay={stop}
                />
              )}
              {credits && <p className="credits">{credits}</p>}
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
