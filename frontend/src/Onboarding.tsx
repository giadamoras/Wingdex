import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Mascot, type MascotMood } from './Mascot'
import { prefersReducedMotion } from './replay'
import type { OnboardingStep } from './useOnboarding'

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 22 }
const TYPE_MS = 25 // per character

// How much of `text` has been "typed" so far. Progress is stored with the text
// it belongs to, so a new line starts from 0 straight away (no flash of the
// old count). `instant` (reduced motion) shows everything at once.
function useTypewriter(text: string, instant: boolean) {
  const [progress, setProgress] = useState({ text, count: 0 })
  useEffect(() => {
    if (instant) return
    const timer = setInterval(() => {
      setProgress((p) => {
        const count = (p.text === text ? p.count : 0) + 1
        if (count >= text.length) clearInterval(timer)
        return { text, count }
      })
    }, TYPE_MS)
    return () => clearInterval(timer)
  }, [text, instant])
  const count = instant
    ? text.length
    : progress.text === text
      ? progress.count
      : 0
  return { typed: text.slice(0, count), rest: text.slice(count) }
}

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

// The mascot stays docked bottom-left for the whole flow and "says" each step
// in a speech bubble beside it. While a card is open the bubble
// shrinks to a click-through hint (see .hint in index.css), because its fixed
// position could otherwise block the card's own Catch/journey buttons. Built with Framer Motion, except
// under reduced motion, where it uses plain <div>s with no transitions.
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
  const reduced = prefersReducedMotion()
  const line = lineFor(step ?? 'greeting', hasTarget, cardOpen)
  const { typed, rest } = useTypewriter(line, reduced)

  const mood: MascotMood =
    step === 'done' ? 'cheer' : rest !== '' ? 'talk' : 'idle'

  const bubbleContent = step && (
    <>
      <div className="onboarding-body">
        {/* The untyped remainder stays in the layout (transparent) so the
            bubble doesn't resize as it types and screen readers get the line. */}
        <p>
          {rest === '' ? (
            typed
          ) : (
            <>
              {typed}
              <span className="onboarding-pending">{rest}</span>
            </>
          )}
        </p>
        {step === 'greeting' && !cardOpen && (
          <button className="onboarding-btn" onClick={onAdvance}>
            Got it!
          </button>
        )}
      </div>
      {!cardOpen && (
        <button
          className="onboarding-close"
          onClick={onDismiss}
          aria-label="Dismiss onboarding"
        >
          ×
        </button>
      )}
    </>
  )
  // With a card open the bubble is a click-through hint (no buttons), so it
  // can never block the card's own Catch/journey buttons.
  const bubbleClass = cardOpen ? 'onboarding-bubble hint' : 'onboarding-bubble'

  if (reduced)
    return (
      step && (
        <div className="onboarding" role="status">
          <Mascot className="onboarding-mascot" mood={mood} />
          {step && <div className={bubbleClass}>{bubbleContent}</div>}
        </div>
      )
    )
  return (
    <AnimatePresence>
      {step && (
        <motion.div
          className="onboarding"
          role="status"
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={SPRING}
        >
          <Mascot className="onboarding-mascot" mood={mood} />
          <AnimatePresence mode="wait">
            {step && (
              <motion.div
                key={`${step}-${cardOpen}`}
                className={bubbleClass}
                style={{ originX: 0, originY: 1 }}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={SPRING}
              >
                {bubbleContent}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
