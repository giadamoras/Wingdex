// Whether the onboarding flow has already run once on this device. Same
// pattern as badgesSeen.ts's seen-set, just a single flag.
const ONBOARDING_SEEN_KEY = 'airspace-explorer:onboarding-seen:v1'

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, '1')
  } catch {
    // Storage full or blocked: onboarding just runs again next time.
  }
}
