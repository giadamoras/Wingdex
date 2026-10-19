import { useEffect, useSyncExternalStore } from 'react'

// Where the player is, kept in the URL path ("/collection/dex/airlines"), so a
// reload or the back button lands in the same place. The map is "/". No router
// library for a handful of views. The dev and preview servers answer every
// path with the app; a real host needs the same rewrite (see docs/plan.md,
// "Only if deployed").

// pushState and replaceState fire no event of their own, so navigate() tells
// the subscribers itself; back and forward fire popstate.
const CHANGE = 'wingdex:navigate'

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(CHANGE, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(CHANGE, onChange)
  }
}

const getPathname = () => window.location.pathname

// The path's parts: "/collection/dex" -> ["collection", "dex"]; [] for the map.
export function parsePath(pathname: string): string[] {
  return pathname.split('/').filter(Boolean).map(decodeURIComponent)
}

const toUrl = (path: string[]) => '/' + path.map(encodeURIComponent).join('/')

// Goes to `path`. A new history entry by default, so back returns; `replace`
// for small moves inside a view (a tab, a section), which back should skip.
export function navigate(path: string[], { replace = false } = {}) {
  const url = toUrl(path)
  if (url === window.location.pathname) return
  if (replace) window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
  window.dispatchEvent(new Event(CHANGE))
}

// The current path, re-rendering whenever it changes.
export function usePath(): string[] {
  return parsePath(useSyncExternalStore(subscribe, getPathname))
}

// The path segment at `index` if it is one of `options`, else the first
// option: an old or mistyped URL falls back to the default view.
export function pick<T extends string>(
  path: string[],
  index: number,
  options: readonly T[],
): T {
  const segment = path[index]
  return (options as readonly string[]).includes(segment)
    ? (segment as T)
    : options[0]
}

// Spells out the defaults in the URL ("/collection" -> "/collection/journal"),
// so it always says exactly where the player is. Only while the live URL is
// still the one this render saw: otherwise the URL has moved on (back to the
// map, or a child, whose effect runs first, has filled in more) and this
// render's idea of it is stale.
export function useFullPath(rendered: string[], full: string[]) {
  const seen = toUrl(rendered)
  const url = toUrl(full)
  useEffect(() => {
    if (seen !== url && window.location.pathname === seen)
      navigate(parsePath(url), { replace: true })
  }, [seen, url])
}
