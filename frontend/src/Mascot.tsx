// The onboarding/quest-completion mascot: a chibi cat pilot, cropped like a
// passport photo bust to tie into the card's own "Flight Passport" theme.
// No idle animation, only the entrance transition its callers apply. `mood`
// swaps the face: 'talk' opens the mouth, 'cheer' adds happy ^ ^ eyes.
export type MascotMood = 'idle' | 'talk' | 'cheer'

export function Mascot({
  className,
  mood = 'idle',
}: {
  className?: string
  mood?: MascotMood
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      role="img"
      aria-label="The Airspace Explorer mascot: a cat pilot"
    >
      {/* Shoulders/body, cropped at the frame's bottom edge like a photo bust. */}
      <path
        d="M20 100 C20 78 33 68 50 68 C67 68 80 78 80 100 Z"
        className="mascot-fur"
      />
      {/* Scarf, with a small flowing tail to one side. */}
      <path
        d="M30 70 C38 78 62 78 70 70 L70 76 C62 84 38 84 30 76 Z"
        className="mascot-scarf"
      />
      <path
        d="M68 74 C76 78 82 86 79 95 C75 88 70 84 65 80 Z"
        className="mascot-scarf"
      />
      {/* Ears, outer then a smaller inner triangle. */}
      <path d="M22 32 L30 8 L41 29 Z" className="mascot-fur" />
      <path d="M78 32 L70 8 L59 29 Z" className="mascot-fur" />
      <path d="M27 27 L31 15 L37 26 Z" className="mascot-scarf" />
      <path d="M73 27 L69 15 L63 26 Z" className="mascot-scarf" />
      {/* Head. */}
      <circle cx="50" cy="48" r="30" className="mascot-fur" />
      {/* A couple of tabby stripes on the forehead. */}
      <path d="M40 20 L37 27" className="mascot-line" />
      <path d="M60 20 L63 27" className="mascot-line" />
      {/* Goggles, pushed up on the forehead. */}
      <path d="M22 24 Q50 12 78 24" className="mascot-strap" />
      <circle cx="36" cy="23" r="9" className="mascot-lens" />
      <circle cx="64" cy="23" r="9" className="mascot-lens" />
      <path d="M45 23 L55 23" className="mascot-strap" />
      {/* Blush. */}
      <circle cx="28" cy="57" r="4.5" className="mascot-blush" />
      <circle cx="72" cy="57" r="4.5" className="mascot-blush" />
      {/* Eyes: a dark iris and a small sparkle each. */}
      {mood === 'cheer' ? (
        <path
          d="M35 50 Q40 43 45 50 M55 50 Q60 43 65 50"
          className="mascot-mouth"
        />
      ) : (
        <>
          <circle cx="40" cy="48" r="4" className="mascot-eye" />
          <circle cx="60" cy="48" r="4" className="mascot-eye" />
          <circle cx="38.5" cy="46.5" r="1.3" className="mascot-sparkle" />
          <circle cx="58.5" cy="46.5" r="1.3" className="mascot-sparkle" />
        </>
      )}
      {/* Nose, then a small "w" mouth - or an open one when talking/cheering. */}
      <path d="M48 54 L52 54 L50 57 Z" className="mascot-line-fill" />
      {mood === 'idle' ? (
        <path
          d="M50 57 Q46 61 43 58 M50 57 Q54 61 57 58"
          className="mascot-mouth"
        />
      ) : (
        <ellipse
          cx="50"
          cy="62"
          rx="4"
          ry={mood === 'cheer' ? 4.5 : 3}
          className="mascot-mouth-open"
        />
      )}
      {/* Whiskers. */}
      <path
        d="M16 53 L28 55 M15 60 L28 60 M16 67 L28 65"
        className="mascot-line"
      />
      <path
        d="M84 53 L72 55 M85 60 L72 60 M84 67 L72 65"
        className="mascot-line"
      />
    </svg>
  )
}
