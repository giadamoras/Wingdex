import { useEffect, useId, useRef, type ReactNode } from 'react'
import { prefersReducedMotion } from '../shared-lib/reducedMotion'

// The pop-up a tapped badge, Dex tile, Journal stamp or the card's weather
// button opens: centred over a dimmed page and
// closed with OK, like a message that wants acknowledging. A native <dialog>
// opened with showModal(), so the browser traps focus inside it, closes it on
// Escape and gives focus back to the tile afterwards. Clicking the dimmed
// backdrop closes it too. The parent mounts it to open it and unmounts it in
// onClose. When `turnKey` changes, the card turns over: it swings in from
// edge-on with its new side (the weather pop-up's code side).
export function DetailDialog({
  icon,
  title,
  onClose,
  turnKey,
  children,
}: {
  icon: ReactNode // none: the content brings its own
  title: string
  onClose: () => void
  turnKey?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const shownKey = useRef(turnKey)

  // The turn, with the Web Animations API (not in jsdom, so it is optional)
  // rather than a CSS class, so it replays on every change. Not on opening,
  // which has its own pop, and not under reduced motion.
  useEffect(() => {
    if (turnKey === shownKey.current) return
    shownKey.current = turnKey
    // The button that turned it is gone with the old side: focus goes to
    // the title, the top of the new side, instead of being lost.
    document.getElementById(titleId)?.focus()
    if (prefersReducedMotion()) return
    ref.current?.animate?.(
      [
        { transform: 'perspective(900px) rotateY(-90deg)' },
        { transform: 'perspective(900px) rotateY(0deg)' },
      ],
      { duration: 380, easing: 'cubic-bezier(0.34, 1.3, 0.64, 1)' },
    )
  }, [turnKey, titleId])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    // The dialog element itself is only hit on the backdrop: its content
    // fills it edge to edge (see .detail-dialog-body). A mouse shortcut on
    // top of Escape and OK, so it is a plain listener rather than a JSX
    // handler, which the accessibility lint would want a key handler for.
    const onClick = (e: MouseEvent) => {
      if (e.target === dialog) dialog.close()
    }
    dialog.addEventListener('click', onClick)
    return () => dialog.removeEventListener('click', onClick)
  }, [])

  return (
    <dialog
      ref={ref}
      className="detail-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
    >
      <div className="detail-dialog-body">
        {icon && (
          <span className="detail-dialog-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <h2 id={titleId} tabIndex={-1}>
          {title}
        </h2>
        {children}
        <button
          className="detail-dialog-ok"
          onClick={() => ref.current?.close()}
          autoFocus
        >
          OK
        </button>
      </div>
    </dialog>
  )
}
