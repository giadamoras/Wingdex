import { aircraftShape, SILHOUETTES } from './aircraftSilhouette'

// Chunky plane silhouette pointing north (up), rotated to the flight's
// heading. Shape varies by aircraft category (see aircraftSilhouette.ts):
// body, extra parts (a nose propeller), the helicopter's rotor lines, then
// the circles (engines, tail rotor) on top. General aviation is mint.
export function PlaneIcon({
  heading,
  aircraftType,
}: {
  heading: number
  aircraftType: string | null // null (unknown) gets the default shape
}) {
  const { body, engines, parts, rotor, small } =
    SILHOUETTES[aircraftShape(aircraftType)]
  return (
    <svg
      className={small ? 'plane-icon small' : 'plane-icon'}
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${heading}deg)` }}
      aria-hidden="true"
    >
      <path d={body} />
      {parts?.map((d) => (
        <path key={d} d={d} />
      ))}
      {rotor && <path className="rotor" d={rotor} />}
      {engines?.map((e, i) => (
        <circle key={i} cx={e.cx} cy={e.cy} r={e.r} />
      ))}
    </svg>
  )
}
