import { expect, test } from '@playwright/test'

test('a name-only financial record stays unknown until reviewed amounts promote the same identity', async ({
  page,
}) => {
  await page.goto('/#/business/finance')
  await expect(page.getByText('Saved to Samby', { exact: true })).toBeVisible()
  await page
    .getByRole('button', { name: 'Add incomplete record', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Name or reference', exact: true })
    .fill('Customer invoice awaiting reconciliation')
  await page
    .getByRole('textbox', { name: 'Counterparty · optional', exact: true })
    .fill('Local shop')
  await page.getByRole('button', { name: 'Review record', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(
    'This record remains incomplete and excluded from numerical balances',
  )
  await expect(
    page.getByRole('button', { name: 'Confirm and save record', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('checkbox', {
      name: 'I reviewed these exact values and their missing fields',
    })
    .check()
  await page
    .getByRole('button', { name: 'Confirm and save record', exact: true })
    .click()
  await expect(page.getByText('Saved to Samby', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Saved to Samby', { exact: true })).toBeVisible()
  const row = page
    .getByRole('row')
    .filter({ hasText: 'Customer invoice awaiting reconciliation' })
  await expect(row).toContainText('Not provided')
  const credentials = await page.evaluate(() => {
    const id = localStorage.getItem('samby.workspace-id.business')!
    return { id, key: localStorage.getItem(`samby.workspace-key.${id}`)! }
  })
  const headers = {
    'X-Workspace-ID': credentials.id,
    'X-Workspace-Key': credentials.key,
  }
  const read = async () => {
    const response = await page.request.get(
      `http://127.0.0.1:8001/api/prototype/workspaces/${credentials.id}`,
      { headers },
    )
    expect(response.ok()).toBe(true)
    return (await response.json()).workspace
  }
  const incomplete = await read()
  expect(incomplete.pendingFinance).toHaveLength(1)
  expect(incomplete.pendingFinance[0]).toMatchObject({
    amount: null,
    paidAmount: null,
    dueDate: null,
    expectedDate: null,
  })
  expect(incomplete.finance).toHaveLength(0)
  await page
    .getByRole('button', {
      name: 'Complete Customer invoice awaiting reconciliation',
      exact: true,
    })
    .click()
  await page
    .getByLabel('Original amount · blank means unknown', { exact: true })
    .fill('1000')
  await page
    .getByLabel('Cumulative paid amount · blank means unknown', { exact: true })
    .fill('250')
  await page.getByRole('button', { name: 'Review record', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Both amounts are known')
  await page
    .getByRole('checkbox', {
      name: 'I reviewed these exact values and their missing fields',
    })
    .check()
  await page
    .getByRole('button', { name: 'Confirm and save record', exact: true })
    .click()
  await expect(page.getByText('Saved to Samby', { exact: true })).toBeVisible()
  const completed = await read()
  expect(completed.pendingFinance).toHaveLength(0)
  expect(completed.finance).toHaveLength(1)
  expect(completed.finance[0]).toMatchObject({
    id: incomplete.pendingFinance[0].id,
    sourceId: incomplete.pendingFinance[0].sourceId,
    amount: 1000,
    paidAmount: 250,
    cashIncluded: false,
  })
  await page.getByRole('button', { name: 'Internal Debt', exact: true }).click()
  await expect(
    page
      .locator('.metric-card')
      .filter({ hasText: 'Known outstanding subtotal' }),
  ).toContainText('750')
  await expect(
    page
      .locator('.metric-card')
      .filter({ hasText: 'Known outstanding subtotal' }),
  ).not.toContainText('1,000')
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth))
})
