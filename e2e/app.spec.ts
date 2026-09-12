import { expect, test } from '@playwright/test'

test('public shell is responsive and offers authentication', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toContainText('real-time applications')
  await expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible()
  await expect(page.getByText('REST + SSE')).toBeVisible()
})
