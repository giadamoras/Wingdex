import { useMemo } from 'react'
import type { Shape, View } from './panzoom'
import { COUNTRIES } from './countryData'
import { project } from './projection'

// Font size in real screen pixels (constant, like the plane icons - see
// .country-label's scale(1/--zoom) - not scaled with the map like the land).
// Sized by LABELRANK (2 = major country, 7 = minor), so bigger/more
// prominent countries get bigger text, like a real atlas.
const FONT_PX: Record<number, number> = {
  2: 13,
  3: 11.5,
  4: 10.5,
  5: 9.5,
  6: 9,
  7: 8.5,
}

// Average character width as a fraction of font size, for a rough text-width
// estimate without measuring the DOM (Fredoka is fairly wide/rounded).
const CHAR_WIDTH_FACTOR = 0.62

// Border rings, precomputed once like WorldLand's land shapes: outer rings
// only (no holes), so a coastal border segment overlaps the coastline itself
// - normal on a political map, not a bug.
const borderRings = COUNTRIES.flatMap((c) =>
  c.rings.map((ring) =>
    ring
      .map(([lon, lat]) => {
        const { x, y } = project(lat, lon)
        return `${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(' '),
  ),
)

// Each country's label position (percent of the map box, like a plane's
// left/top) and font size, precomputed once and pre-sorted so the most
// important countries claim space first in the collision pass below.
const labelPoints = COUNTRIES.map((c) => {
  const { x, y } = project(c.label[1], c.label[0])
  return { name: c.name, x, y, fontPx: FONT_PX[c.labelRank] ?? 9 }
}).sort((a, b) => b.fontPx - a.fontPx) // biggest (most important) first

// Country borders (always shown) and name labels, drawn over the land.
// Labels are a constant screen size, like the plane icons, not scaled with
// the map - which matters for decluttering: since a label's pixel size stays
// fixed while zooming in grows the pixel gap between two countries' anchors,
// crowded labels that collide at a low zoom can find room once you zoom in.
// `mapWidthPx` and `mapHeightPx` (the map box's actual rendered size) turn the
// fractional view into real pixel positions for that collision check.
export function CountryBorders({
  view,
  shape,
  mapWidthPx,
  mapHeightPx,
}: {
  view: View
  shape: Shape
  mapWidthPx: number
  mapHeightPx: number
}) {
  const visible = useMemo(() => {
    if (mapWidthPx === 0 || mapHeightPx === 0) return []
    const placed: {
      left: number
      right: number
      top: number
      bottom: number
    }[] = []
    const shown: typeof labelPoints = []
    for (const p of labelPoints) {
      // Mirrors FlightMap.tsx's worldStyle transform: translate(view.x,
      // view.y) then scale the world to zoom * lx by zoom * ly box sizes, from
      // the box's top-left corner.
      const sx = (view.x + (p.x / 100) * view.zoom * shape.lx) * mapWidthPx
      const sy = (view.y + (p.y / 100) * view.zoom * shape.ly) * mapHeightPx
      const halfW = (p.name.length * p.fontPx * CHAR_WIDTH_FACTOR) / 2 + 3
      const halfH = p.fontPx / 2 + 2
      const box = {
        left: sx - halfW,
        right: sx + halfW,
        top: sy - halfH,
        bottom: sy + halfH,
      }
      const collides = placed.some(
        (o) =>
          box.left < o.right &&
          box.right > o.left &&
          box.top < o.bottom &&
          box.bottom > o.top,
      )
      if (!collides) {
        placed.push(box)
        shown.push(p)
      }
    }
    return shown
  }, [view, shape, mapWidthPx, mapHeightPx])

  return (
    <>
      <svg
        className="borders"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {borderRings.map((points, i) => (
          <polygon key={i} className="border" points={points} />
        ))}
      </svg>
      {visible.map((p) => (
        <span
          key={p.name}
          className="country-label"
          style={{ left: `${p.x}%`, top: `${p.y}%`, fontSize: `${p.fontPx}px` }}
        >
          {p.name}
        </span>
      ))}
    </>
  )
}
