# UI visual foundation (flat retro-poster kawaii)

Small visual slice pulled ahead of Milestone 1 step 5. It follows the "retro travel-poster kawaii" direction in `plan.md` (style A: flat shapes, limited palette, a little soft depth). The full visual pass (real illustrated map, mascot, onboarding, Framer Motion) is still a later milestone.

## In scope

- **Design tokens** as CSS variables in `frontend/src/index.css` (`--paper`, `--ink`, `--sea`, `--land`, `--accent`, `--highlight`, `--mint`, plus font variables), so a later region/time/weather palette shift only swaps values.
- **Fonts**: Fredoka (display) and Nunito (body), self-hosted through `@fontsource` packages.
- **Aircraft markers**: chunky SVG plane silhouette (`PlaneIcon.tsx`) rotated by `heading`; the selected plane gets a mustard ring.
- **Placeholder map**: sea colour, dashed graticule and flat land shapes, positioned with the existing `project()`. Originally hand-drawn Europe shapes (`EuropeLand.tsx`) with a 10-degree grid. Since Milestone 2 step 3 it is the whole world: Natural Earth coastlines (`WorldLand.tsx`) with a 30-degree grid, drawn in the same style.
- **Map controls** (Milestone 2 step 3): +/−/reset buttons in the map's bottom-right corner, styled like small cream tickets with the ink border and a flat shadow. The map shows a grab cursor.
- **Card**: ticket look with callsign, aircraft-type and altitude chips, the fact in a speech-bubble block and a coral Catch button.
- **Motion**: CSS-only pop on selection and card appearance, disabled under `prefers-reduced-motion`.
- **Quest strip** (added with Milestone 1 step 5): a slim ticket above the map, using the card's paper, border and shadow, with an inverted "QUEST" label. On completion, a coral rubber stamp ("Done!", double border, tilted -8deg) lands with its own `stamp` keyframes. The keyframes repeat the tilt, because a `transform` animation replaces the element's own `transform`. The concept fact appears below a dashed tear line.
- **Journal and caught state** (added with Milestone 1 step 6):
  - **Journal entries** are small ticket stubs (paper, ink border, a thick mint left edge like a torn coupon), stacked below the map, newest first. They pop in with the shared `pop` animation.
  - **"Caught today ✓"** replaces the Catch button on the card and reuses `.stamp`, so "caught" and "quest done" share one stamp look.
  - `.stamp` is `inline-block`, because transforms (the tilt and the landing animation) are ignored on plain inline elements.

## Out of scope (deferred per plan.md)

Real map art, mascot/onboarding, Framer Motion, per-type aircraft silhouettes, palette shifting by region/time/weather.

## Notes

- The land polygons are simplified Natural Earth coastlines, which are throwaway too and will be replaced by the real illustrated map.

## Deferred idea: passport card and catch stamp

Not built yet. The plain Journal exists now (Milestone 1 step 6), so this belongs with the Collection screen and visual pass. `.stamp` already sets the stamp look (quest "Done!" and "Caught today ✓"), so the catch stamp should extend that style rather than introduce a second one.

**Concept:** the flight card becomes a passport page, and Catch becomes stamping it, to mimic the travelling vibe (and fit the "spot & collect" Journal).

- **Card as a passport page (CSS only):** cream paper with a subtle ruled/guilloche pattern, a header strip ("AIRSPACE EXPLORER · FLIGHT PASSPORT"), the callsign as the "name" field, small-caps labelled fields (AIRCRAFT, ALTITUDE, HEADING), the fact reframed as a "Did you know?" note, and a dashed empty stamp area.
- **Catch = stamp:** a CSS animation drops a round or rectangular stamp (callsign, aircraft type, date) onto the stamp area with a slight rotation and a quick overshoot, in an ink colour taken from the design tokens. It stays visible for about a second, then the card closes.
- **Stamp art:** inline SVG or styled `div`, no image assets. Per-type or per-airline designs are a later art pass. Framer Motion stays deferred.
- **Behaviour:** Catch would delay only the visual close (~1s) so the stamp can land; the step 6 Journal append still happens immediately.

**Open questions to decide when unpacking:**

1. What goes on the stamp: callsign, aircraft type and date only, or also route/country once the data has it?
2. Delay the card close by ~1s, or play the stamp as a brief overlay while the card closes instantly?
3. Should the Journal/Collection also look like passport pages, or stay a plain list at first?
4. Add HEADING to the card (data already exists, no backend change)?
