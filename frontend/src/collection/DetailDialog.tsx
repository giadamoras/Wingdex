import { useEffect, useId, useRef, type ReactNode } from 'react'

// The pop-up a tapped badge or Dex tile opens: centred over a dimmed page and
// closed with OK, like a message that wants acknowledging. A native <dialog>
// opened with showModal(), so the browser traps focus inside it, closes it on
// Escape and gives focus back to the tile afterwards. Clicking the dimmed
// backdrop closes it too. The parent mounts it to open it and unmounts it in
// onClose.
export function DetailDialog({
  icon,
  title,
  onClose,
  children,
}: {
  icon: ReactNode
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

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
        <span className="detail-dialog-icon" aria-hidden="true">
          {icon}
        </span>
        <h2 id={titleId}>{title}</h2>
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
