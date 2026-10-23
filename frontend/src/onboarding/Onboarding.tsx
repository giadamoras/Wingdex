import { MascotDock } from '../mascot/MascotDock'
import type { OnboardingStep } from './useOnboarding'

function lineFor(step: OnboardingStep, hasTarget: boolean, cardOpen: boolean) {
  // A card is open before the catch: point at its button instead.
  if (cardOpen && step !== 'done')
    return 'Nice! Hit Catch to add it to your Journal.'
  if (step === 'greeting')
    return 'Welcome aboard! Tap a plane on the map to see it up close.'
  if (step === 'catch')
    return hasTarget
      ? 'Try catching that circled plane - or any other you like!'
      : 'Tap any plane on the map to catch it!'
  return 'Nice catch! Peek at your Collection to see it.'
}

// The first-run flow, said by the docked mascot (MascotDock) step by step.
// While a card is open the bubble is a click-through hint with no buttons.
export function Onboarding({
  step,
  cardOpen,
  hasTarget,
  onAdvance,
  onDismiss,
}: {
  step: OnboardingStep | null
  cardOpen: boolean
  hasTarget: boolean
  onAdvance: () => void
  onDismiss: () => void
}) {
  const line = step && {
    key: step,
    text: lineFor(step, hasTarget, cardOpen),
    cheer: step === 'done',
    action:
      step === 'greeting'
        ? { label: 'Got it!', onClick: onAdvance }
        : undefined,
  }
  return (
    <MascotDock
      line={line}
      hint={cardOpen}
      onClose={onDismiss}
      closeLabel="Dismiss onboarding"
    />
  )
}
