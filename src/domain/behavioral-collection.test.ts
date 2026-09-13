import { describe, expect, it } from 'vitest'
import {
  behavioralCollectionMatrix,
  calculatePercentile,
  diffInDays,
  ASEM_STRESS_DAYS,
} from './behavioral-collection'
import { demoWorkspace, shiftDate, type Workspace } from './workspace'

function baseWorkspace(): Workspace {
  const w = demoWorkspace('test-ws')
  // Clean financial records for controlled tests
  w.finance = []
  w.financeEvents = []
  return w
}

describe('behavioral-collection domain', () => {
  it('calculates exact percentiles correctly', () => {
    expect(calculatePercentile([], 0.5)).toBe(0)
    expect(calculatePercentile([10], 0.5)).toBe(10)
    expect(calculatePercentile([10, 20, 30], 0.5)).toBe(20)
    expect(calculatePercentile([0, 10, 20, 30, 40], 0.8)).toBe(32)
    expect(calculatePercentile([5, 15, 25, 35, 45], 0.5)).toBe(25)
  })

  it('calculates day differences accurately', () => {
    expect(diffInDays('2026-09-15', '2026-09-10')).toBe(5)
    expect(diffInDays('2026-09-10', '2026-09-15')).toBe(-5)
    expect(diffInDays('2026-09-10', '2026-09-10')).toBe(0)
  })

  it('builds empirical P50 and P80 profiles from historical collections', () => {
    const w = baseWorkspace()
    const asOf = '2026-09-12'

    // Historical paid invoices for "Cliente Alpha"
    w.finance.push(
      {
        id: 'inv-hist-1',
        kind: 'receivable',
        name: 'Alpha Factura 1',
        counterparty: 'Cliente Alpha',
        amount: 10000,
        paidAmount: 10000,
        currency: 'MXN',
        dueDate: '2026-08-01',
        expectedDate: '2026-08-05', // +4 days delay
        category: 'collections',
        linkedRecordId: null,
        cashIncluded: false,
      },
      {
        id: 'inv-hist-2',
        kind: 'receivable',
        name: 'Alpha Factura 2',
        counterparty: 'Cliente Alpha',
        amount: 15000,
        paidAmount: 15000,
        currency: 'MXN',
        dueDate: '2026-08-10',
        expectedDate: '2026-08-20', // +10 days delay
        category: 'collections',
        linkedRecordId: null,
        cashIncluded: false,
      },
      {
        id: 'inv-hist-3',
        kind: 'receivable',
        name: 'Alpha Factura 3',
        counterparty: 'Cliente Alpha',
        amount: 20000,
        paidAmount: 20000,
        currency: 'MXN',
        dueDate: '2026-08-15',
        expectedDate: '2026-08-31', // +16 days delay
        category: 'collections',
        linkedRecordId: null,
        cashIncluded: false,
      },
    )

    // Finance events linking payments to invoices
    w.financeEvents = [
      {
        id: 'ev-1',
        sourceId: 's1',
        kind: 'customer_collection',
        recordId: 'inv-hist-1',
        paymentReference: 'PAG-001',
        date: '2026-08-05',
        amount: 10000,
        currency: 'MXN',
      },
      {
        id: 'ev-2',
        sourceId: 's1',
        kind: 'customer_collection',
        recordId: 'inv-hist-2',
        paymentReference: 'PAG-002',
        date: '2026-08-20',
        amount: 15000,
        currency: 'MXN',
      },
      {
        id: 'ev-3',
        sourceId: 's1',
        kind: 'customer_collection',
        recordId: 'inv-hist-3',
        paymentReference: 'PAG-003',
        date: '2026-08-31',
        amount: 20000,
        currency: 'MXN',
      },
    ]

    // Active open invoice for Cliente Alpha
    w.finance.push({
      id: 'inv-open-1',
      kind: 'receivable',
      name: 'Alpha Factura Abierta',
      counterparty: 'Cliente Alpha',
      amount: 25000,
      paidAmount: 0,
      currency: 'MXN',
      dueDate: '2026-09-20',
      expectedDate: null,
      category: 'collections',
      linkedRecordId: null,
      cashIncluded: false,
    })

    const result = behavioralCollectionMatrix(w, { asOf })

    expect(result.openInvoiceCount).toBe(1)
    expect(result.totalOutstanding).toBe(25000)

    const alphaProfile = result.customerProfiles.find(
      (p) => p.customer === 'Cliente Alpha',
    )
    expect(alphaProfile).toBeDefined()
    expect(alphaProfile?.sampleCount).toBe(3)
    expect(alphaProfile?.totalPaidAmount).toBe(45000)
    // Delays are [4, 10, 16] -> P50 is 10, P80 is 14
    expect(alphaProfile?.p50DelayDays).toBe(10)
    expect(alphaProfile?.p80DelayDays).toBe(14)

    const pred = result.predictions[0]
    expect(pred.naiveExpectedDate).toBe('2026-09-20') // contractual due date
    expect(pred.p50ExpectedDate).toBe(shiftDate('2026-09-20', 10)) // 2026-09-30
    expect(pred.p80ExpectedDate).toBe(shiftDate('2026-09-20', 14)) // 2026-10-04
    expect(pred.asemExpectedDate).toBe(
      shiftDate('2026-09-20', 10 + ASEM_STRESS_DAYS),
    )
    expect(pred.confidence).toBe('medium')
  })

  it('shifts payment dates by +76 days and redistributes buckets when ASEM Stress is toggled', () => {
    const w = baseWorkspace()
    const asOf = '2026-09-12'

    // Add historical payment (0 delay)
    w.finance.push(
      {
        id: 'hist-1',
        kind: 'receivable',
        name: 'Hist 1',
        counterparty: 'Pyme Partner',
        amount: 50000,
        paidAmount: 50000,
        currency: 'MXN',
        dueDate: '2026-08-01',
        expectedDate: '2026-08-01',
        category: 'collections',
        linkedRecordId: null,
        cashIncluded: false,
      },
      // Open invoice due in 10 days
      {
        id: 'open-1',
        kind: 'receivable',
        name: 'Open 1',
        counterparty: 'Pyme Partner',
        amount: 50000,
        paidAmount: 0,
        currency: 'MXN',
        dueDate: '2026-09-22', // 10 days from asOf
        expectedDate: null,
        category: 'collections',
        linkedRecordId: null,
        cashIncluded: false,
      },
    )

    w.financeEvents = [
      {
        id: 'ev-1',
        sourceId: 's1',
        kind: 'customer_collection',
        recordId: 'hist-1',
        paymentReference: 'REF-1',
        date: '2026-08-01',
        amount: 50000,
        currency: 'MXN',
      },
    ]

    // Normal P50 run
    const normal = behavioralCollectionMatrix(w, {
      asOf,
      perspective: 'p50',
      asemStress: false,
    })
    expect(normal.matrixTotals['0-30']).toBe(50000)
    expect(normal.matrixTotals['91-120']).toBe(0)
    expect(normal.matrixTotals['120+']).toBe(0)
    expect(normal.asemStressEnabled).toBe(false)

    // Stressed ASEM run (+76 days)
    const stressed = behavioralCollectionMatrix(w, {
      asOf,
      perspective: 'p50',
      asemStress: true,
    })
    expect(stressed.asemStressEnabled).toBe(true)
    // Invoice was due in 10 days, + 76 days = 86 days -> bucket '61-90' or '91-120'
    expect(stressed.matrixTotals['0-30']).toBe(0)
    expect(stressed.matrixTotals['61-90']).toBe(50000)
    expect(stressed.predictions[0].asemDelayDays).toBe(0 + 76)
    expect(stressed.predictions[0].activeExpectedDate).toBe(
      shiftDate('2026-09-22', 76),
    )
    expect(
      stressed.warnings.some((msg) => msg.includes('ASEM stress active')),
    ).toBe(true)
  })

  it('uses portfolio benchmark when an open customer has no past invoices with us', () => {
    const w = baseWorkspace()
    const asOf = '2026-09-12'

    // Historical data only for "Cliente Antiguo"
    w.finance.push(
      {
        id: 'hist-old',
        kind: 'receivable',
        name: 'Hist Old',
        counterparty: 'Cliente Antiguo',
        amount: 30000,
        paidAmount: 30000,
        currency: 'MXN',
        dueDate: '2026-08-01',
        expectedDate: '2026-08-11', // +10 delay
        category: 'collections',
        linkedRecordId: null,
        cashIncluded: false,
      },
      // Open invoice for "Cliente Nuevo" (no history)
      {
        id: 'open-new',
        kind: 'receivable',
        name: 'Open New',
        counterparty: 'Cliente Nuevo',
        amount: 40000,
        paidAmount: 0,
        currency: 'MXN',
        dueDate: '2026-09-25',
        expectedDate: null,
        category: 'collections',
        linkedRecordId: null,
        cashIncluded: false,
      },
    )

    w.financeEvents = [
      {
        id: 'ev-old',
        sourceId: 's1',
        kind: 'customer_collection',
        recordId: 'hist-old',
        paymentReference: 'REF-OLD',
        date: '2026-08-11',
        amount: 30000,
        currency: 'MXN',
      },
    ]

    const result = behavioralCollectionMatrix(w, { asOf })
    const newPred = result.predictions.find(
      (p) => p.customer === 'Cliente Nuevo',
    )
    expect(newPred).toBeDefined()
    expect(newPred?.isBenchmark).toBe(true)
    expect(newPred?.confidence).toBe('portfolio-benchmark')
    // Uses the portfolio delay of +10 days
    expect(newPred?.p50DelayDays).toBe(10)
    expect(newPred?.p50ExpectedDate).toBe(shiftDate('2026-09-25', 10))
  })
})
