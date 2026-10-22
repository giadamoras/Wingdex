import {
  compassWord,
  conditionsOf,
  isMain,
  utcRange,
  utcTime,
  prevailingAt,
  spellWords,
  takesEffect,
  weatherWords,
  type Conditions,
} from './taf'
import type { Taf, TafPeriod } from '../data/types'

// The short, weather-app wording of the forecast pop-up ("weather ticket"):
// an icon and a summary for the landing, three numbers, and one short line per
// later change. And, behind its fold, the pilot's briefing: each part of the
// forecast in words with its piece of the code. taf.ts does the reading; this
// only words it.

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const hasAny = (weather: string | null, codes: string[]) =>
  weather !== null && codes.some((code) => weather.includes(code))

const COVER_RANK = ['FEW', 'SCT', 'BKN', 'OVC']

// The most of the sky any layer covers: "SCT", or null for no cloud.
function mostCover(c: Conditions): string | null {
  const covers = c.clouds
    .map((cloud) => cloud.cover)
    .filter((cover) => COVER_RANK.includes(cover))
  if (covers.length === 0) return null
  return covers.reduce((a, b) =>
    COVER_RANK.indexOf(b) > COVER_RANK.indexOf(a) ? b : a,
  )
}

// An emoji for the conditions: the weather first (storm, snow, fog, rain),
// else how cloudy it is.
export function weatherIcon(c: Conditions): string {
  const w = c.weather
  if (hasAny(w, ['TS'])) return '⛈️'
  if (hasAny(w, ['SN', 'SG', 'PL', 'GR', 'GS', 'IC'])) return '🌨️'
  if (hasAny(w, ['FG']) || c.vertical_visibility_ft !== null) return '🌫️'
  if (hasAny(w, ['RA', 'DZ', 'UP'])) return hasAny(w, ['SH', '-']) ? '🌦️' : '🌧️'
  if (hasAny(w, ['BR', 'HZ', 'FU', 'DU', 'SA'])) return '🌫️'
  const cover = mostCover(c)
  if (cover === 'OVC') return '☁️'
  if (cover === 'BKN') return '🌥️'
  if (cover === 'SCT') return '⛅'
  if (cover === 'FEW') return '🌤️'
  return '☀️'
}

const SKY: Record<string, string> = {
  FEW: 'a few clouds',
  SCT: 'partly cloudy',
  BKN: 'mostly cloudy',
  OVC: 'overcast',
}

// The conditions in a few words: "Dry, a few clouds", "Light rain, overcast".
export function summaryWords(c: Conditions): string {
  const weather = c.weather ? weatherWords(c.weather) : 'dry'
  const cover = mostCover(c)
  const sky =
    c.vertical_visibility_ft !== null
      ? 'sky hidden'
      : cover
        ? SKY[cover]
        : c.clouds.length > 0
          ? 'clear skies'
          : null
  return capitalise(sky ? `${weather}, ${sky}` : weather)
}

const COMPASS_SHORT: Record<string, string> = {
  north: 'N',
  northeast: 'NE',
  east: 'E',
  southeast: 'SE',
  south: 'S',
  southwest: 'SW',
  west: 'W',
  northwest: 'NW',
}

export interface Stat {
  icon: string
  value: string // "13 kt"
  label: string // "wind from the SW"
}

// Wind, visibility and cloud as three numbers, each with a word under it.
// A part the forecast doesn't give is left out.
export function stats(c: Conditions): Stat[] {
  const out: Stat[] = []
  if (c.wind_kt !== null) {
    const from =
      c.wind_variable || c.wind_dir === null
        ? 'variable wind'
        : `wind from the ${COMPASS_SHORT[compassWord(c.wind_dir)]}`
    const gust = c.gust_kt ? `, gusts ${c.gust_kt}` : ''
    out.push(
      c.wind_kt === 0
        ? { icon: '💨', value: 'Calm', label: 'wind' }
        : { icon: '💨', value: `${c.wind_kt} kt`, label: from + gust },
    )
  }
  // Visibility only when it matters: good visibility is the usual case, and
  // the flight rules below already say it's fine.
  const m = c.visibility_m
  if (m !== null && !c.visibility_or_more && m < GOOD_VISIBILITY_M) {
    const value = m >= 1000 ? `${Math.round(m / 1000)} km` : `${m} m`
    out.push({ icon: '👁️', value, label: 'visibility' })
  }
  if (c.vertical_visibility_ft !== null) {
    out.push({
      icon: '🌫️',
      value: `${c.vertical_visibility_ft} ft`,
      label: 'sky hidden',
    })
  } else if (c.clouds.length > 0) {
    const layers = c.clouds.filter((l) => SKY[l.cover] && l.base_ft !== null)
    const lowest = layers.sort((a, b) => a.base_ft! - b.base_ft!)[0]
    out.push(
      lowest
        ? {
            icon: '☁️',
            value: `${lowest.base_ft!.toLocaleString('en-US')} ft`,
            label: {
              FEW: 'a few clouds',
              SCT: 'scattered clouds',
              BKN: 'broken clouds',
              OVC: 'overcast',
            }[lowest.cover]!,
          }
        : { icon: '☁️', value: 'None', label: 'no clouds' },
    )
  }
  const rules = flightRules(c)
  if (rules) out.push({ icon: '✈️', value: rules, label: FLIGHT_RULES[rules] })
  return out
}

// Visibility from here up counts as good (5 statute miles, the FAA's line
// between VFR and marginal VFR).
const GOOD_VISIBILITY_M = 8000

export type FlightRules = 'VFR' | 'MVFR' | 'IFR' | 'LIFR'

// What each category means for a pilot.
const FLIGHT_RULES: Record<FlightRules, string> = {
  VFR: 'fly by sight',
  MVFR: 'marginal: just VFR',
  IFR: 'instruments only',
  LIFR: 'low IFR',
}

// The FAA's flight categories, from the ceiling (the lowest broken or
// overcast layer, or a hidden sky) and the visibility: VFR above 3,000 ft and
// 5 miles, marginal VFR from 1,000 ft or 3 miles, IFR from 500 ft or 1 mile,
// low IFR below. null when the forecast gives neither.
export function flightRules(c: Conditions): FlightRules | null {
  const ceilings = c.clouds
    .filter(
      (l) => (l.cover === 'BKN' || l.cover === 'OVC') && l.base_ft !== null,
    )
    .map((l) => l.base_ft!)
  if (c.vertical_visibility_ft !== null) ceilings.push(c.vertical_visibility_ft)
  const ceiling = ceilings.length > 0 ? Math.min(...ceilings) : Infinity
  const miles = c.visibility_m === null ? Infinity : c.visibility_m / 1609.344
  if (ceiling === Infinity && c.visibility_m === null && c.clouds.length === 0)
    return null
  if (ceiling < 500 || miles < 1) return 'LIFR'
  if (ceiling < 1000 || miles < 3) return 'IFR'
  if (ceiling <= 3000 || miles <= 5) return 'MVFR'
  return 'VFR'
}

// The icon for a change: the weather when that changes, the wind when only
// the wind does ("Calmer: 9 kt" is 💨, not the sun), else the sky after it.
export function changeIcon(before: Conditions, after: Conditions): string {
  if (after.weather !== before.weather) return weatherIcon(after)
  const windChanged =
    after.wind_kt !== null &&
    before.wind_kt !== null &&
    (Math.abs(after.wind_kt - before.wind_kt) >= 5 ||
      (after.wind_dir !== null &&
        before.wind_dir !== null &&
        Math.abs(((after.wind_dir - before.wind_dir + 540) % 360) - 180) >= 60))
  return windChanged ? '💨' : weatherIcon(after)
}

// What a change to the main forecast does, briefly: "Wind picks up: 21 kt
// from the south", "Rain, cloud down to 800 ft", "Dry again".
function changeWords(before: Conditions, after: Conditions): string {
  const parts: string[] = []
  if (after.weather !== before.weather)
    parts.push(after.weather ? weatherWords(after.weather) : 'dry again')
  if (after.wind_kt !== null && before.wind_kt !== null) {
    const from =
      after.wind_variable || after.wind_dir === null
        ? 'variable'
        : `from the ${compassWord(after.wind_dir)}`
    const gust = after.gust_kt ? `, gusts ${after.gust_kt}` : ''
    const diff = after.wind_kt - before.wind_kt
    const turned =
      after.wind_dir !== null &&
      before.wind_dir !== null &&
      Math.abs(((after.wind_dir - before.wind_dir + 540) % 360) - 180) >= 60
    if (diff >= 5)
      parts.push(`wind picks up: ${after.wind_kt} kt ${from}${gust}`)
    else if (diff <= -5)
      parts.push(`calmer: ${after.wind_kt} kt ${from}${gust}`)
    else if (turned)
      parts.push(`wind turns: ${after.wind_kt} kt ${from}${gust}`)
  }
  const low = (c: Conditions) =>
    Math.min(
      ...c.clouds
        .filter(
          (l) => (l.cover === 'BKN' || l.cover === 'OVC') && l.base_ft !== null,
        )
        .map((l) => l.base_ft!),
    )
  if (low(after) < 1500 && low(after) < low(before))
    parts.push(`cloud down to ${low(after).toLocaleString('en-US')} ft`)
  if (parts.length === 0) return summaryWords(after)
  return capitalise(parts.join(', '))
}

// What a spell brings, in a few words: its main weather (a TAF lists the
// most important group first, so "+SHRA +RA" is just "heavy rain showers"),
// gusts and thunderclouds. Visibility and cloud heights are in the briefing.
// "At times: light rain", "40% chance: thunderstorm with rain, thunderclouds".
function spellLine(p: TafPeriod): string {
  const parts: string[] = []
  const first = p.weather?.split(/\s+/)[0]
  if (first) parts.push(weatherWords(first))
  if (p.gust_kt) parts.push(`gusts to ${p.gust_kt} kt`)
  else if (!first && p.wind_kt !== null) parts.push(`wind ${p.wind_kt} kt`)
  if (p.clouds.some((l) => l.cumulonimbus)) parts.push('thunderclouds')
  if (parts.length === 0 && p.visibility_m !== null && p.visibility_m < 5000)
    parts.push('poor visibility')
  return `${capitalise(spellWords(p))}: ${parts.join(', ') || 'changeable'}`
}

export interface LaterLine {
  when: string // "23:00", "Fri 16:00", "21:00–23:00"
  icon: string
  what: string
}

// What changes after time `from` (Unix seconds), one short line each, in time
// order: changes to the main forecast and the spells still to come.
export function laterLines(
  taf: Taf,
  from: number,
  now = Date.now(),
): LaterLine[] {
  const at = (s: number) => utcTime(s, now)
  const lines: (LaterLine & { key: number })[] = []
  for (const p of taf.periods) {
    if (isMain(p)) {
      const effect = takesEffect(p)
      if (effect <= from) continue
      const before = prevailingAt(taf, effect - 1)
      const after = prevailingAt(taf, effect)
      if (!before || !after) continue
      lines.push({
        key: effect,
        when: capitalise(at(effect)), // "Tomorrow 01:00", like "Until 23:00"
        icon: changeIcon(before, after),
        what: changeWords(before, after),
      })
    } else if (p.end > from) {
      const spell = conditionsOf(p)
      // A spell of wind only keeps the wind icon, not the sun.
      const icon =
        p.weather || p.clouds.some((l) => l.cumulonimbus)
          ? weatherIcon(spell)
          : '💨'
      const start = Math.max(p.start, from)
      lines.push({
        key: start,
        when:
          p.start <= from
            ? `Until ${at(p.end)}`
            : capitalise(utcRange(p.start, p.end, now)),
        icon,
        what: spellLine(p),
      })
    }
  }
  return lines
    .map((line, order) => ({ ...line, order }))
    .sort((a, b) => a.key - b.key || a.order - b.order)
    .map(({ when, icon, what }) => ({ when, icon, what }))
}

// The index of the period in force when the plane lands (the last main
// period to have taken effect), for marking its block of the code.
export function landingPeriod(taf: Taf, arrival: number | null): number | null {
  if (arrival === null) return null
  let found: number | null = null
  taf.periods.forEach((p, index) => {
    if (isMain(p) && takesEffect(p) <= arrival) found = index
  })
  return found
}

// The moment the pop-up describes: the landing when it falls within the
// forecast, else now (a plane landing after the forecast ends).
export function ticketMoment(
  taf: Taf,
  arrival: number | null,
  now = Date.now(),
): { t: number; isArrival: boolean } {
  const inForecast =
    arrival !== null && arrival >= taf.valid_from && arrival < taf.valid_to
  return inForecast
    ? { t: arrival, isArrival: true }
    : { t: Math.round(now / 1000), isArrival: false }
}
