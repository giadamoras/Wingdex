import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Mascot, type MascotMood } from '../shared-ui/Mascot'
import { prefersReducedMotion } from '../shared-lib/reducedMotion'
import { springIn } from '../shared-lib/springIn'

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

// One thing the mascot says. `key` tells lines apart for the bubble's
// entrance (two catches can say the same words). `action` is a button under
// the words ("Got it!", "Show me").
export interface DockLine {
  key: string
  text: string
  cheer?: boolean // happy ^ ^ eyes once typed
  action?: { label: string; onClick: () => void }
}

// The mascot docked bottom-left with a speech bubble beside it, typing its
// line. Used by onboarding and the map's chatter (useMascotChatter). With
// `hint` (a card is open) the bubble shrinks to a click-through hint with no
// buttons (see .hint in styles/mascot-dock.css), because its fixed position
// could otherwise block the card's own Catch and journey buttons. Reduced
// motion turns off the enter and exit animations and the typing.
export function MascotDock({
  line,
  hint,
  onClose,
  closeLabel,
}: {
  line: DockLine | null
  hint: boolean
  onClose: () => void
  closeLabel: string
}) {
  const reduced = prefersReducedMotion()
  const { typed, rest } = useTypewriter(line?.text ?? '', reduced)
  const mood: MascotMood = rest !== '' ? 'talk' : line?.cheer ? 'cheer' : 'idle'

  return (
    <AnimatePresence>
      {line && (
        <motion.div
          className="dock"
          role="status"
          {...springIn(
            { opacity: 0, y: 20, scale: 0.9 },
            { opacity: 1, y: 0, scale: 1 },
            { opacity: 0, y: 20, scale: 0.9 },
          )}
        >
          <Mascot className="dock-mascot" mood={mood} />
          <AnimatePresence mode="wait">
            <motion.div
              key={`${line.key}-${hint}`}
              className={hint ? 'dock-bubble hint' : 'dock-bubble'}
              style={{ originX: 0, originY: 1 }}
              {...springIn(
                { opacity: 0, scale: 0.7 },
                { opacity: 1, scale: 1 },
                { opacity: 0, scale: 0.7 },
              )}
            >
              <div className="dock-body">
                {/* The untyped remainder stays in the layout (transparent) so
                    the bubble doesn't resize as it types and screen readers
                    get the line. */}
                <p>
                  {rest === '' ? (
                    typed
                  ) : (
                    <>
                      {typed}
                      <span className="dock-pending">{rest}</span>
                    </>
                  )}
                </p>
                {line.action && !hint && (
                  <button className="dock-btn" onClick={line.action.onClick}>
                    {line.action.label}
                  </button>
                )}
              </div>
              {!hint && (
                <button
                  className="dock-close"
                  onClick={onClose}
                  aria-label={closeLabel}
                >
                  ×
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
