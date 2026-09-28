import { expect, test } from 'vitest'
import {
  centredOn,
  clampView,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  zoomAt,
} from './panzoom'

// Where world point p (0..1) appears on screen for a view, per axis.
const screenX = (v: { zoom: number; x: number }, p: number) => v.x + p * v.zoom

test('zooming keeps the point under the cursor in place', () => {
  const view = { zoom: 2, x: -0.5, y: -0.5 }
  const worldPoint = (0.3 - view.x) / view.zoom // under the cursor at fx = 0.3
  const zoomed = zoomAt(view, 1.5, 0.3, 0.4)
  expect(zoomed.zoom).toBe(3)
  expect(screenX(zoomed, worldPoint)).toBeCloseTo(0.3)
})

test('zoom stays between the min and max', () => {
  const view = { zoom: 1, x: 0, y: 0 }
  expect(zoomAt(view, 0.5, 0.5, 0.5).zoom).toBe(MIN_ZOOM)
  expect(zoomAt(view, 100, 0.5, 0.5).zoom).toBe(MAX_ZOOM)
})

test('the world always covers the whole box', () => {
  // At zoom 2 the layer is twice the box, so x and y stay within -1..0.
  expect(clampView({ zoom: 2, x: 0.3, y: -5 })).toEqual({
    zoom: 2,
    x: 0,
    y: -1,
  })
})

test('at zoom 1 the world cannot be panned', () => {
  expect(panBy({ zoom: 1, x: 0, y: 0 }, 0.2, -0.2)).toEqual({
    zoom: 1,
    x: 0,
    y: 0,
  })
})

test('panning moves the view by the drag distance', () => {
  const view = panBy({ zoom: 4, x: -1, y: -1 }, 0.25, -0.1)
  expect(view.x).toBeCloseTo(-0.75)
  expect(view.y).toBeCloseTo(-1.1)
})

test('centredOn puts the world point in the middle of the box', () => {
  const view = centredOn(0.55, 0.2, 5)
  expect(screenX(view, 0.55)).toBeCloseTo(0.5)
  expect(view.y + 0.2 * view.zoom).toBeCloseTo(0.5)
})

test('centredOn near an edge stops at the edge', () => {
  expect(centredOn(0, 0, 5)).toEqual({ zoom: 5, x: 0, y: 0 })
})
