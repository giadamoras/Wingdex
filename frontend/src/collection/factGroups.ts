import { FACTS, type FactKind } from '../card/facts'

// The Facts tab's groups, in display order, and the fact kinds each one
// gathers. Shared by the tab (FactList) and the mascot's line on it.
export const GROUPS: { name: string; kinds: FactKind[] }[] = [
  { name: 'Aircraft', kinds: ['type', 'family', 'category'] },
  { name: 'Airlines', kinds: ['airline'] },
  { name: 'Flying', kinds: ['altitude', 'phase'] },
  { name: 'Weather', kinds: ['weather'] },
  { name: 'Around the world', kinds: ['region', 'time'] },
]
// A Journal entry keeps only the text it showed, so a fact's kind is looked
// up by its text. One edited or removed from the pool since goes in "Other".
const KIND_OF_TEXT = new Map(FACTS.map((f) => [f.text, f.kind]))
export const OTHER = 'Other'

// The group a fact's text belongs to.
export function groupOf(fact: string): string {
  const kind = KIND_OF_TEXT.get(fact)
  return GROUPS.find((g) => kind && g.kinds.includes(kind))?.name ?? OTHER
}
