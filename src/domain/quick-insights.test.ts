import { describe, expect, it } from 'vitest'
import { emptyWorkspace, type FinancialRecord, type Product, type Sale, type StockPosition } from './workspace'
import { evaluateQuickInsights } from './quick-insights'

describe('quick-insights domain engine', () => {
  it('safely evaluates an empty workspace without runtime errors', () => {
    const ws = emptyWorkspace('test-empty', 'business')
    const result = evaluateQuickInsights(ws)

    expect(result.healthScore.overallScore).toBeGreaterThanOrEqual(0)
    expect(result.healthScore.overallScore).toBeLessThanOrEqual(100)
    expect(['Strong', 'Good', 'Fair', 'At Risk']).toContain(result.healthScore.grade)
    expect(result.healthScore.pillars.liquidity).toBeDefined()
    expect(result.healthScore.pillars.inventory).toBeDefined()
    expect(result.healthScore.pillars.suppliers).toBeDefined()
    expect(result.healthScore.pillars.profitability).toBeDefined()
  })

  it('detects a critical cash deficit when scheduled payables exceed available funds', () => {
    const ws = emptyWorkspace('test-cash-threat', 'business')
    ws.cash = {
      amount: 1000,
      date: '2026-09-12',
      phase: 'end-of-day',
      reserve: 500,
    }

    const urgentPayable: FinancialRecord = {
      id: 'urgent-bill',
      kind: 'payable',
      name: 'Supplier Raw Materials',
      counterparty: 'MegaSupply Corp',
      amount: 15000,
      paidAmount: 0,
      currency: 'USD',
      dueDate: '2026-09-20',
      expectedDate: '2026-09-20',
      category: 'suppliers',
      linkedRecordId: null,
      cashIncluded: false,
    }
    ws.finance = [urgentPayable]

    const result = evaluateQuickInsights(ws)
    const cashDeficitThreat = result.threats.find((t) => t.id === 'threat-cash-deficit')

    expect(cashDeficitThreat).toBeDefined()
    expect(cashDeficitThreat?.severity).toBe('critical')
    expect(cashDeficitThreat?.futureRisk).toContain('shortfall')
    expect(cashDeficitThreat?.targetPage).toBe('analysis')
    expect(result.healthScore.pillars.liquidity.status).toMatch(/warning|critical/)
  })

  it('detects imminent stockout threats on fast-selling products', () => {
    const ws = emptyWorkspace('test-stockout', 'business')
    const product: Product = {
      id: 'prod-widget',
      sku: 'WDG-01',
      name: 'Industrial Widget',
      category: 'Machinery',
      unit: 'pcs',
      cost: 40,
      price: 100,
      supplierId: null,
      leadTimeDays: 14,
      moq: 10,
      casePack: 5,
      reorderPoint: 20,
      safetyStock: 10,
      serviceTarget: 95,
      targetStock: 50,
    }
    ws.products = [product]

    // Active stock is 0
    const stock: StockPosition = {
      id: 'stock-1',
      productId: 'prod-widget',
      locationId: null,
      onHand: 0,
      reserved: 0,
      asOf: '2026-09-12',
      quantityBasis: 'on-hand',
    }
    ws.stock = [stock]

    // High recent sales demand
    const recentSales: Sale[] = Array.from({ length: 10 }, (_, i) => ({
      id: `sale-${i}`,
      date: `2026-09-0${Math.min(9, i + 1)}`,
      productId: 'prod-widget',
      quantity: 5,
      amount: 500,
      unit: 'pcs',
      currency: 'USD',
      locationId: null,
      sourceId: 'pos',
      kind: 'sale',
      amountBasis: 'net',
    }))
    ws.sales = recentSales

    const result = evaluateQuickInsights(ws)
    const stockoutThreat = result.threats.find((t) => t.id === 'threat-stockout')

    expect(stockoutThreat).toBeDefined()
    expect(stockoutThreat?.severity).toBe('critical')
    expect(stockoutThreat?.currentCondition).toContain('Industrial Widget')
    expect(stockoutThreat?.targetPage).toBe('inventory')
  })

  it('generates working capital optimization when dead stock is present', () => {
    const ws = emptyWorkspace('test-dead-stock', 'business')
    const product: Product = {
      id: 'prod-slow',
      sku: 'SLW-01',
      name: 'Slow Moving Item',
      category: 'General',
      unit: 'pcs',
      cost: 50,
      price: 120,
      supplierId: null,
      leadTimeDays: 7,
      moq: 1,
      casePack: 1,
      reorderPoint: 10,
      safetyStock: 5,
      serviceTarget: 90,
      targetStock: 20,
    }
    ws.products = [product]

    // Massive surplus stock
    const stock: StockPosition = {
      id: 'stock-surplus',
      productId: 'prod-slow',
      locationId: null,
      onHand: 150, // 130 units over targetStock
      reserved: 0,
      asOf: '2026-09-12',
      quantityBasis: 'on-hand',
    }
    ws.stock = [stock]

    const result = evaluateQuickInsights(ws)
    const deadStockOpt = result.optimizations.find((o) => o.id === 'opt-dead-stock')

    expect(deadStockOpt).toBeDefined()
    expect(deadStockOpt?.potentialBenefit).toContain('$')
    expect(deadStockOpt?.targetPage).toBe('inventory')
    expect(result.summary.trappedCapitalEstimate).toBeGreaterThan(0)
  })

  it('detects delinquent receivables and generates collection optimization', () => {
    const ws = emptyWorkspace('test-receivables', 'business')
    const overdueInvoice: FinancialRecord = {
      id: 'inv-late',
      kind: 'receivable',
      name: 'Unpaid Invoice #1042',
      counterparty: 'Acme Retail',
      amount: 12000,
      paidAmount: 0,
      currency: 'USD',
      dueDate: '2026-08-15',
      expectedDate: '2026-08-15',
      category: 'collections',
      linkedRecordId: null,
      cashIncluded: false,
    }
    ws.finance = [overdueInvoice]

    const result = evaluateQuickInsights(ws)
    const recvThreat = result.threats.find((t) => t.id === 'threat-overdue-receivables')
    const recvOpt = result.optimizations.find((o) => o.id === 'opt-accelerate-collections')

    expect(recvThreat).toBeDefined()
    expect(recvThreat?.futureRisk).toContain('bad debt')
    expect(recvOpt).toBeDefined()
    expect(recvOpt?.potentialBenefit).toContain('$12,000')
  })

  it('detects supplier delays when open orders exceed promised date', () => {
    const ws = emptyWorkspace('test-supplier-delay', 'business')
    ws.suppliers = [{ id: 'supp-1', name: 'Global Tech', active: true }]
    ws.purchases = [
      {
        id: 'po-late',
        supplierId: 'supp-1',
        productId: 'prod-1',
        orderDate: '2026-08-01',
        promisedDate: '2026-08-20',
        receivedDate: null,
        quantity: 100,
        receivedQuantity: 0,
        amount: 5000,
        plannedPaymentDate: '2026-09-01',
        paidAmount: 0,
      },
    ]

    const result = evaluateQuickInsights(ws)
    const suppThreat = result.threats.find((t) => t.id === 'threat-supplier-delay')

    expect(suppThreat).toBeDefined()
    expect(suppThreat?.severity).toBe('warning')
    expect(suppThreat?.futureRisk).toContain('bottlenecks')
  })
})
