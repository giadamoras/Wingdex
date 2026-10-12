import { Mascot } from '../shared-ui/Mascot'
import type { Quest } from './quest'
import { Stamp } from '../shared-ui/Stamp'

// Quest strip above the map; shows a stamp and concept fact once completed.
// `quest` is null until the first flights arrive and today's quest is picked;
// `searching` tells that wait from a loaded feed that no quest can use, and
// `feedDown` (the first load failed) stops the wait from looking like progress.
// The mascot delivers the completion fact - a once-a-day "bigger celebration"
// moment, unlike the per-catch fact on every card, so it doesn't crowd the
// banner itself (which stays mascot-free).
export function QuestBanner({
  quest,
  done,
  searching,
  feedDown,
}: {
  quest: Quest | null
  done: boolean
  searching: boolean
  feedDown: boolean
}) {
  return (
    <section className="quest">
      {/* One row: label, title and (once done) the stamp on the right. */}
      <div className="quest-head">
        <span className="quest-label">Quest</span>
        <h2>
          {quest
            ? quest.title
            : feedDown
              ? "Today's quest will appear once flights load."
              : searching
                ? "Finding today's quest..."
                : 'Looks like today is a rest day, feel free to catch anything or nothing at all!'}
        </h2>
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
