# Airspace Explorer — Product & Technical Plan

**Status:** Product concept, MVP scope, visual/interaction direction, and technical direction are all settled. Milestone 1 is in progress: steps 1–4 are done (scaffold, mock `/flights` endpoint, polling frontend with flight dots, click-to-open flight card); next up is step 5.

## Context

This is a first serious AI-assisted coding project and first portfolio piece. The goal is to explore and learn about aviation — ahead of starting a PPL — while building something technically and visually interesting. The project deliberately avoids becoming a FlightRadar-style dashboard; it's a playful, kawaii "spot & collect" exploration experience instead.

## Product concept

**One-line pitch:** A kawaii, live-data-powered "spot & collect" exploration experience built on real flight traffic — users hunt for real, live aviation moments (not just track blips on a dashboard), collect them into a personal journal, and pick up bite-size aviation knowledge along the way, while deliberately avoiding the look and feel of a flight-tracking dashboard like FlightRadar24.

### Target user
Aviation-curious people without deep aviation background — including the creator, who is preparing for a PPL — who want a playful, low-pressure way to build intuition about aviation. Secondary audience: casual users who enjoy cozy collection/spotting games and might discover an interest in aviation through play.

### Core loop
1. Explore a 2D map of flying aircraft (pan/zoom, Google Maps-style interaction). MVP starts on mock flight data, but that mock data is deliberately modeled on the attributes/structure a real flight-data source would provide, so the experience is designed around the eventual real-data version and the source stays swappable later (a free, personal-development-tier API is the intended eventual source).
2. Each day — a **personal** day, resetting on the user's own local calendar day, not a globally shared/synchronized challenge — the app surfaces **one** active quest (not a pool or a rotating list) — e.g. "spot something above 30,000 ft," "catch a flight heading over open ocean," "spot a flight flying through a storm system." Quests are built from a small set of parameterized *quest templates* (altitude, aircraft category, region/geography, weather condition, time-of-day) rather than hand-authored one by one, which is what makes "one per day" sustainable content-wise. Flight duration is included in the Flight data model from the start, which unlocks a distance-based template once the templated quest system itself is built — the template system, including this one, is a later milestone, not part of the first implementation.
3. Outside the daily quest, a small set of "featured" flights are highlighted directly on the map each session, so there's always something worth catching even without an active quest — this is what keeps the experience from being an open, blank search/filter dashboard.
4. The user taps/catches a flight — from the daily quest or a featured pick or free exploration. A card appears showing the flight and **one** fact, pulled from small tagged fact-pools keyed to that catch's real attributes (aircraft type, airline, altitude band, destination/region, time-of-day, weather). The same fact system covers aircraft, specific flights, *and* airports — airports are never a separately catchable thing; airport facts surface through the destination/region tag attached to a caught flight.
5. Caught flights are saved into a **Journal**. Completing the daily quest triggers a bigger celebration plus a fact that explains the underlying *concept* (why planes cruise at that altitude, why routes avoid storms, etc.), not just trivia about the aircraft.
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

- [OpenSky Network](https://openskynetwork.github.io/opensky-api/rest.html) — free live ADS-B state vectors (position, altitude, velocity, heading, callsign) for non-commercial/research use, OAuth2 client-credentials auth as of 2026. The mock data's attribute structure should mirror OpenSky's state-vector fields. Still open: the exact field-by-field schema mapping and auth setup — and free-tier request limits should be re-verified on OpenSky's own docs immediately before integration, since third-party sources disagreed on the exact daily allowance during research (reports ranged ~1,000–4,000 requests/day for authenticated accounts).
- The concrete quest template parameters (exact thresholds per template) — the templated system itself is a later milestone; Milestone 1 ships with a single hardcoded quest condition instead.
- The concrete fact-pool content per attribute category (aircraft type, airline, altitude band, region, time-of-day, weather) for aircraft, flights, and airports.
- How mock weather data is represented/sourced before any real weather integration.
- Hosting/deployment target (a free static host — Vercel, Netlify, or GitHub Pages are all viable for a portfolio piece, plus somewhere to run the FastAPI backend) — not yet decided. Build tooling is settled (see Technical direction).
- The concrete screen/component breakdown.
- Visual/character design direction for the "kawaii" aircraft, mascot, and weather-icon representation.

## Technical direction

- **Architecture: two-part monorepo** — `frontend/` (React + TypeScript + Vite) and `backend/` (Python + FastAPI) in one repository. Introducing a real backend from the start (rather than deferring it) is motivated by a concrete need, not "real apps have backends": OpenSky's OAuth2 flow requires a client secret that must never reach the browser, and pooling/caching requests against OpenSky's shared daily quota also needs a server-side layer — both are real requirements once live data is integrated, so the boundary is worth having early.
- **Backend responsibility boundary:** the backend owns *world/flight data* only — serving it (mock now, real later) through a stable domain model. It never owns user-specific data. The frontend owns everything user-scoped — Journal, Badges, active quest state — consistent with the decision that persistence is local-only (no accounts, no cloud sync).
- **Backend data model (minimal for now):** a single flat `Flight` — id, callsign, aircraft type (plain string for now), latitude, longitude, altitude, heading, and **flight duration** (included from the start to support a future distance-based quest template even though that quest is a later milestone). As implemented, fields are `id`, `callsign`, `aircraft_type`, `latitude`/`longitude` (degrees), `altitude_ft` (feet, matching how pilots and the quests express altitude), `heading` (degrees, 0–360) and `duration_min` (minutes), validated with pydantic. OpenSky reports altitude in metres, so the eventual provider converts to these units. Richer models (`AircraftType`, `Airport`, `WeatherCondition` as their own structured types) are deliberately deferred until the features that need them are actually being built.
- **No formal provider abstraction yet:** a plain function (e.g. `get_mock_flights()`) generates mock data. A shared interface for multiple providers (mock vs. OpenSky) is deferred until there's an actual second implementation to satisfy — introducing it now, with only one real implementation, would be premature abstraction.
- **Minimal API surface:** one endpoint, `GET /flights`, returning the normalized `Flight` list. No POST endpoints — the backend stores nothing user-specific. Fact-pool content is a static file bundled into the frontend, not a backend endpoint, since it's content rather than something requiring server computation.
- **Live data source: OpenSky Network** (see Open Items) — the intended eventual real provider; mock data's structure mirrors what OpenSky-normalized data would look like, so swapping providers later changes only the backend's internal implementation, never the `/flights` contract or the frontend.
- **World/map rendering: custom illustrated world, decoupled from mechanics** — pan/zoom and lat/lon-to-screen placement are built and proven against a plain placeholder background first; the final retro-poster illustrated art is a later visual pass on top of already-working mechanics, not a prerequisite for a playable version.
- **Tooling (settled in the scaffold):** frontend uses Vite, npm, oxlint, Prettier, Vitest with Testing Library, and `tsc` for type checking; backend uses pip with a `pyproject.toml` and virtualenv, pytest, ruff and strict mypy. Commands are in the root `README.md`. Hosting is still open.
- **Animation: Framer Motion** — the eventual choice for the MVP's bouncy/springy interactions; not needed until after the core loop works. GSAP was considered for more elaborate showcase moments but deferred to keep the animation surface manageable for a first project.
- **State & persistence: React Context/hooks + browser localStorage** — simplest setup, adequate for MVP-scale Journal/quest data.
- **Quest logic for now:** a single hardcoded quest condition (no template engine) proves the loop first; the parameterized quest-template system described above is a deliberate later generalization, not part of the first implementation milestone.

## Implementation roadmap

**Milestone 1 — walking skeleton with one playable loop (current target):**
1. ✅ Done. Scaffold `backend/` (FastAPI, `/health` endpoint) and `frontend/` (Vite + React + TS, fetches `/health` and displays it) — proves CORS/plumbing before any feature work. (The frontend's `/health` display was later replaced by `/flights` loading/error states; the backend `/health` endpoint is kept.)
2. ✅ Done. Backend: minimal `Flight` model (including duration) + `get_mock_flights()` returning 10 flights with positions jittered by up to ±0.5° per call; `GET /flights` returning them as JSON.
3. ✅ Done. Frontend: poll `/flights` every 5 seconds, render each as a simple dot positioned over a plain placeholder background (basic linear lat/lon-to-x/y scaling over fixed Europe/North Atlantic bounds — no map library, no art yet). A failed poll keeps the last good flights on screen.
4. ✅ Done. Frontend: click a dot → card in a fixed panel below the map showing callsign/altitude + one deterministic fact per aircraft type from a small hardcoded lookup (`facts.ts`; randomized pick from a fact pool comes later), with a "Catch" button. Clicking another dot swaps the card; clicking the selected dot or the map deselects. If the selected flight drops out of the feed it stays at its last known position, flagged "signal lost", until caught or deselected. "Catch" is a stub that only closes the card until step 6.
5. Frontend: display one hardcoded quest (e.g. "Today: catch something above 30,000 ft") and flag when a catch matches it — no reset logic, no template system yet.
6. Frontend: "Catch" appends the flight+fact to a Journal array in Context state, persisted to localStorage, rendered as a plain list.

**Later milestones (rough order, not yet started):** generalize the hardcoded quest into the parameterized template system; build the real illustrated map art and swap in the placeholder; add the Collection screen (Journal + Badges tabs) and badge unlocks; author the tagged fact-pool content; apply the retro-poster visual/mascot/onboarding pass and Framer Motion polish; implement the real `OpenSkyProvider` and swap it in behind the existing `/flights` contract; add weather (atmospheric, then functional); add streaks/collection-progress view and other Nice-to-have items.

## Visual & interaction direction

- **Overall style: Retro travel-poster kawaii** — vintage mid-century aviation travel-poster palettes and shapes, combined with cuteness, rather than generic cartoon cuteness. This is meant to be aviation-flavored kawaii specifically, a differentiator in its own right.
- **Mascot:** kept, rendered in the same poster style (e.g. a stylized paper-airplane or pilot figure), still carrying onboarding and daily-quest prompts.
- **Aircraft fidelity:** recognizable, proportionate aircraft silhouettes rather than abstracted generic shapes — this doubles as passive aircraft-type-recognition learning, reinforcing the project's educational goal through the art itself, not just the fact cards.
- **Motion personality:** bouncy/springy animation, deliberately contrasting the flat vintage-poster look with toy-like, playful energy.
- **Palette strategy:** shifts by context (region, time-of-day, weather) rather than one fixed palette — warm tones over deserts, cool over poles, dusk hues at sunset, etc. This reinforces the weather layer already defined as functional (not just decorative) in the MVP, and makes exploring different parts of the world feel visually distinct.

Still open: concrete palette values, mascot character design, aircraft illustration style guide, iconography for weather/badges, and UI layout/screen composition — these belong to a dedicated visual-design pass.
