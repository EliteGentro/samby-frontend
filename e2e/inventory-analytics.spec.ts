import { expect, test } from '@playwright/test'
import { chooseOption } from './helpers/controls'

test('inventory analytics reflects location selection in category and pipeline totals', async ({
  page,
}) => {
  await page.goto('/#/demo/inventory')
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
  await page
    .getByRole('button', { name: 'Analytics & graphs', exact: true })
    .click()
  const available = page
    .getByText('On hand (Available)', { exact: true })
    .locator('..')
    .locator('p')
    .nth(1)
  const packaging = page
    .getByText('Packaging (2 SKUs)', { exact: true })
    .locator('..')
  const location = page.getByRole('combobox', {
    name: 'Inventory location',
    exact: true,
  })
  await expect(available).toHaveText('2,371')
  await page.getByRole('button', { name: 'Units', exact: true }).click()
  await expect(packaging).toContainText('660 units')
  await chooseOption(location, 'Saltillo branch')
  await expect(available).toHaveText('595')
  await expect(packaging).toContainText('168 units')
  const monterrey = page.getByRole('button', {
    name: /^Monterrey warehouse 1,776 units/,
  })
  await monterrey.click()
  await expect(location).toHaveText('Monterrey warehouse')
  await expect(available).toHaveText('1,776')
  await expect(packaging).toContainText('492 units')
  await monterrey.click()
  await expect(location).toHaveText('All locations')
  await expect(available).toHaveText('2,371')
  await expect(packaging).toContainText('660 units')
})
