import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

afterEach(() => vi.unstubAllGlobals())

test('shows backend status from /health', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({ json: () => Promise.resolve({ status: 'ok' }) }),
  )
  render(<App />)
  expect(await screen.findByText('Backend status: ok')).toBeTruthy()
})

test('shows unreachable when the backend is down', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
  render(<App />)
  expect(await screen.findByText('Backend status: unreachable')).toBeTruthy()
})
