import { CountPill } from './CountPill'
import { GROUPS, groupOf, OTHER } from './factGroups'
import type { JournalEntry } from '../data/types'

// Every distinct fact learned so far, grouped by what it is about, each group
// in the order first caught. The Journal is append-only in catch order, and
// Set preserves insertion order, so deduplicating this way needs no extra
// bookkeeping.
export function FactList({ journal }: { journal: JournalEntry[] }) {
  const facts = [...new Set(journal.map((e) => e.fact))]
  const groups = [...GROUPS.map((g) => g.name), OTHER]
    .map((name) => ({ name, facts: facts.filter((f) => groupOf(f) === name) }))
    .filter((g) => g.facts.length > 0)

  return (
    <section className="facts">
      {facts.length === 0 ? (
        <p className="facts-empty">
          No facts yet. Catch a flight to learn one!
        </p>
      ) : (
        <>
          <CountPill
            icon="💡"
            count={facts.length}
            noun={facts.length === 1 ? 'fact' : 'facts'}
          />
          {groups.map((group) => (
            <div key={group.name}>
              <h2 className="facts-heading">
                {group.name}{' '}
                <span className="facts-count">{group.facts.length}</span>
              </h2>
              <ul>
                {group.facts.map((fact) => (
                  <li key={fact} className="fact-entry">
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  )
}
