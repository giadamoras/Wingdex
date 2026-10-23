import { expect, test } from 'vitest'
import { countryAt, placeWords, spokenCountry } from './places'

test('a position over land names the country', () => {
  expect(placeWords(42.5, 12.5)).toBe('over Italy')
  expect(placeWords(39, -98)).toBe('over the United States')
  expect(placeWords(52.5, -1.5)).toBe('over the United Kingdom')
  expect(countryAt(35, 105)).toBe("People's Republic of China")
})

test('over water it names the nearest coast, else the ocean', () => {
  expect(placeWords(39.5, -11)).toBe('over the sea off Portugal')
  expect(placeWords(45, -35)).toBe('over the North Atlantic')
  expect(placeWords(0, -150)).toBe('over the open ocean')
})

test('country names read well mid-sentence', () => {
  expect(spokenCountry('Netherlands')).toBe('the Netherlands')
  expect(spokenCountry('The Bahamas')).toBe('the Bahamas')
  expect(spokenCountry('France')).toBe('France')
})
