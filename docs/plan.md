# Airspace Explorer — Product & Technical Plan

**Status:** Product concept, MVP scope, visual/interaction direction, and technical direction are all settled.

- **Done.** Milestone 1 (walking skeleton: one playable spot-catch-quest-Journal loop), Milestone 2 (living map: real-speed routes, world map with pan/zoom, journey replay) and Milestone 3 (daily variety: tagged facts, quest templates, featured flights). All three are summarized in the Implementation roadmap.
- **Next.** Milestones 4–7 are ordered there, and Milestone 4 (Collection, badges and the catch moment) is next in line. None of them has been started.

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
    - **Checked for Milestone 3 (2026-09-28, OpenSky REST docs).** State vectors have 18 fields: position, barometric and geometric altitude (metres), velocity (m/s), true track, vertical rate, callsign, on-ground flag and a numeric aircraft category (index 17). They have no aircraft type, route or duration. The quota is 400 credits/day anonymous, 4,000 standard and 8,000 for active feeders, so the earlier "1,000–4,000" reports were roughly right for standard accounts. Aircraft type and duration therefore need a metadata source at integration time (Milestone 7). Until then the Milestone 3 templates and fact tags rely mostly on altitude, position/region, airline (callsign prefix) and time of day, and treat aircraft type and duration as the parts that may need scaling back.
- Weather quest templates and weather fact tags: the template system and the fact pools exist since Milestone 3 (thresholds are constants at the top of `quest.ts`), but nothing uses weather until Milestone 6. The pools are also still small (37 facts), so they can grow at any time.
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
- **Quest logic:** a small list of parameterized quest templates in `quest.ts`, each with a title, a concept fact and a `matches()` test. One is picked per local day and saved (see Milestone 3). There is no template engine beyond that list.

## Implementation roadmap

**Completed milestones.** Summaries only. The step-by-step history is in the git log.

**Milestone 1 — Walking skeleton (done).** One playable loop end to end:

- **Backend and data.** A FastAPI backend serves mock flights on `GET /flights` (plus `/health`), and the frontend polls it every 5 s. A failed poll keeps the last good data on screen.
- **Map and card.** Planes on a placeholder map. Clicking one opens a ticket-style card with its details, one fact per aircraft type (`facts.ts`) and a Catch button. A selected flight that drops out of the feed stays at its last position, flagged "signal lost".
- **Quest.** One hardcoded quest, "Catch a long-haul flight (over 6 hours)" (`quest.ts`), shown in a ticket strip that gets a "Done!" stamp and a concept fact (great-circle routes) when completed. Milestone 3 turned it into one of several templates.
- **Journal.** Catches go into a Journal persisted to localStorage under a versioned key; corrupt or missing data loads as empty. Each entry stores the flight snapshot, the fact text shown and a `caughtAt` timestamp.
- **Rules that still hold:**
  - A flight can be caught once per local day.
  - Quest completion is never stored: it is derived from _today's_ catches, so the quest resets at local midnight (the "personal day" rule).
  - Journal state lives in the `useJournal` hook; React Context arrives with the Collection screen.

**Milestone 2 — Living map (done).** The map feels like real airspace you can explore, and the two MVP gaps left by Milestone 1 (moving flights, pan/zoom) are closed:

- **Real routes at real speed (backend).** A minimal `Airport` model, plus optional `origin`/`destination` and `speed_kt` on `Flight`. The 26 mock flights between 23 real airports move along great-circle routes by elapsed server time (`geo.py`) and restart from their origin on arrival with the same `id`. `duration_min` is the scheduled gate-to-gate time (air time + 25 min). Speeds and altitudes are believable rather than exact.
- **Smooth motion (frontend).** Planes glide between polls (5 s CSS transition) and fade in when they appear. A data-source-independent rule (`jumpedFlightIds` in `motion.ts`) snaps any plane that moved further than its speed allows, e.g. after a route restart or, later, a real coverage gap.
- **World map with pan/zoom.** The whole world except Antarctica, in an 18:7 box with Natural Earth 1:110m coastlines. They are generated once by `scripts/build-land.mjs` into `worldLandData.ts`.
  - **Pan/zoom.** Hand-rolled with no map library: drag, wheel, pinch and +/−/reset buttons, 1×–16×, opening at 5× on Europe (`panzoom.ts`, `usePanZoom.ts`).
  - **Constant sizes.** Planes and line widths undo the zoom through a `--zoom` CSS variable, because `non-scaling-stroke` ignores CSS scaling.
- **Route and journey replay.** Selecting a flight draws its great-circle route: solid where flown, dashed ahead, with IATA chips at both airports (`RouteLayer.tsx`, `geo.ts` mirroring `geo.py`).
  - **Replay.** "See the journey" glides the camera to fit the route. Then a ghost plane flies origin → destination, leaving a solid trail, at about 1 s per hour of flight kept between 3 and 10 s (`replay.ts`).
  - **Controls.** The button becomes "Stop", then "Replay journey". Closing the card or selecting another flight cancels a replay, and reduced motion skips the ghost.
- **Deferred idea.** Make the mock behave like real traffic: park the plane at its destination and fade it out, then a new flight appears at the origin. This needs a "recently left the feed" state.
- **Fixed: the replay ghost jittered.** The ghost moved in small hops and wobbled sideways in both Edge and Firefox. It is smooth in both now (confirmed by eye).
  - **Cause.** The ghost was placed with `left`/`top` percentages inside the zoomed `.map-world` layer. Browsers round those to whole layer pixels _before_ the zoom is applied, so at 4–5× it moved in ~4–5 px steps, and x and y rounded independently (a staircase on diagonal routes). Measured in Edge by screenshots of the real ghost markup moved in sub-pixel steps: `left`/`top` changed on screen in 6 of 20 steps, in irregular clumps, while `transform` changed on all 20.
  - **Fix.** The ghost is moved with `transform: translate(x%, y%)` on a full-layer wrapper (`.ghost-track` in `RouteLayer.tsx`). The wrapper must stay exactly the size of the layer, because the percentages are relative to it.
  - **Wrong guess.** Firefox's jitter was first suspected to be a low frame rate, since it rounds differently. It wasn't: the same fix cured it. So the frame rate is fine for now (a replay ran at a steady 60 fps), and re-rendering `App` every frame isn't a problem yet.
  - **Measuring gotcha.** `getBoundingClientRect` reports layout positions and hides this rounding. Only screenshots (painted pixels) reveal it.
  - **Same rule elsewhere.** Anything that moves continuously inside the zoomed layer should use `transform`, not `left`/`top`. Live planes and endpoint chips still use `left`/`top`, which is fine while they move well under one layer pixel per poll.

**Milestone 3 — Daily variety (done).** A new reason to come back each day. It is all frontend; the backend and the `/flights` contract did not change:

- **Data fit.** Checked against OpenSky's docs (see Open items). Tags and templates rely mostly on attributes that survive real data. Aircraft type and duration are the ones that need a metadata source in Milestone 7.
- **Tags (`attributes.ts`).** The one place that turns a flight into labels: altitude band (low, mid, cruise, high), airline (the 3-letter callsign prefix), region and time of day.
  - **Region.** "Land" is a point-in-polygon test on the map's own `WORLD_LAND` data. "Open ocean" is water with no land within about 3° in 8 directions, so the English Channel and Irish Sea don't count. A few coarse boxes add "europe" and "north-atlantic", and the Mediterranean and other big seas are excluded by box.
  - **Time of day.** Local solar time at the plane (UTC plus longitude/15), not the viewer's clock.
- **Tagged facts (`facts.ts`).** 37 facts, each tagged by aircraft type, airline, altitude band, region or time of day. A flight gets one of the facts matching its tags, picked by a hash of flight id and local day (`hash.ts`, `dayKey` in `dates.ts`). It is stable across polls, so the card doesn't flicker and the Journal saves what was shown, yet it varies between flights and days.
- **Quest templates (`quest.ts`).** Seven: high (over 36,000 ft), low (under 20,000 ft), wide-body, propeller, over open ocean, in the dark, long-haul (over 6 h).
  - **Daily pick.** `pickQuest` starts at a point chosen by the local date and takes the first template some current flight can satisfy.
  - **Lock-in.** The choice (only `{day, questId}`, not completion) is saved under `airspace-explorer:quest:v1` (`dailyQuest.ts`, `useDailyQuest.ts`), so a reload or a changed feed keeps the day's quest.
  - **Completion.** Still derived from today's Journal, judging each catch at its own `caughtAt` time, which matters for the night quest.
- **Featured flights (`featured.ts`).** Three planes per session get a pulsing dashed ring: one that completes the quest, then the rarest aircraft types in the current feed, one plane per type, skipping flights caught today. They are picked once when the feed and quest are ready, and a ring goes away when the flight is caught.
- **Catch scroll.** The catch that completes the quest scrolls the page back to the top, where the quest strip and its stamp are (smooth, or instant under reduced motion).
- **Known limits.**
  - With the static mock feed the featured picks barely change from day to day (the same rare types), and the night quest is only available when some plane is over a night-time longitude.
  - The fact pool is a first draft, reviewed by the user.
  - There are no weather tags yet (Milestone 6).

**Next milestones (ordered, not yet started).** Finish the MVP mechanics first (a Collection). Then do the visual pass once the screens are stable, and swap in real data last. Each milestone ends in a playable, demoable state.

**Milestone 4 — Collection, badges and the catch moment:** catching feels rewarding and progress has a home.

1. A Collection screen with Journal and Badges tabs, opened from the map (simple view state, no router). Journal state moves into React Context here.
2. Badges defined as pure functions over the Journal (first catch, 5 aircraft types, 3 quest days, an ocean crossing…), so they are derived rather than stored. Only the set of badges already seen is persisted, and a newly unlocked badge shows a one-time popup on the map.
3. Passport card and catch stamp: the deferred idea in `docs/ui-foundation.md`, extending `.stamp`. Its open questions get answered at the start of the milestone.

**Milestone 5 — Visual pass, mascot and onboarding:** the retro travel-poster kawaii identity, ready for the portfolio. Starts with a short design doc (palette values, mascot, silhouette style).

1. Illustrated map art replacing the placeholder coastlines (`WorldLand.tsx`) and sea.
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

A small visual foundation slice (tokens, fonts, plane markers, placeholder land, ticket card) was pulled ahead of the Milestone 1 quest work — see `docs/ui-foundation.md`. The full visual pass below is still a later milestone.

- **Overall style: Retro travel-poster kawaii** — vintage mid-century aviation travel-poster palettes and shapes, combined with cuteness, rather than generic cartoon cuteness. This is meant to be aviation-flavored kawaii specifically, a differentiator in its own right.
- **Mascot:** kept, rendered in the same poster style (e.g. a stylized paper-airplane or pilot figure), still carrying onboarding and daily-quest prompts.
- **Aircraft fidelity:** recognizable, proportionate aircraft silhouettes rather than abstracted generic shapes — this doubles as passive aircraft-type-recognition learning, reinforcing the project's educational goal through the art itself, not just the fact cards.
- **Motion personality:** bouncy/springy animation, deliberately contrasting the flat vintage-poster look with toy-like, playful energy.
- **Palette strategy:** shifts by context (region, time-of-day, weather) rather than one fixed palette — warm tones over deserts, cool over poles, dusk hues at sunset, etc. This reinforces the weather layer already defined as functional (not just decorative) in the MVP, and makes exploring different parts of the world feel visually distinct.

Still open: concrete palette values, mascot character design, aircraft illustration style guide, iconography for weather/badges, and UI layout/screen composition — these belong to a dedicated visual-design pass.
