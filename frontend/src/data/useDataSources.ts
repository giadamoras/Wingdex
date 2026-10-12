import { useEffect, useState } from 'react'
import { fetchDataSources } from './api'
import type { DataSources } from './types'

// Asks the backend once which sources it uses. Null until known, and for good if
// the request fails: the credits then stay hidden rather than claim a source.
export function useDataSources(): DataSources | null {
  const [sources, setSources] = useState<DataSources | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchDataSources(controller.signal)
      .then(setSources)
      .catch(() => {})
    return () => controller.abort()
  }, [])

  return sources
}
