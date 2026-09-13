import { expect, test } from '@playwright/test'
import { BACKEND_URL } from './config'

const api = BACKEND_URL
const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10)

test('collection matrix shifts empirical buckets and opens working scenario presets', async ({
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
  const response = await request.get(`${api}/workspaces/${credentials.id}`, {
    headers,
  })
  expect(response.ok()).toBe(true)
  const current = await response.json()
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: current.workspace.profile.timezone,
  }).format(new Date())
  const common = {
    kind: 'receivable',
    counterparty: 'Matrix customer',
    currency: 'MXN',
    category: 'collections',
    expectedDate: null,
    linkedRecordId: null,
    cashIncluded: false,
    sourceId: 'matrix-source',
  }
  const historical = [4, 10, 16].map((delay) => ({
    ...common,
    id: `matrix-history-${delay}`,
    name: `Observed invoice ${delay}`,
    amount: 10000,
    paidAmount: 10000,
    dueDate: shift(today, -60),
  }))
  const financeEvents = [4, 10, 16].map((delay) => ({
    id: `matrix-event-${delay}`,
    kind: 'customer_collection',
    recordId: `matrix-history-${delay}`,
    sourceId: 'matrix-source',
    paymentReference: `MATRIX-${delay}`,
    date: shift(today, -60 + delay),
    amount: 10000,
    currency: 'MXN',
  }))
  const setup = await request.put(`${api}/workspaces/${credentials.id}`, {
    headers,
    data: {
      workspace: {
        ...current.workspace,
        finance: [
          ...historical,
          {
            ...common,
            id: 'matrix-open',
            name: 'Open matrix invoice',
            amount: 25000,
            paidAmount: 0,
            dueDate: shift(today, 20),
          },
        ],
        financeEvents,
        sources: [
          {
            id: 'matrix-source',
            name: 'Reviewed matrix observations',
            type: 'manual',
            importedAt: new Date().toISOString(),
            rowCount: 4,
            excludedCount: 0,
          },
        ],
      },
      expected_revision: current.revision,
    },
  })
  expect(setup.ok()).toBe(true)
  await page.reload()
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Internal Debt', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Behavioral Cash Collection Matrix' }),
  ).toBeVisible()
  const matrix = page.getByRole('region', {
    name: 'Matriz Conductual de Cobro',
  })
  const cells = matrix
    .getByRole('row')
    .filter({ hasText: 'Matrix customer' })
    .getByRole('cell')
  await expect(matrix).toContainText(
    'Comportamiento Empírico P50 (Más probable)',
  )
  await expect(cells.nth(1)).toHaveText('MX$25,000')
  await expect(cells.nth(2)).toHaveText('MX$25,000')
  await expect(cells.nth(3)).toHaveText('—')
  await page
    .getByRole('button', {
      name: 'P80 Empírico (Conservador / Riesgo 80%)',
      exact: true,
    })
    .click()
  await expect(matrix).toContainText(
    'Comportamiento Empírico P80 (Conservador)',
  )
  await expect(cells.nth(2)).toHaveText('—')
  await expect(cells.nth(3)).toHaveText('MX$25,000')
  await page
    .getByRole('button', { name: 'Activar Estrés ASEM (+76d)', exact: true })
    .click()
  await expect(
    page.getByRole('button', {
      name: 'Estrés ASEM Activo (+76d)',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(cells.nth(3)).toHaveText('—')
  await expect(cells.nth(5)).toHaveText('MX$25,000')
  await expect(
    page
      .locator('.metric-card')
      .filter({ hasText: 'Plazo con Estrés ASEM (+76d)' }),
  ).toContainText('106 días')
  await page
    .getByRole('button', { name: 'Simular en Escenarios', exact: true })
    .click()
  await expect(page).toHaveURL(/\/analysis\?question=Q-CUSTOMER-DEBT&delay=86$/)
  const editor = page.getByRole('dialog')
  await expect(
    editor.getByRole('textbox', {
      name: 'Definition name (required to run)',
      exact: true,
    }),
  ).toHaveValue('Explore later customer payments')
  const delay = editor.getByRole('spinbutton', {
    name: /^Collection timing change in days/,
  })
  await editor
    .getByRole('button', { name: 'P50 Empírico (+10d)', exact: true })
    .click()
  await expect(delay).toHaveValue('10')
  await editor
    .getByRole('button', { name: 'P80 Empírico (+14d)', exact: true })
    .click()
  await expect(delay).toHaveValue('14')
  const stress = editor.getByRole('button', {
    name: 'Estrés ASEM (+76d)',
    exact: true,
  })
  await stress.click()
  await expect(delay).toHaveValue('86')
  await expect(
    editor.getByText(/Efecto ASEM de 76 días aplicado:/),
  ).toBeVisible()
  await stress.click()
  await expect(delay).toHaveValue('10')
})
