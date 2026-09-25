import { QUEST } from './quest'

// Quest strip above the map; shows a stamp and concept fact once completed.
export function QuestBanner({ done }: { done: boolean }) {
  return (
    <section className="quest">
      {/* One row: label, title and (once done) the stamp on the right. */}
      <div className="quest-head">
        <span className="quest-label">Quest</span>
        <h2>{QUEST.title}</h2>
        {done && <span className="stamp">Done!</span>}
      </div>
      {done && <p className="quest-fact">{QUEST.conceptFact}</p>}
    </section>
  )
}
