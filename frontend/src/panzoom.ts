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

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n))

// Keeps the zoom in range and the world covering the whole box (no gaps).
export function clampView({ zoom, x, y }: View): View {
  const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM)
  return { zoom: z, x: clamp(x, 1 - z, 0), y: clamp(y, 1 - z, 0) }
}

// Zooms by `factor` while keeping the point under (fx, fy) in place.
export function zoomAt(view: View, factor: number, fx: number, fy: number) {
  const zoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM)
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
