import { aircraftType } from '../shared-lib/aircraftTypes'

// Recognizable-but-simple silhouettes by shape, not one drawing per ICAO type
// code: e.g. A319/A320/A321 barely differ externally, but a turboprop, a
// regional jet and a quad-engine widebody clearly do.
export type AircraftShape =
  | 'narrowBody'
  | 'regionalJet'
  | 'wideBodyTwin'
  | 'quadOrDoubleDeck'
  | 'turboprop'
  | 'bizJet'
  | 'lightSingle'
  | 'lightTwin'
  | 'helicopter'
  | 'glider'

// The shape for a type, from its category in the catalog (aircraftTypes.ts).
// The engine count picks a variant: four for the quad, two for a light twin,
// one for a turboprop with a single nose propeller (Caravan, PC-12), which
// looks like a light aircraft from above. Unknown codes get the narrow-body
// default.
export function aircraftShape(code: string | null): AircraftShape {
  const type = aircraftType(code)
  switch (type?.category) {
    case 'turboprop':
      return type.engines === 1 ? 'lightSingle' : 'turboprop'
    case 'regionalJet':
      return 'regionalJet'
    case 'wideBody':
      return type.engines === 4 ? 'quadOrDoubleDeck' : 'wideBodyTwin'
    case 'bizJet':
      return 'bizJet'
    case 'light':
      return type.engines === 2 ? 'lightTwin' : 'lightSingle'
    case 'helicopter':
      return 'helicopter'
    case 'glider':
      return 'glider'
    default:
      return 'narrowBody'
  }
}

interface Silhouette {
  body: string // SVG path `d`, nose pointing up, same 0-24 viewBox for all shapes
  engines?: { cx: number; cy: number; r: number }[] // drawn on top of the body
  parts?: string[] // extra filled paths on top, e.g. a nose propeller
  rotor?: string // ink lines only (no fill), turned by CSS (planes.css)
  small?: boolean // general aviation: drawn in mint (planes.css); its paths are smaller
}

// Every path is mirrored left/right around x=12. The airliners share the
// narrow-body's nose/wing/tail recipe with different proportions and engine
// call-outs; the general-aviation shapes (small) are drawn smaller in the same
// box, so they read as small next to airliners while the tap area stays the
// same.
export const SILHOUETTES: Record<AircraftShape, Silhouette> = {
  // The default shape, also used for an unknown type: no visible engines.
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
  // Slim and swept, with the tell of a business jet: two engines on the rear
  // fuselage, under a T-tail.
  bizJet: {
    body: 'M12 2.6 C12.9 2.6 13.2 3.7 13.2 5 V9.5 L20.5 13.6 V15 L13.2 12.8 V18.4 L15.4 19.4 V20.6 L12 20 L8.6 20.6 V19.4 L10.8 18.4 V12.8 L3.5 15 V13.6 L10.8 9.5 V5 C10.8 3.7 11.1 2.6 12 2.6 Z',
    engines: [
      { cx: 9.5, cy: 16, r: 1.25 },
      { cx: 14.5, cy: 16, r: 1.25 },
    ],
  },
  // Straight wing, small tail and a propeller bar across the nose. High-wing
  // and low-wing planes look alike from above, so one shape covers both.
  lightSingle: {
    body: 'M12 5.6 C13 5.6 13.4 6.4 13.4 7.4 V8.6 H19.8 Q20.5 8.6 20.5 9.4 V11.2 Q20.5 12 19.8 12 H13.4 L12.9 15.6 H15.6 Q16.2 15.6 16.2 16.2 V17.6 Q16.2 18.2 15.6 18.2 H12.6 L12 19.2 L11.4 18.2 H8.4 Q7.8 18.2 7.8 17.6 V16.2 Q7.8 15.6 8.4 15.6 H11.1 L10.6 12 H4.2 Q3.5 12 3.5 11.2 V9.4 Q3.5 8.6 4.2 8.6 H10.6 V7.4 C10.6 6.4 11 5.6 12 5.6 Z',
    parts: ['M8.4 4.2 H15.6 V5.5 H8.4 Z'],
    small: true,
  },
  // The light-aircraft body with an engine on each wing instead of the nose
  // propeller (Seneca, Baron, DA42).
  lightTwin: {
    body: 'M12 4.6 C13 4.6 13.4 5.8 13.4 7.2 V8.6 H19.8 Q20.5 8.6 20.5 9.4 V11.2 Q20.5 12 19.8 12 H13.4 L12.9 15.6 H15.6 Q16.2 15.6 16.2 16.2 V17.6 Q16.2 18.2 15.6 18.2 H12.6 L12 19.2 L11.4 18.2 H8.4 Q7.8 18.2 7.8 17.6 V16.2 Q7.8 15.6 8.4 15.6 H11.1 L10.6 12 H4.2 Q3.5 12 3.5 11.2 V9.4 Q3.5 8.6 4.2 8.6 H10.6 V7.2 C10.6 5.8 11 4.6 12 4.6 Z',
    engines: [
      { cx: 7.4, cy: 10.3, r: 1.55 },
      { cx: 16.6, cy: 10.3, r: 1.55 },
    ],
    small: true,
  },
  // Round cabin, tail boom with its small tail rotor (the circle), and the
  // main rotor as thin lines that spin (planes.css), so the cabin shows through.
  helicopter: {
    body: 'M12 5.5 C13.9 5.5 15.4 7.3 15.4 9.5 C15.4 11.5 14.3 13 12.8 13.4 V17 H14.8 Q15.3 17 15.3 17.5 V17.9 Q15.3 18.4 14.8 18.4 H12.8 V19.8 H11.2 V18.4 H9.2 Q8.7 18.4 8.7 17.9 V17.5 Q8.7 17 9.2 17 H11.2 V13.4 C9.7 13 8.6 11.5 8.6 9.5 C8.6 7.3 10.1 5.5 12 5.5 Z',
    engines: [{ cx: 13.7, cy: 19.9, r: 1.1 }],
    rotor: 'M3.5 9.5 H20.5 M12 1 V18',
    small: true,
  },
  // Very long, thin, straight wings, a slim body and a T-tail; no engine.
  glider: {
    body: 'M12 5 C12.8 5 13.1 6 13.1 7.2 V9 L22.9 9.6 Q23.4 9.7 23.4 10.2 V10.4 Q23.4 10.9 22.9 11 L13.1 11.4 L12.6 18.6 H14.4 Q15 18.6 15 19.2 V19.4 Q15 20 14.4 20 H12.4 L12 20.6 L11.6 20 H9.6 Q9 20 9 19.4 V19.2 Q9 18.6 9.6 18.6 H11.4 L10.9 11.4 L1.1 11 Q0.6 10.9 0.6 10.4 V10.2 Q0.6 9.7 1.1 9.6 L10.9 9 V7.2 C10.9 6 11.2 5 12 5 Z',
    small: true,
  },
}
