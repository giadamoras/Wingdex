// Placeholder map area (Europe / North Atlantic), covering all mock flights.
export const MAP_BOUNDS = { west: -30, east: 40, south: 34, north: 64 }

// Basic linear lat/lon -> percent of the map box (no real map projection yet).
export function project(latitude: number, longitude: number) {
  const { west, east, south, north } = MAP_BOUNDS
  return {
    x: ((longitude - west) / (east - west)) * 100,
    y: ((north - latitude) / (north - south)) * 100, // screen y grows downward
  }
}
