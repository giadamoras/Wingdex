import { useState } from 'react'
import { BadgeList } from './BadgeList'
import { unlockedBadgeIds } from './badges'
import { FactList } from './FactList'
import { JournalList } from './JournalList'
import { useJournalContext } from './useJournalContext'

type Tab = 'journal' | 'badges' | 'facts'

// Journal, Badges and Facts tabs, reached from the map (simple view state
// in App.tsx, no router).
export function Collection() {
  const { journal } = useJournalContext()
  const [tab, setTab] = useState<Tab>('journal')

  return (
    <section className="collection">
      <div className="collection-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'journal'}
          className={tab === 'journal' ? 'tab active' : 'tab'}
          onClick={() => setTab('journal')}
        >
          Journal
        </button>
        <button
          role="tab"
          aria-selected={tab === 'badges'}
          className={tab === 'badges' ? 'tab active' : 'tab'}
          onClick={() => setTab('badges')}
        >
          Badges
        </button>
        <button
          role="tab"
          aria-selected={tab === 'facts'}
          className={tab === 'facts' ? 'tab active' : 'tab'}
          onClick={() => setTab('facts')}
        >
          Facts
        </button>
      </div>
      {tab === 'journal' && <JournalList entries={journal} />}
      {tab === 'badges' && (
        <BadgeList unlockedIds={unlockedBadgeIds(journal)} />
      )}
      {tab === 'facts' && <FactList journal={journal} />}
    </section>
  )
}
