import type { Quest } from './quest'

// Quest strip above the map; shows a stamp and concept fact once completed.
// `quest` is null until the first flights arrive and today's quest is picked.
export function QuestBanner({
  quest,
  done,
}: {
  quest: Quest | null
  done: boolean
}) {
  return (
    <section className="quest">
      {/* One row: label, title and (once done) the stamp on the right. */}
      <div className="quest-head">
        <span className="quest-label">Quest</span>
        <h2>{quest ? quest.title : "Finding today's quest..."}</h2>
        {done && <span className="stamp">Done!</span>}
      </div>
      {quest && done && <p className="quest-fact">{quest.conceptFact}</p>}
    </section>
  )
}
