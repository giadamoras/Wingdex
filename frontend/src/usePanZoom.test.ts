import { act, renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
import { centreOf, centredOn, shapeFor, WHOLE, type Shape } from './panzoom'
import { usePanZoom } from './usePanZoom'

const portrait = shapeFor(300, 225)
const start = (shape: Shape) => centredOn(0.5, 0.5, 2, shape)

// The hook with a map box that is never really laid out.
function setup(shape: Shape) {
  const ref = { current: document.createElement('div') }
  return renderHook(({ s }) => usePanZoom(ref, s, start), {
    initialProps: { s: shape },
  })
}

test('rotating a map nobody has moved reopens it on the start view', () => {
  const { result, rerender } = setup(portrait)
  rerender({ s: WHOLE })
  expect(result.current.view).toEqual(start(WHOLE))
})

test('rotating a moved map keeps the same centre and the same span of longitudes', () => {
  const { result, rerender } = setup(portrait)
  const target = centredOn(0.3, 0.6, 4, portrait)
  act(() => result.current.animateTo(target, 0))

  rerender({ s: WHOLE })
  const wide = result.current.view
  expect(centreOf(wide, WHOLE).px).toBeCloseTo(0.3)
  expect(centreOf(wide, WHOLE).py).toBeCloseTo(0.6)
  // The world is portrait.lx box widths wide at zoom 1 in a tall box, so the
  // same longitudes fill the box at a zoom that many times higher.
  expect(wide.zoom).toBeCloseTo(4 * portrait.lx)

  rerender({ s: portrait }) // and back
  const back = result.current.view
  expect(centreOf(back, portrait).px).toBeCloseTo(0.3)
  expect(centreOf(back, portrait).py).toBeCloseTo(0.6)
  expect(back.zoom).toBeCloseTo(4)
})

test('reset goes back to the start view of the current shape', () => {
  const { result, rerender } = setup(WHOLE)
  act(() => result.current.animateTo(centredOn(0.2, 0.2, 6), 0))
  rerender({ s: portrait })
  act(() => result.current.reset())
  expect(result.current.view).toEqual(start(portrait))
})
