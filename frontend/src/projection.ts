// The whole world except Antarctica. The map box's aspect ratio (18 / 7 in
// index.css) matches 360 x 140 degrees, so a degree is equally wide and tall.
export const MAP_BOUNDS = { west: -180, east: 180, south: -60, north: 80 }

// Basic linear lat/lon -> percent of the map box (no real map projection yet).
export function project(latitude: number, longitude: number) {
  const { west, east, south, north } = MAP_BOUNDS
  return {
    x: ((longitude - west) / (east - west)) * 100,
    y: ((north - latitude) / (north - south)) * 100, // screen y grows downward
  }
}
