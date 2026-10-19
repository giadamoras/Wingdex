import codes from '../content/country-codes.json'
import prefixes from '../content/icao-prefixes.json'

// The country of an airport, from the start of its ICAO code: pilots' codes
// are grouped by region, e.g. "EG.." is the United Kingdom and "K..." the
// United States. Used for the Dex's destination countries (the passport). It works
// the same for mock and live flights, unlike the country a route lookup names.
// Territories are listed under the country whose passport stamp they would
// get (Puerto Rico under the United States, Hong Kong on its own).

export const ICAO_PREFIXES = prefixes as Record<string, string>

// Every country the table knows, once each (several prefixes can share one).
export const COUNTRY_NAMES = [...new Set(Object.values(ICAO_PREFIXES))]

// The longest prefix wins, so "UTDD" is Tajikistan ("UTD") not Uzbekistan
// ("UT"), and "UUEE" falls back to Russia ("U"). null for a prefix the table
// lacks or a code that isn't four letters.
export function countryOfAirport(icao: string): string | null {
  const code = icao.trim().toUpperCase()
  if (!/^[A-Z]{4}$/.test(code)) return null
  for (let length = 3; length >= 1; length--) {
    const prefix = code.slice(0, length)
    if (Object.hasOwn(ICAO_PREFIXES, prefix)) return ICAO_PREFIXES[prefix]
  }
  return null
}

// Each country's two-letter ISO code, lower case ("gb"), which names its flag
// file in the flag-icons package (see Flag.tsx). countries.test.ts checks
// that every country above has one.
export const COUNTRY_CODES = codes as Record<string, string>
