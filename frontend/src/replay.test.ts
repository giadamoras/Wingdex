import { expect, test } from 'vitest'
import { FIT_MS, flyMs, LAND_MS, replayAt } from './replay'

test('about one second of replay per hour of flight', () => {
  expect(flyMs(360)).toBe(6000)
})

test('short and very long flights are kept between 3 and 10 s', () => {
  expect(flyMs(59)).toBe(3000) // LHR -> CDG
  expect(flyMs(735)).toBe(10000) // AMS -> SIN
})

test('a replay fits the camera, flies, lands, then ends', () => {
  const minutes = 360 // 6 s of flying
  expect(replayAt(0, minutes)).toEqual({ phase: 'fitting', progress: 0 })
  expect(replayAt(FIT_MS + 3000, minutes)).toEqual({
    phase: 'flying',
    progress: 0.5,
  })
  expect(replayAt(FIT_MS + 6000, minutes).phase).toBe('landing')
  expect(replayAt(FIT_MS + 6000 + LAND_MS, minutes).phase).toBe('done')
})
