# Airspace Explorer — Product & Technical Plan

**Status:** Product concept, MVP scope, visual/interaction direction, and technical direction are all settled.

- **Done.** Milestone 1 (walking skeleton: one playable spot-catch-quest-Journal loop), Milestone 2 (living map: real-speed routes, world map with pan/zoom, journey replay), Milestone 3 (daily variety: tagged facts, quest templates, featured flights), Milestone 4 (Collection, badges and the catch moment), Milestone 5 (visual pass, mascot and onboarding) and Milestone 6 (weather). All six are summarized in the Implementation roadmap.
- **Next.** Milestone 7 (live data and deployment) is described there. It has not been started.

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
- Real weather source: the Aviation Weather Center's global SIGMET feed (see Milestone 6 for what was verified and what was not, and Milestone 7 for the integration item). The fact pools are still small (47 facts, 10 of them weather), so they can grow at any time.
- Hosting/deployment target (a free static host — Vercel, Netlify, or GitHub Pages are all viable for a portfolio piece, plus somewhere to run the FastAPI backend) — not yet decided. Build tooling is settled (see Technical direction).
- The concrete screen/component breakdown.

## Technical direction

- **Architecture: two-part monorepo** — `frontend/` (React + TypeScript + Vite) and `backend/` (Python + FastAPI) in one repository. Introducing a real backend from the start (rather than deferring it) is motivated by a concrete need, not "real apps have backends": OpenSky's OAuth2 flow requires a client secret that must never reach the browser, and pooling/caching requests against OpenSky's shared daily quota also needs a server-side layer — both are real requirements once live data is integrated, so the boundary is worth having early.
- **Backend responsibility boundary:** the backend owns _world/flight data_ only — serving it (mock now, real later) through a stable domain model. It never owns user-specific data. The frontend owns everything user-scoped — Journal, Badges, active quest state — consistent with the decision that persistence is local-only (no accounts, no cloud sync).
- **Backend data model (minimal for now):** a single flat `Flight` — id, callsign, aircraft type (plain string for now), latitude, longitude, altitude, heading, and **flight duration** (included from the start to support a future distance-based quest template even though that quest is a later milestone). As implemented, fields are `id`, `callsign`, `aircraft_type`, `latitude`/`longitude` (degrees), `altitude_ft` (feet, matching how pilots and the quests express altitude), `heading` (degrees, 0–360) and `duration_min` (minutes), validated with pydantic. OpenSky reports altitude in metres, so the eventual provider converts to these units. Richer models (`AircraftType` as its own structured type) are deliberately deferred until the features that need them are actually being built. Milestone 2 adds the first one, because the journey replay needs a route, and Milestone 6 adds `WeatherArea` (below). `Airport` (`icao`, `iata`, `name`, `latitude`, `longitude`) and `Flight.origin`/`Flight.destination` are **optional**, because OpenSky state vectors carry no route. `Flight.speed_kt` (knots) is also added, since OpenSky reports velocity.
- **No formal provider abstraction yet:** a plain function (e.g. `get_mock_flights()`) generates mock data. A shared interface for multiple providers (mock vs. OpenSky) is deferred until there's an actual second implementation to satisfy — introducing it now, with only one real implementation, would be premature abstraction.
- **Minimal API surface:** two endpoints, `GET /flights` (the normalized `Flight` list) and, since Milestone 6, `GET /weather` (the normalized `WeatherArea` list). No POST endpoints — the backend stores nothing user-specific. Fact-pool content is a static file bundled into the frontend, not a backend endpoint, since it's content rather than something requiring server computation. (The "Idea: move content to a database" entry under Nice-to-have would revisit this.)
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
  - There were no weather tags yet; Milestone 6 added them.

**Milestone 4 — Collection, badges and the catch moment (done).** Catching feels rewarding and progress has a home. Still all frontend:

- **Collection screen (`Collection.tsx`).** Journal, Badges and Facts tabs behind a header button (`📘 Collection` / `🗺 Map`), a plain `view` state in `App.tsx`, no router. The Journal moved out of the map view into this screen's Journal tab.
- **Journal in Context.** `useJournal`'s state and localStorage effect moved into `JournalContext.tsx` (the `JournalProvider`, wrapping `<App>` in `main.tsx`), with the context object and value type in `journalStore.ts` and the consumer hook in `useJournalContext.ts` — split into three files, one hook per file like the rest of the codebase, to avoid a React Fast Refresh lint warning from mixing a component and a hook export. `addCatch` now takes an optional `questId`.
- **Badges (`badges.ts`).** Four, each a pure function over the Journal: first catch, 5 distinct aircraft types, 3 different quest-completion days, and a catch over open ocean (region recomputed from the flight snapshot's position, same as the quest template). "3 quest days" needed a small schema addition to stay Journal-only: `JournalEntry.questId` (optional) is set only on the catch that completed that day's quest, so quest-day badges don't need a separate quest-history store. Only the set of badges already shown a popup persists (`badgesSeen.ts`); unlocked state itself is always derived (`useBadgeUnlocks.ts`), and a newly unlocked badge shows a one-time popup on the map (`BadgePopup.tsx`), visually distinct from the entry stamp (a toast, not a stamped card).
- **Passport card.** The flight card is a passport page (ruled-paper texture, a header strip, the existing chips plus a new HEADING chip). Catch is the same uniform, immediate reaction for every flight — the plain "Caught today ✓" marker, no per-flight animation and no delay before the card closes (an earlier version delayed closing so a destination-specific stamp could land on the card itself; tried, then simplified away after review, since a varying per-catch animation and an artificial delay both add complexity without adding to the "satisfying catch" feel the plan called for).
- **Entry stamp and Journal.** The deferred passport-stamp idea in `docs/ui-foundation.md` lives on as the Journal's entry format rather than a catch-moment animation: each Journal entry is just a small ink "entry stamp" (`EntryStamp.tsx`) — destination-focused like a real immigration stamp (falls back to the callsign when there's no known route) — with no other flight detail, laid out as a wrapping row ("a page of stamps"). This also replaced the first attempt at a fuller passport-stub layout (callsign, chips, fact text) once it turned out to be more information than the collection view needed.
- **Facts tab.** Each catch's fact (`JournalEntry.fact`, unchanged since Milestone 1) is worth keeping even though the Journal entry no longer shows it. `FactList.tsx` lists every distinct fact learned so far, in the order first caught, deduplicated (`[...new Set(journal.map(e => e.fact))]` — `Set` preserves insertion order, so no extra bookkeeping is needed).
- **Known limits.** None outstanding. (An earlier draft of this note flagged the Badges/Facts tabs' `display: grid` single-column layout as sharing the Journal's narrow-item quirk; checked with a computed-width probe and it doesn't — their row content, unlike the old short Journal entries, is long enough that the implicit grid column already fills the container. Worth remembering: measure before writing a limitation down.)

**Next milestones.** The visual pass and weather are done; swapping in real data comes last. Each milestone ends in a playable, demoable state.

**Milestone 5 — Visual pass, mascot and onboarding (done):** the retro travel-poster kawaii identity, ready for the portfolio. Frontend only; details of each piece are in `docs/ui-foundation.md`.

- **Map art.** `WorldLand.tsx` reskins the same Natural Earth coastlines (land gradient lit from the north, zoom-compensated shadow, dotted graticule, a CSS sea texture). `CountryBorders.tsx`/`countryData.ts` (from `scripts/build-countries.mjs`) add borders and name labels at a constant screen size, with real collision avoidance using the map's rendered width. Two false starts fixed this: font size scaling with the map (a colliding pair could never separate on zoom) and a fixed rank threshold with no collision check.
- **Aircraft silhouettes and time-of-day palette.** `aircraftSilhouette.ts` sorts ICAO types into 5 families (reusing `quest.ts`'s `WIDE_BODY`/`TURBOPROP`), drawn by `PlaneIcon.tsx`. The map's sea/land palette (`.map[data-map-time]`) follows the solar time at the viewport centre (`timeOfDay`, `centreOf`, `unprojectLongitude`) and eases over 0.9 s via `@property` colours. Region palette shifts are still deferred; a weather tint was tried in Milestone 6 and dropped.
- **Mascot.** `Mascot.tsx`: a chibi cat pilot with `idle`/`talk`/`cheer` faces. It also delivers the quest-completion fact (`QuestBanner.tsx`), a once-a-day celebration, not shown on the banner itself or on every card.
- **Onboarding.** `useOnboarding.ts` is a `greeting` -> `catch` -> `done` -> gone state machine, run once per device (`onboardingSeen.ts`). The mascot stays docked bottom-left for the whole flow and speaks each step in a typed-out speech bubble (`Onboarding.tsx`); the map stays usable throughout. The catch step rings one real flight near `DEFAULT_CENTER` (`onboardingTarget.ts`, pinned once picked) with its own `.plane.target` ring, but completes on *any* catch. The last step nudges the Collection button.
- **Framer Motion.** A real dependency now: card entrance, the shared stamp (`Stamp.tsx`), badge popup (with its first real exit animation) and the onboarding. The Journal grid, featured ring and map/route animations stay plain CSS (zoom-compensated SVG math). Under `prefers-reduced-motion`, converted components skip Framer Motion entirely (plain elements) - more correct for accessibility, and needed for testing (below).
- **Bugs found and fixed.**
  - The onboarding bubble could sit over the card's Catch/journey buttons on a short viewport and block clicks (found by a Playwright check, not unit tests). While a card is open the bubble is now a click-through "Hit Catch" hint, and the page gets bottom padding while onboarding runs.
  - The highlighted plane was invisible: the ring was a 2px dashed `--paper` circle, nearly the land's colour (this also hit the daily featured rings, now ink). The target was also re-picked every render, so the ring hopped between moving planes.
- **Testing gotcha.** Under Vitest's fake timers a `motion` component's exit transition (`AnimatePresence`) can fail to complete after earlier tests have driven other fake-timer animations (a cross-test scheduler leak; isolated repros pass, smaller time steps and real timers did not help). Mocking `matchMedia` to report reduced motion in the affected tests (the `reducedMotion()` helper in `App.test.tsx`, per test, not global) fixes it. The journey-replay tests need `prefersReducedMotion()` to read `false`, hence per-test.
- **Known limits.** The onboarding target is the flight nearest the default view; with a sparse live feed it could be off-screen (not handled). The mascot, hint bubble and Collection nudge were checked in a browser with a mocked feed at two viewport sizes, but not against a real phone; on a very short viewport the docked mascot and hint overlap the card's text until you scroll.

**Milestone 6 — Weather (done):** atmosphere first, then weather as a game attribute. Backend plus frontend; the `/flights` contract did not change.

- **Real source, mock data.** The intended real source is the Aviation Weather Center's global SIGMET feed (`https://aviationweather.gov/api/data/isigmet?format=json`): free, no key, about 100 requests/min and 400 results per query. It was checked against a live response, not just its docs. It is worldwide (about 100 advisories, from Asia and South America to Europe), unlike the AWC's `airsigmet` and G-AIRMET products, which are US-only and not used. Open-Meteo (free, per-point weather codes) was the alternative; it is dense but not aviation-specific, so it was dropped.
  - **Fields seen:** `icaoId`, `firId`, `firName`, `validTimeFrom`/`validTimeTo` (epoch seconds), `seriesId`, `hazard` (TS, TURB, ICE, MTW, VA, TC), `qualifier`, `base`/`top` (feet), `geom` ("AREA"), `coords` (a list of lat/lon points), `dir`, `spd`, `chng`, `rawSigmet`.
  - **Not confirmed.** There is no severity field on global SIGMETs (the US ones have one). `qualifier` held a volcano name in the two entries read, so its other values are unknown. Only `geom: "AREA"` was seen, so lines or points may exist. Check a larger sample before writing the provider.
- **Backend.** `GET /weather` returns `WeatherArea`s (`models.py`): `id`, `hazard` (thunderstorm, turbulence, icing, volcanic_ash, tropical_cyclone), `region`, `altitude_min_ft`/`altitude_max_ft`, `valid_from`/`valid_to` (Unix seconds, as in the feed), a closed `polygon` of `LatLon` points, and optional movement direction and speed. It is normalised (our names, not AWC's), so a real provider only maps fields. A separate endpoint, not a field on `Flight`, because a hazard belongs to an area rather than to one plane, and flights and weather will come from different sources. The mock (`mock_weather.py`) is a static snapshot of 9 areas, rectangles standing in for real polygons, placed over the mock routes and a few far-off spots; the validity window is recomputed around "now", so the areas never expire. The movement fields are unused for now, so a drifting mock needs no contract change.
- **Icons (`WeatherLayer.tsx`, `HazardIcon.tsx`, `weatherIcons.ts`).** Round stickers, one glyph per hazard, under the planes. An area gets one icon when it is small on screen and up to 4 as you zoom in. Positions are lattice points kept only if inside the polygon, ordered most-central first then farthest-apart, so zooming only adds icons and a concave area never gets an icon outside it. The area's outline and a label (hazard, region, altitude band) appear only when an icon is clicked. A ☁ button in the map controls hides or shows all weather (not remembered between visits). Details are in `docs/ui-foundation.md`.
- **Game attribute.** `weatherAt` (`attributes.ts`) says a flight is "in" a hazard when it is inside the polygon, within the altitude band and the advisory is valid at that moment. The altitude check is the lesson: a flight above an icing layer is not in it.
  - **Quests (`quest.ts`).** Five more templates, one per hazard, built from a small table. `matches` gained an optional third argument, the weather areas, which only these templates read.
  - **Facts (`facts.ts`).** 10 weather facts (47 in total). A flight inside a hazard shows only facts about that hazard, since weather is rare and worth explaining when met; otherwise the pool is unchanged.
  - **Featured flights.** The quest-completing flight can be a weather one.
- **Two bugs found and fixed.**
  - **A weather quest could un-complete.** "Done" was recomputed from each saved catch, but the Journal does not store weather, so live weather moving away would have undone it. The entry that completed the quest already carries `questId`, so "done" is now `questId` matches, or the quest still matches.
  - **A pick race.** Weather loads separately from flights. Picking the quest before weather arrived meant weather quests could never be chosen that day. `useWeather` is now `null` until its first request settles, and the quest and the featured flights wait for it. A failed request settles to "no weather", so it can never block either.
- **Tried and dropped: a weather tint.** A soft, neutral wash over each hazard area (SVG polygons, blurred edges, multiply blend). Seen in a browser it looked like muddy smudges on the land, was nearly invisible over sea, and vanished at world zoom, so it was removed in favour of icons alone. A global palette shift was judged too heavy for 9 small areas and not built. Region and weather palette shifts remain deferred.
- **Known limits.**
  - With the mock, few flights are ever inside a hazard (one of the 9 areas had a flight in it when checked), so a weather quest is often skipped because no current flight can satisfy it. Icing (5,000-25,000 ft) is the hardest. This is true to the altitude lesson, but the mock areas could be widened for demos.
  - A quest is saved for the day when it is picked. With live weather the hazard could move away, leaving a quest nobody can complete.
  - A flight's fact can change between polls as it moves in or out of an area (region and time facts already behave this way).
  - Planes are drawn above weather icons, so a plane can sit over an icon; the area's other icons, or zooming in, still reach it. The icon count assumes a map about 1000 px wide. The storm and cyclone glyphs are the least legible at 26 px.
  - Weather quests and facts still work with the weather switch off.

**Milestone 7 — Live data and deployment:** real flights and weather, publicly hosted.

1. `OpenSkyProvider` behind the existing `/flights` contract: OAuth2 client credentials, server-side caching to protect the daily quota, a callsign-based `id`, and metres converted to feet. The provider interface is introduced here, once a second implementation exists.
2. Fill in the missing type and duration from a metadata source, or scale back the templates that depend on them.
3. Real weather behind the existing `/weather` contract: a provider that maps the AWC `isigmet` JSON into `WeatherArea` (field notes and unconfirmed details are in Milestone 6), with server-side caching inside its rate limit. Decide what to do with real SIGMETs being sparse and issued around real events: the weather quests may often have nothing to match, and a quest saved for the day can outlive its hazard.
4. Deploy the frontend (static host) and the backend, which settles the hosting open item.

**Nice-to-have, after the MVP:** streak counter, richer mascot dialogue, larger fact pools, a collection-progress view.

**Idea: move content (facts, quests) to a database.** Not a milestone; recorded so the trade-offs are written down before anyone commits to it.

- **Why.** Edit facts and quests without redeploying, handle a pool too large for a code file, and the portfolio value of a real data layer.
- **Fit.** Facts are already rows (kind, value, text), and the Journal stores the fact text it showed, so editing the pool never rewrites anyone's history. Quests are only partly data: the title and concept fact are text, but `matches()` is code.
- **Scope, undecided.**
  - (a) Facts only.
  - (b) Facts plus each quest's title and concept fact, with the matching rule kept in code and keyed by quest id.
  - (c) Facts plus full quest definitions, which needs a rule format.
- **Decisions it would reopen.**
  - Facts are a static file bundled into the frontend, not a backend endpoint (see Technical direction).
  - Option (c) reverses "there is no template engine beyond that list".
  - The backend owns world/flight data only. Content would be a new responsibility, though still never user-specific data.
- **Costs and risks.**
  - New infrastructure and a network dependency for content that works offline today.
  - The fact pick is a hash over the matching pool, so editing the pool changes which fact a flight shows. The pool would have to be fetched once and held for the session, so the card and the fact saved in the Journal agree.
  - Hosting is undecided until Milestone 7 and limits the database choice (a file database on an ephemeral free host would lose its data).
  - The tests currently rely on static content.
- **Staged path.**
  1. Move the facts out of `facts.ts` into a plain data file in the repo. No infrastructure, and most of the "content is not code" benefit.
  2. Serve content read-only from the backend, backed by a database, once editing without redeploying or the size of the pool is actually needed.
  3. An editor or admin page, only if someone other than the developer will edit content.
- **When to pick it up.** After Milestone 7 settles hosting, and when one of those needs is real.

## Visual & interaction direction

A small visual foundation slice (tokens, fonts, plane markers, placeholder land, ticket card) was pulled ahead of the Milestone 1 quest work — see `docs/ui-foundation.md`. The full visual pass below was done in Milestone 5.

- **Overall style: Retro travel-poster kawaii** — vintage mid-century aviation travel-poster palettes and shapes, combined with cuteness, rather than generic cartoon cuteness. This is meant to be aviation-flavored kawaii specifically, a differentiator in its own right.
- **Mascot:** kept, rendered in the same poster style (e.g. a stylized paper-airplane or pilot figure), still carrying onboarding and daily-quest prompts.
- **Aircraft fidelity:** recognizable, proportionate aircraft silhouettes rather than abstracted generic shapes — this doubles as passive aircraft-type-recognition learning, reinforcing the project's educational goal through the art itself, not just the fact cards.
- **Motion personality:** bouncy/springy animation, deliberately contrasting the flat vintage-poster look with toy-like, playful energy.
- **Palette strategy:** shifts by context (region, time-of-day, weather) rather than one fixed palette — warm tones over deserts, cool over poles, dusk hues at sunset, etc. This reinforces the weather layer already defined as functional (not just decorative) in the MVP, and makes exploring different parts of the world feel visually distinct.

Settled in Milestone 5: palette values, the cat-pilot mascot, aircraft silhouettes, badge iconography and screen layout. Settled in Milestone 6: weather iconography (round hazard stickers). The weather palette shift was tried as a local tint and dropped, and a region palette shift is still deferred.
