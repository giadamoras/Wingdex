import { COUNTRIES } from '../map/countryData'
import { inRing, regionsOf } from './attributes'

// Where a position is, in words a player can find on the map: "over Italy",
// "over the sea off Portugal", "over the North Atlantic". From the map's own
// country shapes (Natural Earth 1:110m), so coarse along coasts: a plane just
// off a coast can read as over the sea, which is still the right place to look.

// Names as said in a sentence, where the map's label reads oddly there.
const SPOKEN: Record<string, string> = {
  'United States of America': 'the United States',
  "People's Republic of China": 'China',
  'Turkish Republic of Northern Cyprus': 'Northern Cyprus',
  'The Bahamas': 'the Bahamas',
  'The Gambia': 'the Gambia',
}
// Names that take "the" in a sentence ("over the United Kingdom").
const TAKES_THE =
  /^(United|Democratic|Republic|Central African|Dominican|Czech|Netherlands|Philippines|Solomon|Falkland|French Southern)/

export const spokenCountry = (name: string) =>
  SPOKEN[name] ?? (TAKES_THE.test(name) ? `the ${name}` : name)

// The country a position is over, by the map's name, or null over water.
export function countryAt(lat: number, lon: number): string | null {
  return (
    COUNTRIES.find((c) => c.rings.some((ring) => inRing(lat, lon, ring)))
      ?.name ?? null
  )
}

// Over water, a coast within this many degrees (about 300 nm) names the sea.
const OFFSHORE_DEG = 5

// The country with the nearest border point within OFFSHORE_DEG, or null.
// Longitude gaps shrink towards the poles, so they are scaled by cos(lat).
function nearestCountry(lat: number, lon: number): string | null {
  const shrink = Math.cos((lat * Math.PI) / 180)
  let best: { name: string; d: number } | null = null
  for (const c of COUNTRIES)
    for (const ring of c.rings)
      for (const [pLon, pLat] of ring) {
        const dLon = (((pLon - lon + 540) % 360) - 180) * shrink
        const d = Math.hypot(pLat - lat, dLon)
        if (d <= OFFSHORE_DEG && (!best || d < best.d))
          best = { name: c.name, d }
      }
  return best?.name ?? null
}

// "over Italy", "over the sea off Portugal", "over the North Atlantic",
// "over the open ocean".
export function placeWords(lat: number, lon: number): string {
  const country = countryAt(lat, lon)
  if (country) return `over ${spokenCountry(country)}`
  const coast = nearestCountry(lat, lon)
  if (coast) return `over the sea off ${spokenCountry(coast)}`
  if (regionsOf(lat, lon).includes('north-atlantic'))
    return 'over the North Atlantic'
  return 'over the open ocean'
}
