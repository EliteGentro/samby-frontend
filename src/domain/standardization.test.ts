import { describe, expect, it } from 'vitest'
import {
  applyStandardization,
  type StandardizationProposal,
} from './standardization'
import { demoWorkspace } from './workspace'
const proposal = (
  field: StandardizationProposal['field'],
  oldValue: string,
  value: string,
): StandardizationProposal => ({
  id: field,
  productId: 'p-1',
  field,
  oldValue,
  value,
  reason: 'Reviewed source',
  selected: true,
  rejected: false,
})
describe('explicit standardization conversions', () => {
  it('preserves money, identity, unknowns and source cells while converting linked units', () => {
    const w = demoWorkspace('convert'),
      p = w.products[0],
      before = structuredClone(w),
      q = {
        ...proposal('unit', p.unit, 'dozens'),
        factor: 1 / 12,
        basis: 'Confirmed 12 pieces per dozen',
      }
    w.serviceObservations = [
      {
        id: 'classified',
        sourceId: 'service',
        productId: 'p-1',
        locationId: null,
        date: '2026-09-12',
        unit: 'pieces',
        requested: 24,
        fulfilled: 12,
        availableQuantity: null,
        phase: 'closing',
        deadline: 'initial-request',
        inStockMinutes: null,
        observedMinutes: null,
        unmetDisposition: 'backordered',
        backlogRemaining: 12,
        backlogAsOf: '2026-09-12',
        lostUnitMargin: 2,
      },
    ]
    before.serviceObservations = structuredClone(w.serviceObservations)
    const next = applyStandardization(w, [q])
    expect(next.serviceObservations![0].backlogRemaining).toBe(1)
    expect(next.serviceObservations![0].lostUnitMargin).toBe(24)
    expect(next.products[0].id).toBe(p.id)
    expect(next.products[0].cost).toBe(p.cost! * 12)
    expect(next.stock[0].onHand).toBe(w.stock[0].onHand / 12)
    expect(next.sales[0].quantity).toBeCloseTo(w.sales[0].quantity! / 12)
    expect(next.sales[0].amount).toBe(w.sales[0].amount)
    expect(next.sales[0].unitCost).toBe(w.sales[0].unitCost! * 12)
    expect(
      next.inventoryHistory![0].quantity * next.inventoryHistory![0].unitCost!,
    ).toBeCloseTo(
      w.inventoryHistory![0].quantity * w.inventoryHistory![0].unitCost!,
    )
    expect(next.standardization.at(-1)).toMatchObject({
      field: 'unit',
      conversionFactor: 1 / 12,
    })
    expect(next.sources).toEqual(w.sources)
    expect(w).toEqual(before)
  })
  it('requires an independent compatible historical cost unit and rejects ambiguous override order', () => {
    const w = demoWorkspace('guards'),
      unit = {
        ...proposal('unit', 'pieces', 'dozens'),
        factor: 1 / 12,
        basis: '12 pieces',
      }
    w.sales[0].costUnit = 'boxes'
    expect(() => applyStandardization(w, [unit])).toThrow(
      /historical cost uses another unit/,
    )
    w.sales[0].costUnit = 'pieces'
    const cost = proposal('cost', String(w.products[0].cost), '100')
    expect(() => applyStandardization(w, [unit, cost])).toThrow(/separately/)
    expect(() => applyStandardization(w, [cost, unit])).toThrow(/separately/)
    expect(() => applyStandardization(w, [{ ...unit, basis: '' }])).toThrow(
      /source establishing/,
    )
  })
  it('changes names and supplier references without merging product identity', () => {
    const w = demoWorkspace('names'),
      first = w.products[0]
    const next = applyStandardization(w, [
      proposal('name', first.name, 'Corrected packaging name'),
      proposal('supplierName', w.suppliers[0].name, 'Corrected supplier name'),
    ])
    expect(next.products[0].id).toBe(first.id)
    expect(next.suppliers[0].id).toBe(w.suppliers[0].id)
    expect(next.paymentTerms![0].counterparty).toBe('Corrected supplier name')
    expect(() =>
      applyStandardization(w, [proposal('sku', first.sku, w.products[1].sku)]),
    ).toThrow(/collision/)
  })
})
