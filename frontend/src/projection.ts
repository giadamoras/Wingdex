// The whole world except Antarctica. The map box's aspect ratio (18 / 7 in
// index.css) matches 360 x 140 degrees, so a degree is equally wide and tall.
export const MAP_BOUNDS = { west: -180, east: 180, south: -60, north: 80 }

// The map's default opening view centres on this point (FlightMap.tsx), and
// onboardingTarget.ts uses it to pick a first-catch flight likely on screen.
export const DEFAULT_CENTER = { latitude: 50, longitude: 10 }

// Basic linear lat/lon -> percent of the map box (no real map projection yet).
export function project(latitude: number, longitude: number) {
  const { west, east, south, north } = MAP_BOUNDS
  return {
    x: ((longitude - west) / (east - west)) * 100,
    y: ((north - latitude) / (north - south)) * 100, // screen y grows downward
  }
}

// Inverse of project()'s x axis: fraction of the map box width (0..1) back to
// longitude. Used to find the current viewport's centre longitude for the
// map's time-of-day palette.
export function unprojectLongitude(xFraction: number): number {
  const { west, east } = MAP_BOUNDS
  return west + xFraction * (east - west)
}
