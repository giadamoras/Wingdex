import { expect, test, vi } from 'vitest'
import {
  centredOn,
  centreOf,
  clampView,
  fitBounds,
  MAX_ZOOM,
  TOUCH_MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  shapeFor,
  viewBetween,
  WHOLE,
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

test('centreOf recovers the world point centredOn was given', () => {
  const view = centredOn(0.7, 0.3, 4)
  expect(centreOf(view).px).toBeCloseTo(0.7)
  expect(centreOf(view).py).toBeCloseTo(0.3)
})

test('centredOn puts the world point in the middle of the box', () => {
  const view = centredOn(0.55, 0.2, 5)
  expect(screenX(view, 0.55)).toBeCloseTo(0.5)
  expect(view.y + 0.2 * view.zoom).toBeCloseTo(0.5)
})

test('centredOn near an edge stops at the edge', () => {
  expect(centredOn(0, 0, 5)).toEqual({ zoom: 5, x: 0, y: 0 })
})

test('fitBounds shows the whole box with a margin, centred', () => {
  // A box 0.2 wide and 0.1 tall: width limits the zoom to (1 - 2 * 0.1) / 0.2.
  const view = fitBounds(0.4, 0.4, 0.6, 0.5, 0.1)
  expect(view.zoom).toBeCloseTo(4)
  expect(screenX(view, 0.4)).toBeCloseTo(0.1) // left edge sits at the margin
  expect(screenX(view, 0.6)).toBeCloseTo(0.9)
})

test('fitBounds on a tiny route stops at the max zoom', () => {
  expect(fitBounds(0.5, 0.5, 0.501, 0.501).zoom).toBe(MAX_ZOOM)
})

test('viewBetween starts at a, ends at b, and zooms geometrically', () => {
  const a = centredOn(0.5, 0.5, 2)
  const b = centredOn(0.5, 0.5, 8)
  expect(viewBetween(a, b, 0)).toEqual(a)
  expect(viewBetween(a, b, 1).zoom).toBeCloseTo(8)
  expect(viewBetween(a, b, 0.5).zoom).toBeCloseTo(4) // halfway in log scale
})

test('a touch screen cannot zoom in as far', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  try {
    const view = { zoom: 1, x: 0, y: 0 }
    expect(zoomAt(view, 100, 0.5, 0.5).zoom).toBe(TOUCH_MAX_ZOOM)
    expect(fitBounds(0.5, 0.5, 0.501, 0.501).zoom).toBe(TOUCH_MAX_ZOOM)
  } finally {
    vi.unstubAllGlobals()
  }
})

// A box about 4:3, like a phone held upright: the world is 1.93 box widths wide.
const portrait = shapeFor(300, 225)

test('a box shaped like the world, or of unknown size, shows the whole world', () => {
  expect(shapeFor(700, 272)).toEqual(WHOLE)
  expect(shapeFor(327, 122)).toEqual(WHOLE) // the border's pixels do not count
  expect(shapeFor(0, 0)).toEqual(WHOLE)
})

test('a taller box shows only part of the width, a wider one part of the height', () => {
  expect(portrait.lx).toBeCloseTo(1.93, 1)
  expect(portrait.ly).toBe(1)
  const wide = shapeFor(1000, 200)
  expect(wide.lx).toBe(1)
  expect(wide.ly).toBeGreaterThan(1)
})

test('in a tall box the world still covers it, and can be panned sideways at zoom 1', () => {
  const left = clampView({ zoom: 1, x: 0.4, y: -3 }, portrait)
  expect(left).toEqual({ zoom: 1, x: 0, y: 0 })
  const right = clampView({ zoom: 1, x: -5, y: 0 }, portrait)
  expect(right.x).toBeCloseTo(1 - portrait.lx)
  expect(panBy({ zoom: 1, x: 0, y: 0 }, -0.3, 0.3, portrait).x).toBeCloseTo(
    -0.3,
  )
  expect(panBy({ zoom: 1, x: 0, y: 0 }, -0.3, 0.3, portrait).y).toBe(0)
})

test('centredOn and centreOf agree in a tall box', () => {
  const view = centredOn(0.6, 0.4, 3, portrait)
  expect(centreOf(view, portrait).px).toBeCloseTo(0.6)
  expect(centreOf(view, portrait).py).toBeCloseTo(0.4)
  expect(view.x + 0.6 * view.zoom * portrait.lx).toBeCloseTo(0.5)
})

test('zooming in a tall box keeps the point under the cursor in place', () => {
  const view = centredOn(0.6, 0.4, 3, portrait)
  const p = { x: (0.3 - view.x) / (view.zoom * portrait.lx) } // world point at fx 0.3
  const zoomed = zoomAt(view, 1.5, 0.3, 0.4, portrait)
  expect(zoomed.x + p.x * zoomed.zoom * portrait.lx).toBeCloseTo(0.3)
})

test('fitBounds in a tall box fits the width it really has', () => {
  const view = fitBounds(0.4, 0.4, 0.5, 0.45, 0.1, portrait)
  const left = view.x + 0.4 * view.zoom * portrait.lx
  const right = view.x + 0.5 * view.zoom * portrait.lx
  expect(left).toBeGreaterThanOrEqual(0.1 - 1e-9)
  expect(right).toBeLessThanOrEqual(0.9 + 1e-9)
})

test('viewBetween in a tall box still ends at the target', () => {
  const a = centredOn(0.5, 0.5, 2, portrait)
  const b = centredOn(0.7, 0.4, 6, portrait)
  const end = viewBetween(a, b, 1, portrait)
  expect(end.zoom).toBeCloseTo(6)
  expect(centreOf(end, portrait).px).toBeCloseTo(centreOf(b, portrait).px)
})
