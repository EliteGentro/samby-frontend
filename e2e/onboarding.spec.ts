import { expect, test, type Page } from '@playwright/test'
import { chooseOption } from './helpers/controls'

async function begin(page: Page, name: string) {
  await page.goto('/#/business/home')
  await page.getByRole('button', { name: 'Set up my workspace' }).click()
  await page
    .getByRole('textbox', { name: 'Business name', exact: true })
    .fill(name)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
}

async function workspace(page: Page) {
  return page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('samby.workspace.business')!),
  )
}

test('a first-time inventory shortcut requires context and preserves confirmed zero', async ({
  page,
}) => {
  await page.goto('/#/business/home')
  await page.getByRole('button', { name: /Current inventory/ }).click()
  await expect(
    page.getByRole('textbox', { name: 'Business name', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Business name', exact: true })
    .fill('Inventory start')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page
    .getByRole('button', {
      name: 'Enter inventory & costs manually',
      exact: true,
    })
    .click()
  await page.getByLabel(/SKU or product reference/).fill('ZERO-1')
  await page.getByLabel(/Recorded stock quantity/).fill('0')
  await page.getByLabel('Unit', { exact: true }).fill('pieces')
  await page.getByLabel('Stock date').fill('2026-01-10')
  await page
    .getByRole('button', { name: 'Review inventory', exact: true })
    .click()
  await expect(page.locator('[aria-current="step"]')).toContainText('Review')
  await expect(
    page.getByRole('button', { name: 'Confirm & apply', exact: true }),
  ).toBeDisabled()
  expect((await workspace(page)).stock).toEqual([])
  await page
    .getByLabel('I confirm these values and their stated meaning.')
    .check()
  await page
    .getByRole('button', { name: 'Confirm & apply', exact: true })
    .click()
  await page
    .getByRole('button', { name: /View my (workspace|analysis)/ })
    .click()
  const saved = await workspace(page)
  expect(saved.profile.name).toBe('Inventory start')
  expect(saved.stock[0]).toMatchObject({
    onHand: 0,
    reserved: null,
    quantityBasis: 'on-hand',
  })
  expect(saved.onboarding.completed).toBe(true)
  expect(saved.onboarding.firstAnalysisAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  expect(saved.onboarding.firstComparisonAt).toBeNull()
})

test('changing the first question prioritizes collections without discarding sales', async ({
  page,
}) => {
  await begin(page, 'Question continuity')
  await page.getByRole('button', { name: 'Enter sales manually' }).click()
  await page.getByLabel('Date row 1', { exact: true }).fill('2026-01-10')
  await page.getByLabel('Amount row 1', { exact: true }).fill('125')
  await chooseOption(
    page.getByLabel('What would you like to understand first?'),
    'Analyze a critical collection',
  )
  await expect(page.getByLabel('Record / invoice name')).toBeVisible()
  await page.getByLabel('Record / invoice name').fill('COLLECTION-1')
  await chooseOption(
    page.getByLabel('What would you like to understand first?'),
    'Understand my sales',
  )
  await expect(page.getByLabel('Amount row 1', { exact: true })).toHaveValue(
    '125',
  )
  await chooseOption(
    page.getByLabel('What would you like to understand first?'),
    'Analyze a critical collection',
  )
  await expect(page.getByLabel('Record / invoice name')).toHaveValue(
    'COLLECTION-1',
  )
  expect((await workspace(page)).sales).toEqual([])
  expect((await workspace(page)).finance).toEqual([])
  expect((await workspace(page)).profile.firstQuestion).toBe(
    'Q-CRITICAL-COLLECTION',
  )
  await page.getByRole('button', { name: 'Save draft & close' }).click()
  await page.getByRole('button', { name: 'Set up my workspace' }).click()
  await expect(
    page.getByLabel('What would you like to understand first?'),
  ).toHaveText('Analyze a critical collection')
  await expect(page.getByLabel('Record / invoice name')).toHaveValue(
    'COLLECTION-1',
  )
})

test('confirming finance and finishing retains unfinished inventory and manual sales', async ({
  page,
}) => {
  await begin(page, 'Independent drafts')
  await page.getByRole('button', { name: 'Enter sales manually' }).click()
  await page.getByLabel('Amount row 1', { exact: true }).fill('480')
  await page
    .getByRole('button', { name: 'Inventory & costs', exact: true })
    .click()
  await page.getByLabel(/SKU or product reference/).fill('UNFINISHED-1')
  await page.getByLabel(/Recorded stock quantity/).fill('17')
  await page
    .getByRole('button', { name: 'Finance & collections', exact: true })
    .click()
  await page.getByLabel('Record / invoice name').fill('INV-17')
  await page.getByLabel('Customer, supplier or counterparty').fill('Atlas')
  await page.getByLabel('Original amount · MXN').fill('2000')
  await page.getByLabel(/Amount already paid/).fill('0')
  await page
    .getByRole('button', { name: 'Review financial record', exact: true })
    .click()
  await page
    .getByLabel('I confirm these values and their stated meaning.')
    .check()
  await page
    .getByRole('button', { name: 'Confirm & apply', exact: true })
    .click()
  await page
    .getByRole('button', { name: /View my (workspace|analysis)/ })
    .click()
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
  await page.reload()
  await page.goto('/#/business/settings')
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await page
    .getByRole('button', { name: 'Inventory & costs', exact: true })
    .click()
  await expect(page.getByLabel(/SKU or product reference/)).toHaveValue(
    'UNFINISHED-1',
  )
  await expect(page.getByLabel(/Recorded stock quantity/)).toHaveValue('17')
  await page.getByRole('button', { name: 'Sales', exact: true }).click()
  await expect(page.getByLabel('Amount row 1', { exact: true })).toHaveValue(
    '480',
  )
  const saved = await workspace(page)
  expect(saved.finance).toHaveLength(1)
  expect(saved.finance[0]).toMatchObject({
    name: 'INV-17',
    amount: 2000,
    paidAmount: 0,
  })
  expect(saved.stock).toEqual([])
  expect(saved.sales).toEqual([])
})

test('an older aggregate sales import shows its coverage and a useful first result', async ({
  page,
}) => {
  await begin(page, 'Historical sales')
  await page.getByLabel('Choose your sales file').setInputFiles({
    name: 'historical-sales.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'date,amount,currency,reference\n2025-01-03,725,MXN,INV-HISTORY\n',
    ),
  })
  await page
    .getByRole('textbox', { name: /Amount definition/ })
    .fill('Net sales excluding tax')
  await chooseOption(
    page.getByRole('combobox', { name: /^Sale amount/ }),
    'Not supplied',
  )
  await expect(
    page.getByRole('button', { name: 'Confirm & apply 0 rows' }),
  ).toBeDisabled()
  expect((await workspace(page)).sales).toEqual([])
  await chooseOption(
    page.getByRole('combobox', { name: /^Sale amount/ }),
    'amount',
  )
  await expect(page.getByText('1 usable', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Sales review scope' }),
  ).toContainText('2025-01-03')
  await expect(
    page.getByRole('region', { name: 'Sales review scope' }),
  ).toContainText(/aggregate/i)
  await page.getByLabel(/I confirm these mappings/).check()
  await page.getByRole('button', { name: 'Confirm & apply 1 rows' }).click()
  await page
    .getByRole('button', { name: /View my (workspace|analysis)/ })
    .click()
  await expect(
    page.locator('.metric-card').filter({ hasText: 'Recorded sales' }),
  ).toContainText('725')
  await expect(page.getByRole('main')).toContainText('2025-01-03')
  const saved = await workspace(page)
  expect(saved.sales[0]).toMatchObject({
    amount: 725,
    quantity: null,
    productId: null,
    sourceReference: 'INV-HISTORY',
  })
  expect(saved.products).toEqual([])
  expect(saved.stock).toEqual([])
  expect(saved.cash).toBeNull()
  expect(saved.onboarding.firstComparisonAt).toBeNull()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth))
})

test('a selection-only inventory draft survives section changes and resume', async ({
  page,
}) => {
  await begin(page, 'Select-only draft')
  await page
    .getByRole('button', { name: 'Inventory & costs', exact: true })
    .click()
  await page
    .getByRole('button', {
      name: 'Enter inventory & costs manually',
      exact: true,
    })
    .click()
  await page.getByLabel(/SKU or product reference/).fill('SELECT-1')
  await page.getByLabel(/Recorded stock quantity/).fill('12')
  await page.getByLabel('Unit', { exact: true }).fill('pieces')
  await page.getByLabel('Stock date').fill('2026-01-10')
  await page.getByLabel(/^Location/).fill('Draft warehouse')
  await chooseOption(
    page.getByRole('combobox', { name: 'Quantity basis', exact: true }),
    'Available · reservations already deducted',
  )
  await page
    .getByRole('button', { name: 'Finance & collections', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Inventory & costs', exact: true })
    .click()
  await expect(
    page.getByRole('combobox', { name: 'Quantity basis', exact: true }),
  ).toHaveText('Available · reservations already deducted')
  await expect(page.getByLabel('Unit', { exact: true })).toHaveValue('pieces')
  await expect(page.getByLabel(/^Location/)).toHaveValue('Draft warehouse')
  await page.getByRole('button', { name: 'Save draft & close' }).click()
  await page.getByRole('button', { name: 'Set up my workspace' }).click()
  await expect(
    page.getByRole('combobox', { name: 'Quantity basis', exact: true }),
  ).toHaveText('Available · reservations already deducted')
  await expect(page.getByLabel('Unit', { exact: true })).toHaveValue('pieces')
  await expect(page.getByLabel(/^Location/)).toHaveValue('Draft warehouse')
  await page
    .getByRole('button', { name: 'Review inventory', exact: true })
    .click()
  await page
    .getByLabel('I confirm these values and their stated meaning.')
    .check()
  await page
    .getByRole('button', { name: 'Confirm & apply', exact: true })
    .click()
  await page
    .getByRole('button', { name: /View my (workspace|analysis)/ })
    .click()
  const saved = await workspace(page)
  expect(saved.stock).toHaveLength(1)
  expect(saved.stock[0]).toMatchObject({
    onHand: 12,
    quantityBasis: 'available',
  })
  expect(saved.products[0]).toMatchObject({ sku: 'SELECT-1', unit: 'pieces' })
  expect(saved.locations[0]).toMatchObject({
    id: saved.stock[0].locationId,
    name: 'Draft warehouse',
  })
})

test('bulk inventory review applies only confirmed stock and persists its source meaning', async ({
  page,
}) => {
  await begin(page, 'Bulk inventory')
  await page
    .getByRole('button', { name: 'Inventory & costs', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Import inventory & costs', exact: true })
    .click()
  await page.getByLabel('Choose your inventory & costs file').setInputFiles({
    name: 'reviewed-stock.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'SKU / product reference,Product name,Unit,Stock quantity,Quantity basis,Reserved quantity,Stock date,Location,Unit cost\nBULK-1,Imported stock,pieces,12,on-hand,1,2026-08-10,Main warehouse,25\n',
    ),
  })
  await expect(
    page.getByRole('heading', {
      name: 'Check how your inventory & costs are understood.',
    }),
  ).toBeVisible()
  await expect(page.getByText('1 usable', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Confirm & apply 1 rows' }),
  ).toBeDisabled()
  expect((await workspace(page)).stock).toEqual([])
  await page.getByLabel(/I confirm these mappings/).check()
  await page.getByRole('button', { name: 'Confirm & apply 1 rows' }).click()
  await page
    .getByRole('button', { name: /View my (workspace|analysis)/ })
    .click()
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
  const saved = await workspace(page)
  expect(saved.products).toHaveLength(1)
  expect(saved.products[0]).toMatchObject({
    sku: 'BULK-1',
    name: 'Imported stock',
    unit: 'pieces',
    cost: 25,
  })
  expect(saved.stock).toHaveLength(1)
  expect(saved.stock[0]).toMatchObject({
    productId: saved.products[0].id,
    onHand: 12,
    reserved: 1,
    quantityBasis: 'on-hand',
    asOf: '2026-08-10',
  })
  expect(saved.locations[0]).toMatchObject({
    id: saved.stock[0].locationId,
    name: 'Main warehouse',
  })
  expect(saved.sources[0]).toMatchObject({
    name: 'reviewed-stock.csv',
    rowCount: 1,
  })
})

test('correcting a pending manual sale never duplicates a confirmed sale', async ({
  page,
}) => {
  await begin(page, 'Partial manual intake')
  await page.getByRole('button', { name: 'Enter sales manually' }).click()
  await page.getByLabel('Date row 1', { exact: true }).fill('2026-01-10')
  await page.getByLabel('Amount row 1', { exact: true }).fill('100')
  await page.getByRole('button', { name: 'Add row', exact: true }).click()
  await page.getByLabel('Amount row 2', { exact: true }).fill('50')
  await page.getByRole('button', { name: 'Review these sales' }).click()
  await page
    .getByRole('textbox', { name: /Amount definition/ })
    .fill('Net sales excluding tax')
  await expect(page.getByText('1 pending', { exact: true })).toBeVisible()
  await page.getByLabel(/I confirm these mappings/).check()
  await page.getByRole('button', { name: 'Confirm & apply 1 rows' }).click()
  expect((await workspace(page)).sales).toHaveLength(1)
  await page.getByRole('button', { name: 'Add more information' }).click()
  const pendingRow = page
    .getByRole('row')
    .filter({ has: page.locator('input[value="50"]') })
  await pendingRow.getByLabel(/^Date row/).fill('2026-01-11')
  await page.getByRole('button', { name: 'Review these sales' }).click()
  await page.getByLabel(/I confirm these mappings/).check()
  await page.getByRole('button', { name: 'Confirm & apply 1 rows' }).click()
  await page.getByRole('button', { name: 'View my analysis' }).click()
  const saved = await workspace(page)
  expect(saved.sales).toHaveLength(2)
  expect(
    saved.sales
      .map((sale: { amount: number }) => sale.amount)
      .sort((a: number, b: number) => a - b),
  ).toEqual([50, 100])
  expect(saved.sources[0].review.rows).toHaveLength(2)
  expect(saved.sources[0].review.acceptedRowIndexes).toEqual([0])
  await expect(
    page.locator('.metric-card').filter({ hasText: 'Recorded sales' }),
  ).toContainText('150')
})
