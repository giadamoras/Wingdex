// Chunky plane silhouette pointing north (up), rotated to the flight's heading.
export function PlaneIcon({ heading }: { heading: number }) {
  return (
    <svg
      className="plane-icon"
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${heading}deg)` }}
      aria-hidden="true"
    >
      <path d="M12 2c1 0 1.6 1 1.6 2.4V9L22 13.6V16l-8.4-2.2V19l2.2 1.6V22L12 21l-3.8 1v-1.4l2.2-1.6v-5.2L2 16v-2.4L10.4 9V4.4C10.4 3 11 2 12 2z" />
    </svg>
  )
}
