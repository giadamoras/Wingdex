import { useState } from 'react'
import { BADGES } from './badges'
import { DetailDialog } from './DetailDialog'

// Every badge as a medallion: its icon and name only, so the grid stays light.
// Locked ones show their own icon faded to grey, a hint of what's to come,
// with a small lock; earned ones show nothing extra.
// Tapping one opens a pop-up with the description. `unlockedIds` is derived
// from the Journal by the caller (see badges.ts).
export function BadgeList({ unlockedIds }: { unlockedIds: string[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = BADGES.find((b) => b.id === openId)

  return (
    <>
      <ul className="badge-grid">
        {BADGES.map((badge) => {
          const unlocked = unlockedIds.includes(badge.id)
          return (
            <li key={badge.id}>
              <button
                className={unlocked ? 'medal unlocked' : 'medal locked'}
                aria-haspopup="dialog"
                onClick={() => setOpenId(badge.id)}
              >
                {/* The lock sits outside the disc, which is greyed when locked. */}
                <span className="medal-disc" aria-hidden="true">
                  <span className="medal-icon">{badge.icon}</span>
                  {!unlocked && <span className="medal-lock">🔒</span>}
                </span>
                <span className="medal-name">{badge.name}</span>
                {!unlocked && (
                  <span className="visually-hidden"> (locked)</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {open && (
        <DetailDialog
          key={open.id}
          icon={open.icon}
          title={open.name}
          onClose={() => setOpenId(null)}
        >
          <p>{open.description}</p>
          {/* Earned needs no label: only a locked badge says so. */}
          {!unlockedIds.includes(open.id) && (
            <p className="detail-dialog-status">🔒 Locked</p>
          )}
        </DetailDialog>
      )}
    </>
  )
}
