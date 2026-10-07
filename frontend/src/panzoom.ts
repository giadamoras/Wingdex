// Pan/zoom maths for the map. Everything is in fractions of the map box
// (0..1), so the view survives the box being resized.
//
// The world layer is scaled by `zoom` from its top-left corner, then shifted
// by (x, y). A point p of the world (0..1) appears on screen at x + p * zoom.
export interface View {
  zoom: number
  x: number
  y: number
}

export const MIN_ZOOM = 1 // whole world
export const MAX_ZOOM = 16
// Touch screens stop sooner: a phone browser keeps the sharpness the map had when
// it was drawn, so the closer you zoom the blurrier it gets (see WORLD_SCALE in
// FlightMap.tsx).
export const TOUCH_MAX_ZOOM = 9

export function maxZoom(): number {
  const touch =
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  return touch ? TOUCH_MAX_ZOOM : MAX_ZOOM
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n))

// Keeps the zoom in range and the world covering the whole box (no gaps).
export function clampView({ zoom, x, y }: View): View {
  const z = clamp(zoom, MIN_ZOOM, maxZoom())
  return { zoom: z, x: clamp(x, 1 - z, 0), y: clamp(y, 1 - z, 0) }
}

// Zooms by `factor` while keeping the point under (fx, fy) in place.
export function zoomAt(view: View, factor: number, fx: number, fy: number) {
  const zoom = clamp(view.zoom * factor, MIN_ZOOM, maxZoom())
  // World point currently under the cursor.
  const px = (fx - view.x) / view.zoom
  const py = (fy - view.y) / view.zoom
  return clampView({ zoom, x: fx - px * zoom, y: fy - py * zoom })
}

// Shifts the view by a drag of (dx, dy), in fractions of the box.
export function panBy(view: View, dx: number, dy: number): View {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy })
}

// A view at `zoom` centred on world point (px, py), as close as the edges allow.
export function centredOn(px: number, py: number, zoom: number): View {
  return clampView({ zoom, x: 0.5 - px * zoom, y: 0.5 - py * zoom })
}

// The closest view showing the whole world box (min..max), with `margin` of
// the map box left free on each side.
export function fitBounds(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  margin = 0.12,
): View {
  const room = 1 - 2 * margin
  const zoom = clamp(
    Math.min(
      room / Math.max(maxX - minX, 1e-6),
      room / Math.max(maxY - minY, 1e-6),
    ),
    MIN_ZOOM,
    maxZoom(),
  )
  return centredOn((minX + maxX) / 2, (minY + maxY) / 2, zoom)
}

// World point at the centre of the box for a view. Exported so the map's
// time-of-day palette can be based on what part of the world is in view.
export const centreOf = (v: View) => ({
  px: (0.5 - v.x) / v.zoom,
  py: (0.5 - v.y) / v.zoom,
})

// The view `t` (0..1) of the way from `a` to `b`, for camera animations. Zoom
// changes geometrically and the centre glides, so it feels like one move.
export function viewBetween(a: View, b: View, t: number): View {
  const ca = centreOf(a)
  const cb = centreOf(b)
  const zoom = a.zoom * (b.zoom / a.zoom) ** t
  return centredOn(
    ca.px + (cb.px - ca.px) * t,
    ca.py + (cb.py - ca.py) * t,
    zoom,
  )
}
