import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import { chooseOption } from './helpers/controls'

const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(
    new Date(),
  )
const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10)
const saved = async (page: Page) =>
  expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
async function begin(page: Page) {
  await page.goto('/#/business/home')
  await saved(page)
  await page.getByRole('button', { name: 'Set up my workspace' }).click()
  await page
    .getByRole('textbox', { name: 'Business name', exact: true })
    .fill('Complete data workflow')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await saved(page)
}
async function confirmSales(page: Page) {
  await page
    .getByRole('textbox', { name: /Amount definition/ })
    .fill('Net sales excluding tax after discounts')
  await page.getByRole('checkbox', { name: /I confirm these mappings/ }).check()
  await page.getByRole('button', { name: 'Confirm & apply 2 rows' }).click()
  await saved(page)
  await page.getByRole('button', { name: 'View my analysis' }).click()
  await saved(page)
}
async function inventoryIntake(page: Page) {
  await page.goto('/#/business/inventory')
  await saved(page)
  await page.getByRole('button', { name: 'Add inventory', exact: true }).click()
  await page
    .getByRole('button', {
      name: 'Enter inventory & costs manually',
      exact: true,
    })
    .click()
}
async function confirmAdvanced(page: Page) {
  await page
    .getByRole('checkbox', { name: /I confirm the original values/ })
    .check()
  await page.getByRole('button', { name: 'Confirm & apply record' }).click()
  await saved(page)
  await expect(
    page.getByRole('status').filter({ hasText: 'Confirmed record applied' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog' }).click()
}
async function readWorkspace(page: Page) {
  const credential = await page.evaluate(() => {
    const id = localStorage.getItem('samby.workspace-id.business')!
    return { id, key: localStorage.getItem(`samby.workspace-key.${id}`)! }
  })
  const response = await page.request.get(
    `http://127.0.0.1:8001/api/prototype/workspaces/${credential.id}`,
    {
      headers: {
        'X-Workspace-ID': credential.id,
        'X-Workspace-Key': credential.key,
      },
    },
  )
  expect(response.ok()).toBe(true)
  return (await response.json()).workspace
}
for (const extension of ['xlsx', 'xls'])
  test(`native ${extension.toUpperCase()} workbook is parsed, reviewed and durably applied`, async ({
    page,
  }) => {
    await begin(page)
    await page
      .getByLabel('Choose your sales file')
      .setInputFiles(path.resolve(`e2e/fixtures/sales-review.${extension}`))
    if (extension === 'xlsx') {
      await expect(
        page.getByRole('combobox', { name: 'Worksheet' }),
      ).toBeVisible()
      await chooseOption(
        page.getByRole('combobox', { name: 'Worksheet' }),
        'Sales · 2 rows',
      )
    }
    await expect(
      page.getByRole('row').filter({ hasText: 'Native workbook product' }),
    ).toHaveCount(2)
    await expect(
      page.getByRole('button', { name: 'Confirm & apply 0 rows' }),
    ).toBeDisabled()
    expect((await readWorkspace(page)).sales).toHaveLength(0)
    await confirmSales(page)
    const workspace = await readWorkspace(page)
    expect(workspace.sales).toHaveLength(2)
    expect(workspace.sales[0].unitCost).toBe(5)
    expect(workspace.sources[0].type).toBe('xlsx')
    expect(workspace.sources[0].review.rows).toHaveLength(2)
    await page.reload()
    await saved(page)
    expect((await readWorkspace(page)).sales).toHaveLength(2)
  })

test('confirmed observations produce literal DIO, GMROI, service and receipt-age results', async ({
  page,
}) => {
  test.setTimeout(90_000)
  page.setDefaultTimeout(10000)
  const end = today(),
    start = shift(end, -29)
  await begin(page)
  await page.getByLabel('Choose your sales file').setInputFiles({
    name: 'costed-sales.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `date,sku,product,quantity,unit,amount,currency,unit cost\n${start},METRIC-1,Metric product,10,pieces,100,MXN,5\n${end},METRIC-1,Metric product,10,pieces,100,MXN,5\n`,
    ),
  })
  await confirmSales(page)
  await inventoryIntake(page)
  await page.getByLabel(/SKU or product reference/).fill('METRIC-1')
  await page.getByLabel(/Recorded stock quantity/).fill('20')
  await page.getByLabel('Unit', { exact: true }).fill('pieces')
  await page.getByLabel(/Reserved quantity/).fill('0')
  await page.getByLabel('Stock date', { exact: true }).fill(end)
  await page.getByLabel(/^Unit cost · MXN/).fill('5')
  await page.getByText('Optional inventory policies', { exact: true }).click()
  await page.getByLabel(/Target inventory quantity/).fill('10')
  await page.getByLabel(/Service target %/).fill('90')
  await chooseOption(
    page.getByLabel(/Service target definition/),
    'Initially fulfilled / requested units',
  )
  await page
    .getByRole('button', { name: 'Review inventory', exact: true })
    .click()
  await page
    .getByRole('checkbox', {
      name: 'I confirm these values and their stated meaning.',
    })
    .check()
  await page
    .getByRole('button', { name: 'Confirm & apply', exact: true })
    .click()
  await saved(page)
  await page.getByRole('button', { name: 'View my analysis' }).click()
  await saved(page)
  await inventoryIntake(page)
  await page
    .getByRole('button', { name: 'Inventory history', exact: true })
    .click()
  await page.getByLabel('Observation / as-of date').fill(start)
  await chooseOption(
    page.getByLabel('Observation method'),
    'Explicit constant-value interval estimate',
  )
  await page.getByLabel('Through date (interval estimates only)').fill(end)
  await page.getByLabel('Physical quantity · pieces').fill('20')
  await page.getByLabel('Historical cost per unit · MXN').fill('5')
  await page
    .getByRole('button', { name: 'Review inventory history', exact: true })
    .click()
  expect((await readWorkspace(page)).inventoryHistory ?? []).toHaveLength(0)
  await confirmAdvanced(page)
  await inventoryIntake(page)
  await page
    .getByRole('button', { name: 'Observed service', exact: true })
    .click()
  await page.getByLabel('Observation / as-of date').fill(end)
  await page.getByLabel('Initially requested units').fill('10')
  await page.getByLabel('Fulfilled at initial requested deadline').fill('8')
  await page.getByLabel('Observed available quantity').fill('2')
  await chooseOption(
    page.getByLabel('Unmet demand disposition'),
    'Recorded abandoned / lost',
  )
  await page.getByLabel('Explicit lost unit margin estimate · MXN').fill('5')
  await page
    .getByLabel('Lost margin cost / price basis')
    .fill('Recorded net unit selling price 10 less historical unit cost 5')
  await page.getByLabel('Customer order reference').fill('LOST-1')
  await page
    .getByRole('button', { name: 'Review observed service', exact: true })
    .click()
  await confirmAdvanced(page)
  await inventoryIntake(page)
  await page
    .getByRole('button', { name: 'Observed service', exact: true })
    .click()
  await page.getByLabel('Observation / as-of date').fill(shift(end, -5))
  await page.getByLabel('Initially requested units').fill('10')
  await page.getByLabel('Fulfilled at initial requested deadline').fill('7')
  await chooseOption(
    page.getByLabel('Unmet demand disposition'),
    'Carried as a backorder',
  )
  await page.getByLabel('Backorder units still pending').fill('2')
  await page.getByLabel('Backorder observation date').fill(end)
  await page.getByLabel('Customer order reference').fill('BACK-1')
  await page.getByLabel('Actual customer delivery date').fill(shift(end, -3))
  await page
    .getByRole('button', { name: 'Review observed service', exact: true })
    .click()
  await confirmAdvanced(page)
  await inventoryIntake(page)
  await page
    .getByRole('button', { name: 'Receipt age layers', exact: true })
    .click()
  await page.getByLabel('Observation / as-of date').fill(end)
  await page.getByLabel('Original receipt date').fill(shift(end, -100))
  await page.getByLabel('Remaining units from this receipt').fill('20')
  await page
    .getByRole('button', { name: 'Review receipt age layers', exact: true })
    .click()
  await confirmAdvanced(page)
  await page.goto('/#/business/dashboards')
  await saved(page)
  await expect(
    page
      .locator('.metric-card')
      .filter({ hasText: 'Days inventory outstanding' }),
  ).toContainText('30 days')
  await expect(
    page
      .locator('.metric-card')
      .filter({ hasText: 'Gross margin return on inventory' }),
  ).toContainText('1')
  await page.getByRole('button', { name: 'Service', exact: true }).click()
  const serviceRow = page
    .locator('section')
    .filter({
      has: page.getByRole('heading', { name: 'Observed service', exact: true }),
    })
    .getByRole('row')
    .filter({ hasText: 'Metric product' })
  await expect(serviceRow).toContainText('75%')
  await expect(serviceRow).toContainText('100%')
  await expect(
    page.getByRole('row').filter({ hasText: 'LOST-1' }),
  ).toContainText('$10')
  await expect(
    page.getByRole('row').filter({ hasText: 'BACK-1' }),
  ).toContainText('2 pieces / 5 days')
  await expect(
    page.getByRole('row').filter({ hasText: 'BACK-1' }),
  ).toContainText('2 days after requested deadline')
  await expect(
    page.getByRole('row').filter({ hasText: 'initial-unit-fill' }),
  ).toContainText('-15 percentage points')
  await page.goto('/#/business/inventory')
  await page.getByRole('button', { name: 'Age & excess', exact: true }).click()
  const ageRow = page.getByRole('row').filter({ hasText: 'Metric product' })
  await expect(ageRow).toContainText('10 / 10')
  await expect(ageRow).toContainText('$50')
  await page.reload()
  await saved(page)
  const workspace = await readWorkspace(page)
  expect(workspace.inventoryHistory).toHaveLength(1)
  expect(workspace.serviceObservations).toHaveLength(2)
  expect(workspace.inventoryLayers).toHaveLength(1)
})

test('explicit unit conversion previews factor and preserves total monetary value', async ({
  page,
}) => {
  await page.goto('/#/demo/inventory')
  await saved(page)
  await page
    .getByRole('button', { name: 'Standardize SKUs', exact: true })
    .click()
  await page.getByText('Add a specific correction', { exact: true }).click()
  await chooseOption(
    page.getByRole('combobox', { name: 'Product', exact: true }),
    'Shipping box · medium · EMP-001',
  )
  await chooseOption(
    page.getByRole('combobox', { name: 'Field', exact: true }),
    'unit',
  )
  await page.getByRole('button', { name: 'Create review proposal' }).click()
  await page
    .getByRole('textbox', { name: 'Proposed unit for pieces' })
    .fill('dozens')
  await page.getByLabel('New units per 1 old unit').fill(String(1 / 12))
  await page
    .getByLabel('Conversion source / basis')
    .fill('Owner checked 12 pieces per dozen on supplier packaging')
  await page
    .getByRole('checkbox', { name: 'Approve pieces', exact: true })
    .check()
  await page
    .getByRole('button', { name: 'Review 1 changes', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText(
    'Linked quantities multiply by this factor; unit cost/price divide',
  )
  await page.getByRole('button', { name: 'Confirm application' }).click()
  await saved(page)
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Applied 1 confirmed corrections' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  const row = page.getByRole('row').filter({ hasText: 'Shipping box · medium' })
  await expect(row).toContainText('dozens')
  await expect(row).toContainText('216')
})

test('negative opening cash is reviewed, saved and remains negative after reload', async ({
  page,
}) => {
  await page.goto('/#/business/finance')
  await saved(page)
  await page
    .getByRole('button', { name: 'Add financial data', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Business name', exact: true })
    .fill('Opening cash business')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page
    .getByRole('button', {
      name: 'Enter finance & collections manually',
      exact: true,
    })
    .click()
  await page
    .getByRole('button', { name: 'Available cash', exact: true })
    .click()
  await page.getByLabel('Available cash · MXN', { exact: true }).fill('-100')
  await page.getByLabel('Balance date', { exact: true }).fill(today())
  await page.getByRole('button', { name: 'Review cash', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(/-.*100/)
  expect((await readWorkspace(page)).cash).toBeNull()
  await page
    .getByRole('checkbox', {
      name: 'I confirm these values and their stated meaning.',
    })
    .check()
  await page
    .getByRole('button', { name: 'Confirm & apply', exact: true })
    .click()
  await saved(page)
  expect((await readWorkspace(page)).cash?.amount).toBe(-100)
  await page.reload()
  await saved(page)
  expect((await readWorkspace(page)).cash).toMatchObject({
    amount: -100,
    phase: 'opening',
    reserve: null,
  })
})

test('recorded purchase receipts produce observed supplier lead times and open-order aging', async ({
  page,
}) => {
  test.setTimeout(90_000)
  page.setDefaultTimeout(10000)
  await begin(page)
  await page.getByLabel('Choose your sales file').setInputFiles({
    name: 'supplier-product.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `date,sku,product,quantity,unit,amount,currency,unit cost\n${shift(today(), -1)},SUP-1,Supplier metric product,10,pieces,100,MXN,5\n${today()},SUP-1,Supplier metric product,10,pieces,100,MXN,5\n`,
    ),
  })
  await confirmSales(page)
  const product = (await readWorkspace(page)).products[0]
  for (const receipt of [
    { received: 10, days: 4 },
    { received: 5, days: 8 },
  ]) {
    await inventoryIntake(page)
    await page
      .getByRole('button', { name: 'Purchasing & suppliers', exact: true })
      .click()
    await page
      .getByLabel('Supplier name', { exact: true })
      .fill('Observed supplier')
    await chooseOption(
      page.getByRole('combobox', { name: 'Product Optional' }),
      `${product.sku} · ${product.name}`,
    )
    await page.getByLabel(/Quoted lead time/).fill('3')
    await page.getByLabel('Purchase quantity', { exact: true }).fill('10')
    await page.getByLabel(/^Purchase amount already paid · MXN/).fill('0')
    await page
      .getByLabel('Order date', { exact: true })
      .fill(shift(today(), -10))
    await page
      .getByLabel('Promised receipt date', { exact: true })
      .fill(shift(today(), -7))
    await chooseOption(
      page.getByRole('combobox', { name: 'Receipt status', exact: true }),
      'Recorded receipt (full or partial)',
    )
    await page
      .getByLabel('Quantity received on the recorded receipt date', {
        exact: true,
      })
      .fill(String(receipt.received))
    await page
      .getByLabel(/^Actual purchase receipt date/)
      .fill(shift(today(), -10 + receipt.days))
    await page
      .getByRole('button', { name: 'Review supplier information', exact: true })
      .click()
    await page
      .getByRole('checkbox', {
        name: 'I confirm these values and their stated meaning.',
      })
      .check()
    await page
      .getByRole('button', { name: 'Confirm & apply', exact: true })
      .click()
    await saved(page)
    await page
      .getByRole('button', { name: 'View my analysis', exact: true })
      .click()
    await saved(page)
  }
  await page.goto('/#/business/dashboards')
  await saved(page)
  await page.getByRole('button', { name: 'Suppliers', exact: true }).click()
  const panel = page.locator('section').filter({
    has: page.getByRole('heading', {
      name: 'Supplier lead time and open-order age',
      exact: true,
    }),
  })
  const observed = panel
    .getByRole('row')
    .filter({ hasText: 'Observed supplier' })
  await expect(observed).toContainText('3 days')
  await expect(observed).toContainText('6 days')
  await expect(observed).toContainText('2.8 days')
  const openOrders = page.getByRole('button', { name: /^Open purchase orders/ })
  await expect(openOrders).toHaveAttribute('aria-expanded', 'true')
  const open = openOrders
    .locator('..')
    .getByRole('row')
    .filter({ hasText: 'Overdue and still open' })
  await expect(open).toContainText('10 days')
  await expect(open).toContainText('5 pieces')
  await page.reload()
  await saved(page)
  expect((await readWorkspace(page)).purchases).toHaveLength(2)
})
