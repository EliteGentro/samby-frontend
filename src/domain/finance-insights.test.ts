import { describe, expect, it } from 'vitest'
import { financeInsights } from './finance-insights'
import { demoWorkspace, type FinancialRecord } from './workspace'
const record = (
  id: string,
  amount: number,
  dueDate: string | null,
  expectedDate: string | null,
  patch: Partial<FinancialRecord> = {},
): FinancialRecord => ({
  id,
  name: id,
  kind: 'receivable',
  counterparty: 'Customer A',
  amount,
  paidAmount: 0,
  currency: 'MXN',
  dueDate,
  expectedDate,
  category: 'collections',
  linkedRecordId: null,
  cashIncluded: false,
  ...patch,
})
const asOf = '2026-09-12'
describe('ordinary financial insight arithmetic', () => {
  it('separates invoice remainder, provider availability, overdue bands and known denominator', () => {
    const w = demoWorkspace('finance')
    w.finance = [
      record('invoice', 100, '2026-08-13', '2026-09-15', { paidAmount: 40 }),
      record('provider', 40, '2026-08-13', '2026-09-13', {
        kind: 'provider_pending',
        linkedRecordId: 'invoice',
      }),
      record('unknown-party', 50, null, null, { counterparty: '' }),
      record('today', 10, asOf, '2026-09-15'),
      record('future', 20, '2026-09-20', '2026-10-20'),
      record('settled', 30, '2026-08-01', null, { paidAmount: 30 }),
    ]
    const result = financeInsights(w, 'internal', asOf, asOf, '2026-10-11')
    expect(result.total).toBe(180)
    expect(result.overdue).toBe(60)
    expect(result.providerPending).toBe(40)
    expect(result.aging.find((band) => band.key === '1-30')?.amount).toBe(60)
    expect(result.aging.find((band) => band.key === 'due-today')?.amount).toBe(
      10,
    )
    expect(result.aging.find((band) => band.key === 'provider')?.amount).toBe(
      40,
    )
    expect(
      result.concentration.find((party) => party.name === 'Customer A')?.share,
    ).toBeCloseTo((130 / 180) * 100)
    expect(
      result.concentration.find(
        (party) => party.name === 'Unassigned counterparty',
      )?.amount,
    ).toBe(50)
    expect(result.unscheduled).toBe(50)
    expect(result.beyondWindow).toBe(20)
    expect(result.settledCount).toBe(1)
    expect(result.timeline).toEqual([
      {
        date: '2026-09-13',
        receivable: 0,
        provider: 40,
        payable: 0,
        recordIds: ['provider'],
      },
      {
        date: '2026-09-15',
        receivable: 70,
        provider: 0,
        payable: 0,
        recordIds: ['invoice', 'today'],
      },
    ])
  })
  it('excludes unreconciled stages, mixed currency, invalid balances and duplicate identities', () => {
    const w = demoWorkspace('finance')
    w.finance = [
      record('valid', 100, null, null),
      record('dup', 90, null, null),
      record('dup', 90, null, null),
      record('foreign', 300, null, null, { currency: 'USD' }),
      record('invalid', 10, null, null, { paidAmount: 20 }),
      record('unlinked', 40, null, null, { kind: 'provider_pending' }),
      record('cash', 500, null, null, { cashIncluded: true }),
    ]
    const result = financeInsights(w, 'internal')
    expect(result.total).toBe(100)
    expect(result.excluded).toHaveLength(6)
    expect(result.concentration[0].share).toBe(100)
  })
  it('uses literal aging boundaries and never treats a due date as an expected payment', () => {
    const w = demoWorkspace('finance')
    w.finance = [
      record('31', 31, '2026-08-12', null, { kind: 'payable' }),
      record('61', 61, '2026-07-13', '2026-09-11', { kind: 'payable' }),
      record('91', 91, '2026-06-13', '2026-09-12', { kind: 'payable' }),
    ]
    const result = financeInsights(w, 'external', asOf, asOf, '2026-09-12')
    expect(result.total).toBe(183)
    expect(result.overdue).toBe(183)
    expect(
      result.aging
        .filter((band) => band.amount > 0)
        .map((band) => [band.key, band.amount]),
    ).toEqual([
      ['31-60', 31],
      ['61-90', 61],
      ['91+', 91],
    ])
    expect(result.unscheduled).toBe(31)
    expect(result.beforeWindow).toBe(61)
    expect(result.timeline[0].payable).toBe(91)
  })
  it('does not add linked purchase amounts or expected commitments to payable debt', () => {
    const w = demoWorkspace('finance')
    w.finance = [
      record('bill', 100, asOf, asOf, {
        kind: 'payable',
        paidAmount: 20,
        linkedRecordId: w.purchases[0].id,
      }),
    ]
    expect(financeInsights(w, 'external').total).toBe(80)
  })
  it('preserves known zero but does not manufacture zero from absent or excluded records', () => {
    const w = demoWorkspace('finance')
    w.finance = []
    expect(financeInsights(w, 'internal').total).toBeNull()
    w.finance = [record('invalid', 50, null, null, { paidAmount: 60 })]
    expect(financeInsights(w, 'internal').total).toBeNull()
    w.finance = [record('settled', 50, null, null, { paidAmount: 50 })]
    expect(financeInsights(w, 'internal').total).toBe(0)
    expect(financeInsights(w, 'internal').concentration).toEqual([])
  })
  it('does not relabel current balances as historical aging and retains source scope', () => {
    const w = demoWorkspace('finance')
    w.finance = [
      record('current', 100, '2026-08-01', '2026-09-15', {
        sourceId: w.sources[0].id,
      }),
    ]
    const result = financeInsights(
      w,
      'internal',
      '2026-08-31',
      '2026-09-01',
      '2026-09-30',
    )
    expect(result.historicalUnavailable).toBe(true)
    expect(result.total).toBeNull()
    expect(result.aging).toEqual([])
    expect(result.concentration).toEqual([])
    expect(result.timeline[0].receivable).toBe(100)
    expect(result.asOf).toBe(asOf)
    expect(result.sources[0].id).toBe(w.sources[0].id)
  })
})
