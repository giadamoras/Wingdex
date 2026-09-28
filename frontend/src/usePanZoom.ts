import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, MouseEvent, RefObject } from 'react'
import { panBy, zoomAt, type View } from './panzoom'

// Pixels a pointer must move before a press counts as a drag, not a click.
const DRAG_THRESHOLD_PX = 4
const BUTTON_ZOOM = 1.6

// Pan/zoom gestures for the map box in `ref`: drag to pan, wheel to zoom at
// the cursor, two-finger pinch, plus helpers for +/- and reset buttons.
export function usePanZoom(ref: RefObject<HTMLElement | null>, initial: View) {
  const [view, setView] = useState(initial)
  // Active pointers (mouse or fingers) and where each one last was.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  // True once the current gesture moved far enough to be a drag.
  const dragged = useRef(false)
  const travelled = useRef(0)

  // Converts client pixels to fractions of the map box.
  const toBox = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect()
    return {
      fx: (clientX - r.left) / r.width,
      fy: (clientY - r.top) / r.height,
    }
  }

  // Wheel zoom needs a non-passive listener so it can stop the page scrolling,
  // which React's onWheel prop can't do.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const fx = (e.clientX - r.left) / r.width
      const fy = (e.clientY - r.top) / r.height
      setView((v) => zoomAt(v, Math.exp(-e.deltaY * 0.002), fx, fy))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref])

  const onPointerDown = (e: PointerEvent) => {
    if (pointers.current.size === 0) {
      dragged.current = false
      travelled.current = 0
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }

  const onPointerMove = (e: PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const r = ref.current!.getBoundingClientRect()

    if (pointers.current.size === 1) {
      travelled.current += Math.hypot(e.clientX - prev.x, e.clientY - prev.y)
      if (!dragged.current && travelled.current > DRAG_THRESHOLD_PX) {
        dragged.current = true
        // Capture only once dragging, so a plain click still reaches the plane.
        ref.current!.setPointerCapture(e.pointerId)
      }
      if (dragged.current) {
        const dx = (e.clientX - prev.x) / r.width
        const dy = (e.clientY - prev.y) / r.height
        setView((v) => panBy(v, dx, dy))
      }
    } else if (pointers.current.size === 2) {
      // Pinch: zoom by how much the finger distance changed, at their midpoint.
      const [other] = [...pointers.current].filter(([id]) => id !== e.pointerId)
      const o = other[1]
      const before = Math.hypot(prev.x - o.x, prev.y - o.y)
      const after = Math.hypot(e.clientX - o.x, e.clientY - o.y)
      if (before > 0) {
        const { fx, fy } = toBox((e.clientX + o.x) / 2, (e.clientY + o.y) / 2)
        setView((v) => zoomAt(v, after / before, fx, fy))
      }
      dragged.current = true
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }

  const onPointerUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId)
  }

  // Swallows the click that ends a drag, so it doesn't select or deselect.
  const onClickCapture = (e: MouseEvent) => {
    if (dragged.current) {
      e.stopPropagation()
      dragged.current = false
    }
  }

  return {
    view,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClickCapture,
    },
    zoomIn: () => setView((v) => zoomAt(v, BUTTON_ZOOM, 0.5, 0.5)),
    zoomOut: () => setView((v) => zoomAt(v, 1 / BUTTON_ZOOM, 0.5, 0.5)),
    reset: () => setView(initial),
  }
}
