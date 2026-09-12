import { expect, test, type Page } from '@playwright/test'

const api = 'http://127.0.0.1:8001/api/prototype'
const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10)

async function recordEvent(
  page: Page,
  kind: string,
  recordId: string,
  paymentReference: string,
  date: string,
  amount: string,
) {
  await page
    .getByRole('button', { name: 'Record historical payment', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Record an observed payment stage',
  })
  await dialog
    .getByRole('combobox', { name: 'Observed stage' })
    .selectOption(kind)
  await dialog
    .getByRole('combobox', { name: 'Linked financial record' })
    .selectOption(recordId)
  await dialog
    .getByRole('textbox', { name: 'Payment or allocation reference' })
    .fill(paymentReference)
  await dialog.getByLabel('Actual event date', { exact: true }).fill(date)
  await dialog
    .getByRole('spinbutton', { name: 'Observed amount', exact: true })
    .fill(amount)
  await dialog
    .getByRole('button', { name: 'Review historical event', exact: true })
    .click()
  await expect(
    dialog.getByRole('button', {
      name: 'Confirm historical event',
      exact: true,
    }),
  ).toBeDisabled()
  await dialog
    .getByRole('checkbox', {
      name: 'I verified this historical event against its source',
    })
    .check()
  await dialog
    .getByRole('button', { name: 'Confirm historical event', exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
}

test('historical collection and availability preserve their stages, reporting dates and durable balances', async ({
  page,
  request,
}) => {
  await page.goto('/#/business/finance')
  await expect(page.getByText('Saved to Samby', { exact: true })).toBeVisible()
  const credentials = await page.evaluate(() => {
    const id = localStorage.getItem('samby.workspace-id.business')!
    return { id, key: localStorage.getItem(`samby.workspace-key.${id}`)! }
  })
  const headers = {
    'X-Workspace-ID': credentials.id,
    'X-Workspace-Key': credentials.key,
  }
  const read = await request.get(`${api}/workspaces/${credentials.id}`, {
    headers,
  })
  expect(read.ok()).toBe(true)
  const current = await read.json()
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: current.workspace.profile.timezone,
  }).format(new Date())
  const paymentReference = `BANK-${crypto.randomUUID()}`
  const base = {
    counterparty: 'Historical customer',
    currency: 'MXN',
    category: 'collections',
    dueDate: shift(today, -15),
    expectedDate: null,
    cashIncluded: false,
    sourceId: 'finance-history-fixture',
  }
  const finance = [
    {
      ...base,
      id: 'history-invoice',
      kind: 'receivable',
      name: 'Historical invoice',
      amount: 200,
      paidAmount: 100,
      linkedRecordId: null,
    },
    {
      ...base,
      id: 'history-provider',
      kind: 'provider_pending',
      name: 'Historical provider funds',
      amount: 100,
      paidAmount: 80,
      linkedRecordId: 'history-invoice',
    },
  ]
  const cash = { amount: 500, date: today, phase: 'opening', reserve: 20 }
  const workspace = {
    ...current.workspace,
    finance,
    cash,
    sources: [
      ...current.workspace.sources,
      {
        id: 'finance-history-fixture',
        name: 'Reviewed financial balances',
        type: 'manual',
        importedAt: new Date().toISOString(),
        rowCount: 2,
        excludedCount: 0,
      },
    ],
  }
  const setup = await request.put(`${api}/workspaces/${credentials.id}`, {
    headers,
    data: { workspace, expected_revision: current.revision },
  })
  expect(setup.ok()).toBe(true)
  await page.reload()
  await expect(page.getByText('Saved to Samby', { exact: true })).toBeVisible()

  await recordEvent(
    page,
    'customer_collection',
    'history-invoice',
    paymentReference,
    shift(today, -10),
    '100',
  )
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`${api}/workspaces/${credentials.id}`, {
              headers,
            })
          ).json()
        ).workspace.financeEvents?.length,
    )
    .toBe(1)
  await recordEvent(
    page,
    'provider_availability',
    'history-provider',
    paymentReference,
    shift(today, -3),
    '80',
  )
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`${api}/workspaces/${credentials.id}`, {
              headers,
            })
          ).json()
        ).workspace.financeEvents?.length,
    )
    .toBe(2)

  const panel = page
    .locator('section.panel')
    .filter({
      has: page.getByRole('heading', {
        name: 'Recorded collections and payments',
        exact: true,
      }),
    })
  const collections = panel
    .locator('.metric-card')
    .filter({ hasText: 'Customer collections recorded' })
    .locator('.metric-value')
  const available = panel
    .locator('.metric-card')
    .filter({ hasText: 'Provider funds made available' })
    .locator('.metric-value')
  await expect(collections).toContainText('100')
  await expect(available).toContainText('80')
  await panel
    .getByRole('combobox', { name: 'Historical reporting window' })
    .selectOption('7')
  await expect(collections).toHaveText('Not provided')
  await expect(available).toContainText('80')
  await expect(
    panel.getByRole('rowheader', { name: shift(today, -3), exact: true }),
  ).toBeVisible()
  await expect(
    panel.getByRole('rowheader', { name: shift(today, -10), exact: true }),
  ).toHaveCount(0)

  await page.reload()
  await expect(page.getByText('Saved to Samby', { exact: true })).toBeVisible()
  await expect(collections).toContainText('100')
  await expect(available).toContainText('80')
  await expect(
    panel.getByText(`Manual historical payment · ${paymentReference}`, {
      exact: true,
    }),
  ).toHaveCount(2)
  const restored = (
    await (
      await request.get(`${api}/workspaces/${credentials.id}`, { headers })
    ).json()
  ).workspace
  expect(restored.cash).toEqual(cash)
  expect(restored.finance).toEqual(finance)
  expect(restored.financeEvents).toHaveLength(2)
  expect(
    new Set(restored.financeEvents.map((event: { id: string }) => event.id))
      .size,
  ).toBe(2)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth))
})
