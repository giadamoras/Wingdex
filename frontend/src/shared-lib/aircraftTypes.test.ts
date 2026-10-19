import { expect, test } from 'vitest'
import {
  AIRCRAFT_FAMILIES,
  AIRCRAFT_TYPES,
  aircraftType,
  isTurboprop,
  isWideBody,
} from './aircraftTypes'

const CATEGORIES = [
  'narrowBody',
  'regionalJet',
  'wideBody',
  'turboprop',
  'bizJet',
  'light',
  'glider',
  'helicopter',
]

// The JSON is only cast to these types, so check every entry here.
test('every catalog entry is well formed', () => {
  for (const [code, type] of Object.entries(AIRCRAFT_TYPES)) {
    expect(code, code).toMatch(/^[A-Z0-9]{2,4}$/) // ICAO type designator
    expect(type.name.length, code).toBeGreaterThan(0)
    expect(CATEGORIES, code).toContain(type.category)
    if (type.family !== undefined)
      expect(Object.keys(AIRCRAFT_FAMILIES), code).toContain(type.family)
    if (type.engines !== undefined)
      expect(Number.isInteger(type.engines) && type.engines > 0, code).toBe(
        true,
      )
  }
})

test('every family is named and has at least one type', () => {
  const used = new Set(Object.values(AIRCRAFT_TYPES).map((t) => t.family))
  for (const [id, family] of Object.entries(AIRCRAFT_FAMILIES)) {
    expect(family.name.length, id).toBeGreaterThan(0)
    expect(used.has(id), id).toBe(true)
  }
})

test('looks up a code, and gives null for an unknown or missing one', () => {
  expect(aircraftType('B738')?.name).toBe('Boeing 737-800')
  expect(aircraftType('B738')?.family).toBe('737')
  expect(aircraftType('ZZZZ')).toBeNull()
  expect(aircraftType(null)).toBeNull()
  expect(aircraftType('constructor')).toBeNull() // not an inherited property
})

// The lists the catalog replaced (WIDE_BODY and TURBOPROP, which the
// wide-body and turboprop quests used): every code in them still counts.
test('the old wide-body and turboprop codes keep their category', () => {
  // prettier-ignore
  const oldWideBody = [
    'A306', 'A310', 'A332', 'A333', 'A338', 'A339', 'A342', 'A343', 'A345',
    'A346', 'A359', 'A35K', 'A388', 'B742', 'B744', 'B748', 'B762', 'B763',
    'B764', 'B772', 'B773', 'B77L', 'B77W', 'B788', 'B789', 'B78X',
  ]
  // prettier-ignore
  const oldTurboprop = [
    'AT43', 'AT45', 'AT72', 'AT73', 'AT75', 'AT76', 'DH8A', 'DH8B', 'DH8C',
    'DH8D', 'SF34', 'B190', 'E120', 'C208',
  ]
  for (const code of oldWideBody) expect(isWideBody(code), code).toBe(true)
  for (const code of oldTurboprop) expect(isTurboprop(code), code).toBe(true)
  expect(isWideBody('B738')).toBe(false)
  expect(isTurboprop('A320')).toBe(false)
  expect(isWideBody(null)).toBe(false)
})
