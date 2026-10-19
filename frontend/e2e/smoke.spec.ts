import { expect, test } from '@playwright/test'

// The core loop end to end, against the real backend on mock data: the map
// loads, onboarding points at a plane, the player catches it, and the catch is
// in the Journal, still there after a reload.
test('catch a plane and find it in the Journal', async ({ page }) => {
  await page.goto('/')

  // Onboarding greets a first-time player; "Got it!" moves on to the catch
  // step, which rings one plane on the map.
  await page.getByRole('button', { name: 'Got it!' }).click()
  const target = page.locator('button.plane.target')
  await expect(target).toBeVisible()
  const callsign = await target.getAttribute('aria-label')
  expect(callsign).toBeTruthy()

  // Tapping it opens the card; catching turns the button into a stamp.
  await target.click()
  await page.getByRole('button', { name: 'Catch', exact: true }).click()
  await expect(page.getByText('Caught today ✓')).toBeVisible()

  // The Collection opens on the Journal, with that one catch.
  await page.getByRole('button', { name: /Collection/ }).click()
  const journal = page.locator('.collection')
  await expect(
    journal.locator('.count-row', { hasText: '1 catch' }),
  ).toBeVisible()
  await expect(journal.getByText(callsign!)).toBeVisible()

  // The Journal is saved in the browser, so it survives a reload, which also
  // stays on the Collection (its place is in the URL).
  await page.reload()
  await expect(page.locator('.count-row', { hasText: '1 catch' })).toBeVisible()
})
