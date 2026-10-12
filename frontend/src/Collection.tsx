import { useState } from 'react'
import { BadgeList } from './BadgeList'
import { unlockedBadgeIds } from './badges'
import { FactList } from './FactList'
import { JournalList } from './JournalList'
import { useJournalContext } from './useJournalContext'

type Tab = 'journal' | 'badges' | 'facts'

const TABS: { id: Tab; label: string }[] = [
  { id: 'journal', label: 'Journal' },
  { id: 'badges', label: 'Badges' },
  { id: 'facts', label: 'Facts' },
]

// Journal, Badges and Facts views, reached from the map (simple view state
// in App.tsx, no router). The switcher is plain toggle buttons, not an ARIA
// tablist, which would also need panels and arrow-key navigation.
export function Collection() {
  const { journal } = useJournalContext()
  const [tab, setTab] = useState<Tab>('journal')

  return (
    <section className="collection">
      <div className="collection-tabs">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            aria-pressed={tab === id}
            className={tab === id ? 'tab active' : 'tab'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'journal' && <JournalList entries={journal} />}
      {tab === 'badges' && (
        <BadgeList unlockedIds={unlockedBadgeIds(journal)} />
      )}
      {tab === 'facts' && <FactList journal={journal} />}
    </section>
  )
}
