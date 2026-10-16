import { aircraftShape, SILHOUETTES } from './aircraftSilhouette'

// Chunky plane silhouette pointing north (up), rotated to the flight's
// heading. Shape varies by aircraft category (see aircraftSilhouette.ts).
export function PlaneIcon({
  heading,
  aircraftType,
}: {
  heading: number
  aircraftType: string | null // null (unknown) gets the default shape
}) {
  const { body, engines } = SILHOUETTES[aircraftShape(aircraftType)]
  return (
    <svg
      className="plane-icon"
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${heading}deg)` }}
      aria-hidden="true"
    >
      <path d={body} />
      {engines?.map((e, i) => (
        <circle key={i} cx={e.cx} cy={e.cy} r={e.r} />
      ))}
    </svg>
  )
}
