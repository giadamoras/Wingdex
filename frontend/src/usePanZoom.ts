import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, MouseEvent, RefObject } from 'react'
import {
  centreOf,
  centredOn,
  panBy,
  viewBetween,
  zoomAt,
  type Shape,
  type View,
} from './panzoom'

// Pixels a pointer must move before a press counts as a drag, not a click.
const DRAG_THRESHOLD_PX = 4
const BUTTON_ZOOM = 1.6

// Slow start and end for camera moves.
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2

// Pan/zoom gestures for the map box in `ref`: drag to pan, wheel to zoom at
// the cursor, two-finger pinch, plus helpers for +/- and reset buttons and
// animated camera moves. `startView` is the view the map opens with and the
// reset button returns to, for the box's `shape`. When the shape changes (it is
// only known after the first layout, and changes when the phone is rotated), a
// map nobody has moved yet reopens on the new start view, and one that has been
// moved keeps the world point at its centre and the same span of longitudes in
// view (the zoom changes by the shapes' ratio), so rotating the phone does not
// lose your place.
export function usePanZoom(
  ref: RefObject<HTMLElement | null>,
  shape: Shape,
  startView: (shape: Shape) => View,
) {
  const [view, setView] = useState(() => startView(shape))
  // Latest shape, for the event handlers and animations that outlive a render.
  const shapeRef = useRef(shape)
  // True once the user (or a replay) has moved the camera.
  const moved = useRef(false)
  // Active pointers (mouse or fingers) and where each one last was.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  // True once the current gesture moved far enough to be a drag.
  const dragged = useRef(false)
  const travelled = useRef(0)
  // Latest view, so an animation can start from it, and the running animation.
  const latest = useRef(view)
  const anim = useRef(0)

  useEffect(() => {
    latest.current = view
  }, [view])
  useEffect(() => {
    const before = shapeRef.current
    if (before === shape) return
    shapeRef.current = shape
    setView((v) => {
      if (!moved.current) return startView(shape)
      const { px, py } = centreOf(v, before)
      const grow = Math.max(before.lx, before.ly) / Math.max(shape.lx, shape.ly)
      return centredOn(px, py, v.zoom * grow, shape)
    })
    // startView is a module-level function; only a new shape matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape])
  useEffect(() => () => cancelAnimationFrame(anim.current), [])

  // Any user gesture takes over from a running camera animation.
  const stopAnimation = () => cancelAnimationFrame(anim.current)

  // Moves the camera to `target` over `ms` (instantly if 0).
  const animateTo = (target: View, ms: number) => {
    stopAnimation()
    moved.current = true
    if (ms <= 0) return setView(target)
    const from = latest.current
    const start = Date.now()
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / ms)
      setView(viewBetween(from, target, easeInOut(t), shapeRef.current))
      if (t < 1) anim.current = requestAnimationFrame(step)
    }
    anim.current = requestAnimationFrame(step)
  }

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
      cancelAnimationFrame(anim.current)
      const r = el.getBoundingClientRect()
      const fx = (e.clientX - r.left) / r.width
      const fy = (e.clientY - r.top) / r.height
      moved.current = true
      setView((v) =>
        zoomAt(v, Math.exp(-e.deltaY * 0.002), fx, fy, shapeRef.current),
      )
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref])

  const onPointerDown = (e: PointerEvent) => {
    stopAnimation()
    // A new first finger means no other finger is down: forget any left over
    // from a lost pointerup (e.g. while the page froze), or this touch would
    // count as a pinch.
    if (e.isPrimary) pointers.current.clear()
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
        moved.current = true
        setView((v) => panBy(v, dx, dy, shapeRef.current))
      }
    } else if (pointers.current.size === 2) {
      // Pinch: zoom by how much the finger distance changed, at their midpoint.
      const [other] = [...pointers.current].filter(([id]) => id !== e.pointerId)
      const o = other[1]
      const before = Math.hypot(prev.x - o.x, prev.y - o.y)
      const after = Math.hypot(e.clientX - o.x, e.clientY - o.y)
      if (before > 0) {
        const { fx, fy } = toBox((e.clientX + o.x) / 2, (e.clientY + o.y) / 2)
        moved.current = true
        setView((v) => zoomAt(v, after / before, fx, fy, shapeRef.current))
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
    zoomIn: () => {
      stopAnimation()
      moved.current = true
      setView((v) => zoomAt(v, BUTTON_ZOOM, 0.5, 0.5, shapeRef.current))
    },
    zoomOut: () => {
      stopAnimation()
      moved.current = true
      setView((v) => zoomAt(v, 1 / BUTTON_ZOOM, 0.5, 0.5, shapeRef.current))
    },
    reset: () => {
      animateTo(startView(shapeRef.current), 0)
      moved.current = false
    },
    animateTo,
  }
}
