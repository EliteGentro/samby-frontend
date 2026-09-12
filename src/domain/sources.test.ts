import { describe, expect, it } from 'vitest'
import { sourceRecordCounts, removeSourceRecords } from './sources'
import { capabilities, emptyWorkspace } from './workspace'
describe('source-linked partial financial records', () => {
  it('retains incomplete visibility without monetary readiness and removes dependent event rows with their financial record', () => {
    const w = emptyWorkspace('pending-source')
    w.sources = [
      {
        id: 'source',
        name: 'Original invoice',
        type: 'manual',
        rowCount: 1,
        excludedCount: 0,
        importedAt: '2026-09-12',
      },
    ]
    w.pendingFinance = [
      {
        id: 'pending',
        name: 'Supplier bill',
        counterparty: 'Supplier',
        kind: 'payable',
        amount: null,
        paidAmount: null,
        currency: 'MXN',
        dueDate: null,
        expectedDate: null,
        sourceId: 'source',
      },
    ]
    expect(capabilities.find((c) => c.id === 'external-debt')!.check(w)).toBe(
      true,
    )
    expect(capabilities.find((c) => c.id === 'liquidity')!.check(w)).toBe(false)
    w.finance = [
      {
        id: 'known',
        name: 'Invoice',
        counterparty: 'Customer',
        kind: 'receivable',
        amount: 100,
        paidAmount: 25,
        currency: 'MXN',
        dueDate: null,
        expectedDate: null,
        linkedRecordId: null,
        cashIncluded: false,
        category: 'collections',
        sourceId: 'source',
      },
    ]
    w.financeEvents = [
      {
        id: 'event',
        sourceId: 'other-source',
        recordId: 'known',
        kind: 'customer_collection',
        paymentReference: 'receipt-25',
        date: '2026-09-12',
        amount: 25,
        currency: 'MXN',
      },
    ]
    expect(sourceRecordCounts(w, 'source')).toMatchObject({
      pendingFinance: 1,
      finance: 1,
      financeEvents: 1,
    })
    const result = removeSourceRecords(w, 'source')
    expect(result.pendingFinance).toEqual([])
    expect(result.finance).toEqual([])
    expect(result.financeEvents).toEqual([])
    expect(w.pendingFinance).toHaveLength(1)
    expect(w.financeEvents).toHaveLength(1)
  })
})
