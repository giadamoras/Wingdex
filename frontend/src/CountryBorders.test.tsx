import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { CountryBorders } from './CountryBorders'
import { WHOLE } from './panzoom'

// Labels are drawn for the whole world, visible or not, so a screen reader
// must not walk through them.
test('country labels are hidden from screen readers', () => {
  const { container } = render(
    <CountryBorders
      view={{ zoom: 1, x: 0, y: 0 }}
      shape={WHOLE}
      mapWidthPx={1000}
      mapHeightPx={400}
    />,
  )
  const labels = container.querySelectorAll('.country-label')
  expect(labels.length).toBeGreaterThan(0)
  for (const label of labels)
    expect(label.getAttribute('aria-hidden')).toBe('true')
})
