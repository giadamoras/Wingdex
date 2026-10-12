import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Mascot } from './Mascot'

test('the mascot is decorative: hidden from screen readers', () => {
  const { container } = render(<Mascot />)
  expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
    'true',
  )
  expect(screen.queryByRole('img')).toBeNull()
})
