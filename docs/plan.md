# Airspace Explorer — Product & Technical Plan

**Status:** Product concept, MVP scope, visual/interaction direction, and technical direction are all settled.

- **Done.** Milestones 1-6 (walking skeleton, living map, daily variety, Collection and badges, visual pass and onboarding, weather), summarized in the Implementation roadmap.
- **In progress.** Milestone 7 (live data and deployment). Done: the OpenSky provider (step 1), live aircraft type, route and duration (step 2), the extra card detail and the journey readability fix. Next, in order: density (step 3), real weather (step 4), quests (step 5), world-wide mock data (step 6), deployment (step 7).

## Context

This is a first serious AI-assisted coding project and first portfolio piece. The goal is to explore and learn about aviation — ahead of starting a PPL — while building something technically and visually interesting. The project deliberately avoids becoming a FlightRadar-style dashboard; it's a playful, kawaii "spot & collect" exploration experience instead.

## Product concept

**One-line pitch:** A kawaii, live-data-powered "spot & collect" exploration experience built on real flight traffic — users hunt for real, live aviation moments (not just track blips on a dashboard), collect them into a personal journal, and pick up bite-size aviation knowledge along the way, while deliberately avoiding the look and feel of a flight-tracking dashboard like FlightRadar24.

### Target user

Aviation-curious people without deep aviation background — including the creator, who is preparing for a PPL — who want a playful, low-pressure way to build intuition about aviation. Secondary audience: casual users who enjoy cozy collection/spotting games and might discover an interest in aviation through play.

### Core loop

1. Explore a 2D map of flying aircraft (pan/zoom, Google Maps-style interaction). The game was built on mock data modelled on a real flight source's attributes, and the source is swappable (OpenSky is the live one, see Milestone 7).
2. Each day — a **personal** day, resetting on the user's own local calendar day, not a globally shared challenge — the app surfaces **one** active quest, e.g. "spot something above 30,000 ft," "catch a flight heading over open ocean," "spot a flight flying through a storm system." Quests are built from a small set of parameterized _quest templates_ (altitude, aircraft category, region, weather condition, time-of-day, duration) rather than hand-authored one by one, which is what makes "one per day" sustainable content-wise.
3. Outside the daily quest, a small set of "featured" flights are highlighted on the map each session, so there's always something worth catching — this keeps the experience from being an open, blank search/filter dashboard.
4. The user taps/catches a flight — from the daily quest, a featured pick or free exploration. A card appears showing the flight and **one** fact, pulled from small tagged fact-pools keyed to that catch's real attributes (aircraft type, airline, altitude band, destination/region, time-of-day, weather). The same fact system covers aircraft, specific flights, _and_ airports — airports are never a separately catchable thing; airport facts surface through the destination/region tag attached to a caught flight.
5. Caught flights are saved into a **Journal**. Completing the daily quest triggers a bigger celebration plus a fact that explains the underlying _concept_ (why planes cruise at that altitude, why routes avoid storms, etc.), not just trivia about the aircraft.
6. Badge/achievement unlocks are signaled with a lightweight popup on the map view, but live in their own space — Journal and Badges are two tabs/sections inside one shared **Collection** screen, reached from the main map. Collection/progress persists locally on the user's device — no accounts or cloud sync.
7. Weather is shown on the map with icons for atmosphere ("imagine being on this flight"), and is also a functional attribute — it can define quest conditions and influence which facts get selected, tying back to real aviation concepts (turbulence, why routes avoid storms, etc.).

### Differentiation from flight-tracker dashboards (e.g. FlightRadar24)

- Framed as a curated discovery/collection experience, not a raw search-and-filter utility.
- Success is measured by "moments caught" and facts learned, not by exhaustive data density.
- Visual identity is playful/kawaii throughout — not a technical/utilitarian dashboard look.
- The app proactively suggests what's interesting rather than requiring the user to already know what to search for.

## MVP scope

**Essential:**

- Pannable/zoomable 2D map with multiple moving flight icons.
- Tap-to-catch interaction: a card showing one fact pulled from tagged fact-pools.
- The catch action plus a satisfying catch animation.
- One active **personal** daily quest built from parameterized templates, shown prominently, with a bigger completion celebration and a concept-level fact.
- A small set of "featured" flights highlighted on the map.
- A **Collection** screen with Journal (caught flights) and Badges, reached from the map; the map itself only shows a lightweight popup when a badge unlocks.
- Local persistence of Journal/Collection progress across sessions (no accounts or cloud sync).
- Ambient + functional weather: icons on the map, and weather as an attribute that quests and facts can use.
- A short onboarding moment (mascot greeting + one easy first catch).
- Kawaii-first visual style applied to the map, icons, and cards.

**Nice-to-have (loop survives without it at launch):**

- A streak counter for daily quests.
- A richer mascot personality/dialogue beyond onboarding.
- Larger fact pools / more attribute categories over time.

**Out (explicitly deferred, not MVP):**

- GPS/location-based "look up, that's above you" mode.
- Pattern-based live event detection that needs historical track analysis (holding patterns, diversions, weather reroutes) — these need continuous polling and track history, unlike the snapshot-derivable quests, and are a reasonable fast-follow.
- A full illustrated aircraft/airport/aviation encyclopedia beyond per-catch facts.
- 3D aircraft models in the flight card.
- Weather forecasting/simulation — only current (or mock) snapshot conditions.
- Accounts, social features, rankings.

## Open items for future planning passes

- **Hosting** (a free static host such as Vercel, Netlify or GitHub Pages, plus somewhere to run the FastAPI backend) is not decided. It is settled in Milestone 7, step 7.
- **Fact pools** are still small (47 facts, 10 of them weather) and can grow at any time.
- **Ideas, not scheduled:** draw the real flown track of a selected flight; flight photos (see "Photos" in Milestone 7); airline-based quests and facts; learning missing aircraft types in the background; 3D aircraft models.

## Technical direction

- **Architecture: two-part monorepo** — `frontend/` (React + TypeScript + Vite) and `backend/` (Python + FastAPI) in one repository. The backend exists for concrete needs: OpenSky's OAuth2 client secret must never reach the browser, and pooling/caching requests against OpenSky's shared daily quota needs a server-side layer.
- **Backend responsibility boundary:** the backend owns _world/flight data_ only — serving it (mock or live) through a stable domain model. It never owns user-specific data. The frontend owns everything user-scoped — Journal, Badges, active quest state — consistent with local-only persistence.
- **Backend data model** (pydantic, `models.py`):
  - `Flight`: `id`, `callsign`, `latitude`/`longitude` (degrees), `altitude_ft`, `heading` (0-360), `speed_kt`, and optional `aircraft_type`, `duration_min` (with `duration_estimated`), `origin`/`destination` (`Airport`: `icao`, `iata`, `name`, `latitude`, `longitude`, optional `city` and `country`), `vertical_rate_fpm` and `registered_country`. The optional fields are null when a source does not know them. OpenSky reports metres and m/s, so the provider converts to these units.
  - `WeatherArea` (Milestone 6) and `FlightRoute` (the `/route` response, Milestone 7).
  - Richer models are deferred until a feature needs them.
- **Flight source:** `FlightProvider` (`providers.py`) with two implementations, mock and OpenSky, chosen by `FLIGHT_SOURCE`. Swapping sources changes only the backend, never the `/flights` contract or the frontend.
- **API surface:** `GET /flights`, `GET /weather`, `GET /flights/{id}/route` (route, type, estimated duration and detail of one live flight, looked up when a player taps it) and `/health`. No POST endpoints: the backend stores nothing user-specific. Fact-pool content is a static file bundled into the frontend, not an endpoint. (The "move content to a database" idea below would revisit this.)
- **World/map rendering:** a custom illustrated world, decoupled from mechanics. Pan/zoom and lat/lon-to-screen placement are hand-rolled, with no map library.
- **Tooling:** frontend uses Vite, npm, oxlint, Prettier, Vitest with Testing Library, and `tsc`; backend uses pip with a `pyproject.toml` and virtualenv, pytest, ruff and strict mypy. Commands are in the root `README.md`.
- **Animation:** Framer Motion for the bouncy, springy interactions. GSAP was considered and deferred.
- **State & persistence:** React Context/hooks + browser localStorage.
- **Quest logic:** a small list of parameterized quest templates in `quest.ts`, each with a title, a concept fact and a `matches()` test. One is picked per local day and saved (see Milestone 3). There is no template engine beyond that list.

## Implementation roadmap

**Completed milestones.** Summaries only. The step-by-step history is in the git log.

**Milestone 1 — Walking skeleton (done).** One playable loop end to end:

- **Backend and data.** A FastAPI backend serves mock flights on `GET /flights` (plus `/health`), and the frontend polls it every 5 s. A failed poll keeps the last good data on screen.
- **Map and card.** Planes on a placeholder map. Clicking one opens a ticket-style card with its details, one fact and a Catch button. A selected flight that drops out of the feed stays at its last position, flagged "signal lost".
- **Quest.** One hardcoded quest in a ticket strip that gets a "Done!" stamp and a concept fact when completed. Milestone 3 turned it into one of several templates.
- **Journal.** Catches go into a Journal persisted to localStorage under a versioned key; corrupt or missing data loads as empty. Each entry stores the flight snapshot, the fact text shown and a `caughtAt` timestamp.
- **Rules that still hold:**
  - A flight can be caught once per local day.
  - Quest completion is derived from _today's_ catches, so the quest resets at local midnight (the "personal day" rule).

**Milestone 2 — Living map (done).** Moving flights and pan/zoom:

- **Real routes at real speed (backend).** 26 mock flights between 23 real airports move along great-circle routes by elapsed server time (`geo.py`) and restart from their origin on arrival with the same `id`. `duration_min` is the scheduled gate-to-gate time (air time + 25 min).
- **Smooth motion (frontend).** Planes glide between polls (5 s CSS transition) and fade in when they appear. `jumpedFlightIds` (`motion.ts`) snaps any plane that moved further than its speed allows, e.g. after a route restart or a coverage gap.
- **World map with pan/zoom.** The whole world except Antarctica in an 18:7 box with Natural Earth 1:110m coastlines (generated by `scripts/build-land.mjs`). Drag, wheel, pinch and +/−/reset buttons, 1×–16×, opening at 5× on Europe (`panzoom.ts`, `usePanZoom.ts`). Planes and line widths undo the zoom through a `--zoom` CSS variable.
- **Route and journey replay.** Selecting a flight draws its great-circle route: solid where flown, dashed ahead, with IATA chips at both airports (`RouteLayer.tsx`). "See the journey" glides the camera to fit the route, then a ghost plane flies origin → destination at about 1 s per flight hour, kept between 3 and 10 s (`replay.ts`). Closing the card or selecting another flight cancels it, and reduced motion skips the ghost.
- **Lesson: sub-pixel motion inside the zoomed layer.** The replay ghost jittered because browsers round `left`/`top` percentages to whole layer pixels _before_ the zoom is applied (steps of ~4-5 px at 4-5×, with x and y rounding independently). It is now moved with `transform: translate(x%, y%)` on a full-layer wrapper (`.ghost-track`, which must stay exactly the size of the layer). `getBoundingClientRect` hides this rounding; only screenshots show it. Anything that moves continuously inside the zoomed layer should use `transform`. Live planes still use `left`/`top`, which is fine while they move well under one layer pixel per poll.
- **Deferred idea.** Park a mock plane at its destination and fade it out before a new flight appears at the origin, which needs a "recently left the feed" state.

**Milestone 3 — Daily variety (done).** All frontend; the `/flights` contract did not change.

- **Tags (`attributes.ts`).** The one place that turns a flight into labels: altitude band (low, mid, cruise, high), airline (the 3-letter callsign prefix), region and time of day.
  - **Region.** "Land" is a point-in-polygon test on the map's own `WORLD_LAND` data. "Open ocean" is water with no land within about 3° in 8 directions. A few coarse boxes add "europe" and "north-atlantic", and big seas are excluded by box.
  - **Time of day.** Local solar time at the plane (UTC plus longitude/15), not the viewer's clock.
- **Tagged facts (`facts.ts`).** Each fact is tagged by aircraft type, airline, altitude band, region, time of day or (Milestone 6) weather. A flight gets one of the facts matching its tags, picked by a hash of flight id and local day (`hash.ts`, `dayKey` in `dates.ts`), so it is stable across polls yet varies between flights and days.
- **Quest templates (`quest.ts`).** High, low, wide-body, propeller, over open ocean, in the dark, long-haul, plus five weather ones (Milestone 6).
  - **Daily pick.** `pickQuest` starts at a point chosen by the local date and takes the first template some current flight can satisfy.
  - **Lock-in.** Only `{day, questId}` is saved (`airspace-explorer:quest:v1`), so a reload or a changed feed keeps the day's quest.
  - **Completion.** Derived from today's Journal, judging each catch at its own `caughtAt` time, which matters for the night quest.
- **Featured flights (`featured.ts`).** Three planes per session get a pulsing dashed ring: one that completes the quest, then the rarest aircraft types in the feed, one plane per type, skipping flights caught today. They are picked once when the feed and quest are ready, and a ring goes away when the flight is caught.
- **Catch scroll.** The catch that completes the quest scrolls back to the quest strip and its stamp.

**Milestone 4 — Collection, badges and the catch moment (done).** All frontend.

- **Collection screen (`Collection.tsx`).** Journal, Badges and Facts tabs behind a header button, a plain `view` state in `App.tsx`, no router. The Journal state lives in `JournalContext.tsx` (provider, store and consumer hook in separate files, one hook per file, to avoid a React Fast Refresh lint warning).
- **Badges (`badges.ts`).** First catch, 5 distinct aircraft types, 3 different quest-completion days, and a catch over open ocean, each a pure function over the Journal. `JournalEntry.questId` (optional) is set only on the catch that completed that day's quest. Only the set of badges already shown a popup persists (`badgesSeen.ts`); unlocked state is derived (`useBadgeUnlocks.ts`), and a new badge shows a one-time toast (`BadgePopup.tsx`).
- **Passport card.** The flight card is a passport page. Catch is one uniform, immediate reaction for every flight ("Caught today ✓"). A per-flight stamp animation with a delay before the card closed was tried and simplified away, since it added complexity without improving the feel.
- **Entry stamp and Journal.** Each entry is a small ink stamp (`EntryStamp.tsx`), destination-focused (the callsign when there is no route), laid out as a wrapping row.
- **Facts tab.** `FactList.tsx` lists every distinct fact learned so far, in the order first caught.

**Milestone 5 — Visual pass, mascot and onboarding (done).** The retro travel-poster kawaii identity. Frontend only; details are in `docs/ui-foundation.md`.

- **Map art.** `WorldLand.tsx` reskins the coastlines (north-lit gradient, zoom-compensated shadow, dotted graticule, CSS sea texture). `CountryBorders.tsx` adds borders and name labels at a constant screen size with collision avoidance using the map's rendered width.
- **Aircraft silhouettes and time-of-day palette.** `aircraftSilhouette.ts` sorts ICAO types into 5 families, drawn by `PlaneIcon.tsx`. The map's sea and land palette follows the solar time at the viewport centre and eases over 0.9 s.
- **Mascot.** `Mascot.tsx`, a chibi cat pilot with `idle`/`talk`/`cheer` faces. It delivers the quest-completion fact, once a day.
- **Onboarding.** `useOnboarding.ts` is a `greeting` -> `catch` -> `done` state machine, run once per device. The mascot speaks in a typed-out bubble, and the catch step rings one real flight near the default view (`onboardingTarget.ts`, pinned once picked) but completes on _any_ catch.
- **Framer Motion** is a real dependency now (card entrance, stamp, badge popup, onboarding). Under `prefers-reduced-motion`, converted components skip it entirely.
- **Testing gotcha.** Under Vitest's fake timers a `motion` exit transition can fail to complete after earlier tests drove other fake-timer animations. Mocking `matchMedia` to report reduced motion in the affected tests (the `reducedMotion()` helper in `App.test.tsx`, per test) fixes it. The journey-replay tests need `prefersReducedMotion()` to read `false`.
- **Known limits.** The onboarding target is the flight nearest the default view; with a sparse live feed it could be off-screen. On a very short viewport the docked mascot and hint overlap the card's text until you scroll. Not checked on a real phone.

**Milestone 6 — Weather (done).** Backend plus frontend; the `/flights` contract did not change.

- **Real source, mock data.** The intended real source is the Aviation Weather Center's global SIGMET feed (`https://aviationweather.gov/api/data/isigmet?format=json`): free, no key, about 100 requests/min and 400 results per query. It was checked against a live response. It is worldwide (about 100 advisories), unlike the AWC's `airsigmet` and G-AIRMET products, which are US-only. Open-Meteo was the alternative and was dropped (dense but not aviation-specific).
  - **Fields seen:** `icaoId`, `firId`, `firName`, `validTimeFrom`/`validTimeTo` (epoch seconds), `seriesId`, `hazard` (TS, TURB, ICE, MTW, VA, TC), `qualifier`, `base`/`top` (feet), `geom` ("AREA"), `coords` (lat/lon points), `dir`, `spd`, `chng`, `rawSigmet`.
  - **Not confirmed.** There is no severity field on global SIGMETs. `qualifier` held a volcano name in the two entries read, so its other values are unknown. Only `geom: "AREA"` was seen, so lines or points may exist. Check a larger sample before writing the provider.
- **Backend.** `GET /weather` returns `WeatherArea`s: `id`, `hazard` (thunderstorm, turbulence, icing, volcanic_ash, tropical_cyclone), `region`, altitude band, `valid_from`/`valid_to` (Unix seconds), a closed `polygon` and optional movement. It is a separate endpoint because a hazard belongs to an area, not to one plane, and flights and weather will come from different sources. The mock (`mock_weather.py`) is a static snapshot of 9 rectangular areas whose validity is recomputed around "now".
- **Icons (`WeatherLayer.tsx`, `HazardIcon.tsx`, `weatherIcons.ts`).** Round stickers under the planes: one icon for a small area, up to 4 as you zoom in, placed inside the polygon. The outline and label appear when an icon is clicked. A ☁ button hides or shows all weather.
- **Game attribute.** `weatherAt` (`attributes.ts`) says a flight is "in" a hazard when it is inside the polygon, within the altitude band and the advisory is valid. A flight above an icing layer is not in it. Five weather quest templates, ten weather facts (shown only for a flight inside a hazard), and the quest-completing featured flight can be a weather one.
- **Bugs fixed.**
  - A weather quest could un-complete when the live weather moved away. "Done" is now the saved `questId` match, or the quest still matching.
  - Quest picking raced the weather request, so weather quests were never picked that day. `useWeather` is `null` until its first request settles (a failure settles to "no weather"), and the quest and featured flights wait for it.
- **Tried and dropped:** a weather tint over hazard areas (muddy smudges, invisible over sea) and a global palette shift (too heavy for 9 small areas). Region and weather palette shifts remain deferred.
- **Known limits.**
  - With the mock, few flights are ever inside a hazard, so a weather quest is often skipped (icing is the hardest).
  - A quest saved for the day can outlive its hazard once the weather is live.
  - A flight's fact can change between polls as it moves in or out of an area.
  - Planes are drawn above weather icons. The icon count assumes a map about 1000 px wide.

**Milestone 7 — Live data and deployment:** real flights and weather, publicly hosted. Done one step at a time.

**Order of the remaining steps:** 3 density, 4 real weather, 5 quests, 6 world-wide mock data, 7 deployment. Density comes first because it ties to the stutter measured below and changes what the other steps look like. The quest review follows weather because real weather changes which weather quests can match.

**Step 1a — OpenSky provider (backend only, done).** Run live once by the user on 2026-10-04.

- **Quota (re-verified 2026-10-04).** 4,000 credits per day for a standard account, no monthly cap found. A global `/states/all` costs 4 credits, and so does any box over 400 sq°, so a bounding box saves nothing. `X-Rate-Limit-Remaining` reports what is left; at zero the API answers 429 with `X-Rate-Limit-Retry-After-Seconds`.
- **Provider.** `providers.py` holds the `FlightProvider` Protocol and `create_provider`. `FLIGHT_SOURCE=mock` (default) or `opensky`, so a missing secret never breaks the app. `opensky.py` has the token handling, mapping, cache and dead reckoning. One shared snapshot refreshes on demand after 90 s, so no visitors means no quota use. On failure it serves the stale snapshot and backs off (30 s, or as long as a 429 asks).
- **Credit guard** (normal preset): a 60 s refresh floor, a 200-credit hourly cap and a 400-credit reserve read from OpenSky's header. `/health` shows its state. The presets and arithmetic are in `docs/opensky-credit-guard.md`.
- **Mapping.** `id` is the callsign, or the `icao24` address when there is none (the callsign then shows as "Unknown"). On-ground aircraft and incomplete rows are dropped, and duplicate callsigns keep the freshest report. The whole world is served, capped at 1,500 flights by a hash-of-id sample. That keeps the altitude mix (every quest can still match) and the same planes between refreshes. It is uniform, so it mirrors real traffic: Europe full, oceans, Africa and South America sparse. **Decided: keep it uniform.** A random pick each refresh was rejected because planes would flicker and selection, the once-a-day catch rule and fact choice would shift.

**Step 1b — Readability and performance of live data (done except density).**

- **Journey readability (done 2026-10-04, found by the user with live data).** Frontend only (details and the CSS gotcha are in `docs/ui-foundation.md`).
  - The route line is bent through the plane (`curveThrough`), because real planes are off the great-circle arc (airways, ocean tracks, winds; the plausibility check allows up to about 25%) and the solid and dashed parts used to meet beside the plane. Unchanged for a plane on the arc.
  - With a flight selected the other planes dim, during the replay they disappear, the route has a paper outline above the other planes (under the selected one), and planes shrink when zoomed out.
- **Motion (measured 2026-10-04, no code change).** Planes moving in fits and starts is a rendering cost, not timing. Headless Chromium (software rendering, so absolute numbers are pessimistic) with planes flown on every poll: polls arrive steadily every ~5.0 s; 30 planes glide at 60 fps and 600 at ~57 fps, but 1,500 drop to ~32 fps with about 50 frames over 50 ms in 20 s, against ~57 fps with the glide switched off. Moving the glide to the `translate` property (positions in `cqw`/`cqh`) did not help (24-37 fps, noisy) and was reverted; `will-change`, dropping the fade-in and dropping the icon's shadow made no clear difference. The cost grows with the number of planes, so the real fix is drawing fewer of them (step 3). Not tested: a real GPU or a phone. Method: Playwright with N injected moving planes, measuring `requestAnimationFrame` deltas over 20 s plus the gaps between polls (the script lived in a scratchpad, not the repo).
- **UI credit (done).** A small line under the map names OpenSky, its aircraft database and adsbdb.

**Step 2 — Aircraft type, route and duration for live flights (done).** Run against fakes, and the route service against the real adsbdb with a few requests. Not verified: the full flow against the live feed in a browser by Claude (the user ran it live and liked the card).

- **Sources (spike 2026-10-04).**
  - OpenSky's `/flights/*` endpoints are historical, so they cannot give a live route.
  - adsbdb (`api.adsbdb.com`, free, no key, MIT-licensed code) answered in 0.1-0.3 s: `GET /v0/aircraft/{icao24}` (type, ICAO type code, manufacturer, registration), `GET /v0/callsign/{callsign}` (route with full airport details), and `GET /v0/aircraft/{icao24}?callsign={callsign}` for both. It returns 404 when anything asked for is unknown, **including the combined call when only one half is unknown**, so a combined 404 is followed by one request per half. It documents no rate limit, no bulk endpoint and no uptime promise. Its README restricts the route data ("may not be copied, published, or incorporated into other databases"), and the MIT licence covers the code, not the data. The aircraft data comes from PlaneBase with no stated terms.
  - OpenSky's aircraft database is a 106 MB CSV (newest snapshot January 2025). Its page calls it "unlicensed", "as is", and asks that publications (web pages included) cite Schäfer et al., "Bringing Up OpenSky", IPSN 2014. 83% of its 601,282 aircraft have a type code. Against one live snapshot (10,811 airborne usable planes), 82% had a type; of the 1,968 without, 1,697 were not in the database (newer aircraft) and 271 had no type code.
- **Type.** A compact `icao24 -> type code` file (`backend/app/data/aircraft_types.csv.gz`, 501,934 aircraft, 1.8 MB) is committed and loaded at startup. `backend/scripts/build_aircraft_types.py` rebuilds it (steps in `docs/opensky-aircraft-database.md`). A plane not in it has `aircraft_type = null`; the log line shows how many kept flights have a type. A tap also fills in the type of a plane missing from the file.
- **Route, on a tap only.** `GET /flights/{id}/route` finds the flight in the current snapshot and asks adsbdb (`routes.py`). It answers 404 for an unknown flight or nothing known, and 503 when adsbdb is down; the frontend treats both as "unknown". A flight with a route in the feed (the mock) is answered from the feed. Answers are kept **in memory only**, never written to disk, because of the route data restriction: 24 h for a hit, 1 h for "unknown", failures not cached. The route is checked against the plane's position on **every** lookup (the plane must lie roughly between the airports), because a callsign can be flown on another leg later in the day. An earlier version checked only on the first lookup and served the cached route for the wrong plane; this was caught against the live adsbdb.
- **Duration is an estimate:** great-circle distance at 440 kt plus 25 minutes of ground time. `Flight.duration_estimated` marks it, and the card shows "~7h 13m" in a dashed chip with a tooltip.
- **Contract.** `aircraft_type` and `duration_min` are optional, and the `"UNKNOWN"`/`1` placeholders are gone. The mock still fills every field.
- **Long-haul quest is mock-only.** Live flights carry no duration in the feed, so `pickQuest` can never pick it on live data (a test pins this down). The featured rings always work, since they use attributes every flight has.
- **Frontend.** The selected flight is looked up when tapped (`useFlightRoute.ts`, `route.ts`) and merged in at render time, not into the polled snapshot, so a poll does not erase it. The card says "Looking up route…", then fills in, or says "Route unknown" and hides the type, duration, route and journey button. The merged flight is what the route line, the replay and the Catch snapshot use. Quests, facts, badges, featured flights and silhouettes treat a null type as "unknown".
- **Extra detail (after step 2).** Everything the two sources give that the card did not use, except photos.
  - From OpenSky, for every plane: climb or descent rate ("↗ 1,900 ft/min", "level" under 300) and the country of registration.
  - From adsbdb, on a tap, in `FlightRoute`: airline and its country, tail number, manufacturer, model, the registered owner (shown as "Operated by" only when it is not the airline) and the airports' city and country. Display only, never used by quests, facts or badges. The airline survives a route rejected by the plausibility check, since it comes from the callsign.
  - Left out: OpenSky's squawk code (emergency codes need careful handling), the airport elevation and OpenSky's category field.
- **Photos: left out (decided 2026-10-04).** adsbdb gives a photo URL (airport-data.com); a "See a photo" link was built, tried and removed because the photo source was not good enough. The OpenSky database has no photo links, and collecting links in bulk from adsbdb would breach its data restriction. **Planespotters.net** is the candidate to revisit: a public, rate-limited lookup by aircraft address (`api.planespotters.net/pub/photos/hex/{icao24}`) that requires a User-Agent with a real contact URL or email, a "© photographer" credit and a link back. Not verified: its terms (read them in a browser) and the response shape. Revisit after deployment, when there is a project URL to use as the contact, or together with the 3D-model idea.
- **Known limits.**
  - Type coverage is about 82% on the map; the rest show a default silhouette and cannot match type quests until tapped. The file dates from January 2025, so rebuild it when OpenSky publishes a newer snapshot.
  - adsbdb is a volunteer service with no documented limits. Only taps use it, and every failure hides the fields.
  - Routes come from the callsign, so a wrong or outdated one is possible, and the estimate can be off by tens of minutes.
  - A tapped flight's fact can change when the lookup adds its type.

**Step 3 — Density (next; approach to confirm before coding).** Option E in earlier notes. The live map is very full, and the motion measurement above ties the stutter to the plane count (1,500 markers is about 32 fps; 600 is about 57). Frontend only, no credits.

- **Approach.**
  - Draw only the planes in the visible area, capped at about 150 at once, with more revealed as you zoom in.
  - The cap is filled by a stable hash of the flight id, so planes do not flicker when panning (one plane, one fixed rank). A "most interesting first" ranking (rare types, extremes, weather) is left for later.
  - Quest, featured, selected and onboarding-target planes are always shown. Quest and featured picks are still made from the full feed, so a server-side or visible-area filter cannot starve them.
  - Space out overlapping markers, like the country labels.
  - Must keep working with the glide, the jump snap and the route/replay dimming in `FlightMap.tsx`.
- **Alternatives weighed.** A per-grid-cell cap on the server (B) thins Europe but reverses "keep it uniform"; a learning-first selection (A) needs good type data. Neither is planned now.
- **Done when:** the 1,500-flight measurement above is repeated and the map holds a steady frame rate, panning and zooming do not make planes pop in and out distractingly, and the selected, quest and featured planes are never hidden.

**Step 4 — Real weather.** A provider behind the existing `/weather` contract that maps the AWC `isigmet` JSON into `WeatherArea` (field notes and unconfirmed details are in Milestone 6), with server-side caching inside its rate limit. Decide what to do with real SIGMETs being sparse and issued around real events: the weather quests may often have nothing to match, and a quest saved for the day can outlive its hazard.

**Step 5 — Quests.** Review which quests can fire on live data (no long-haul, type quests only for the 82% with a known type, weather depending on step 4), fix the empty-quest cases, and add new quests that suit live traffic. Airline-based quests and facts are one candidate and need their own decision.

**Step 6 — World-wide mock data.** Spread the mock feed over the whole world to match a world-wide live feed, so a demo without OpenSky credentials looks like the real thing. The mock's weather areas may need the same.

**Step 7 — Deployment.** Deploy the frontend (static host) and the backend, which settles the hosting open item. Before it: re-verify the full flow against the live OpenSky feed in a browser, and decide whether Planespotters photos are worth adding once there is a project URL.

**Nice-to-have, after the MVP:** streak counter, richer mascot dialogue, larger fact pools, a collection-progress view.

**Idea: move content (facts, quests) to a database.** Not a milestone; recorded so the trade-offs are written down.

- **Why.** Edit facts and quests without redeploying, handle a pool too large for a code file, and the portfolio value of a real data layer.
- **Fit.** Facts are already rows (kind, value, text), and the Journal stores the fact text it showed, so editing the pool never rewrites history. Quests are only partly data: the title and concept fact are text, but `matches()` is code.
- **Scope, undecided.** (a) Facts only. (b) Facts plus each quest's title and concept fact, with the matching rule kept in code. (c) Full quest definitions, which needs a rule format and reverses "no template engine beyond that list".
- **Costs.** New infrastructure and a network dependency for content that works offline today; the fact pick is a hash over the matching pool, so editing the pool changes which fact a flight shows (the pool would be fetched once and held for the session); hosting limits the database choice (a file database on an ephemeral free host would lose its data); and the backend would own content, not only world data.
- **Staged path.** (1) Move the facts out of `facts.ts` into a plain data file in the repo. (2) Serve content read-only from the backend once editing without redeploying or the pool's size is really needed. (3) An editor page, only if someone other than the developer will edit content. Pick it up after Milestone 7 settles hosting.

## Visual & interaction direction

A small visual foundation slice was pulled ahead of Milestone 1 (see `docs/ui-foundation.md`). The full visual pass was done in Milestone 5.

- **Overall style: retro travel-poster kawaii** — vintage mid-century aviation travel-poster palettes and shapes combined with cuteness, rather than generic cartoon cuteness.
- **Mascot:** a chibi cat pilot in the same poster style, carrying onboarding and quest prompts.
- **Aircraft fidelity:** recognizable, proportionate silhouettes rather than generic shapes, which doubles as passive aircraft-type-recognition learning.
- **Motion personality:** bouncy, springy animation, deliberately contrasting the flat vintage look with toy-like energy.
- **Palette strategy:** shifts by context (region, time-of-day, weather). Time of day is built. The weather shift was tried as a local tint and dropped, and a region shift is still deferred.

Settled in Milestone 5: palette values, the mascot, aircraft silhouettes, badge iconography and screen layout. Settled in Milestone 6: weather iconography (round hazard stickers).
