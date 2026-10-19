import { FACTS, type FactKind } from '../card/facts'
import { CountPill } from './CountPill'
import type { JournalEntry } from '../data/types'

// The fact groups, in display order, and the fact kinds each one gathers.
const GROUPS: { name: string; kinds: FactKind[] }[] = [
  { name: 'Aircraft', kinds: ['type', 'family', 'category'] },
  { name: 'Airlines', kinds: ['airline'] },
  { name: 'Flying', kinds: ['altitude', 'phase'] },
  { name: 'Weather', kinds: ['weather'] },
  { name: 'Around the world', kinds: ['region', 'time'] },
]
// A Journal entry keeps only the text it showed, so a fact's kind is looked
// up by its text. One edited or removed from the pool since goes in "Other".
const KIND_OF_TEXT = new Map(FACTS.map((f) => [f.text, f.kind]))
const OTHER = 'Other'

// Every distinct fact learned so far, grouped by what it is about, each group
// in the order first caught. The Journal is append-only in catch order, and
// Set preserves insertion order, so deduplicating this way needs no extra
// bookkeeping.
export function FactList({ journal }: { journal: JournalEntry[] }) {
  const facts = [...new Set(journal.map((e) => e.fact))]
  const groupOf = (fact: string) => {
    const kind = KIND_OF_TEXT.get(fact)
    return GROUPS.find((g) => kind && g.kinds.includes(kind))?.name ?? OTHER
  }
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
