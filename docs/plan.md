# Airspace Explorer — Product & Technical Plan

**Status:** Product concept, MVP scope, visual/interaction direction, and technical direction are all settled. Milestone 1 is complete: steps 1–6 are done (scaffold, mock `/flights` endpoint, polling frontend with flight dots, click-to-open flight card, hardcoded quest, persisted Journal). Milestones 2–7 are ordered in the Implementation roadmap, and Milestone 2 (Living map) is in progress.

## Context

This is a first serious AI-assisted coding project and first portfolio piece. The goal is to explore and learn about aviation — ahead of starting a PPL — while building something technically and visually interesting. The project deliberately avoids becoming a FlightRadar-style dashboard; it's a playful, kawaii "spot & collect" exploration experience instead.

## Product concept

**One-line pitch:** A kawaii, live-data-powered "spot & collect" exploration experience built on real flight traffic — users hunt for real, live aviation moments (not just track blips on a dashboard), collect them into a personal journal, and pick up bite-size aviation knowledge along the way, while deliberately avoiding the look and feel of a flight-tracking dashboard like FlightRadar24.

### Target user

Aviation-curious people without deep aviation background — including the creator, who is preparing for a PPL — who want a playful, low-pressure way to build intuition about aviation. Secondary audience: casual users who enjoy cozy collection/spotting games and might discover an interest in aviation through play.

### Core loop

1. Explore a 2D map of flying aircraft (pan/zoom, Google Maps-style interaction). MVP starts on mock flight data, but that mock data is deliberately modeled on the attributes/structure a real flight-data source would provide, so the experience is designed around the eventual real-data version and the source stays swappable later (a free, personal-development-tier API is the intended eventual source).
2. Each day — a **personal** day, resetting on the user's own local calendar day, not a globally shared/synchronized challenge — the app surfaces **one** active quest (not a pool or a rotating list) — e.g. "spot something above 30,000 ft," "catch a flight heading over open ocean," "spot a flight flying through a storm system." Quests are built from a small set of parameterized _quest templates_ (altitude, aircraft category, region/geography, weather condition, time-of-day) rather than hand-authored one by one, which is what makes "one per day" sustainable content-wise. Flight duration is included in the Flight data model from the start, which unlocks a distance-based template once the templated quest system itself is built — the template system, including this one, is a later milestone, not part of the first implementation.
3. Outside the daily quest, a small set of "featured" flights are highlighted directly on the map each session, so there's always something worth catching even without an active quest — this is what keeps the experience from being an open, blank search/filter dashboard.
4. The user taps/catches a flight — from the daily quest or a featured pick or free exploration. A card appears showing the flight and **one** fact, pulled from small tagged fact-pools keyed to that catch's real attributes (aircraft type, airline, altitude band, destination/region, time-of-day, weather). The same fact system covers aircraft, specific flights, _and_ airports — airports are never a separately catchable thing; airport facts surface through the destination/region tag attached to a caught flight.
5. Caught flights are saved into a **Journal**. Completing the daily quest triggers a bigger celebration plus a fact that explains the underlying _concept_ (why planes cruise at that altitude, why routes avoid storms, etc.), not just trivia about the aircraft.
6. Badge/achievement unlocks are signaled with a lightweight popup on the map view, but live in their own space — Journal and Badges are two tabs/sections inside one shared **Collection** screen, reached from the main map. Collection/progress persists locally on the user's device across sessions in the MVP — no accounts or cloud sync.
7. Weather is represented on the map with icons for atmosphere ("imagine being on this flight"), and is also a functional attribute — it can define quest conditions and influence which facts get selected, tying directly back to real aviation concepts (turbulence, why routes avoid storms, etc.).

### Differentiation from flight-tracker dashboards (e.g. FlightRadar24)

- Framed as a curated discovery/collection experience, not a raw search-and-filter utility.
- Success is measured by "moments caught" and facts learned, not by exhaustive data density.
- Visual identity is playful/kawaii throughout — not a technical/utilitarian dashboard look.
- The app proactively suggests what's interesting rather than requiring the user to already know what to search for.

## MVP scope

**Essential:**

- Pannable/zoomable 2D map with multiple moving flight icons, driven by mock data whose attribute structure mirrors a real flight-data API so the source can be swapped later without redesign.
- Tap-to-catch interaction: a card showing one fact pulled from tagged fact-pools (attributes: aircraft type, airline, altitude band, destination/region, time-of-day, weather) — covering aircraft, specific flights, and airports (airport facts surface via the destination/region tag, not a separate catching action).
- The catch action plus a satisfying catch animation.
- One active **personal** daily quest (resets on the user's local calendar day, not shared/synchronized globally), built from parameterized quest templates (altitude, aircraft category, region, weather, time-of-day), shown prominently, with a bigger completion celebration and a concept-level fact.
- A small set of "featured" flights highlighted on the map for catching outside the daily quest.
- A **Collection** screen with two areas — Journal (caught flights) and Badges/Achievements — reached from the map; the map itself only shows a lightweight popup when a badge unlocks.
- Local persistence of Journal/Collection progress across sessions (no accounts or cloud sync).
- Ambient + functional weather: weather icons on the map for atmosphere, and weather as an attribute that quests/facts can use.
- A short onboarding moment (mascot greeting + one easy first catch/quest).
- Kawaii-first visual style applied to the map, icons, and cards.

**Nice-to-have (loop survives without it at launch):**

- A streak counter for daily quests.
- A richer mascot personality/dialogue beyond onboarding.
- Larger fact pools / more attribute categories over time.

**Out (explicitly deferred, not MVP):**

- GPS/location-based "look up, that's above you" mode.
- Pattern-based live event detection that requires historical track analysis (holding patterns, diversions, weather reroutes) — these need continuous polling and track history, unlike the snapshot-derivable quests above, and are a reasonable fast-follow rather than a launch requirement.
- A full illustrated aircraft/airport/aviation encyclopedia beyond per-catch facts.
- 3D aircraft models in the flight card.
- Weather forecasting/simulation — only current (or mock) snapshot conditions, not prediction.
- Accounts, social features, rankings.

## Open items for future planning passes

- [OpenSky Network](https://openskynetwork.github.io/opensky-api/rest.html) — free live ADS-B state vectors (position, altitude, velocity, heading, callsign) for non-commercial/research use, OAuth2 client-credentials auth as of 2026. The mock data's attribute structure should mirror OpenSky's state-vector fields. Still open: the exact field-by-field schema mapping and auth setup — and free-tier request limits should be re-verified on OpenSky's own docs immediately before integration, since third-party sources disagreed on the exact daily allowance during research (reports ranged ~1,000–4,000 requests/day for authenticated accounts). Two further points to settle at integration time:
  - **Flight identity.** The Journal's "one catch per flight per day" rule relies on `Flight.id`. For real data, `id` should come from the callsign (a flight number repeats daily on the same route, so callsign plus the day identifies one flight), not the ICAO24 transponder address (which identifies the airframe, and one airframe flies several flights a day). Handle a missing callsign.
  - **Missing fields to verify.** As researched so far, live state vectors don't include aircraft type, route or flight duration, yet the long-haul quest uses `duration_min` and facts are keyed by `aircraft_type`. Check OpenSky's aircraft metadata and flights endpoints (or another source) for these before relying on them. The Milestone 2 journey replay also depends on origin/destination, so it stays hidden for flights without a route.
- The concrete quest template parameters (exact thresholds per template) — the templated system itself is a later milestone; Milestone 1 ships with a single hardcoded quest condition instead.
- The concrete fact-pool content per attribute category (aircraft type, airline, altitude band, region, time-of-day, weather) for aircraft, flights, and airports.
- How mock weather data is represented/sourced before any real weather integration.
- Hosting/deployment target (a free static host — Vercel, Netlify, or GitHub Pages are all viable for a portfolio piece, plus somewhere to run the FastAPI backend) — not yet decided. Build tooling is settled (see Technical direction).
- The concrete screen/component breakdown.
- Visual/character design direction for the "kawaii" aircraft, mascot, and weather-icon representation.

## Technical direction

- **Architecture: two-part monorepo** — `frontend/` (React + TypeScript + Vite) and `backend/` (Python + FastAPI) in one repository. Introducing a real backend from the start (rather than deferring it) is motivated by a concrete need, not "real apps have backends": OpenSky's OAuth2 flow requires a client secret that must never reach the browser, and pooling/caching requests against OpenSky's shared daily quota also needs a server-side layer — both are real requirements once live data is integrated, so the boundary is worth having early.
- **Backend responsibility boundary:** the backend owns _world/flight data_ only — serving it (mock now, real later) through a stable domain model. It never owns user-specific data. The frontend owns everything user-scoped — Journal, Badges, active quest state — consistent with the decision that persistence is local-only (no accounts, no cloud sync).
- **Backend data model (minimal for now):** a single flat `Flight` — id, callsign, aircraft type (plain string for now), latitude, longitude, altitude, heading, and **flight duration** (included from the start to support a future distance-based quest template even though that quest is a later milestone). As implemented, fields are `id`, `callsign`, `aircraft_type`, `latitude`/`longitude` (degrees), `altitude_ft` (feet, matching how pilots and the quests express altitude), `heading` (degrees, 0–360) and `duration_min` (minutes), validated with pydantic. OpenSky reports altitude in metres, so the eventual provider converts to these units. Richer models (`AircraftType`, `WeatherCondition` as their own structured types) are deliberately deferred until the features that need them are actually being built. Milestone 2 adds the first one, because the journey replay needs a route. `Airport` (`icao`, `iata`, `name`, `latitude`, `longitude`) and `Flight.origin`/`Flight.destination` are **optional**, because OpenSky state vectors carry no route. `Flight.speed_kt` (knots) is also added, since OpenSky reports velocity.
- **No formal provider abstraction yet:** a plain function (e.g. `get_mock_flights()`) generates mock data. A shared interface for multiple providers (mock vs. OpenSky) is deferred until there's an actual second implementation to satisfy — introducing it now, with only one real implementation, would be premature abstraction.
- **Minimal API surface:** one endpoint, `GET /flights`, returning the normalized `Flight` list. No POST endpoints — the backend stores nothing user-specific. Fact-pool content is a static file bundled into the frontend, not a backend endpoint, since it's content rather than something requiring server computation.
- **Live data source: OpenSky Network** (see Open Items) — the intended eventual real provider; mock data's structure mirrors what OpenSky-normalized data would look like, so swapping providers later changes only the backend's internal implementation, never the `/flights` contract or the frontend.
- **World/map rendering: custom illustrated world, decoupled from mechanics** — pan/zoom and lat/lon-to-screen placement are built and proven against a plain placeholder background first; the final retro-poster illustrated art is a later visual pass on top of already-working mechanics, not a prerequisite for a playable version.
- **Tooling (settled in the scaffold):** frontend uses Vite, npm, oxlint, Prettier, Vitest with Testing Library, and `tsc` for type checking; backend uses pip with a `pyproject.toml` and virtualenv, pytest, ruff and strict mypy. Commands are in the root `README.md`. Hosting is still open.
- **Animation: Framer Motion** — the eventual choice for the MVP's bouncy/springy interactions; not needed until after the core loop works. GSAP was considered for more elaborate showcase moments but deferred to keep the animation surface manageable for a first project.
- **State & persistence: React Context/hooks + browser localStorage** — simplest setup, adequate for MVP-scale Journal/quest data.
- **Quest logic for now:** a single hardcoded quest condition (no template engine) proves the loop first; the parameterized quest-template system described above is a deliberate later generalization, not part of the first implementation milestone.

## Implementation roadmap

**Milestone 1 — walking skeleton with one playable loop (done):**

1. ✅ Done. Scaffold `backend/` (FastAPI, `/health` endpoint) and `frontend/` (Vite + React + TS, fetches `/health` and displays it) — proves CORS/plumbing before any feature work. (The frontend's `/health` display was later replaced by `/flights` loading/error states; the backend `/health` endpoint is kept.)
2. ✅ Done. Backend: minimal `Flight` model (including duration) + `get_mock_flights()` returning 10 flights with positions jittered by up to ±0.5° per call; `GET /flights` returning them as JSON.
3. ✅ Done. Frontend: poll `/flights` every 5 seconds, render each as a simple dot positioned over a plain placeholder background (basic linear lat/lon-to-x/y scaling over fixed Europe/North Atlantic bounds — no map library, no art yet). A failed poll keeps the last good flights on screen.
4. ✅ Done. Frontend: click a dot → card in a fixed panel below the map showing callsign/altitude + one deterministic fact per aircraft type from a small hardcoded lookup (`facts.ts`; randomized pick from a fact pool comes later), with a "Catch" button. Clicking another dot swaps the card; clicking the selected dot or the map deselects. If the selected flight drops out of the feed it stays at its last known position, flagged "signal lost", until caught or deselected. "Catch" is a stub that only closes the card until step 6.
5. ✅ Done. Frontend: one hardcoded quest, "Catch a long-haul flight (over 6 hours)" (`duration_min > 360`, defined in `quest.ts`; 4 of the 10 mock flights match). It is shown in a ticket-style strip above the map (`QuestBanner.tsx`). The first matching catch stamps the strip with an animated "Done!" stamp and reveals a concept fact (great-circle routes) that stays visible; later matches change nothing. Completion was in-memory only in this step; step 6 replaced it with completion derived from today's Journal entries. There is no template system. To make the quest playable, the card also shows a duration chip (`format.ts`).
6. ✅ Done. Frontend: "Catch" appends an entry to a Journal persisted to localStorage (versioned key, and corrupt or missing data loads as an empty Journal). Each entry holds the flight snapshot, the fact text shown (stored so it survives facts becoming random picks later) and an ISO `caughtAt` timestamp. It is rendered as a plain list below the map, newest first (`JournalList.tsx`). Three deliberate changes from the original step:
   - **A custom hook instead of Context.** The state lives in `useJournal` rather than React Context, because only `App` uses it so far. Context arrives with the Collection screen.
   - **One catch per flight per local day.** A flight already caught today shows a "Caught today ✓" stamp instead of the Catch button.
   - **A minimal daily reset, pulled forward.** Quest completion is no longer stored. It is derived from _today's_ catches, so older catches don't count and the quest resets at the user's local midnight. This implements the "personal day" rule from the core loop for the single hardcoded quest.

**Later milestones (ordered, not yet started).** Finish the MVP mechanics first (a living map, daily variety, a Collection). Then do the visual pass once the screens are stable, and swap in real data last. Each milestone ends in a playable, demoable state. Two MVP "Essential" items are still missing after Milestone 1: pan/zoom, and flights that actually move (the mock only jitters them by ±0.5°).

**Milestone 2 — Living map (current target):** the map feels like real airspace you can explore. Flights move at **real speed**, the way flight trackers show them. Zoomed out that movement is barely visible, so a "See the journey" replay supplies the visible motion. This is our version of the route line and playback that FlightRadar24-style apps offer.

1. ✅ Done. Backend: flights on real routes at real speed. A minimal `Airport` model, plus optional `origin`/`destination` and a `speed_kt` field on `Flight`. There are ~25–30 mock flights between ~15 real airports. Each one's position is interpolated along the great-circle route from origin to destination according to elapsed server time. `duration_min` is the distance divided by the speed, and a flight that arrives departs again with the same `id`. Small great-circle helpers live in `geo.py`.
2. Frontend: mirror the new fields, show the route ("FRA → JFK") on the card, and let planes glide between polls with a 5 s CSS transition. A flight that restarts its leg jumps rather than sliding back across the map.
3. Frontend: "See the journey". A card button (hidden when the route is unknown) draws the dashed great-circle route and flies a ghost plane from origin to destination in ~8 s with `requestAnimationFrame`. It is cancelled by closing the card or selecting another flight, and under reduced motion only the route line is shown. The live plane stays put as "you are here".
4. Frontend: pan/zoom. Hand-rolled on the existing map: one transformable layer, planes counter-scaled so they keep their size, drag / wheel / pinch / +− buttons, 1×–6× zoom clamped to the bounds. The maths lives in a tested `panzoom.ts`. No map library.

**Milestone 3 — Daily variety (facts, quest templates, featured flights):** a new reason to come back each day.

0. Data-fit check (research, no code). Re-verify which attributes OpenSky actually provides (see Open items). Templates and fact tags should rely mostly on attributes that will survive the switch to real data (altitude, position/region, airline from the callsign prefix, time of day). Aircraft type and duration are flagged as needing a metadata source.
1. Tagged fact pools. `facts.ts` becomes a static pool tagged by aircraft type, airline, altitude band, region and time-of-day. `getFact` collects the matching facts and picks one at random. This is safe because Journal entries already store the fact text they showed.
2. Quest templates. Replace `QUEST` with a few parameterized templates (altitude, aircraft category, region such as "over open ocean", time-of-day, long-haul duration), each with a title, a concept fact and `matches()`. Today's quest is picked deterministically from the local date, so a reload shows the same quest, and only from quests at least one current flight can satisfy. Completion is still derived from today's Journal entries.
3. Featured flights. Highlight 2–3 flights per session on the map with a distinct marker ring, favouring rarer types and matches for today's quest.

**Milestone 4 — Collection, badges and the catch moment:** catching feels rewarding and progress has a home.

1. A Collection screen with Journal and Badges tabs, opened from the map (simple view state, no router). Journal state moves into React Context here.
2. Badges defined as pure functions over the Journal (first catch, 5 aircraft types, 3 quest days, an ocean crossing…), so they are derived rather than stored. Only the set of badges already seen is persisted, and a newly unlocked badge shows a one-time popup on the map.
3. Passport card and catch stamp: the deferred idea in `docs/ui-foundation.md`, extending `.stamp`. Its open questions get answered at the start of the milestone.

**Milestone 5 — Visual pass, mascot and onboarding:** the retro travel-poster kawaii identity, ready for the portfolio. Starts with a short design doc (palette values, mascot, silhouette style).

1. Illustrated map art replacing `EuropeLand.tsx` and the placeholder sea.
2. Silhouettes for each aircraft type, and palette tokens that shift by time of day (region and weather come later).
3. Mascot and a short onboarding (a greeting, then one guaranteed-easy first catch).
4. Framer Motion for springy card, stamp and popup motion.

**Milestone 6 — Weather:** atmosphere first, then weather as a game attribute.

1. A mock weather snapshot from the backend (a few areas, each with a condition). Whether this becomes a new endpoint or a field on flights gets decided then.
2. Weather icons on the map.
3. Weather as a quest-template parameter and fact tag (turbulence, storm avoidance).

**Milestone 7 — Live data and deployment:** real flights, publicly hosted.

1. `OpenSkyProvider` behind the existing `/flights` contract: OAuth2 client credentials, server-side caching to protect the daily quota, a callsign-based `id`, and metres converted to feet. The provider interface is introduced here, once a second implementation exists.
2. Fill in the missing type and duration from a metadata source, or scale back the templates that depend on them.
3. Deploy the frontend (static host) and the backend, which settles the hosting open item.

**Nice-to-have, after the MVP:** streak counter, richer mascot dialogue, larger fact pools, a collection-progress view.

## Visual & interaction direction

A small visual foundation slice (tokens, fonts, plane markers, placeholder land, ticket card) was pulled ahead of step 5 — see `docs/ui-foundation.md`. The full visual pass below is still a later milestone.

- **Overall style: Retro travel-poster kawaii** — vintage mid-century aviation travel-poster palettes and shapes, combined with cuteness, rather than generic cartoon cuteness. This is meant to be aviation-flavored kawaii specifically, a differentiator in its own right.
- **Mascot:** kept, rendered in the same poster style (e.g. a stylized paper-airplane or pilot figure), still carrying onboarding and daily-quest prompts.
- **Aircraft fidelity:** recognizable, proportionate aircraft silhouettes rather than abstracted generic shapes — this doubles as passive aircraft-type-recognition learning, reinforcing the project's educational goal through the art itself, not just the fact cards.
- **Motion personality:** bouncy/springy animation, deliberately contrasting the flat vintage-poster look with toy-like, playful energy.
- **Palette strategy:** shifts by context (region, time-of-day, weather) rather than one fixed palette — warm tones over deserts, cool over poles, dusk hues at sunset, etc. This reinforces the weather layer already defined as functional (not just decorative) in the MVP, and makes exploring different parts of the world feel visually distinct.

Still open: concrete palette values, mascot character design, aircraft illustration style guide, iconography for weather/badges, and UI layout/screen composition — these belong to a dedicated visual-design pass.
