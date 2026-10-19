import { useState } from 'react'
import { COUNTRY_CODES } from '../shared-lib/countries'

// Flag SVGs from the flag-icons package (MIT), one file per country. Emoji
// flags are not used because Windows draws them as two letters ("FR").
// `?no-inline` keeps each flag a separate file, fetched only when shown,
// instead of inlining the small ones into the app's JavaScript.
const FLAG_URLS = import.meta.glob<string>(
  '../../node_modules/flag-icons/flags/4x3/*.svg',
  { eager: true, query: '?no-inline', import: 'default' },
)

const urlFor = (code: string) =>
  FLAG_URLS[`../../node_modules/flag-icons/flags/4x3/${code}.svg`]

// A country's flag, decorative (the country name is always written next to
// it). The bigger files (Spain's coat of arms is 81 KB) take a moment, so the
// frame shows a small spinner until the image has loaded; a failed load
// leaves the empty frame. Nothing when the country has no flag on file.
export function Flag({ country }: { country: string }) {
  const [state, setState] = useState<'loading' | 'done' | 'failed'>('loading')
  const code = COUNTRY_CODES[country]
  const url = code ? urlFor(code) : undefined
  if (!url) return null
  return (
    <span
      className={state === 'loading' ? 'flag-frame loading' : 'flag-frame'}
      aria-hidden="true"
    >
      {state !== 'failed' && (
        <img
          className="flag"
          src={url}
          alt=""
          onLoad={() => setState('done')}
          onError={() => setState('failed')}
        />
      )}
    </span>
  )
}
