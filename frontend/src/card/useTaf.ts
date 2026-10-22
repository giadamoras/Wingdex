import { useEffect, useState } from 'react'
import { fetchTaf } from '../data/api'
import type { Taf } from '../data/types'

// idle: no destination. loading: waiting for the backend. ready: a forecast.
// none: the airport issues none, or the lookup failed (the section just hides).
export type TafStatus = 'idle' | 'loading' | 'ready' | 'none'

// How long an answer is reused. The backend caches each airport for the same
// time, so asking again after this is cheap and catches an amended forecast.
export const TAF_TTL_MS = 30 * 60 * 1000

// Answers by airport, shared by every card: reopening a flight to the same
// destination, or another flight to it, shows the forecast at once.
const answers = new Map<string, { taf: Taf | null; at: number }>()

// For tests: forget every answer.
export function clearTafCache() {
  answers.clear()
}

const freshAnswer = (icao: string) => {
  const answer = answers.get(icao)
  return answer && Date.now() - answer.at < TAF_TTL_MS ? answer : undefined
}

// The destination's forecast. A failed lookup is not kept, so the next card
// tries again; closing the card cancels a lookup in progress.
export function useTaf(icao: string | null): {
  status: TafStatus
  taf: Taf | null
} {
  // Bumped when an answer arrives, to show it.
  const [, setVersion] = useState(0)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    if (icao === null || freshAnswer(icao)) return
    const controller = new AbortController()
    fetchTaf(icao, controller.signal)
      .then((taf) => {
        answers.set(icao, { taf, at: Date.now() })
        setVersion((v) => v + 1)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(icao)
      })
    return () => controller.abort()
  }, [icao])

  if (icao === null) return { status: 'idle', taf: null }
  const answer = freshAnswer(icao)
  if (answer) return { status: answer.taf ? 'ready' : 'none', taf: answer.taf }
  return { status: failed === icao ? 'none' : 'loading', taf: null }
}
