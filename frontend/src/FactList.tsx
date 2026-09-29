import type { JournalEntry } from './types'

// Every distinct fact learned so far, in the order first caught. The
// Journal is append-only in catch order, and Set preserves insertion
// order, so deduplicating this way needs no extra bookkeeping.
export function FactList({ journal }: { journal: JournalEntry[] }) {
  const facts = [...new Set(journal.map((e) => e.fact))]

  return (
    <section className="facts">
      <h2>Facts ({facts.length})</h2>
      {facts.length === 0 ? (
        <p className="facts-empty">
          No facts yet. Catch a flight to learn one!
        </p>
      ) : (
        <ul>
          {facts.map((fact) => (
            <li key={fact} className="fact-entry">
              {fact}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
