import { BadgeList } from './BadgeList'
import { DexView } from './DexView'
import { unlockedBadgeIds } from './badges'
import { FactList } from './FactList'
import { JournalList } from './JournalList'
import { useJournalContext } from './useJournalContext'
import { navigate, pick, useFullPath } from '../shared-lib/usePath'

const TABS = [
  { id: 'journal', label: 'Journal' },
  { id: 'dex', label: 'Dex' },
  { id: 'badges', label: 'Badges' },
  { id: 'facts', label: 'Facts' },
] as const
const TAB_IDS = TABS.map((t) => t.id)

// Journal, Dex, Badges and Facts views, reached from the map. The tab is the
// URL's second part ("/collection/dex"), so a reload stays on it; switching
// tabs replaces the history entry, so back returns to the map in one step.
// The switcher is plain toggle buttons, not an ARIA tablist, which would also
// need panels and arrow-key navigation.
// `path` is the whole URL path ("collection", tab, ...), read once by App
// (see usePath) so every level sees the same one.
export function Collection({ path }: { path: string[] }) {
  const { journal } = useJournalContext()
  const tab = pick(path, 1, TAB_IDS)
  // The Dex fills in its own section and chip (see DexView).
  useFullPath(path, [
    'collection',
    tab,
    ...(tab === 'dex' ? path.slice(2) : []),
  ])

  return (
    <section className="collection">
      <div className="collection-tabs">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            aria-pressed={tab === id}
            className={tab === id ? 'tab active' : 'tab'}
            onClick={() => navigate(['collection', id], { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'journal' && <JournalList entries={journal} />}
      {tab === 'dex' && <DexView journal={journal} path={path.slice(2)} />}
      {tab === 'badges' && (
        <BadgeList unlockedIds={unlockedBadgeIds(journal)} />
      )}
      {tab === 'facts' && <FactList journal={journal} />}
    </section>
  )
}
