import { compassWord, ordinal, weatherGroupWords } from './taf'
import type { Taf } from '../data/types'

// The pilot's side of the forecast pop-up: the TAF code broken down word by
// word, in the code's own order, each word next to what it means. The code
// is split into its opening (what, where, when issued, how long it is valid)
// and one block per group (the opening forecast, then each FM, BECMG, TEMPO
// or PROB). Times are UTC, as in the code: "22nd 14:00 UTC".

export interface CodeWord {
  code: string // "BKN018"
  meaning: string // "Broken cloud at 1,800 ft"
}

export interface CodeBlock {
  words: CodeWord[]
  atLanding: boolean // the block in force when the plane lands
}

export interface DecodedTaf {
  opening: CodeWord[]
  blocks: CodeBlock[]
}

const pad = (n: number) => String(n).padStart(2, '0')

// A day of the month and time in the code, read as written: "22nd 14:00".
const dayTime = (day: number, hour: number, minute = 0) =>
  `${ordinal(day)} ${pad(hour)}:${pad(minute)}`

// A time in the code, in UTC: "22nd 11:20 UTC".
const utcAt = (day: number, hour: number, minute = 0) =>
  `${dayTime(day, hour, minute)} UTC`

// A span in the code ("2220/2302"), naming the day once when both ends share
// it: "22nd 20:00–23rd 02:00 UTC", "22nd 14:00–17:00 UTC".
function utcSpan(span: string): string {
  const m = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(span)
  if (!m) return span
  const [d1, h1, d2, h2] = m.slice(1).map(Number)
  const end = d1 === d2 ? `${pad(h2)}:00` : dayTime(d2, h2)
  return `${dayTime(d1, h1)}–${end} UTC`
}

const COVER: Record<string, string> = {
  FEW: 'A few clouds',
  SCT: 'Scattered cloud',
  BKN: 'Broken cloud',
  OVC: 'Overcast',
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// What one word of the conditions means. Unknown words say so rather than
// guess.
function conditionWord(word: string): string {
  let m = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/.exec(word)
  if (m) {
    const [, dir, speed, gust, unit] = m
    const units = unit === 'KT' ? 'kt' : 'm/s'
    if (Number(speed) === 0) return 'Calm, no wind'
    const from =
      dir === 'VRB'
        ? 'Wind from a changing direction'
        : `Wind from ${Number(dir)}° (the ${compassWord(Number(dir))})`
    const gusts = gust ? `, gusts to ${Number(gust)} ${units}` : ''
    return `${from} at ${Number(speed)} ${units}${gusts}`
  }
  if (word === 'CAVOK')
    return 'Ceiling and visibility OK: 10 km or more, no cloud below 5,000 ft, no weather'
  if (word === '9999') return 'Visibility 10 km or more'
  if (/^\d{4}$/.test(word)) {
    const metres = Number(word)
    return metres >= 1000
      ? `Visibility ${metres / 1000} km`
      : `Visibility ${metres} m`
  }
  if (word === 'P6SM') return 'Visibility more than 6 miles (10 km)'
  m = /^(\d+)SM$/.exec(word)
  if (m) return `Visibility ${m[1]} miles`
  m = /^(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?$/.exec(word)
  if (m) {
    const feet = (Number(m[2]) * 100).toLocaleString('en-US')
    const kind =
      m[3] === 'CB'
        ? ', thunderclouds'
        : m[3] === 'TCU'
          ? ', towering clouds'
          : ''
    return `${COVER[m[1]]} at ${feet} ft${kind}`
  }
  m = /^VV(\d{3})$/.exec(word)
  if (m)
    return `Sky hidden (fog): seen up to ${(Number(m[1]) * 100).toLocaleString('en-US')} ft`
  if (word === 'NSC') return 'No significant cloud'
  if (word === 'SKC' || word === 'CLR') return 'Clear sky'
  if (word === 'NSW') return 'No significant weather'
  const weather = weatherGroupWords(word)
  if (weather !== word) return capitalise(weather)
  return 'Not explained here'
}

// One block's words: its keyword and times read together, then each condition.
function blockWords(words: string[]): CodeWord[] {
  const out: CodeWord[] = []
  let i = 0
  let m: RegExpExecArray | null
  if ((m = /^FM(\d{2})(\d{2})(\d{2})$/.exec(words[0]))) {
    out.push({
      code: words[0],
      meaning: `New forecast from ${utcAt(+m[1], +m[2], +m[3])}`,
    })
    i = 1
  } else if (
    words[0] === 'BECMG' ||
    words[0] === 'TEMPO' ||
    /^PROB\d{2}$/.test(words[0])
  ) {
    const lead: string[] = []
    while (
      words[i] === 'BECMG' ||
      words[i] === 'TEMPO' ||
      /^PROB\d{2}$/.test(words[i] ?? '')
    )
      lead.push(words[i++])
    const span = words[i] && /^\d{4}\/\d{4}$/.test(words[i]) ? words[i++] : null
    const prob = lead.find((w) => w.startsWith('PROB'))
    const kind = lead.includes('BECMG')
      ? 'Becoming, gradually'
      : prob
        ? `A ${prob.slice(4)}% chance${lead.includes('TEMPO') ? ', at times' : ''}`
        : 'At times'
    out.push({
      code: [...lead, span].filter(Boolean).join(' '),
      meaning: span ? `${kind}, ${utcSpan(span)}` : kind,
    })
  }
  for (; i < words.length; i++) {
    const word = words[i]
    const temp = /^T([XN])(M?)(\d{2})\/(\d{2})(\d{2})Z$/.exec(word)
    if (temp) {
      const degrees = `${temp[2] ? '-' : ''}${Number(temp[3])}°C`
      out.push({
        code: word,
        meaning: `${temp[1] === 'X' ? 'Highest' : 'Lowest'} temperature ${degrees}, ${utcAt(+temp[4], +temp[5])}`,
      })
      continue
    }
    out.push({ code: word, meaning: conditionWord(word) })
  }
  return out
}

// The whole code, broken down. `landingIndex` is the block in force at the
// landing (from the periods, when the code's blocks line up with them).
export function decodeTaf(taf: Taf, landingIndex: number | null): DecodedTaf {
  const words = taf.raw.replace(/=\s*$/, '').trim().split(/\s+/)
  const opening: CodeWord[] = []
  let i = 0
  if (words[i] === 'TAF') {
    opening.push({
      code: 'TAF',
      meaning: 'An airport forecast (Terminal Aerodrome Forecast)',
    })
    i++
  }
  while (words[i] === 'AMD' || words[i] === 'COR') {
    opening.push({
      code: words[i],
      meaning:
        words[i] === 'AMD' ? 'Amended: an update to the forecast' : 'Corrected',
    })
    i++
  }
  if (/^[A-Z0-9]{4}$/.test(words[i] ?? '')) {
    opening.push({
      code: words[i],
      meaning: `The airport${taf.name ? `: ${taf.name}` : ''}`,
    })
    i++
  }
  let m = /^(\d{2})(\d{2})(\d{2})Z$/.exec(words[i] ?? '')
  if (m) {
    opening.push({
      code: words[i],
      meaning: `Issued ${utcAt(+m[1], +m[2], +m[3])}`,
    })
    i++
  }
  m = /^\d{4}\/\d{4}$/.exec(words[i] ?? '')
  if (m) {
    opening.push({
      code: words[i],
      meaning: `Valid ${utcSpan(words[i])}`,
    })
    i++
  }
  // The groups, split where each change group starts (PROB40 TEMPO is one).
  const groups: string[][] = [[]]
  for (const word of words.slice(i)) {
    const previous = groups.at(-1)!.at(-1)
    const starts =
      /^FM\d{6}$/.test(word) ||
      word === 'BECMG' ||
      /^PROB\d{2}$/.test(word) ||
      (word === 'TEMPO' && !/^PROB\d{2}$/.test(previous ?? ''))
    if (starts && groups.at(-1)!.length > 0) groups.push([])
    groups.at(-1)!.push(word)
  }
  const kept = groups.filter((g) => g.length > 0)
  // The landing's block only when the blocks line up with the periods, so a
  // code we split differently never marks the wrong one.
  const lined = kept.length === taf.periods.length
  const blocks = kept.map((g, index) => ({
    words: blockWords(g),
    atLanding: lined && index === landingIndex,
  }))
  return { opening, blocks }
}
