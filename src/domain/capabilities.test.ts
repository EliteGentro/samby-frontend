import { describe, expect, it } from 'vitest'
import {
  capabilities,
  canActivateCapability,
  catalogCapabilities,
  demoWorkspace,
  emptyWorkspace,
  isCapabilityMuted,
  readiness,
  scopedCapabilityWorkspace,
  type Capability,
} from './workspace'

const capability = (id: string) => capabilities.find((c) => c.id === id)!

describe('scoped capability contracts', () => {
  it('represents all 46 canonical requirements once with consistent input edges', () => {
    expect(catalogCapabilities.filter((c) => c.canonical)).toHaveLength(46)
    expect(
      new Set(catalogCapabilities.filter((c) => c.canonical).map((c) => c.name))
        .size,
    ).toBe(46)
    expect(
      catalogCapabilities.some((c) => c.id === 'sales' || c.id === 'forecast'),
    ).toBe(false)
    for (const c of capabilities)
      for (const upstream of c.requires ?? [])
        expect(capability(upstream).feeds).toContain(c.id)
  })

  it('supports amount-only sales without unlocking unit demand and refuses incompatible monetary bases', () => {
    const w = demoWorkspace('amount-only')
    w.sales = [{ ...w.sales[0], productId: null, quantity: null, amount: 0 }]
    expect(capability('sales-aggregate').check(w)).toBe(true)
    expect(capability('forecast-naive').check(w)).toBe(false)
    w.sales.push({
      ...w.sales[0],
      id: 'different-basis',
      amount: 300,
      amountBasis: 'Gross including tax',
    })
    expect(capability('sales-aggregate').check(w)).toBe(false)
  })

  it('does not combine scattered products or gaps into a seasonal history', () => {
    const w = demoWorkspace('seasonal')
    w.sales = w.sales.filter((s) => s.productId === 'p-1').slice(-7)
    expect(capability('forecast-seasonal').check(w)).toBe(true)
    w.sales[3].quantity = null
    expect(capability('forecast-seasonal').check(w)).toBe(false)
    expect(capability('forecast-naive').check(w)).toBe(true)
  })

  it('keeps physical stock usable while unknown reservations block availability-based scenarios', () => {
    const w = demoWorkspace('stock')
    w.stock = [{ ...w.stock[0], reserved: null }]
    expect(capability('stock').check(w)).toBe(true)
    expect(capability('declared-order').check(w)).toBe(false)
    w.stock[0].quantityBasis = 'available'
    w.inventoryHistory = []
    expect(capability('declared-order').check(w)).toBe(true)
    expect(capability('inventory-value').check(w)).toBe(false)
  })

  it('requires aligned cash, a future event and period-specific category review', () => {
    const w = demoWorkspace('cash')
    expect(capability('liquidity').check(w)).toBe(true)
    w.coverage.payroll.state = 'unknown'
    expect(capability('liquidity').check(w)).toBe(false)
    w.coverage.payroll.state = 'omitted'
    expect(capability('liquidity').check(w)).toBe(true)
    w.cash!.date = '2026-09-10'
    expect(capability('liquidity').check(w)).toBe(false)
  })

  it('restricts readiness to attributed rows without inventing financial or stock allocation', () => {
    const w = demoWorkspace('scope')
    w.sources.push({
      id: 'other',
      name: 'Other sales',
      type: 'csv',
      rowCount: 1,
      excludedCount: 0,
      importedAt: '2026-09-12',
    })
    w.sales.push({ ...w.sales[0], id: 'source-other', sourceId: 'other' })
    const source = scopedCapabilityWorkspace(w, { sourceId: 'other' })
    expect(source.sales).toHaveLength(1)
    expect(source.stock).toEqual([])
    expect(source.finance).toEqual([])
    expect(source.cash).toBeNull()
    const location = scopedCapabilityWorkspace(w, {
      locationId: 'loc-mty',
      startDate: '2026-09-01',
      endDate: '2026-09-11',
    })
    expect(
      location.sales.every(
        (s) =>
          s.locationId === 'loc-mty' &&
          s.date >= '2026-09-01' &&
          s.date <= '2026-09-11',
      ),
    ).toBe(true)
    expect(location.purchases).toEqual([])
    expect(location.stock).toEqual([])
  })

  it('separates lifecycle and presentation from input eligibility', () => {
    const w = demoWorkspace('lifecycle'),
      current = capability('inventory-value')
    const retired: Capability = {
      ...current,
      lifecycle: 'retired',
      successor: 'stock',
      sunsetDate: '2026-12-01',
    }
    expect(current.check(w)).toBe(true)
    expect(canActivateCapability(retired, w)).toBe(false)
    expect(readiness(retired, w)).toBe('Retired')
    w.muted = ['sales']
    expect(isCapabilityMuted(capability('sales-product'), w)).toBe(true)
    expect(capability('forecast-naive').check(w)).toBe(true)
  })

  it('checks real advanced and historical prerequisites independently of demo membership', () => {
    const w = demoWorkspace('engines')
    w.mode = 'business'
    expect(capability('forecast-advanced').check(w)).toBe(true)
    expect(capability('turnover-dio').check(w)).toBe(true)
    expect(capability('payment-terms').check(w)).toBe(true)
    w.sales = w.sales.slice(-100)
    expect(capability('forecast-advanced').check(w)).toBe(false)
    w.inventoryHistory = []
    expect(capability('turnover-dio').check(w)).toBe(false)
    expect(
      catalogCapabilities.some((c) => c.check(emptyWorkspace('empty'))),
    ).toBe(false)
  })
})
