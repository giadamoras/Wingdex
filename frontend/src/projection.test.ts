import { expect, test } from 'vitest'
import { MAP_BOUNDS, project, unprojectLongitude } from './projection'

const { west, east, south, north } = MAP_BOUNDS

test('north-west corner maps to top-left', () => {
  expect(project(north, west)).toEqual({ x: 0, y: 0 })
})

test('south-east corner maps to bottom-right', () => {
  expect(project(south, east)).toEqual({ x: 100, y: 100 })
})

test('centre of the bounds maps to the centre', () => {
  expect(project((north + south) / 2, (west + east) / 2)).toEqual({
    x: 50,
    y: 50,
  })
})

test('unprojectLongitude reverses the x axis of project', () => {
  expect(unprojectLongitude(0)).toBe(west)
  expect(unprojectLongitude(1)).toBe(east)
  expect(unprojectLongitude(0.5)).toBe((west + east) / 2)
})
