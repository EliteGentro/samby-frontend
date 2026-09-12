import { expect, test } from '@playwright/test'

test('empty business, demo isolation and responsive navigation', async ({
  page,
  isMobile,
}) => {
  await page.goto('/#/business/home')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A clearer picture starts here.',
  )
  if (isMobile) {
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Workspace navigation' }),
    ).toBeVisible()
  }
  await page.getByRole('button', { name: 'Explore demo workspace' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Your business, in view.',
  )
  await expect(
    page.locator('.metric-card').filter({ hasText: 'Recorded sales' }),
  ).toContainText('155,420')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Your business, in view.',
  )
  const ids = await page.evaluate(() => [
    localStorage.getItem('samby.workspace-id.business'),
    localStorage.getItem('samby.workspace-id.demo'),
  ])
  expect(ids[0]).not.toEqual(ids[1])
  await page.getByRole('button', { name: 'Exit demo' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A clearer picture starts here.',
  )
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth))
})

test('CSV review preserves missing quantities and applies only confirmed usable rows', async ({
  page,
}) => {
  await page.goto('/#/business/home')
  await page.getByRole('button', { name: 'Set up my workspace' }).click()
  await page
    .getByRole('textbox', { name: 'Business name', exact: true })
    .fill('CSV Test Business')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Monterrey',
  }).format(new Date())
  await page.getByLabel('Choose your sales file').setInputFiles({
    name: 'review-sales.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `date,sku,product,quantity,unit,amount,currency\n${date},TEST-1,Test product,,,250,MXN\ninvalid,TEST-2,Invalid date,2,pieces,100,MXN\n`,
    ),
  })
  await page
    .getByRole('textbox', { name: /Amount definition/ })
    .fill('Net sales excluding tax after discounts')
  await expect(page.getByText('1 usable', { exact: true })).toBeVisible()
  await expect(page.getByText('1 pending', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Confirm & apply 1 rows' }),
  ).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Include row 2' }).uncheck()
  await page.getByRole('checkbox', { name: /I confirm these mappings/ }).check()
  await page.getByRole('button', { name: 'Confirm & apply 1 rows' }).click()
  await page.getByRole('button', { name: 'View my analysis' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Your business, in view.',
  )
  await expect(
    page.locator('.metric-card').filter({ hasText: 'Recorded sales' }),
  ).toContainText('250')
  await expect(
    page.getByRole('row').filter({ hasText: 'Test product' }),
  ).toContainText('Not provided')
  const saved = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('samby.workspace.business')!),
  )
  expect(saved.sales).toHaveLength(1)
  expect(saved.sales[0].quantity).toBeNull()
  expect(saved.stock).toHaveLength(0)
  expect(saved.cash).toBeNull()
  expect(saved.onboarding.firstAnalysisAt).toBeTruthy()
  expect(saved.onboarding.firstComparisonAt).toBeNull()
  await page.reload()
  await expect(
    page.locator('.metric-card').filter({ hasText: 'Recorded sales' }),
  ).toContainText('250')
})

test('SKU standardization supports cancel, reject, edited approval and stable product identity', async ({
  page,
}) => {
  await page.goto('/#/demo/inventory')
  await page
    .getByRole('button', { name: 'Standardize SKUs', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText(
    'Review the original value, affected records and proposed correction',
  )
  await page.getByRole('button', { name: 'Reject suggestion' }).click()
  await expect(
    page.getByRole('button', { name: 'Review 0 changes' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Rejected · restore' }).click()
  await page
    .getByRole('checkbox', { name: 'Select all non-rejected suggestions' })
    .check()
  await page
    .getByRole('textbox', { name: /Proposed sku for/ })
    .fill('OFFICE-MARKER')
  await page.getByRole('button', { name: 'Review 1 changes' }).click()
  await page.getByRole('button', { name: 'Confirm application' }).click()
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Applied 1 confirmed corrections' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('OFFICE-MARKER', { exact: true })).toBeVisible()
  const saved = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('samby.workspace.demo')!),
  )
  expect(
    saved.products.find((p: { sku: string }) => p.sku === 'OFFICE-MARKER').id,
  ).toBe('p-6')
  expect(
    saved.sales.some((s: { productId: string }) => s.productId === 'p-6'),
  ).toBe(true)
})

test('muting hides current widgets across modules while preserving source records', async ({
  page,
}) => {
  await page.goto('/#/demo/data')
  await page
    .getByRole('switch', { name: 'Inventory value presentation', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText('Saved runs')
  await page
    .getByRole('button', { name: 'Mute presentation', exact: true })
    .click()
  for (const route of ['home', 'inventory', 'dashboards']) {
    await page.goto(`/#/demo/${route}`)
    await expect(
      page.locator('.metric-card').filter({ hasText: 'Inventory at cost' }),
    ).toHaveCount(0)
  }
  const saved = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('samby.workspace.demo')!),
  )
  expect(saved.stock).toHaveLength(12)
  expect(saved.muted).toContain('inventory-value')
  await page.goto('/#/demo/data')
  await page
    .getByRole('switch', { name: 'Inventory value presentation', exact: true })
    .click()
  await page.goto('/#/demo/home')
  await expect(
    page.locator('.metric-card').filter({ hasText: 'Inventory at cost' }),
  ).toBeVisible()
})

test('deferring intake completes setup without inventing the first analysis', async ({
  page,
}) => {
  await page.goto('/#/business/home')
  await page.getByRole('button', { name: 'Set up my workspace' }).click()
  await page
    .getByRole('textbox', { name: 'Business name', exact: true })
    .fill('Deferred Business')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page
    .getByRole('button', { name: 'Continue for now', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText(
    'No analysis has been calculated',
  )
  await page
    .getByRole('button', { name: 'Continue for now', exact: true })
    .click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A clearer picture starts here.',
  )
  const saved = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('samby.workspace.business')!),
  )
  expect(saved.onboarding.completed).toBe(true)
  expect(saved.onboarding.deferred).toBe(true)
  expect(saved.onboarding.firstAnalysisAt).toBeNull()
  expect(saved.sales).toEqual([])
})

test('notification controls suppress optional reminders while preserving inline omissions', async ({
  page,
}) => {
  await page.goto('/#/demo/home')
  await page.getByRole('button', { name: 'View notifications' }).click()
  await expect(page.getByRole('dialog')).toContainText(
    'Cash planning has partial coverage',
  )
  await page.getByRole('button', { name: 'Snooze for 1 day' }).first().click()
  await expect(page.getByRole('dialog')).not.toContainText(
    'Cash planning has partial coverage',
  )
  await page.keyboard.press('Escape')
  await page.goto('/#/demo/settings')
  await page
    .getByRole('switch', { name: 'Optional notifications', exact: true })
    .click()
  await page.goto('/#/demo/finance')
  await expect(page.getByText('taxes · omitted', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View notifications' }).click()
  await expect(page.getByRole('dialog')).toContainText(
    'Optional notifications are turned off',
  )
})

test('dialogs restore keyboard focus to their opener', async ({
  page,
  isMobile,
}) => {
  await page.goto('/#/business/home')
  const button = page.getByRole('button', { name: 'Set up my workspace' })
  await button.click()
  await page.keyboard.press('Escape')
  await expect(button).toBeFocused()
  if (isMobile) {
    const navigation = page.getByRole('button', { name: 'Open navigation' })
    await navigation.click()
    await page.keyboard.press('Escape')
    await expect(navigation).toBeFocused()
  }
})
