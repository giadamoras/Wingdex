import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { WeatherOnArrival } from './WeatherOnArrival'
import { clearZoneCache } from './timeZone'
import { clearTafCache } from './useTaf'
import type { Taf } from '../data/types'
import { makeFlight } from '../testFlight'

afterEach(() => {
  cleanup()
  clearTafCache()
  clearZoneCache()
  vi.unstubAllGlobals()
})

const now = Math.floor(Date.now() / 1000)
const TAF: Taf = {
  icao: 'LFPG',
  name: 'Paris Charles de Gaulle',
  issued: now - 3600,
  valid_from: now - 3600,
  valid_to: now + 24 * 3600,
  raw: 'TAF LFPG 221100Z 2212/2318 24012KT 9999 -RA BKN012 BECMG 2220/2222 31020KT',
  periods: [
    {
      start: now - 3600,
      end: now + 24 * 3600,
      change: 'base',
      becoming_by: null,
      probability: null,
      wind_dir: 240,
      wind_kt: 12,
      wind_variable: false,
      gust_kt: null,
      visibility_m: 10000,
      visibility_or_more: true,
      weather: '-RA',
      clouds: [{ cover: 'BKN', base_ft: 1200, cumulonimbus: false }],
      vertical_visibility_ft: null,
    },
    {
      start: now + 6 * 3600,
      end: now + 24 * 3600,
      change: 'BECMG',
      becoming_by: now + 8 * 3600,
      probability: null,
      wind_dir: 310,
      wind_kt: 20,
      wind_variable: false,
      gust_kt: null,
      visibility_m: null,
      visibility_or_more: false,
      weather: null,
      clouds: [],
      vertical_visibility_ft: null,
    },
  ],
}

// 60 nm out at 300 kt: lands in about 12 minutes, in the rain.
const toParis = makeFlight({
  latitude: 48,
  longitude: 2.5,
  speed_kt: 300,
  destination: {
    icao: 'LFPG',
    iata: 'CDG',
    name: 'Paris Charles de Gaulle',
    city: 'Paris',
    latitude: 49,
    longitude: 2.5,
  },
})

const answer = (status: number, body?: unknown) =>
  vi.fn(
    async (_url: RequestInfo | URL) =>
      new Response(JSON.stringify(body ?? {}), { status }),
  )

test('the button opens the weather ticket for the landing', async () => {
  vi.stubGlobal('fetch', answer(200, TAF))
  render(<WeatherOnArrival flight={toParis} />)
  // The sticker is a teaser: the icon and the destination.
  const button = await screen.findByRole('button', {
    name: 'Weather on arrival at CDG: Light rain, mostly cloudy',
  })
  expect(button.textContent).toBe('🌦️CDG')
  fireEvent.click(button)
  const dialog = screen.getByRole('dialog', { name: 'Weather at Paris' })
  // The times wait for the destination's time zone, behind a spinner.
  expect(screen.getByRole('status').textContent).toBe('Loading local time…')
  await screen.findByText(/Paris time/)
  expect(screen.queryByRole('status')).toBeNull()
  expect(dialog.textContent).toContain('Light rain, mostly cloudy')
  // Every time is Paris time, named once in the hero.
  expect(dialog.textContent).toMatch(
    /Landing ~(\w+ )?\d{2}:\d{2} Paris timeLight/,
  )
  expect(dialog.textContent).not.toContain('issued')
  expect(dialog.textContent).toContain('12 kt') // the wind number
  // The later change, briefly.
  expect(dialog.textContent).toContain(
    'Wind picks up: 20 kt from the northwest',
  )
  fireEvent.click(screen.getByRole('button', { name: 'OK' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('the card turns over to the code, word by word, and back', async () => {
  vi.stubGlobal('fetch', answer(200, TAF))
  render(<WeatherOnArrival flight={toParis} />)
  fireEvent.click(await screen.findByRole('button', { name: /Weather/ }))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Show the code pilots read' }),
  )
  const dialog = screen.getByRole('dialog')
  expect(dialog.textContent).not.toContain('Landing') // only the code side
  // The button that turned it is gone: focus is on the title.
  expect(document.activeElement?.textContent).toBe('Weather at Paris')
  // The whole code on one line, and the UTC note.
  expect(document.querySelector('.code-line')?.textContent).toBe(TAF.raw)
  expect(dialog.textContent).toContain('Times are UTC, written day and hour')
  const words = [...document.querySelectorAll('.code-word code')].map(
    (c) => c.textContent,
  )
  expect(words).toContain('BKN012')
  // The landing falls in the opening forecast.
  const landing = document.querySelector('.code-block.at-landing')
  expect(landing?.textContent).toContain('24012KT')
  expect(landing?.textContent).toContain(
    'Wind from 240° (the southwest) at 12 kt',
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Show the forecast summary' }),
  )
  expect(screen.getByRole('dialog').textContent).toContain('Landing')
})

test('no button without a forecast or a destination', async () => {
  const fetchMock = answer(404)
  vi.stubGlobal('fetch', fetchMock)
  const { container } = render(<WeatherOnArrival flight={toParis} />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  expect(container.innerHTML).toBe('')
  cleanup()
  render(<WeatherOnArrival flight={makeFlight({ destination: null })} />)
  expect(screen.queryByRole('button')).toBeNull()
})

test('an answer is reused by the next card to the same airport', async () => {
  const fetchMock = answer(200, TAF)
  vi.stubGlobal('fetch', fetchMock)
  const first = render(<WeatherOnArrival flight={toParis} />)
  await screen.findByRole('button', { name: /Weather/ })
  first.unmount()
  render(<WeatherOnArrival flight={{ ...toParis, id: 'f2' }} />)
  expect(screen.getByRole('button', { name: /Weather/ })).toBeTruthy() // at once
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test("the destination's time zone is found once, then shown at once", async () => {
  vi.stubGlobal('fetch', answer(200, TAF))
  render(<WeatherOnArrival flight={toParis} />)
  fireEvent.click(await screen.findByRole('button', { name: /Weather/ }))
  await screen.findByText(/Paris time/)
  fireEvent.click(screen.getByRole('button', { name: 'OK' }))
  fireEvent.click(screen.getByRole('button', { name: /Weather/ }))
  // No spinner the second time.
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByRole('dialog').textContent).toContain('Paris time')
})

test('an airport without a city reads "local time"', async () => {
  vi.stubGlobal('fetch', answer(200, TAF))
  const destination = { ...toParis.destination!, city: null }
  render(<WeatherOnArrival flight={{ ...toParis, destination }} />)
  fireEvent.click(await screen.findByRole('button', { name: /Weather/ }))
  expect(await screen.findByText(/local time/)).toBeTruthy()
})
