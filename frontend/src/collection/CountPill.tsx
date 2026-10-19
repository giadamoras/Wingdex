// A small icon-and-number pill on the right above a Collection list ("✈️ 12"),
// in place of a heading: the tab already names the list. The noun is for
// screen readers only ("12 catches").
export function CountPill({
  icon,
  count,
  noun,
}: {
  icon: string
  count: number
  noun: string
}) {
  return (
    <div className="count-row">
      <p className="pill">
        <span aria-hidden="true">{icon}</span> {count}
        <span className="visually-hidden"> {noun}</span>
      </p>
    </div>
  )
}
