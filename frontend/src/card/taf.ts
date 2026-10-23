import { angularDistance } from '../map/geo'
import type { Flight, Taf, TafCloud, TafPeriod } from '../data/types'

// Reads an airport forecast (TAF) the way a pilot does, and says it in plain
// words. The backend hands over AWC's periods; here they are combined at a
// given moment and worded. How the change groups combine:
// - "base" and "FM" (from): a complete new forecast, replacing what came before;
// - "BECMG" (becoming): a gradual change, counted once it is complete;
// - "TEMPO" (at times) and "PROB30/40" (a chance): spells on top, which don't
//   change the main forecast.

// The weather conditions at one moment: a period's fields without its times.
export type Conditions = Pick<
  TafPeriod,
  | 'wind_dir'
  | 'wind_variable'
  | 'wind_kt'
  | 'gust_kt'
  | 'visibility_m'
  | 'visibility_or_more'
  | 'weather'
  | 'clouds'
  | 'vertical_visibility_ft'
>

export const conditionsOf = (p: TafPeriod): Conditions => ({
  wind_dir: p.wind_dir,
  wind_variable: p.wind_variable,
  wind_kt: p.wind_kt,
  gust_kt: p.gust_kt,
  visibility_m: p.visibility_m,
  visibility_or_more: p.visibility_or_more,
  weather: p.weather,
  clouds: p.clouds,
  vertical_visibility_ft: p.vertical_visibility_ft,
})

// A BECMG period changes only the fields it gives.
function overlay(base: Conditions, change: Conditions): Conditions {
  const windGiven = change.wind_kt !== null || change.wind_variable
  const visibilityGiven = change.visibility_m !== null
  // Cloud layers and a hidden sky ("VV") are one sky group: either replaces
  // the other, so fog that lifts to cloud no longer reads "sky hidden".
  const skyGiven =
    change.clouds.length > 0 || change.vertical_visibility_ft !== null
  return {
    wind_dir: windGiven ? change.wind_dir : base.wind_dir,
    wind_variable: windGiven ? change.wind_variable : base.wind_variable,
    wind_kt: windGiven ? change.wind_kt : base.wind_kt,
    gust_kt: windGiven ? change.gust_kt : base.gust_kt,
    visibility_m: visibilityGiven ? change.visibility_m : base.visibility_m,
    visibility_or_more: visibilityGiven
      ? change.visibility_or_more
      : base.visibility_or_more,
    weather: change.weather ?? base.weather,
    clouds: skyGiven ? change.clouds : base.clouds,
    vertical_visibility_ft: skyGiven
      ? change.vertical_visibility_ft
      : base.vertical_visibility_ft,
  }
}

// The main forecast at time `t` (Unix seconds), without the spells.
export function prevailingAt(taf: Taf, t: number): Conditions | null {
  let now: Conditions | null = null
  for (const p of taf.periods) {
    if (p.change === 'base' || p.change === 'FM') {
      if (p.start <= t) now = conditionsOf(p)
    } else if (p.change === 'BECMG' && now) {
      if ((p.becoming_by ?? p.start) <= t) now = overlay(now, conditionsOf(p))
    }
  }
  return now
}

// ----------------------------------------------------------------------------
// Arrival

const EARTH_RADIUS_NM = 3440.065
const MIN_SPEED_KT = 60 // slower than this (taxiing, a hovering helicopter): no estimate

// When the plane should land, in Unix seconds: the remaining great-circle
// distance at its current ground speed. Rough (no approach, no wind change),
// but enough to pick the forecast period. null without a destination or speed.
export function arrivalTime(flight: Flight, now = Date.now()): number | null {
  if (!flight.destination || flight.speed_kt < MIN_SPEED_KT) return null
  const nm = angularDistance(flight, flight.destination) * EARTH_RADIUS_NM
  return Math.round(now / 1000 + (nm / flight.speed_kt) * 3600)
}

// ----------------------------------------------------------------------------
// Words

const INTENSITY: Record<string, string> = { '-': 'light', '+': 'heavy' }
const PHENOMENA: Record<string, string> = {
  DZ: 'drizzle',
  RA: 'rain',
  SN: 'snow',
  SG: 'snow grains',
  IC: 'ice crystals',
  PL: 'ice pellets',
  GR: 'hail',
  GS: 'small hail',
  UP: 'precipitation',
  BR: 'mist',
  FG: 'fog',
  FU: 'smoke',
  VA: 'volcanic ash',
  DU: 'dust',
  SA: 'sand',
  HZ: 'haze',
  PO: 'dust whirls',
  SQ: 'squalls',
  FC: 'funnel cloud',
  SS: 'sandstorm',
  DS: 'duststorm',
}
const DESCRIPTOR: Record<string, (what: string) => string> = {
  MI: (w) => `shallow ${w}`,
  BC: (w) => `patches of ${w}`,
  PR: (w) => `partial ${w}`,
  DR: (w) => `drifting ${w}`,
  BL: (w) => `blowing ${w}`,
  FZ: (w) => `freezing ${w}`,
  SH: (w) => (w ? `${w} showers` : 'showers'),
  TS: (w) => (w ? `thunderstorm with ${w}` : 'thunderstorm'),
}
const WEATHER_CODE =
  /^(-|\+|VC)?(MI|BC|PR|DR|BL|FZ|SH|TS)?((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS)*)$/

// One weather group in words: "-SHRA" -> "light rain showers", "TSRA" ->
// "thunderstorm with rain", "VCSH" -> "showers nearby". An unknown group is
// left as written.
export function weatherGroupWords(code: string): string {
  if (code === 'NSW') return 'no significant weather'
  const m = WEATHER_CODE.exec(code)
  if (!m || (!m[2] && !m[3])) return code
  const [, intensity, descriptor, phenomena] = m
  const what = (phenomena.match(/../g) ?? [])
    .map((p) => PHENOMENA[p])
    .join(' and ')
  let words = descriptor ? DESCRIPTOR[descriptor](what) : what
  if (intensity === 'VC') return `${words} nearby`
  if (intensity) words = `${INTENSITY[intensity]} ${words}`
  return words
}

// All of a period's weather groups: "-RA BR" -> "light rain, mist".
export const weatherWords = (codes: string): string =>
  codes.split(/\s+/).filter(Boolean).map(weatherGroupWords).join(', ')

const COMPASS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
]

// "wind 15 kt from the southwest, gusting 25", "light and variable wind".
export function windWords(c: Conditions): string | null {
  if (c.wind_kt === null) return null
  if (c.wind_kt === 0) return 'calm'
  const gust = c.gust_kt ? `, gusting ${c.gust_kt}` : ''
  if (c.wind_variable || c.wind_dir === null)
    return `variable wind ${c.wind_kt} kt${gust}`
  return `wind ${c.wind_kt} kt from the ${compassWord(c.wind_dir)}${gust}`
}

// The compass point a wind blows from: 225 -> "southwest".
export const compassWord = (degrees: number) =>
  COMPASS[Math.round(degrees / 45) % 8]

// "good visibility" (10 km or more), "visibility 3 km", "visibility 800 m".
export function visibilityWords(c: Conditions): string | null {
  const m = c.visibility_m
  if (m === null) return null
  if (c.visibility_or_more && m >= 9000) return 'good visibility'
  if (m >= 1000) return `visibility ${Math.round(m / 1000)} km`
  return `visibility ${m} m`
}

const COVER: Record<string, string> = {
  FEW: 'a few clouds',
  SCT: 'scattered cloud',
  BKN: 'broken cloud',
  OVC: 'overcast',
}

// The lowest cloud layer, and thunderclouds anywhere: "broken cloud at
// 1,200 ft, with thunderclouds". "no significant cloud" when none.
export function cloudWords(clouds: TafCloud[]): string | null {
  if (clouds.length === 0) return null
  const layers = clouds.filter((c) => COVER[c.cover] && c.base_ft !== null)
  if (layers.length === 0) return 'no significant cloud'
  const lowest = layers.reduce((a, b) => (b.base_ft! < a.base_ft! ? b : a))
  const at = `${COVER[lowest.cover]} at ${lowest.base_ft!.toLocaleString('en-US')} ft`
  return clouds.some((c) => c.cumulonimbus) ? `${at}, with thunderclouds` : at
}

// Conditions in one line: weather first, then wind, visibility, cloud. The
// main forecast says "dry" when it has no weather; a change or spell
// (`onlyChanges`) only says what it changes.
export function conditionsWords(c: Conditions, onlyChanges = false): string {
  const parts = [
    c.weather ? weatherWords(c.weather) : onlyChanges ? null : 'dry',
    windWords(c),
    visibilityWords(c),
    c.vertical_visibility_ft !== null
      ? `sky hidden, seen up to ${c.vertical_visibility_ft} ft`
      : cloudWords(c.clouds),
  ].filter((p): p is string => p !== null)
  const line = parts.join(', ')
  return line.charAt(0).toUpperCase() + line.slice(1)
}

// A spell's lead-in: "at times" (TEMPO), "30% chance" (PROB30, PROB30 TEMPO).
export const spellWords = (p: TafPeriod): string =>
  p.probability ? `${p.probability}% chance` : 'at times'

// ----------------------------------------------------------------------------
// Times

const pad = (n: number) => String(n).padStart(2, '0')

// One formatter per time zone (building one is slow), giving a moment's
// calendar day, clock time and weekday on that zone's wall clock.
const formatters = new Map<string, Intl.DateTimeFormat>()
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
      hourCycle: 'h23',
    })
    formatters.set(timeZone, f)
  }
  return f
}

// A moment (Unix ms) on a zone's wall clock: its day as a number of days
// since 1970 (to compare days), "HH:MM" and the weekday ("Sat").
function wallClock(ms: number, timeZone: string) {
  const parts: Record<string, string> = {}
  for (const p of formatter(timeZone).formatToParts(ms)) parts[p.type] = p.value
  const day = Date.UTC(+parts.year, +parts.month - 1, +parts.day) / 86_400_000
  return {
    day,
    hhmm: `${pad(+parts.hour)}:${parts.minute}`,
    weekday: parts.weekday,
  }
}

// A time on a zone's clock (summer time included): "16:40", "tomorrow 03:00",
// "Sat 09:00", where "tomorrow" is that zone's next day. The summary uses the
// destination's zone; UTC, the forecast's own clock, is the default.
export function clockTime(
  t: number,
  timeZone = 'UTC',
  now = Date.now(),
): string {
  const at = wallClock(t * 1000, timeZone)
  const days = at.day - wallClock(now, timeZone).day
  if (days === 0) return at.hhmm
  if (days === 1) return `tomorrow ${at.hhmm}`
  return `${at.weekday} ${at.hhmm}`
}

// A span on a zone's clock, naming the day once when both ends share it:
// "21:00–23:00", "tomorrow 05:00–09:00", "21:00–tomorrow 21:00".
export function clockRange(
  a: number,
  b: number,
  timeZone = 'UTC',
  now = Date.now(),
): string {
  const end = wallClock(b * 1000, timeZone)
  return wallClock(a * 1000, timeZone).day === end.day
    ? `${clockTime(a, timeZone, now)}–${end.hhmm}`
    : `${clockTime(a, timeZone, now)}–${clockTime(b, timeZone, now)}`
}

export const ordinal = (n: number) =>
  n % 10 === 1 && n !== 11
    ? `${n}st`
    : n % 10 === 2 && n !== 12
      ? `${n}nd`
      : n % 10 === 3 && n !== 13
        ? `${n}rd`
        : `${n}th`

// How to read a time in the code, from the forecast's own start: "2212 is the
// 22nd at 12:00 UTC".
export function codeTimeExample(taf: Taf): string {
  const d = new Date(taf.valid_from * 1000)
  const code = `${pad(d.getUTCDate())}${pad(d.getUTCHours())}`
  return `${code} is the ${ordinal(d.getUTCDate())} at ${pad(d.getUTCHours())}:00 UTC`
}

// ----------------------------------------------------------------------------
// Shared by the ticket (tafTicket.ts)

export const isMain = (p: TafPeriod) =>
  p.change === 'base' || p.change === 'FM' || p.change === 'BECMG'

// When a period takes effect: a BECMG change once it is complete.
export const takesEffect = (p: TafPeriod) =>
  p.change === 'BECMG' ? (p.becoming_by ?? p.start) : p.start
