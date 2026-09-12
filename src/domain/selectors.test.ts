import { expect, test, vi } from 'vitest'
import {
  availability,
  cutoff,
  demoWorkspace,
  emptyWorkspace,
  money,
} from './workspace'
import {
  financeTotals,
  comparisonWindow,
  periodWindow,
  salesSummary,
  salesComparison,
  stockValue,
  supplierPerformance,
} from './selectors'
import { workspaceNotices } from './notifications'

test('business cutoff follows the configured timezone and monetary display retains currency fractions', () => {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(new Date('2026-09-13T02:30:00Z'))
    const workspace = emptyWorkspace('timezone')
    expect(
      cutoff({
        ...workspace,
        profile: { ...workspace.profile, timezone: 'America/Monterrey' },
      }),
    ).toBe('2026-09-12')
    expect(
      cutoff({
        ...workspace,
        profile: { ...workspace.profile, timezone: 'Asia/Tokyo' },
      }),
    ).toBe('2026-09-13')
    expect(money(100.25, 'MXN')).toContain('100.25')
    expect(money(0.01, 'USD')).toContain('0.01')
    expect(money(null)).toBe('Not provided')
  } finally {
    vi.useRealTimers()
  }
})

test('unknown reservations and overlapping aggregate stock cannot become zero or partial availability', () => {
  const w = demoWorkspace('demo')
  w.stock[0].reserved = null
  expect(availability(w, 'p-1')).toBeNull()
  w.stock[0].reserved = 0
  expect(availability(w, 'p-1')).toBe(560)
  w.stock.push({ ...w.stock[0], id: 'aggregate', locationId: null })
  expect(availability(w, 'p-1')).toBeNull()
  expect(availability(w, 'absent')).toBeNull()
})
test('sales without cost or quantities cannot manufacture margin and mismatched currency is excluded', () => {
  const w = demoWorkspace('demo')
  const sales = [
    { ...w.sales[0], quantity: null, amount: 100 },
    { ...w.sales[1], currency: 'USD', amount: 900 },
  ]
  const result = salesSummary(w, sales)
  expect(result.revenue).toBe(100)
  expect(result.margin).toBeNull()
  expect(result.revenueRows).toBe(1)
  w.stock.forEach((s) => (s.quantityBasis = 'available'))
  expect(stockValue(w).value).toBeNull()
})
test('calendar periods cap current quarter and supplier history does not read later receipts', () => {
  expect(periodWindow('Selected quarter', '2026-09-12', 2026, 3)).toEqual({
    start: '2026-07-01',
    end: '2026-09-12',
  })
  expect(periodWindow('Previous quarter', '2026-09-12')).toEqual({
    start: '2026-04-01',
    end: '2026-06-30',
  })
  const w = demoWorkspace('demo')
  w.purchases = [
    {
      ...w.purchases[0],
      promisedDate: '2026-08-30',
      receivedDate: '2026-09-01',
      receivedQuantity: 120,
    },
  ]
  expect(
    supplierPerformance(w, '2026-08-01', '2026-08-31').inFull,
  ).toHaveLength(0)
})
test('notification dismissal, snooze, mute and global settings do not change records or readiness', () => {
  const w = emptyWorkspace('test')
  w.cash = { amount: 100, date: '2026-09-12', phase: 'opening', reserve: null }
  expect(workspaceNotices(w).some((n) => n.id === 'cash-coverage')).toBe(true)
  w.notifications.snoozedUntil = { 'cash-coverage': '2100-01-01' }
  expect(workspaceNotices(w)).toHaveLength(0)
  w.notifications.snoozedUntil = {}
  w.muted = ['liquidity']
  expect(workspaceNotices(w)).toHaveLength(0)
  expect(w.cash.amount).toBe(100)
  w.muted = []
  w.notifications.enabled = false
  expect(workspaceNotices(w)).toHaveLength(0)
})

test('incompatible amount definitions are not silently summed into one sales total', () => {
  const w = demoWorkspace('demo')
  const rows = [
    { ...w.sales[0], amount: 100, amountBasis: 'Net excluding tax' },
    { ...w.sales[1], amount: 116, amountBasis: 'Gross including tax' },
  ]
  expect(salesSummary(w, rows).revenue).toBeNull()
  expect(salesSummary(w, rows).basisConflict).toBe(true)
})
test('provider funds already reflected in cash do not remain in Internal Debt and unreconciled stages are visible', () => {
  const w = demoWorkspace('demo')
  const before = financeTotals(w)
  w.finance.find((f) => f.kind === 'provider_pending')!.cashIncluded = true
  expect(financeTotals(w).internal).toBe(before.internal! - 10000)
  const pending = w.finance.find((f) => f.kind === 'provider_pending')!
  pending.cashIncluded = false
  pending.linkedRecordId = null
  expect(financeTotals(w).issues).toHaveLength(1)
  expect(financeTotals(w).internal).toBe(before.internal! - 10000)
})

test('rolling comparisons use adjacent equal-duration windows and quarters use calendar boundaries', () => {
  expect(
    comparisonWindow('Last 7 days', { start: '2026-09-06', end: '2026-09-12' }),
  ).toEqual({
    start: '2026-08-30',
    end: '2026-09-05',
    label: 'Previous 7 days',
  })
  expect(
    comparisonWindow('Last 30 days', {
      start: '2026-08-14',
      end: '2026-09-12',
    }),
  ).toEqual({
    start: '2026-07-15',
    end: '2026-08-13',
    label: 'Previous 30 days',
  })
  expect(
    comparisonWindow('Selected quarter', {
      start: '2026-07-01',
      end: '2026-09-12',
    }),
  ).toEqual({
    start: '2026-04-01',
    end: '2026-06-30',
    label: 'Previous quarter',
  })
  expect(periodWindow('Last 12 months', '2024-02-29')).toEqual({
    start: '2023-03-01',
    end: '2024-02-29',
  })
})

test('period comparisons reject incompatible amount definitions and preserve a zero baseline', () => {
  const w = demoWorkspace('comparison')
  const net = salesSummary(w, [
    { ...w.sales[0], amount: 100, amountBasis: 'Net excluding tax' },
  ])
  const gross = salesSummary(w, [
    { ...w.sales[0], amount: 116, amountBasis: 'Gross including tax' },
  ])
  expect(salesComparison(net, gross).absolute).toBeNull()
  const zero = salesSummary(w, [
    { ...w.sales[0], amount: 0, amountBasis: 'Net excluding tax' },
  ])
  expect(salesComparison(net, zero)).toMatchObject({
    absolute: 100,
    percentage: null,
  })
})

test('historical costs take priority and explicit unknown historical costs cannot use current prices', () => {
  const w = demoWorkspace('costs')
  w.products[0].cost = 90
  const sale = {
    ...w.sales[0],
    quantity: 2,
    amount: 100,
    unitCost: 10,
    costUnit: w.products[0].unit,
    amountBasis: 'Net excluding tax',
  }
  expect(salesSummary(w, [sale])).toMatchObject({
    grossProfit: 80,
    margin: 80,
    currentCostRows: 0,
  })
  expect(salesSummary(w, [{ ...sale, unitCost: null }]).grossProfit).toBeNull()
  expect(
    salesSummary(w, [{ ...sale, costUnit: 'incompatible' }]).grossProfit,
  ).toBeNull()
})

test('ordinary debt summaries exclude cash-included and duplicate stages and keep absent balances unknown', () => {
  const w = demoWorkspace('stages')
  const invoice = {
    ...w.finance[0],
    id: 'invoice',
    kind: 'receivable' as const,
    amount: 100,
    paidAmount: 40,
    currency: 'MXN',
    cashIncluded: false,
  }
  const provider = {
    ...invoice,
    id: 'provider',
    kind: 'provider_pending' as const,
    amount: 40,
    paidAmount: 0,
    linkedRecordId: 'invoice',
  }
  w.finance = [invoice, provider]
  expect(financeTotals(w).internal).toBe(100)
  w.finance = [{ ...invoice, cashIncluded: true }, provider]
  expect(financeTotals(w).internal).toBeNull()
  w.finance = [invoice, provider, provider]
  expect(financeTotals(w).internal).toBe(60)
  expect(financeTotals(w).issues.length).toBeGreaterThan(0)
  w.finance = [{ ...invoice, currency: 'USD' }]
  expect(financeTotals(w).internal).toBeNull()
})
