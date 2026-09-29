# UI visual foundation (flat retro-poster kawaii)

Small visual slice pulled ahead of the Milestone 1 quest work. It follows the "retro travel-poster kawaii" direction in `plan.md` (style A: flat shapes, limited palette, a little soft depth). The full visual pass (real illustrated map, mascot, onboarding, Framer Motion) is still a later milestone.

## In scope

- **Design tokens** as CSS variables in `frontend/src/index.css` (`--paper`, `--ink`, `--sea`, `--land`, `--accent`, `--highlight`, `--mint`, plus font variables), so a later region/time/weather palette shift only swaps values.
- **Fonts**: Fredoka (display) and Nunito (body), self-hosted through `@fontsource` packages.
- **Aircraft markers**: chunky SVG plane silhouette (`PlaneIcon.tsx`) rotated by `heading`; the selected plane gets a mustard ring.
- **Placeholder map**: sea colour, dashed graticule and flat land shapes, positioned with the existing `project()`. Originally hand-drawn Europe shapes (`EuropeLand.tsx`) with a 10-degree grid. Since Milestone 2 it is the whole world: Natural Earth coastlines (`WorldLand.tsx`) with a 30-degree grid, drawn in the same style.
- **Route and journey replay** (Milestone 2):
  - **Route line.** The selected flight's route is an ink line: solid (3px) where it has flown, dashed and slightly faded (2px) ahead.
  - **Airports.** Each end has a small paper dot with the IATA code in a mustard chip, like the card chips.
  - **Ghost plane.** The replay ghost is the same plane icon at 60% opacity, and it leaves a solid trail. Both fade out (`fade-out` keyframes) when it lands.
  - **Journey button.** A secondary paper button with an ink outline and flat shadow, next to the coral Catch.
  - **Zoom.** Like the land, line widths are divided by `--zoom` so they look the same at any zoom. The route SVG is named `.route-lines` because `.route` is the card's route text.
- **Map controls** (Milestone 2): +/−/reset buttons in the map's bottom-right corner, styled like small cream tickets with the ink border and a flat shadow. The map shows a grab cursor.
- **Featured flights** (Milestone 3): a dashed paper-coloured ring that gently pulses (`featured-pulse`, off under reduced motion) around 2–3 planes picked for the session. The selected plane's solid mustard ring replaces it, since the selected rule comes later in the CSS. The ring is a `::after` pseudo-element, so it may use `transform`.
- **Card**: ticket look with callsign, aircraft-type and altitude chips, the fact in a speech-bubble block and a coral Catch button. Since Milestone 4 it's a passport page (below).
- **Motion**: CSS-only pop on selection and card appearance, disabled under `prefers-reduced-motion`.
- **Quest strip** (added with Milestone 1): a slim ticket above the map, using the card's paper, border and shadow, with an inverted "QUEST" label. On completion, a coral rubber stamp ("Done!", double border, tilted -8deg) lands with its own `stamp` keyframes. The keyframes repeat the tilt, because a `transform` animation replaces the element's own `transform`. The concept fact appears below a dashed tear line.
- **Journal and caught state** (added with Milestone 1):
  - **Journal entries** are small ink stamps (since Milestone 4, see below), stacked below the map, newest first (since Milestone 4, inside the Collection screen). They pop in with the shared `pop` animation.
  - **"Caught today ✓"** replaces the Catch button on the card and reuses `.stamp`, so "caught" and "quest done" share one stamp look — the same for every flight, and immediate: Catch closes the card right away, same as Milestone 1.
  - `.stamp` is `inline-block`, because transforms (the tilt and the landing animation) are ignored on plain inline elements.
- **Passport card** (Milestone 4): the flight card is a passport page — `.passport-page`'s faint ruled-line background, a `.passport-strip` header band bled to the card's edges ("AIRSPACE EXPLORER · FLIGHT PASSPORT"), the existing chips plus a new HEADING chip (rounded to a whole degree), and the fact reframed as "Did you know? ...".
- **Entry stamp** (Milestone 4, `EntryStamp.tsx`): a small static ink stamp, `.entry-stamp`, showing the destination IATA code (like a real immigration entry stamp, not a route) with a callsign fallback when there's no known destination, plus the date and callsign in smaller print. It's Journal-only — an early version also played it as a landing catch-moment animation with a delayed card close, but that was simplified away after review in favour of one uniform, immediate catch reaction for every flight (above) and the stamp being purely how a Journal entry looks.
- **Collection screen** (Milestone 4): Journal, Badges and Facts tabs (`.collection-tabs`, `.tab`/`.tab.active`) behind a header toggle button (`.collection-btn`, `.app-header`).
  - **Journal tab**: a wrapping row of entry stamps (`.journal ul` is `display: flex; flex-wrap: wrap`) — "a page of stamps," no other flight detail.
  - **Badges tab** (`.badge-list`, `.badge`/`.badge.locked`): a medal or a lock icon per badge.
  - **Facts tab** (`FactList.tsx`, `.facts`, `.fact-entry`): every distinct fact learned so far, deduplicated, in the card's own fact style (`.fact-entry` reuses the mint speech-bubble look).
  - A badge unlock shows `.badge-popup`, a fixed toast in the map's corner, deliberately not reusing `.stamp`/`.entry-stamp` — badges are a different kind of reward from a catch.

## Out of scope (deferred per plan.md)

Real map art, mascot/onboarding, Framer Motion, per-type aircraft silhouettes, palette shifting by region/time/weather.

## Notes

- The land polygons are simplified Natural Earth coastlines, which are throwaway too and will be replaced by the real illustrated map.
