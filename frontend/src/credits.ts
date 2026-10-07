import type { DataSources } from './types'

// The credit line under the map. It names only the sources actually in use: the
// mock needs no credit, so on mock data (or while the sources are unknown) there
// is no line at all.
export function creditLine(sources: DataSources | null): string | null {
  if (!sources) return null
  const parts: string[] = []
  if (sources.source === 'opensky') {
    parts.push(
      'Live flights: OpenSky Network.',
      'Aircraft types: OpenSky aircraft database.',
      'Routes: adsbdb.',
    )
  }
  if (sources.weather_source === 'awc') {
    parts.push('Weather: Aviation Weather Center.')
  }
  return parts.length > 0 ? parts.join(' ') : null
}
