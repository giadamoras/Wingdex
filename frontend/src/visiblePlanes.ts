import { hashString } from './hash'
import { WHOLE, type Shape, type View } from './panzoom'
import { project } from './projection'
import type { Flight } from './types'

// At most about this many planes are drawn at once. Measured: 794 planes held
// 57 fps and 1,500 only 32 (software rendering), so the server may send many
// more planes than this to fill sparse regions, and the view never draws more.
export const VIEW_CAP = 800
// Planes just outside the view are kept, so they don't pop in at the edge.
const MARGIN = 0.05

// Picks the planes worth drawing: those in view (plus a margin). If more than
// VIEW_CAP are in view, only those whose stable id hash falls under a share of
// VIEW_CAP / count are kept. One plane keeps one fixed rank, so panning does
// not shuffle planes (only the cut moves as the count changes), and zooming
// in, which shrinks the count, only ever adds planes. `alwaysIds` (selected,
// featured, onboarding target) are drawn wherever they are.
export function visibleFlights(
  flights: Flight[],
  view: View,
  alwaysIds: Iterable<string | null>,
  shape: Shape = WHOLE,
): Flight[] {
  const always = new Set(alwaysIds)
  // The view's edges in world fractions (0..1), widened by the margin.
  const sx = view.zoom * shape.lx // the world's size in box widths and heights
  const sy = view.zoom * shape.ly
  const left = -view.x / sx - MARGIN / sx
  const right = (1 - view.x) / sx + MARGIN / sx
  const top = -view.y / sy - MARGIN / sy
  const bottom = (1 - view.y) / sy + MARGIN / sy

  const inView = flights.filter((f) => {
    const { x, y } = project(f.latitude, f.longitude)
    return (
      x / 100 >= left && x / 100 <= right && y / 100 >= top && y / 100 <= bottom
    )
  })
  const share = Math.min(1, VIEW_CAP / Math.max(inView.length, 1))
  const drawn =
    share === 1
      ? inView
      : inView.filter((f) => hashString(f.id) / 2 ** 32 < share)

  // Add back the always-drawn planes that fell outside the view or the cut.
  const drawnIds = new Set(drawn.map((f) => f.id))
  const extra = flights.filter((f) => always.has(f.id) && !drawnIds.has(f.id))
  return extra.length > 0 ? [...drawn, ...extra] : drawn
}
