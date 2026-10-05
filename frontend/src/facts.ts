import {
  airlineOf,
  altitudeBand,
  regionsOf,
  timeOfDay,
  weatherAt,
} from './attributes'
import { dayKey } from './dates'
import { hashString } from './hash'
import type { Flight, Hazard, WeatherArea } from './types'

// One fact, tagged with the single flight attribute it is about. A flight
// gets every fact whose tag matches one of its own attributes.
type FactKind = 'type' | 'airline' | 'altitude' | 'region' | 'time' | 'weather'
interface Fact {
  kind: FactKind
  value: string
  text: string
}

// Values: type is the ICAO aircraft code, airline the 3-letter callsign prefix,
// altitude/region/time the labels from attributes.ts, weather a hazard name
// (see Hazard in types.ts).
const FACTS: Fact[] = [
  // Aircraft types
  {
    kind: 'type',
    value: 'A319',
    text: 'One type rating lets pilots fly the A318, A319, A320 and A321, so airlines can swap crews between them.',
  },
  {
    kind: 'type',
    value: 'A320',
    text: 'The A320 uses fully digital fly-by-wire, so pilots fly it with a sidestick instead of a yoke.',
  },
  {
    kind: 'type',
    value: 'A321',
    text: 'The A321 is an A320 stretched by about 7 metres to fit more passengers.',
  },
  {
    kind: 'type',
    value: 'A333',
    text: 'Twin-engine jets like the A330 are certified to fly hours from the nearest airport, which is why they can cross the Atlantic.',
  },
  {
    kind: 'type',
    value: 'A359',
    text: "More than half of the A350's structure is carbon-fibre composite rather than aluminium.",
  },
  {
    kind: 'type',
    value: 'A388',
    text: "The A380 is the world's largest passenger airliner and the only full-length double-deck jet airliner. It was designed to fit within an 80 m-wide box, the biggest size airports allow.",
  },
  {
    kind: 'type',
    value: 'AT76',
    text: 'The ATR 72 is a turboprop: a gas turbine spins its propellers. On short hops that burns much less fuel than a jet, which is why it is common on short regional routes.',
  },
  {
    kind: 'type',
    value: 'B738',
    text: 'Many early 737s had "eyebrow windows" above the cockpit windows, which gave pilots better visibility in turns.',
  },
  {
    kind: 'type',
    value: 'B738',
    text: 'The 737 sits low to the ground, so its engine intakes are flattened at the bottom to leave room between the engine and the runway.',
  },
  {
    kind: 'type',
    value: 'B748',
    text: 'At about 76 m, the 747-8 is one of the longest airliners ever built.',
  },
  {
    kind: 'type',
    value: 'B77W',
    text: "The 777-300ER's engines are among the largest and most powerful jet engines flying, with fans over 3 m across.",
  },
  {
    kind: 'type',
    value: 'E190',
    text: 'The Embraer E190 seats passengers 2+2, so there is no middle seat.',
  },

  // Airlines (callsign prefix)
  {
    kind: 'airline',
    value: 'BAW',
    text: 'British Airways pilots call themselves "Speedbird" on the radio, a name inherited from the logo of its predecessor, Imperial Airways.',
  },
  {
    kind: 'airline',
    value: 'AFR',
    text: 'On the radio, Air France flights use the callsign "Airfrans".',
  },
  {
    kind: 'airline',
    value: 'DLH',
    text: 'Lufthansa was the first airline to fly the Boeing 747-8 Intercontinental, the passenger version of the stretched 747.',
  },
  {
    kind: 'airline',
    value: 'KLM',
    text: 'KLM was founded in 1919 and is the oldest airline in the world still flying under its original name.',
  },
  {
    kind: 'airline',
    value: 'RYR',
    text: "Ryanair's mainline fleet is almost all Boeing 737s, which keeps pilot training and maintenance simple.",
  },
  {
    kind: 'airline',
    value: 'THY',
    text: 'Turkish Airlines flies to more countries than almost any other airline, with Istanbul as its hub.',
  },
  {
    kind: 'airline',
    value: 'UAE',
    text: 'Emirates is the biggest operator of the A380 and flies only wide-body jets.',
  },
  {
    kind: 'airline',
    value: 'EIN',
    text: 'Aer Lingus flights use the callsign "Shamrock" on the radio.',
  },
  {
    kind: 'airline',
    value: 'SAS',
    text: 'SAS stands for Scandinavian Airlines System, and it began as a joint venture between Denmark, Norway and Sweden.',
  },
  {
    kind: 'airline',
    value: 'EZY',
    text: 'easyJet flights are simply called "Easy" on the radio, followed by their flight number.',
  },
  {
    kind: 'airline',
    value: 'ICE',
    text: 'Icelandair uses Keflavik as a stopover hub, linking Europe and North America through Iceland.',
  },

  // Altitude bands
  {
    kind: 'altitude',
    value: 'low',
    text: 'Below 10,000 ft, aircraft in most airspace are limited to 250 knots, which keeps busy airport areas manageable.',
  },
  {
    kind: 'altitude',
    value: 'mid',
    text: 'In the USA, pilots set their altimeters to a standard pressure at 18,000 ft. Above that, altitudes are called flight levels: 36,000 ft is FL360.',
  },
  {
    kind: 'altitude',
    value: 'cruise',
    text: 'Airliners cruise at 30,000 to 38,000 ft because the thin air there means less drag, while the engines still get enough oxygen to run efficiently.',
  },
  {
    kind: 'altitude',
    value: 'cruise',
    text: 'Airliner cabins are pressurised to feel like about 6,000 to 8,000 ft, not sea level.',
  },
  {
    kind: 'altitude',
    value: 'high',
    text: 'Near an airliner\'s highest altitude, the gap between stalling speed and the speed where shockwaves form gets very small. Pilots call this squeeze the "coffin corner".',
  },

  // Regions
  {
    kind: 'region',
    value: 'open-ocean',
    text: 'Far from land, aircraft are out of range of radar and ground radio, so pilots send position reports by satellite data link and follow fixed spacing rules.',
  },
  {
    kind: 'region',
    value: 'north-atlantic',
    text: 'Transatlantic flights follow "tracks" published every day, laid out to catch tailwinds from the jet stream.',
  },
  {
    kind: 'region',
    value: 'north-atlantic',
    text: 'Flights from North America to Europe are usually quicker than the way back, because the jet stream blows west to east.',
  },
  {
    kind: 'region',
    value: 'europe',
    text: 'Europe has some of the busiest airspace in the world, shared between dozens of air traffic control centres.',
  },
  {
    kind: 'region',
    value: 'land',
    text: 'Most flights plan an alternate airport, in case bad weather or a closed runway stops them landing at their destination.',
  },

  // Time of day (local solar time at the plane)
  {
    kind: 'time',
    value: 'night',
    text: 'At night you can tell which way a plane is heading from its lights: red on the left wing, green on the right, white at the tail.',
  },
  {
    kind: 'time',
    value: 'dawn',
    text: 'At sunrise, contrails can glow orange and pink because they catch the low sunlight.',
  },
  {
    kind: 'time',
    value: 'dusk',
    text: 'After sunset on the ground, an airliner at cruising altitude can still be lit by the sun, so it glows against a darkening sky.',
  },
  {
    kind: 'time',
    value: 'day',
    text: "A contrail only forms when the air is cold and humid enough for the engines' water vapour to freeze into ice crystals.",
  },

  // Weather hazards. Shown only to a flight that is inside one (see getFact).
  {
    kind: 'weather',
    value: 'thunderstorm',
    text: 'Pilots steer around thunderstorms instead of flying through them. The tall clouds hide violent up-and-down air currents, hail and lightning, and the weather radar in the nose shows which way to go.',
  },
  {
    kind: 'weather',
    value: 'thunderstorm',
    text: "A thunderstorm cloud can tower far above the height airliners cruise at, so climbing over it isn't an option. Pilots go around it instead, often keeping about 20 nautical miles away from the worst of it.",
  },
  {
    kind: 'weather',
    value: 'turbulence',
    text: 'Turbulence is bumpy air, made by jet streams, mountains and storms. It can feel scary, but airliners are built to flex far more than it ever asks. The real rule is to keep your seat belt on.',
  },
  {
    kind: 'weather',
    value: 'turbulence',
    text: "Clear-air turbulence happens in cloudless skies, often when the fast winds of a jet stream shear against slower air. Ordinary weather radar can't directly detect it, so pilots radio warnings to each other and to air traffic control about the bumps they have felt.",
  },
  {
    kind: 'weather',
    value: 'mountain_wave',
    text: 'When strong winds flow across a mountain range in a suitable atmospheric environment, they can create waves of air that extend downwind. These mountain waves can produce turbulence, sometimes even when the air is too dry for clouds to form.',
  },
  {
    kind: 'weather',
    value: 'mountain_wave',
    text: 'Smooth, lens-shaped clouds called lenticular clouds can form near the top of a mountain wave. They may look almost motionless even though strong winds are flowing through them. Glider pilots can use the rising air around mountain waves to gain altitude.',
  },
  {
    kind: 'weather',
    value: 'icing',
    text: 'Ice can build up on the wings and change their shape, so they make less lift. Airliners heat the wing edges and engine intakes, and pilots can climb or descend to leave an icy layer.',
  },
  {
    kind: 'weather',
    value: 'icing',
    text: 'Icing comes from supercooled water: cloud droplets that are still liquid below freezing and turn to ice the moment they touch a plane. That is why a warning comes with a range of heights. Above or below the layer, the air is fine.',
  },
  {
    kind: 'weather',
    value: 'volcanic_ash',
    text: 'Volcanic ash is made of tiny, glass-like pieces of rock. In a jet engine it can melt and clog the turbine, so pilots avoid ash clouds, even thin ones that are hard to see.',
  },
  {
    kind: 'weather',
    value: 'volcanic_ash',
    text: "After Iceland's Eyjafjallajökull volcano erupted in 2010, much of Europe's airspace was shut for days, the biggest closure since World War II.",
  },
  {
    kind: 'weather',
    value: 'tropical_cyclone',
    text: 'Hurricanes and typhoons are the same kind of storm, a tropical cyclone, named differently depending on where it forms. Airlines route flights well around them, and cancel flights to airports in their path.',
  },
  {
    kind: 'weather',
    value: 'tropical_cyclone',
    text: "A tropical cyclone's storm clouds can reach the heights airliners cruise at, so there is no flying over one. Forecasters track each storm so routes can be planned to skirt it.",
  },
]

const FALLBACK_FACT =
  "Every aircraft type has its own quirks. This one's on you to find!"

// One fact for this flight, from the pool entries matching its attributes.
// The pick is seeded by flight id and local day, not random per call: the card
// re-renders on every poll and the Journal stores the fact that was shown, so
// it must stay the same. It still varies between flights and between days.
// A flight inside a weather hazard gets a fact about that hazard instead of
// the usual pool: weather is rare and worth explaining when you meet it.
export function getFact(
  flight: Flight,
  now = new Date(),
  weather: WeatherArea[] = [],
): string {
  const hazards = weatherAt(flight, weather, now)
  const weatherFacts = FACTS.filter(
    (f) => f.kind === 'weather' && hazards.includes(f.value as Hazard),
  )
  if (weatherFacts.length > 0)
    return weatherFacts[
      hashString(flight.id + dayKey(now)) % weatherFacts.length
    ].text

  const tags = new Set([
    ...(flight.aircraft_type ? [`type:${flight.aircraft_type}`] : []),
    `airline:${airlineOf(flight.callsign)}`,
    `altitude:${altitudeBand(flight.altitude_ft)}`,
    ...regionsOf(flight.latitude, flight.longitude).map((r) => `region:${r}`),
    `time:${timeOfDay(flight.longitude, now)}`,
  ])
  const matches = FACTS.filter((f) => tags.has(`${f.kind}:${f.value}`))
  if (matches.length === 0) return FALLBACK_FACT
  return matches[hashString(flight.id + dayKey(now)) % matches.length].text
}
