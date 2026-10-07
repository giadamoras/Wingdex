# Airspace Explorer — Product & Technical Plan

**Status:** Product concept, MVP scope, visual/interaction direction, and technical direction are all settled.

- **Done.** Milestones 1-6 and Milestone 7 steps 1-6 (OpenSky provider, live aircraft type and route, density, real weather, quests, world-wide mock data). They are summarised in `docs/history.md`.
- **In progress.** Milestone 7, the last step of the MVP: deployment (step 7). After the MVP, a backlog in priority order is under "Implementation roadmap".

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

**Out (explicitly deferred, not MVP; most are now ordered in the post-MVP backlog under "Implementation roadmap"):**

- GPS/location-based "look up, that's above you" mode.
- Pattern-based live event detection that needs historical track analysis (holding patterns, diversions, weather reroutes) — these need continuous polling and track history, unlike the snapshot-derivable quests, and are a reasonable fast-follow.
- A full illustrated aircraft/airport/aviation encyclopedia beyond per-catch facts.
- 3D aircraft models in the flight card.
- Weather forecasting/simulation — only current (or mock) snapshot conditions.
- Accounts, social features, rankings.

## Open items for future planning passes

- **Hosting** (a free static host such as Vercel, Netlify or GitHub Pages, plus somewhere to run the FastAPI backend) is not decided. It is settled in Milestone 7, step 7.
- **Fact pools** are still small (49 facts, 12 of them weather) and can grow at any time (backlog item 2).
- **Ideas, not scheduled:** see "Smaller ideas" in the roadmap. Flight photos are decided in step 7 (see "Photos" in `docs/history.md`, Milestone 7 step 2).

## Technical direction

- **Architecture: two-part monorepo** — `frontend/` (React + TypeScript + Vite) and `backend/` (Python + FastAPI) in one repository. The backend exists for concrete needs: OpenSky's OAuth2 client secret must never reach the browser, and pooling/caching requests against OpenSky's shared daily quota needs a server-side layer.
- **Backend responsibility boundary:** the backend owns _world/flight data_ only — serving it (mock or live) through a stable domain model. It never owns user-specific data. The frontend owns everything user-scoped — Journal, Badges, active quest state — consistent with local-only persistence.
- **Backend data model** (pydantic, `models.py`):
  - `Flight`: `id`, `callsign`, `latitude`/`longitude` (degrees), `altitude_ft`, `heading` (0-360), `speed_kt`, and optional `aircraft_type`, `duration_min` (with `duration_estimated`), `origin`/`destination` (`Airport`: `icao`, `iata`, `name`, `latitude`, `longitude`, optional `city` and `country`), `vertical_rate_fpm` and `registered_country`. The optional fields are null when a source does not know them. OpenSky reports metres and m/s, so the provider converts to these units.
  - `WeatherArea` (Milestone 6) and `FlightRoute` (the `/route` response, Milestone 7).
  - Richer models are deferred until a feature needs them.
- **Flight source:** `FlightProvider` (`providers.py`) with two implementations, mock and OpenSky, chosen by `FLIGHT_SOURCE`. Weather has the same shape: `WeatherProvider` with mock and AWC, chosen by `WEATHER_SOURCE`. Swapping sources changes only the backend, never the `/flights` or `/weather` contract (the frontend only needed to learn the new hazard and labels once, in step 4).
- **API surface:** `GET /flights`, `GET /weather`, `GET /flights/{id}/route` (route, type, estimated duration and detail of one live flight, looked up when a player taps it) and `/health`. No POST endpoints: the backend stores nothing user-specific. Fact-pool content is a static file bundled into the frontend, not an endpoint. (The "move content to a database" idea below would revisit this.)
- **World/map rendering:** a custom illustrated world, decoupled from mechanics. Pan/zoom and lat/lon-to-screen placement are hand-rolled, with no map library.
- **Tooling:** frontend uses Vite, npm, oxlint, Prettier, Vitest with Testing Library, and `tsc`; backend uses pip with a `pyproject.toml` and virtualenv, pytest, ruff and strict mypy. Commands are in the root `README.md`.
- **Animation:** Framer Motion for the bouncy, springy interactions. GSAP was considered and deferred.
- **State & persistence:** React Context/hooks + browser localStorage.
- **Quest logic:** a small list of parameterized quest templates in `quest.ts`, each with a title, a concept fact and a `matches()` test. One is picked per local day and saved (see Milestone 3 in `docs/history.md`). There is no template engine beyond that list.

## Implementation roadmap

Finished work (Milestones 1-6 and Milestone 7 steps 1-6) is in `docs/history.md`, with the measurements and lessons behind it. The rules from it that still shape the code are under "Standing rules" below.

### Standing rules

- **Catching.** A flight can be caught once per local day. Quest completion is derived from _today's_ Journal, judging each catch at its own `caughtAt` time (the "personal day" rule). Only `{day, questId}` is saved for the quest; a weather quest counts as done when the saved `questId` matches or the quest still matches.
- **Live flights.** One shared snapshot is refreshed on demand (90 s, never faster than 60 s) behind a credit guard, so no visitors means no credits spent; never run live mode with `--reload` (`docs/opensky-credit-guard.md`). The whole world is served, with a uniform hash-of-id sample only above a 15,000 safety ceiling; a random pick each refresh was rejected because planes would flicker.
- **Drawing.** At most 800 planes in view (`VIEW_CAP`), thinned by a stable id hash. Selected, featured and onboarding-target planes are always drawn, and quest picks use the full feed. The densest-view limit is rendering cost, not data.
- **Unknown fields.** `aircraft_type`, `duration_min` and the route are null when a source does not know them; the long-haul quest can only match mock data.
- **adsbdb route data.** Kept in memory only, never written to disk (its terms restrict copying). The route is checked against the plane's position on every lookup, because a callsign can be flown on another leg later in the day. The cache holds 2,000 entries and drops the one closest to expiring when full; after a failed lookup new requests pause for 15 s; at most 8 requests run at once. The frontend waits 250 ms after a tap, reuses an answer for 30 minutes and cancels a lookup when the plane is deselected.
- **AWC weather.** The request is `?format=json` and nothing else (undocumented parameters are an error), with a custom User-Agent, cached at least 60 s. Only the backend calls it (no cross-origin access). Recount the raw JSON, not a summary.
- **Motion in the zoomed layer.** Anything that moves continuously inside it uses `transform: translate(...)`, not `left/top` percentages, which browsers round before the zoom is applied.
- **Layering.** Planes sit above weather icons; the weather label sits above planes (`z-index: 4`).
- **Testing gotchas.** Under Vitest fake timers a `motion` exit can fail to complete; mock `matchMedia` to report reduced motion (the `reducedMotion()` helper in `App.test.tsx`). The journey-replay tests need `prefersReducedMotion()` to read `false`.
- **Backend boundary.** The backend owns world data only; the frontend owns everything user-specific (Journal, badges, quest state).

### Now: finish Milestone 7 (the MVP)

Done one step at a time: work only on the step the user names. Only deployment is left.

**Step 7 — Deployment.** Deploy the frontend (static host) and the backend, which settles the hosting open item. Before it: re-verify the full flow against the live OpenSky feed in a browser, **check the app on a real phone** (the biggest unchecked risk: touch pan/zoom, the docked mascot overlapping the card on a short viewport, JSON parse and React work with thousands of planes), and decide whether Planespotters photos are worth adding once there is a project URL. Set `CORS_ORIGINS` on the backend to the deployed frontend URL and `VITE_API_URL` on the frontend to the backend URL (see `backend/.env.example`).

### After the MVP: backlog in priority order

Sizes are rough: S under a day, M a few days, L open-ended. Each item is picked up on its own, after the user names it.

1. **CI, smoke test and PWA (M).** GitHub Actions running the backend and frontend checks, one Playwright smoke test, an installable PWA. First because it protects every later change and de-risks the public site.
2. **Larger facts and quests (M).** Start by moving the facts out of `facts.ts` into a data file (stage 1 of the content-database idea below) and building one **type catalog keyed by ICAO type code** (name, family, short description) that the dex, the encyclopedia and the 3D models all share. Then grow the pools, add airline-based facts and quests (needs its own decision) and learn missing aircraft types in the background. Content quality is the weakest point seen live.
3. **Collection dex, streak and more badges (S/M).** Types and families seen out of those that exist, countries and airlines; a streak counter; badges derived from the Journal (night owl, storm chaser, polar, many countries). Cheap, frontend only, a strong collect-them-all feel; needs the catalog from item 2.
4. **Share card (M).** Export a catch as an image. Adds reach and portfolio appeal; needs the public URL.
5. **GPS "above you" mode (M).** Use the browser's location to find the plane overhead ("look up, that's above you"). High delight; needs HTTPS (so after deployment) and a permission prompt, and works best on a phone.
6. **Track history foundation (M).** Flight tracking, pattern events, drawing a flight's real flown route and crediting a weather quest to a plane that passed through all need past positions. Mind the quota: continuous global polling would use almost the whole 4,000 credits/day (a global request costs 4 credits, every 90 s is about 3,800 a day), so start with an in-memory buffer of recent snapshots and measure its size. **Decide the database once, here** (hosting limits the choice: a file database on an ephemeral free host loses its data); user progress stays local either way.
7. **Flight tracking and pattern events (M, built on item 6).** The original Milestone 8, now after the MVP: "Track a specific flight in real time. Search or enter a flight number (callsign) and follow that plane live, even when it is not among the planes drawn. Specifics are undecided: how the flight is found (search box, URL, or from the flight card), whether the camera follows it, how often its position refreshes beyond the shared 90 s snapshot and what that costs in OpenSky credits, and how it interacts with the density logic, the daily catch rule and the journal." A search box risks looking like a tracker dashboard; "follow this flight" from its card or Journal entry fits the product better. Pattern-based events (holding patterns, diversions, weather reroutes) need the track history.
8. **Learning path and encyclopedia (L).** A Duolingo-style PPL / aviation path and an aviation encyclopedia, hung off the type catalog; content may move to the database chosen in item 6. User progress stays local.
9. **3D aircraft models (L).** In the encyclopedia, not per flight, and matched by ICAO type code (not by name, which is fuzzy: "A320 214" vs "A320-200"). Lazy-loaded; check the models' licences.

**Learning extras (alongside, one at a time).** Short mini lessons on small aviation topics, written together with the user (the user learns while we write them), kept in `docs/lessons/` as Markdown with a PDF export and linked from the related fact or quest later. `docs/aviation-weather-products.md` is the first. No deadline, and no code until a few exist.

**Smaller ideas, not scheduled.** Richer mascot dialogue; a "most interesting first" ranking for the draw cap (rare types, extremes, weather); clustering or count badges in dense areas; cheaper rendering (canvas or SVG) if phones struggle; pausing the flight poll while the browser tab is hidden (and fetching at once when it returns) to save phone data and battery; sharing one route lookup between simultaneous taps on the same plane, and stopping the backend's adsbdb call when the browser cancels (today the backend finishes it); a per-view server request (`/flights?bbox=`) if the whole-world feed proves too heavy; region and weather palette shifts; the airport-style "recently left the feed" state for mock planes.

**Still out:** accounts, social features and rankings; weather forecasting or simulation.

**Idea: move content (facts, quests) to a database.** Not a milestone; recorded so the trade-offs are written down. Backlog items 2 and 6 touch it.

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
