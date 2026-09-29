import { BADGES } from './badges'

// Every badge, locked or unlocked. `unlockedIds` is derived from the
// Journal by the caller (see badges.ts).
export function BadgeList({ unlockedIds }: { unlockedIds: string[] }) {
  return (
    <ul className="badge-list">
      {BADGES.map((badge) => {
        const unlocked = unlockedIds.includes(badge.id)
        return (
          <li
            key={badge.id}
            className={unlocked ? 'badge unlocked' : 'badge locked'}
          >
            <span className="badge-icon" aria-hidden="true">
              {unlocked ? '🏅' : '🔒'}
            </span>
            <div>
              <strong>{badge.name}</strong>
              <p>{badge.description}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
