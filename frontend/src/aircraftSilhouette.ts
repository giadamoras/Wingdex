import { TURBOPROP, WIDE_BODY } from './quest'

// Recognizable-but-simple silhouettes by aircraft family, not one drawing per
// ICAO type code: e.g. A319/A320/A321 barely differ externally, but a
// turboprop, a regional jet and a quad-engine widebody clearly do.
export type AircraftFamily =
  | 'narrowBody'
  | 'regionalJet'
  | 'wideBodyTwin'
  | 'quadOrDoubleDeck'
  | 'turboprop'

// Enough common codes to cover the mock data and a live feed, same spirit as
// WIDE_BODY/TURBOPROP in quest.ts.
const REGIONAL_JET = new Set(['E170', 'E175', 'E190', 'E195'])
const QUAD_OR_DOUBLE_DECK = new Set([
  'A342',
  'A343',
  'A345',
  'A346',
  'A388',
  'B742',
  'B744',
  'B748',
])

// Checked in this order: turboprop and regional jet are call-outs from the
// narrow-body default, quad/double-deck is a call-out from WIDE_BODY, and
// anything else wide-body falls back to the twin-jet shape. An unrecognized
// code (future mock data, or a live feed) gets the narrow-body default.
export function aircraftFamily(aircraftType: string): AircraftFamily {
  if (TURBOPROP.has(aircraftType)) return 'turboprop'
  if (REGIONAL_JET.has(aircraftType)) return 'regionalJet'
  if (QUAD_OR_DOUBLE_DECK.has(aircraftType)) return 'quadOrDoubleDeck'
  if (WIDE_BODY.has(aircraftType)) return 'wideBodyTwin'
  return 'narrowBody'
}

interface Silhouette {
  body: string // SVG path `d`, nose pointing up, same 0-24 viewBox for all families
  engines?: { cx: number; cy: number; r: number }[] // drawn on top of the body
}

// Every path is hand-built from the same nose/wing/tail recipe as the
// original narrow-body shape (mirrored left/right around x=12), just with
// different proportions and engine call-outs per family.
export const SILHOUETTES: Record<AircraftFamily, Silhouette> = {
  // The original generic silhouette: no visible engines.
  narrowBody: {
    body: 'M12 2c1 0 1.6 1 1.6 2.4V9L22 13.6V16l-8.4-2.2V19l2.2 1.6V22L12 21l-3.8 1v-1.4l2.2-1.6v-5.2L2 16v-2.4L10.4 9V4.4C10.4 3 11 2 12 2z',
  },
  // Smaller and stubbier: shorter fuselage, narrower wingspan.
  regionalJet: {
    body: 'M12 4 C12.81 4 13.3 4.81 13.3 5.95 V10 L20 14 V16 L13.3 15.5 V18.5 L15.6 19.7 V21 L12 20 L8.4 21 V19.7 L10.7 18.5 V15.5 L4 16 V14 L10.7 10 V5.95 C10.7 4.81 11.19 4 12 4 Z',
  },
  // Long fuselage, full wingspan, two large underwing engines.
  wideBodyTwin: {
    body: 'M12 1 C13.06 1 13.7 2.06 13.7 3.55 V9.5 L23 14 V16.2 L13.7 14 V20 L16.3 21.7 V23 L12 22 L7.7 23 V21.7 L10.3 20 V14 L1 16.2 V14 L10.3 9.5 V3.55 C10.3 2.06 10.94 1 12 1 Z',
    engines: [
      { cx: 18, cy: 14.6, r: 1.3 },
      { cx: 6, cy: 14.6, r: 1.3 },
    ],
  },
  // Same long fuselage as the wide-body twin, but four smaller engines.
  quadOrDoubleDeck: {
    body: 'M12 1 C13.06 1 13.7 2.06 13.7 3.55 V9.5 L23 14 V16.2 L13.7 14 V20 L16.3 21.7 V23 L12 22 L7.7 23 V21.7 L10.3 20 V14 L1 16.2 V14 L10.3 9.5 V3.55 C10.3 2.06 10.94 1 12 1 Z',
    engines: [
      { cx: 15.5, cy: 14.3, r: 0.95 },
      { cx: 20, cy: 14.7, r: 0.95 },
      { cx: 8.5, cy: 14.3, r: 0.95 },
      { cx: 4, cy: 14.7, r: 0.95 },
    ],
  },
  // Small body, like the regional jet, but the tell is the two propeller-disc
  // circles on the wings ("a jet engine that spins a propeller" - quest.ts).
  turboprop: {
    body: 'M12 5 C12.88 5 13.4 5.73 13.4 6.75 V9 L21 11.5 V12.5 L13.4 13 V17 L15.4 18.2 V19.4 L12 18.5 L8.6 19.4 V18.2 L10.6 17 V13 L3 12.5 V11.5 L10.6 9 V6.75 C10.6 5.73 11.13 5 12 5 Z',
    engines: [
      { cx: 16.5, cy: 12, r: 1.5 },
      { cx: 7.5, cy: 12, r: 1.5 },
    ],
  },
}
