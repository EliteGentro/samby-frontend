import { expect, test, type Page } from '@playwright/test'
import { chooseOption } from './helpers/controls'

const api = 'http://127.0.0.1:8001/api/prototype'
const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10)

async function recordEvent(
  page: Page,
  stage: string,
  recordName: string,
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
  await chooseOption(
    dialog.getByRole('combobox', { name: 'Observed stage' }),
    stage,
  )
  await chooseOption(
    dialog.getByRole('combobox', { name: 'Linked financial record' }),
    recordName,
  )
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
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
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
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()

  await recordEvent(
    page,
    'Customer collection',
    'Historical invoice · Historical customer',
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
    'Provider funds made available',
    'Historical provider funds · Historical customer',
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

  const panel = page.locator('section.panel').filter({
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
  const observedDate = panel.getByRole('columnheader', {
    name: 'Observed date',
    exact: true,
  })
  const observedDates = panel.locator('tbody tr th[scope="row"]')
  await observedDate
    .getByRole('button', { name: 'Observed date', exact: true })
    .click()
  await expect(observedDate).toHaveAttribute('aria-sort', 'descending')
  await expect(observedDates).toHaveText([shift(today, -3), shift(today, -10)])
  await observedDate
    .getByRole('button', { name: 'Observed date', exact: true })
    .click()
  await expect(observedDate).toHaveAttribute('aria-sort', 'ascending')
  await expect(observedDates).toHaveText([shift(today, -10), shift(today, -3)])
  await observedDate
    .getByRole('button', { name: 'Observed date', exact: true })
    .click()
  await expect(observedDate).toHaveAttribute('aria-sort', 'none')
  await expect(observedDates).toHaveText([shift(today, -3), shift(today, -10)])
  await chooseOption(
    panel.getByRole('combobox', { name: 'Historical reporting window' }),
    'Last 7 days',
  )
  await expect(collections).toHaveText('Not provided')
  await expect(available).toContainText('80')
  await expect(
    panel.getByRole('rowheader', { name: shift(today, -3), exact: true }),
  ).toBeVisible()
  await expect(
    panel.getByRole('rowheader', { name: shift(today, -10), exact: true }),
  ).toHaveCount(0)

  await page.reload()
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
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
