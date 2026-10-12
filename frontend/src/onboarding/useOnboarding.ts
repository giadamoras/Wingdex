import { useEffect, useRef, useState } from 'react'
import { pickOnboardingTarget } from './onboardingTarget'
import { hasSeenOnboarding, markOnboardingSeen } from './onboardingSeen'
import type { Flight } from '../data/types'

export type OnboardingStep = 'greeting' | 'catch' | 'done'

const DONE_DISPLAY_MS = 5000 // long enough to notice the Collection nudge

// Runs once ever per device (gated by onboardingSeen.ts): a greeting, then a
// "try catching a plane" prompt, then a brief congratulation. Non-blocking -
// the map stays fully usable the whole time, and it can be skipped at any
// step. Completes on *any* catch during the "catch" step, not specifically
// the highlighted flight, so it stays forgiving.
export function useOnboarding(flights: Flight[] | null, journalLength: number) {
  const [step, setStep] = useState<OnboardingStep | null>(() =>
    hasSeenOnboarding() ? null : 'greeting',
  )
  // Journal length when "catch" started, so a catch already in the Journal
  // from a past session doesn't instantly finish this step.
  const catchStartLength = useRef(journalLength)
  // The highlighted flight, pinned once picked: planes move every poll, so
  // re-picking "nearest to the centre" each render made the ring hop around.
  const [pinnedId, setPinnedId] = useState<string | null>(null)

  useEffect(() => {
    if (step === 'catch' && journalLength > catchStartLength.current)
      setStep('done')
  }, [step, journalLength])

  useEffect(() => {
    if (step !== 'done') return
    const timer = setTimeout(() => {
      markOnboardingSeen()
      setStep(null)
    }, DONE_DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [step])

  // Pick a target when "catch" starts, and re-pick only if it leaves the feed.
  const stillThere = flights?.some((f) => f.id === pinnedId) ?? false
  const pickedId =
    step === 'catch' && !stillThere
      ? (pickOnboardingTarget(flights ?? [])?.id ?? null)
      : null
  if (pickedId !== null) setPinnedId(pickedId) // same pattern as App's snapshot

  return {
    step,
    targetId: step === 'catch' && stillThere ? pinnedId : pickedId,
    advance: () => {
      catchStartLength.current = journalLength
      setStep('catch')
    },
    dismiss: () => {
      markOnboardingSeen()
      setStep(null)
    },
  }
}
