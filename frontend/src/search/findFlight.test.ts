import { expect, test } from 'vitest'
import { findByCallsign, normaliseSearch, notFoundWords } from './findFlight'
import { makeFlight } from '../testFlight'

test('a search is written like a callsign, or refused', () => {
  expect(normaliseSearch(' mu 640 ')).toBe('MU640')
  expect(normaliseSearch('ba-117')).toBe('BA117')
  expect(normaliseSearch('MU')).toBeNull() // too short to be a flight
  expect(normaliseSearch('CES640/..')).toBeNull()
  expect(normaliseSearch('ABCDEFGHI')).toBeNull() // longer than a callsign
})

test('the feed is searched by callsign, in the order given', () => {
  const flights = [
    makeFlight({ id: 'a', callsign: 'OTT640' }),
    makeFlight({ id: 'b', callsign: 'CES640 ' }), // feeds can pad callsigns
  ]
  expect(findByCallsign(flights, ['CES640'])?.id).toBe('b')
  expect(findByCallsign(flights, ['CES640', 'OTT640'])?.id).toBe('b')
  expect(findByCallsign(flights, ['XYZ1'])).toBeNull()
})

test('not found says whether the flight is known at all', () => {
  // Known to fly as CES640, just not in the feed: say so.
  expect(notFoundWords('MU640', ['CES640', 'CES0640'])).toMatch(
    /^MU640 flies as CES640, but it isn't in the live feed right now/,
  )
  // Nothing known: the general reasons.
  expect(notFoundWords('MU640')).toMatch(/^No MU640 in the sky right now/)
  expect(notFoundWords('CES640', ['CES640'])).toMatch(/^No CES640/)
})
