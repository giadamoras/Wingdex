import { useEffect, useState } from 'react'
import type { Flight } from '../data/types'

// A replay is: the camera fits the route, the ghost flies origin ->
// destination, then the ghost and its trail fade out.
export const FIT_MS = 600
export const LAND_MS = 600

// About 1 s of replay per hour of flight, kept between 3 and 10 s.
const FLY_MS_PER_HOUR = 1000
const MIN_FLY_MS = 3000
const MAX_FLY_MS = 10000
export function flyMs(durationMin: number): number {
  const ms = (durationMin / 60) * FLY_MS_PER_HOUR
  return Math.min(MAX_FLY_MS, Math.max(MIN_FLY_MS, ms))
}

export type ReplayPhase = 'fitting' | 'flying' | 'landing' | 'done'

// Where a replay is after `elapsed` ms: its phase and the ghost's progress (0..1).
export function replayAt(
  elapsed: number,
  durationMin: number,
): { phase: ReplayPhase; progress: number } {
  const fly = flyMs(durationMin)
  if (elapsed < FIT_MS) return { phase: 'fitting', progress: 0 }
  if (elapsed < FIT_MS + fly)
    return { phase: 'flying', progress: (elapsed - FIT_MS) / fly }
  if (elapsed < FIT_MS + fly + LAND_MS) return { phase: 'landing', progress: 1 }
  return { phase: 'done', progress: 1 }
}

export interface ReplayState {
  flight: Flight // snapshot at start: the route doesn't change
  startedAt: number // Date.now() when started, also identifies this replay
  phase: ReplayPhase
  progress: number
}

// Runs one replay at a time, ticking every animation frame while active.
// It also runs under reduced motion: the journey is what the button asks for,
// and only the camera fit (done by the map) becomes instant.
export function useReplay() {
  const [run, setRun] = useState<{ flight: Flight; startedAt: number } | null>(
    null,
  )
  const [now, setNow] = useState(0)
  // Last flight replayed, so its button can say "Replay journey".
  const [playedId, setPlayedId] = useState<string | null>(null)

  useEffect(() => {
    if (!run) return
    let frame = 0
    const tick = () => {
      const t = Date.now()
      const { phase } = replayAt(
        t - run.startedAt,
        run.flight.duration_min ?? 0,
      )
      if (phase === 'done') setRun(null)
      else {
        setNow(t)
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [run])

  const replay: ReplayState | null = run && {
    ...run,
    ...replayAt(Math.max(0, now - run.startedAt), run.flight.duration_min ?? 0),
  }

  return {
    replay,
    playedId,
    start: (flight: Flight) => {
      const t = Date.now()
      setNow(t)
      setRun({ flight, startedAt: t })
      setPlayedId(flight.id)
    },
    stop: () => setRun(null),
  }
}
