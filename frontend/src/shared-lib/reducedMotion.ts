// True when the player's system asks for less motion. Read at call time, not
// cached, so a changed setting applies on the next animation.
export const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
