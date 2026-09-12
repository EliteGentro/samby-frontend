import { expect, test } from 'vitest'
import { demoWorkspace, type FinanceEvent } from './workspace'
import { financeEventIssues, financeHistory } from './finance-history'

function fixture() {
  const workspace = demoWorkspace('historical')
  const base = workspace.finance[0]
  workspace.finance = [
    {
      ...base,
      id: 'invoice',
      kind: 'receivable',
      name: 'Invoice A',
      amount: 150,
      paidAmount: 100,
      currency: 'MXN',
      cashIncluded: false,
    },
    {
      ...base,
      id: 'provider',
      kind: 'provider_pending',
      name: 'Provider settlement',
      amount: 100,
      paidAmount: 80,
      currency: 'MXN',
      linkedRecordId: 'invoice',
      cashIncluded: false,
    },
    {
      ...base,
      id: 'bill',
      kind: 'payable',
      name: 'Supplier bill',
      amount: 300,
      paidAmount: 60,
      currency: 'MXN',
    },
  ]
  return workspace
}

function event(
  id: string,
  kind: FinanceEvent['kind'],
  recordId: string,
  amount: number,
  date: string,
  paymentReference = id,
): FinanceEvent {
  return {
    id,
    kind,
    recordId,
    amount,
    date,
    paymentReference,
    currency: 'MXN',
    sourceId: 'observed-payment',
  }
}

test('inclusive reporting periods use observed dates and keep collection/availability stages separate', () => {
  const workspace = fixture(),
    cash = structuredClone(workspace.cash),
    records = structuredClone(workspace.finance)
  workspace.financeEvents = [
    event(
      'receipt',
      'customer_collection',
      'invoice',
      100,
      '2026-08-31',
      'PAY-A',
    ),
    event(
      'available',
      'provider_availability',
      'provider',
      80,
      '2026-09-01',
      'PAY-A',
    ),
    event('paid', 'supplier_payment', 'bill', 60, '2026-09-12'),
  ]
  const current = financeHistory(workspace, '2026-09-01', '2026-09-12')
  expect(current.collections).toBeNull()
  expect(current.available).toBe(80)
  expect(current.payments).toBe(60)
  expect(current.rows.map((row) => row.event.id)).toEqual(['paid', 'available'])
  const full = financeHistory(workspace, '2026-08-31', '2026-09-12', 'internal')
  expect(full.collections).toBe(100)
  expect(full.available).toBe(80)
  expect(full.payments).toBeNull()
  expect(workspace.cash).toEqual(cash)
  expect(workspace.finance).toEqual(records)
})

test('duplicate stage references and overallocated paid histories are excluded instead of double counted', () => {
  const workspace = fixture()
  workspace.financeEvents = [
    event(
      'receipt-1',
      'customer_collection',
      'invoice',
      50,
      '2026-09-01',
      'SAME',
    ),
    event(
      'receipt-2',
      'customer_collection',
      'invoice',
      50,
      '2026-09-02',
      'same',
    ),
    event('overpaid', 'supplier_payment', 'bill', 61, '2026-09-01'),
  ]
  const result = financeHistory(workspace, '2026-09-01', '2026-09-12')
  expect(result.excluded).toHaveLength(3)
  expect(result.collections).toBeNull()
  expect(result.payments).toBeNull()
  expect(result.excluded[0].reason).toContain('unique source reference')
  expect(result.excluded[2].reason).toContain('exceed')
})

test('provider availability cannot precede its matching collection or exceed its payment allocation', () => {
  const workspace = fixture()
  workspace.financeEvents = [
    event(
      'receipt',
      'customer_collection',
      'invoice',
      50,
      '2026-09-05',
      'PAY-A',
    ),
    event(
      'available',
      'provider_availability',
      'provider',
      80,
      '2026-09-04',
      'PAY-A',
    ),
  ]
  expect(
    financeEventIssues(workspace).find((row) => row.event.id === 'available')
      ?.reason,
  ).toContain('precede availability')
})

test('undated cumulative payments remain unallocated, while an explicit observed zero remains zero', () => {
  const workspace = fixture()
  const missing = financeHistory(workspace, '2026-09-01', '2026-09-12')
  expect(missing.collections).toBeNull()
  expect(missing.warnings.join(' ')).toContain('no dated observations')
  workspace.financeEvents = [
    event('zero', 'supplier_payment', 'bill', 0, '2026-09-01'),
    event('future', 'customer_collection', 'invoice', 10, '2026-09-13'),
  ]
  const result = financeHistory(workspace, '2026-09-01', '2026-09-12')
  expect(result.payments).toBe(0)
  expect(result.collections).toBeNull()
  expect(result.excluded[0].reason).toContain('actual historical event date')
})
