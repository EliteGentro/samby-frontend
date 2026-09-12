import { describe, expect, it } from 'vitest'
import {
  agingMetrics,
  capitalMetrics,
  historicalDemandMetrics,
  historicalStockValue,
  supplierHistory,
  serviceConsequences,
  serviceMetrics,
} from './historical-metrics'
import { demoWorkspace, type Workspace } from './workspace'
function fixture(): Workspace {
  const w = demoWorkspace('observed-test')
  w.products = [w.products[0]]
  w.products[0].unit = 'pieces'
  w.stock = [
    {
      id: 'stock',
      productId: 'p-1',
      locationId: null,
      asOf: '2026-09-10',
      onHand: 20,
      reserved: 0,
    },
  ]
  w.sales = [
    {
      id: 'sale',
      productId: 'p-1',
      locationId: null,
      date: '2026-09-05',
      quantity: 100,
      unit: 'pieces',
      amount: 300,
      unitCost: 2,
      costUnit: 'pieces',
      currency: 'MXN',
      sourceId: 'sales',
      kind: 'sale',
      amountBasis: 'Net excluding tax',
    },
  ]
  w.inventoryHistory = [
    {
      id: 'first',
      productId: 'p-1',
      locationId: null,
      asOf: '2026-09-01',
      throughDate: '2026-09-05',
      method: 'constant-estimate',
      quantity: 100,
      unitCost: 2,
      unit: 'pieces',
      currency: 'MXN',
      sourceId: 'history',
    },
    {
      id: 'second',
      productId: 'p-1',
      locationId: null,
      asOf: '2026-09-06',
      throughDate: '2026-09-10',
      method: 'constant-estimate',
      quantity: 50,
      unitCost: 2,
      unit: 'pieces',
      currency: 'MXN',
      sourceId: 'history',
    },
  ]
  w.serviceObservations = []
  w.inventoryLayers = []
  return w
}
describe('observed capital efficiency', () => {
  it('weights explicitly estimated intervals and uses period days with compatible dated sales costs', () => {
    const result = capitalMetrics(fixture(), '2026-09-01', '2026-09-10')
    expect(result.averageInventory).toBe(150)
    expect(result.costOfGoods).toBe(200)
    expect(result.grossProfit).toBe(100)
    expect(result.turnover).toBeCloseTo(4 / 3)
    expect(result.dio).toBe(7.5)
    expect(result.gmroi).toBeCloseTo(2 / 3)
    expect(result.rows[0].estimatedDays).toBe(10)
  })
  it('excludes a gapped or overlapping period instead of interpolating or double weighting', () => {
    const w = fixture()
    w.inventoryHistory![1].asOf = '2026-09-07'
    expect(capitalMetrics(w, '2026-09-01', '2026-09-10').rows).toHaveLength(0)
    w.inventoryHistory![1].asOf = '2026-09-05'
    expect(
      capitalMetrics(w, '2026-09-01', '2026-09-10').averageInventory,
    ).toBeNull()
  })
  it('does not substitute current costs and preserves zero denominator conventions', () => {
    const w = fixture()
    w.sales[0].unitCost = null
    expect(capitalMetrics(w, '2026-09-01', '2026-09-10').costOfGoods).toBeNull()
    w.sales[0].unitCost = 2
    w.inventoryHistory!.forEach((s) => {
      s.quantity = 0
    })
    const result = capitalMetrics(w, '2026-09-01', '2026-09-10')
    expect(result.dio).toBe(0)
    expect(result.turnover).toBeNull()
    expect(result.gmroi).toBeNull()
  })
})
describe('historical service, aging and demand', () => {
  it('separates unit fill, line fill and observed daily availability', () => {
    const w = fixture()
    w.serviceObservations = [1, 2].map((i) => ({
      id: `service-${i}`,
      productId: 'p-1',
      locationId: null,
      date: `2026-09-0${i}`,
      unit: 'pieces',
      requested: i === 1 ? 10 : 0,
      fulfilled: i === 1 ? 7 : 0,
      availableQuantity: i === 1 ? 0 : 10,
      phase: 'closing',
      deadline: 'initial-request',
      inStockMinutes: i === 1 ? 420 : 480,
      observedMinutes: 480,
      sourceId: 'service',
    }))
    const row = serviceMetrics(w, '2026-09-01', '2026-09-10')[0]
    expect(row.fillRate).toBe(70)
    expect(row.lineFill).toBe(0)
    expect(row.lines).toBe(1)
    expect(row.inStockRate).toBe(50)
    expect(row.unmet).toBe(3)
    expect(row.unavailableMinutes).toBe(60)
    w.serviceObservations.push({
      ...w.serviceObservations[0],
      id: 'duplicate',
    })
    const duplicate = serviceMetrics(w, '2026-09-01', '2026-09-10')[0]
    expect(duplicate.inStockRate).toBeNull()
    expect(duplicate.observedMinutes).toBe(0)
    w.serviceObservations[2].locationId = 'loc-mty'
    expect(serviceMetrics(w, '2026-09-01', '2026-09-10')[0].fillRate).toBeNull()
  })
  it('reconciles receipt layers and never applies a global excess target to one location', () => {
    const w = fixture()
    w.products[0].targetStock = 10
    w.products[0].cost = 5
    w.inventoryLayers = [
      {
        id: 'old',
        productId: 'p-1',
        locationId: null,
        asOf: '2026-09-10',
        receiptDate: '2026-05-01',
        remainingQuantity: 15,
        unit: 'pieces',
        sourceId: 'receipt',
      },
    ]
    const row = agingMetrics(w, '2026-09-10')[0]
    expect(row.bands[2].quantity).toBe(15)
    expect(row.unaged).toBe(5)
    expect(row.excess).toBe(10)
    expect(row.excessValue).toBe(50)
    w.inventoryLayers[0].remainingQuantity = 25
    expect(agingMetrics(w, '2026-09-10')[0].bands[2].quantity).toBeNull()
    w.stock[0].locationId = 'loc-mty'
    expect(
      agingMetrics(w, '2026-09-10', { locationId: 'loc-mty' })[0].target,
    ).toBeNull()
  })
  it('requires each observed date for a historical daily-demand rate', () => {
    const w = fixture()
    w.sales[0].quantity = 10
    w.sales[0].date = '2026-09-01'
    expect(
      historicalDemandMetrics(w, '2026-09-01', '2026-09-02')[0].daysSupply,
    ).toBeNull()
    w.sales.push({
      ...w.sales[0],
      id: 'zero',
      date: '2026-09-02',
      quantity: 0,
    })
    const row = historicalDemandMetrics(
      w,
      '2026-09-01',
      '2026-09-02',
      '',
      10,
    )[0]
    expect(row.dailyRate).toBe(5)
    expect(row.daysSupply).toBe(4)
    expect(row.slowMoving).toBe(true)
  })
})

describe('dated stock, supplier and demand consequences', () => {
  it('uses date-specific historical cost without current-cost substitution or overlapping scopes', () => {
    const w = fixture()
    w.products[0].cost = 99
    expect(historicalStockValue(w, '2026-09-07').value).toBe(100)
    expect(historicalStockValue(w, '2026-09-07').estimated).toBe(1)
    expect(historicalStockValue(w, '2026-09-11').value).toBeNull()
    w.inventoryHistory!.push({
      ...w.inventoryHistory![1],
      id: 'location',
      locationId: 'loc-mty',
    })
    expect(historicalStockValue(w, '2026-09-07').value).toBeNull()
    expect(
      historicalStockValue(w, '2026-09-07', { locationId: 'loc-mty' }).value,
    ).toBe(100)
  })
  it('calculates literal observed lead times and sample variability without converting quoted lead time to observation', () => {
    const w = fixture(),
      base = w.purchases[0]
    w.purchases = [
      {
        ...base,
        id: 'a',
        productId: 'p-1',
        orderDate: '2026-09-01',
        promisedDate: '2026-09-10',
        receivedDate: '2026-09-05',
        quantity: 10,
        receivedQuantity: 10,
      },
      {
        ...base,
        id: 'b',
        productId: 'p-1',
        orderDate: '2026-09-01',
        promisedDate: '2026-09-06',
        receivedDate: '2026-09-09',
        quantity: 10,
        receivedQuantity: 5,
      },
      {
        ...base,
        id: 'open',
        productId: 'p-1',
        orderDate: '2026-09-03',
        promisedDate: '2026-09-08',
        receivedDate: null,
        quantity: 10,
        receivedQuantity: 0,
      },
    ]
    const result = supplierHistory(w, '2026-09-01', '2026-09-10')
    expect(result.observations[0].mean).toBe(6)
    expect(result.observations[0].standardDeviation).toBeCloseTo(Math.sqrt(8))
    expect(result.observations[0].partial).toBe(1)
    expect(result.open.find((p) => p.id === 'open')).toMatchObject({
      age: 7,
      overdue: true,
      remaining: 10,
    })
    expect(
      supplierHistory(w, '2026-09-01', '2026-09-06').observations[0]
        .standardDeviation,
    ).toBeNull()
  })
  it('keeps lost demand, remaining backlog, actual delivery timing and declared target basis distinct', () => {
    const w = fixture()
    w.products[0].serviceTarget = 90
    w.products[0].serviceTargetBasis = 'initial-unit-fill'
    const base = {
      productId: 'p-1',
      locationId: null,
      date: '2026-09-01',
      unit: 'pieces',
      requested: 10,
      fulfilled: 7,
      availableQuantity: null,
      phase: 'closing' as const,
      deadline: 'initial-request' as const,
      inStockMinutes: null,
      observedMinutes: null,
      sourceId: 'service',
    }
    w.serviceObservations = [
      {
        ...base,
        id: 'lost',
        orderReference: 'L-1',
        unmetDisposition: 'lost',
        lostUnitMargin: 4,
        lostMarginBasis: 'Net unit sale price 10 less historical unit cost 6',
      },
      {
        ...base,
        id: 'backlog',
        orderReference: 'B-1',
        unmetDisposition: 'backordered',
        backlogRemaining: 2,
        backlogAsOf: '2026-09-10',
        deliveredDate: '2026-09-04',
      },
    ]
    const result = serviceConsequences(w, '2026-09-01', '2026-09-10')
    expect(result.rows[0]).toMatchObject({
      lost: 3,
      estimatedLostMargin: 12,
      remaining: null,
    })
    expect(result.rows[1]).toMatchObject({
      lost: null,
      estimatedLostMargin: null,
      remaining: 2,
      backlogAge: 9,
      deliveryDaysAfterDeadline: 3,
    })
    expect(result.targets[0]).toMatchObject({
      measured: 70,
      target: 90,
      percentagePoints: -20,
    })
    expect(
      serviceConsequences(w, '2026-09-01', '2026-09-10', 'loc-mty').targets,
    ).toEqual([])
    w.products[0].serviceTargetBasis = undefined
    expect(serviceConsequences(w, '2026-09-01', '2026-09-10').targets).toEqual(
      [],
    )
    w.serviceObservations.push({
      ...w.serviceObservations[0],
      id: 'duplicate',
    })
    expect(
      serviceConsequences(w, '2026-09-01', '2026-09-10').rows[0].lost,
    ).toBeNull()
    expect(serviceMetrics(w, '2026-09-01', '2026-09-10')[0].fillRate).toBeNull()
  })
})
