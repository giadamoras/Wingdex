import type { Flight } from './types'

// Placeholder fact lookup, one fact per aircraft type (ICAO code).
// Later this becomes tagged fact-pools with a random pick.
const FACTS: Record<string, string> = {
  A319: 'One type rating lets pilots fly the A318, A319, A320 and A321, so airlines can swap crews between them.',
  A320: 'The A320 uses fully digital fly-by-wire, so pilots fly it with a sidestick instead of a yoke.',
  A321: 'The A321 is an A320 stretched by about 7 metres to fit more passengers.',
  A333: 'Twin-engine jets like the A330 are certified to fly hours from the nearest airport, which is why they can cross the Atlantic.',
  A359: "More than half of the A350's structure is carbon-fibre composite rather than aluminium.",
  A388: "The A380 is the world's largest passenger airliner and the only full-length double-deck jet airliner. It was designed to fit within an 80 m-wide box, the biggest size airports allow.",
  B738: 'Many early 737s had "eyebrow windows" above the cockpit windows. They gave pilots better visibility in turns and made it easier to navigate by the stars.',
  B748: 'At about 76 m, the 747-8 is the longest passenger airliner in service.',
  B77W: "The 777-300ER's engines are among the largest and most powerful jet engines flying, with fans over 3 m across.",
  E190: 'The Embraer E190 seats passengers 2+2, so there is no middle seat.',
}

const FALLBACK_FACT =
  "Every aircraft type has its own quirks. This one's on you to find!"

export function getFact(flight: Flight): string {
  return FACTS[flight.aircraft_type] ?? FALLBACK_FACT
}
