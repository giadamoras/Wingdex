# Wingdex — Product & Technical Plan

**Name.** Renamed from "Airspace Explorer" on 2026-10-14: a NATS flight-tracking app already has that name. "Wingdex" is the collect-them-all dex plus earning your wings as you learn about aviation. The browser storage keys keep the old `airspace-explorer:` prefix on purpose: renaming them would empty every existing Journal.

**Status.**

- **Done.** The MVP (Milestones 1-6), live data (Milestone 7 steps 1-6; its deployment step was postponed, see "Only if deployed") and the post-MVP work so far: the smoke test, the content files and type catalog, the card in plain words, larger facts and quests with the airline catalog, and more silhouettes. All of it is summarised in `docs/history.md`.
- **Next.** The "Now" list under "Roadmap", one item at a time, after the user names it.
- **Postponed.** Deployment and everything that needs it ("Only if deployed").

## Context

A first serious AI-assisted coding project and a portfolio piece. The goal is to explore and learn about aviation, ahead of starting a PPL, while building something technically and visually interesting. It deliberately avoids becoming a FlightRadar-style dashboard: it is a playful, "spot & collect" experience instead.

## Product concept

**One-line pitch:** a "spot & collect" game on real flight traffic. Players hunt for real aviation moments (not blips on a dashboard), collect them in a personal Journal, and pick up bite-size aviation knowledge along the way.

**Target user.** Aviation-curious people without a deep aviation background, the creator included. Secondary: casual players who enjoy cozy collection games and might discover aviation through play.

### Core loop

1. **Explore** a 2D world map of flying aircraft with Google Maps-style pan and zoom. The flight source is swappable: mock data (100 world-wide flights) or OpenSky live.
2. **One daily quest**, on the player's own local day (not a shared global challenge), picked from 23 parameterized templates: altitude ("above 36,000 ft"), aircraft category, region, weather, time of day, flight length, climb or descent, speed, single airlines and airline kinds (cargo, low-cost, holiday). A quest that no current flight can match is skipped.
3. **Featured flights**, a few ringed on the map each session, so there is always something worth catching.
4. **Catch** a flight: its card shows labelled boarding-pass details and **one** fact, picked from tagged pools by the flight's own attributes: aircraft type, family and category, airline, altitude band, flight phase, region, time of day and weather. Aircraft and airline facts are preferred about 2 times in 3. There are no airport facts; airports appear only as the route's ends.
5. **Journal.** Catches are saved in it. Completing the daily quest brings a bigger celebration and a fact that explains the underlying concept, not just trivia.
6. **Collection**, reached from the map, with three tabs: Journal, Badges (4 so far) and Facts. A badge unlock shows as a small popup on the map. Progress stays on the player's device: no accounts or cloud sync.
7. **Weather** on the map as round hazard stickers (live: AWC SIGMETs), both for atmosphere and as a quest and fact condition.

### Differentiation from flight-tracker dashboards (e.g. FlightRadar24)

- A curated discovery and collection experience, not a search-and-filter utility.
- Success is moments caught and facts learned, not data density.
- Playful and visually pretty throughout, not a utilitarian dashboard look.
- The app suggests what is interesting instead of expecting the player to know what to search for.

## Technical direction

- **Architecture: two-part monorepo**: `frontend/` (React + TypeScript + Vite) and `backend/` (Python + FastAPI). The backend exists for concrete needs: OpenSky's OAuth2 client secret must never reach the browser, and requests against OpenSky's shared daily quota must be pooled and cached on a server.
- **Backend responsibility boundary:** the backend owns _world/flight data_ only, serving it (mock or live) through a stable domain model. The frontend owns everything user-scoped (Journal, badges, quest state), consistent with local-only persistence.
- **Backend data model** (pydantic, `models.py`):
  - `Flight`: `id`, `callsign`, `latitude`/`longitude` (degrees), `altitude_ft`, `heading` (0-360), `speed_kt`, and optional `aircraft_type`, `duration_min` (with `duration_estimated`), `origin`/`destination` (`Airport`: `icao`, `iata`, `name`, `latitude`, `longitude`, optional `city` and `country`), `vertical_rate_fpm` and `registered_country`. The optional fields are null when a source does not know them. OpenSky reports metres and m/s, so the provider converts to these units.
  - `WeatherArea` and `FlightRoute` (the `/route` response).
  - Richer models are deferred until a feature needs them.
- **Flight source:** `FlightProvider` (`providers.py`) with two implementations, mock and OpenSky, chosen by `FLIGHT_SOURCE`. Weather has the same shape: `WeatherProvider` with mock and AWC, chosen by `WEATHER_SOURCE`. Swapping sources changes only the backend, never the `/flights` or `/weather` contract.
- **API surface:** `GET /flights`, `GET /weather`, `GET /flights/{id}/route` (route, type, estimated duration and detail of one live flight, looked up when a player taps it) and `/health`. No POST endpoints: the backend stores nothing user-specific.
- **Content:** static JSON bundled into the frontend, in `frontend/src/content/`: `facts.json` (130 facts), the type catalog `aircraft-types.json` (178 ICAO types in 35 families, with category and engine count) and the airline catalog `airlines.json` (80 airlines with radio callsign and kind). Every entry is checked by tests, since the JSON is only cast to its type. Content grows by hand when a gap shows, and every new fact is checked, with a source for anything that isn't standard teaching.
- **World/map rendering:** a custom illustrated world, decoupled from mechanics. Pan/zoom and lat/lon-to-screen placement are hand-rolled, with no map library.
- **Tooling:** the frontend uses Vite, npm, oxlint, Prettier, Vitest with Testing Library, Playwright for one end-to-end smoke test, and `tsc`; the backend uses pip with a `pyproject.toml` and virtualenv, pytest, ruff and strict mypy. CI runs all of them. Commands are in the root `README.md`.
- **Animation:** Framer Motion for the bouncy, springy interactions. GSAP was considered and deferred.
- **State & persistence:** React Context/hooks + browser localStorage.
- **Quest logic:** a list of parameterized quest templates in `quest.ts`, each with a title, a concept fact and a `matches()` test. One is picked per local day and saved. There is no template engine beyond that list.

### Standing rules

- **Catching.** A flight can be caught once per local day. Quest completion is derived from _today's_ Journal, judging each catch at its own `caughtAt` time (the "personal day" rule). Only `{day, questId}` is saved for the quest; a weather quest counts as done when the saved `questId` matches or the quest still matches.
- **Live flights.** One shared snapshot is refreshed on demand (90 s, never faster than 60 s) behind a credit guard, so no visitors means no credits spent; never run live mode with `--reload` (`docs/opensky-credit-guard.md`). The whole world is served, with a uniform hash-of-id sample only above a 15,000 safety ceiling; a random pick each refresh was rejected because planes would flicker.
- **Drawing.** At most 800 planes in view (`VIEW_CAP`, 300 on touch screens), thinned by a stable id hash. Selected, featured and onboarding-target planes are always drawn, and quest picks use the full feed. The densest-view limit is rendering cost, not data.
- **Unknown fields.** `aircraft_type`, `duration_min` and the route are null when a source does not know them; the long-haul quest can only match mock data, and the phase facts only live data (mock flights have no climb rate).
- **adsbdb route data.** Kept in memory only, never written to disk (its terms restrict copying). The route is checked against the plane's position on every lookup, because a callsign can be flown on another leg later in the day. The cache holds 2,000 entries and drops the one closest to expiring when full; after a failed lookup new requests pause for 15 s; at most 8 requests run at once. The frontend waits 250 ms after a tap, reuses an answer for 30 minutes and cancels a lookup when the plane is deselected.
- **AWC weather.** The request is `?format=json` and nothing else (undocumented parameters are an error), with a custom User-Agent, cached at least 60 s. Only the backend calls it (no cross-origin access). Recount the raw JSON, not a summary.
- **Motion in the zoomed layer.** Anything that moves continuously inside it uses `transform: translate(...)`, not `left/top` percentages, which browsers round before the zoom is applied.
- **Layering.** Planes sit above weather icons; the weather label sits above planes (`z-index: 4`).
- **Testing gotchas.** Under Vitest fake timers a `motion` exit can fail to complete; mock `matchMedia` to report reduced motion (the `reducedMotion()` helper in `App.test.tsx`). The journey-replay tests need `prefersReducedMotion()` to read `false`.

## Roadmap

Three lists: what to do now (works locally and adds to the app as a portfolio piece), what only makes sense once Wingdex is deployed, and what is not being done. Sizes are rough: S under a day, M a few days, L open-ended. Each item is picked up on its own, after the user names it; finished items leave this list and are recorded in `docs/history.md`.

### Now

1. **Collection dex, streak and more badges (S/M).** Types and families seen out of those in the catalog, countries and airlines; a streak counter for daily quests; badges derived from the Journal (night owl, storm chaser, polar, many countries, first helicopter…). Frontend only, a strong collect-them-all feel; built on the type and airline catalogs.
2. **Aircraft pictures (M).** One picture per aircraft _type_, not per flight: the lead image of the type's Wikipedia article, shown on the card ("What it looks like") and later in the dex. Fetched once by a script, reviewed like the content (some lead images show a cockpit or a prototype), and only the approved image link and its attribution stored in the type catalog. Every picture shows its author and licence. Loaded lazily from Wikimedia when a card opens, so no picture offline; a rounded postcard-style frame softens photo against the illustrated style. Unlike per-flight photos (Planespotters), this needs no public URL.
3. **Destination forecast (M).** The destination's TAF, the airport forecast pilots read before every flight, on the card in plain words ("light rain after 15:00, wind 15 kt") with the raw code shown small underneath, so players learn to read one. From AWC, like the SIGMETs: backend only, cached, no credits. Decoding the change groups (BECMG, TEMPO, PROB30) needs care; mock flights get none unless the mock invents them; only airports that issue TAFs have one.
4. **Small improvements (S each).** Pause the flight poll while the browser tab is hidden and fetch at once when it returns (phone battery and data); richer mascot dialogue.
5. **README demo (S), last.** Replace the out-of-date GIF and screenshot with ones showing the current app.

**Small ideas, not scheduled.** A "most interesting first" ranking for the draw cap (rare types, extremes, weather); sharing one route lookup between simultaneous taps on the same plane, and stopping the backend's adsbdb call when the browser cancels (today the backend finishes it); the airport-style "recently left the feed" state for mock planes.

### Only if deployed

**Deployment itself (postponed 2026-10-07).** Not started, for two reasons. (1) OpenSky's terms (read 2026-10-07): the data is licensed only for non-profit research and education, the REST API "is provided for non-profit research and educational use only", operational use in a live product, service or automated system needs a written licence, and the data may not be made available to others, so a public site on live OpenSky data is not allowed without one. (2) Cost: a backend host that is always on is rarely free, and the user does not want to pay for now. The ways forward:

- ask OpenSky for a licence;
- find another flight source (its terms are unchecked);
- a public demo on mock data only, which could need no backend at all if the mock flights were generated in the browser, so a free static host would do.

Hosting (a free static host such as Vercel, Netlify or GitHub Pages, plus somewhere to run the FastAPI backend if one is needed) is decided then. Set `CORS_ORIGINS` on the backend and `VITE_API_URL` on the frontend (see `backend/.env.example`).

Once deployed:

1. **Share card (M).** Export a catch as an image. Adds reach and portfolio appeal; needs the public URL.
2. **GPS "above you" mode (M).** Use the browser's location to find the plane overhead ("look up, that's above you"). High delight; needs HTTPS and a permission prompt, and works best on a phone.
3. **Installable PWA (S/M).** Dropped from the smoke-test item on 2026-10-16: installing only matters on a phone, which needs the app hosted on HTTPS, and until then a service worker adds caching risk (players stuck on an old version) for no user. When picked up: a hand-written manifest, icons made from `favicon.svg`, and a small service worker that caches the app's files, tries the network first for the page and never caches `/flights`, `/weather` or `/route`.
4. **Flight photos (S/M).** Planespotters photos of the exact plane, by its transponder address, so live flights only. Their API wants a User-Agent with a contact URL or email, a photographer credit and a link back; the terms are unchecked (see "Photos" in `docs/history.md`, Milestone 7 step 2). Kept here rather than in "Now" because the aircraft pictures cover the wish until then.
5. **Track history foundation (M).** Flight tracking, pattern events, drawing a flight's real flown route and crediting a weather quest to a plane that passed through all need past positions, so a server polling all day. Mind the quota: continuous global polling would use almost the whole 4,000 credits/day (a global request costs 4 credits, every 90 s is about 3,800 a day), so start with an in-memory buffer of recent snapshots and measure its size. If a database is needed, choose it here (a file database on an ephemeral free host loses its data); user progress stays local either way.
6. **Flight tracking and pattern events (M, built on item 5).** Follow one flight live, even when it is not among the planes drawn. "Follow this flight" from its card or Journal entry fits the product better than a search box, which risks looking like a tracker dashboard. Open questions: whether the camera follows it, how often its position refreshes beyond the shared 90 s snapshot and what that costs in credits, and how it interacts with the density logic, the daily catch rule and the Journal. Pattern events (holding patterns, diversions, weather reroutes) need the track history.

### Not doing

- **3D aircraft models.** No consistent, freely licensed set (each model would need its own licence check), 1-10 MB per model plus three.js, a clash with the flat poster style, and a large effort for something seen once per type. Aircraft pictures ("Now") cover the same wish.
- **Content in a database.** Facts are already data files, and the Journal stores the fact text it showed, so editing the pool never rewrites history. A database would only pay off if someone other than the developer edited content; it would add infrastructure, a network dependency for content that works offline, and make the backend own content.
- **Accounts, social features and rankings.** Progress stays local.
- **Weather simulation or our own forecasting.** Only official reports and forecasts (SIGMETs today, TAFs in "Now").
- **A learning path or encyclopedia.** Outside Wingdex's scope; facts and quest lessons stay the way it teaches.
- **Canvas rendering, per-view server requests (`/flights?bbox=`).** Only if phones or the whole-world feed ever prove too slow.

## Visual & interaction direction

A small visual foundation slice was pulled ahead of Milestone 1 and the full visual pass was done in Milestone 5; `docs/ui-foundation.md` records the decisions.

- **Overall style: retro travel-poster**: vintage mid-century aviation travel-poster palettes and shapes combined with cuteness, rather than generic cartoon cuteness.
- **Mascot:** a chibi cat pilot in the same poster style, carrying onboarding and quest prompts.
- **Aircraft fidelity:** recognizable, proportionate silhouettes by shape rather than generic icons, which doubles as passive aircraft-recognition learning. Airliners are coral and general aviation mint.
- **Motion personality:** bouncy, springy animation, deliberately contrasting the flat vintage look with toy-like energy.
- **Palette strategy:** shifts by context. Time of day is built. A weather shift was tried as a local tint and dropped, and a region shift is a small idea.
