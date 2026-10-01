import { Mascot } from './Mascot'
import type { Quest } from './quest'
import { Stamp } from './Stamp'

// Quest strip above the map; shows a stamp and concept fact once completed.
// `quest` is null until the first flights arrive and today's quest is picked.
// The mascot delivers the completion fact - a once-a-day "bigger celebration"
// moment, unlike the per-catch fact on every card, so it doesn't crowd the
// banner itself (which stays mascot-free).
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
        {done && <Stamp>Done!</Stamp>}
      </div>
      {quest && done && (
        <div className="quest-fact-row">
          <Mascot className="quest-mascot" />
          <p className="quest-fact">{quest.conceptFact}</p>
        </div>
      )}
    </section>
  )
}
