import {
  availability,
  cutoff,
  money,
  outstanding,
  shiftDate,
  type Page,
  type Workspace,
} from './workspace'
import {
  financeTotals,
  salesSummary,
  scopedSales,
  stockValue,
  supplierPerformance,
} from './selectors'
import { historicalDemandMetrics } from './historical-metrics'

export type HealthPillarKey =
  | 'liquidity'
  | 'inventory'
  | 'suppliers'
  | 'profitability'

export type PillarStatus = 'optimal' | 'stable' | 'warning' | 'critical'

export interface HealthPillarScore {
  key: HealthPillarKey
  title: string
  score: number // 0 - 100
  status: PillarStatus
  weight: number // 0 - 1
  metricLabel: string
  metricValue: string
  summary: string
  strengths: string[]
  vulnerabilities: string[]
}

export type HealthGrade = 'Strong' | 'Good' | 'Fair' | 'At Risk'

export interface BusinessHealthScore {
  overallScore: number // 0 - 100
  grade: HealthGrade
  summary: string
  pillars: Record<HealthPillarKey, HealthPillarScore>
}

export type ThreatSeverity = 'critical' | 'warning' | 'info'

export interface BusinessThreat {
  id: string
  title: string
  severity: ThreatSeverity
  pillar: HealthPillarKey
  currentCondition: string
  futureRisk: string // The critical condition to prevent
  impact: string
  recommendedAction: string
  actionLabel: string
  targetPage: Page
  targetQuery?: string
}

export interface BusinessOptimization {
  id: string
  title: string
  pillar: HealthPillarKey
  potentialBenefit: string
  metricImpact: string
  rationale: string
  actionLabel: string
  targetPage: Page
  targetQuery?: string
}

export interface QuickInsightsSummary {
  criticalThreatCount: number
  warningCount: number
  optimizationCount: number
  trappedCapitalEstimate: number | null
  runwayDays: number | null
  stockoutRiskProductCount: number
  currency: string
}

export interface QuickInsightsData {
  healthScore: BusinessHealthScore
  threats: BusinessThreat[]
  optimizations: BusinessOptimization[]
  summary: QuickInsightsSummary
}

export function evaluateQuickInsights(w: Workspace): QuickInsightsData {
  const asOf = cutoff(w)
  const currency = w.profile.currency || 'USD'
  const threats: BusinessThreat[] = []
  const optimizations: BusinessOptimization[] = []

  // ----------------------------------------------------
  // 1. DATA EXTRACTION & ANALYSIS
  // ----------------------------------------------------
  const recentStart30 = shiftDate(asOf, -29)
  const sales30 = scopedSales(w, recentStart30, asOf)
  const recentSummary = salesSummary(w, sales30)
  const valuation = stockValue(w)

  const availableCash = w.cash?.amount ?? 0
  const hasCashRecord = w.cash !== null

  // Payables & Receivables analysis
  const activePayables = w.finance.filter(
    (f) => f.kind === 'payable' && outstanding(f) > 0,
  )
  const activeReceivables = w.finance.filter(
    (f) =>
      (f.kind === 'receivable' || f.kind === 'provider_pending') &&
      outstanding(f) > 0,
  )

  const overduePayables = activePayables.filter(
    (f) => f.dueDate && f.dueDate < asOf,
  )
  const overduePayablesAmount = overduePayables.reduce(
    (s, f) => s + outstanding(f),
    0,
  )

  const overdueReceivables = activeReceivables.filter(
    (f) => f.dueDate && f.dueDate < asOf,
  )
  const overdueReceivablesAmount = overdueReceivables.reduce(
    (s, f) => s + outstanding(f),
    0,
  )

  // Payables due in next 30 days
  const next30Limit = shiftDate(asOf, 30)
  const upcomingPayables30 = activePayables.filter(
    (f) => !f.dueDate || f.dueDate <= next30Limit,
  )
  const upcomingPayablesAmount30 = upcomingPayables30.reduce(
    (s, f) => s + outstanding(f),
    0,
  )

  // Receivables expected in next 30 days
  const upcomingReceivables30 = activeReceivables.filter(
    (f) =>
      (!f.expectedDate && !f.dueDate) ||
      (f.expectedDate && f.expectedDate <= next30Limit) ||
      (f.dueDate && f.dueDate <= next30Limit),
  )
  const upcomingReceivablesAmount30 = upcomingReceivables30.reduce(
    (s, f) => s + outstanding(f),
    0,
  )

  // Net 30d cash outlook
  const net30dRequired = upcomingPayablesAmount30
  const net30dInflow = availableCash + upcomingReceivablesAmount30 * 0.8 // risk-adjusted 80% collections
  const cashShortfall30d = Math.max(0, net30dRequired - net30dInflow)

  // Average daily sales & cash burn estimate
  const recordedSalesAmount = recentSummary.revenue ?? 0
  const avgDailySales = recordedSalesAmount > 0 ? recordedSalesAmount / 30 : 0
  const runwayDays =
    upcomingPayablesAmount30 > 0 && hasCashRecord
      ? Math.round((availableCash / (upcomingPayablesAmount30 / 30)) * 10) / 10
      : null

  // ----------------------------------------------------
  // INVENTORY ANALYSIS
  // ----------------------------------------------------
  const demandAnalysis = historicalDemandMetrics(w, recentStart30, asOf)
  const productStockStatus = w.products.map((p) => {
    const avail = availability(w, p.id)
    const demand = demandAnalysis.find((d) => d.productId === p.id)
    const dailyRate =
      demand?.dailyRate !== null && demand?.dailyRate !== undefined && demand.dailyRate > 0
        ? demand.dailyRate
        : (demand?.units ?? 0) > 0
          ? (demand?.units ?? 0) / 30
          : 0
    const daysSupply =
      dailyRate > 0 && avail !== null && avail >= 0
        ? avail / dailyRate
        : avail !== null && avail === 0 && dailyRate > 0
          ? 0
          : null
    const belowReorder =
      p.reorderPoint !== null && avail !== null && avail < p.reorderPoint
    const isStockedOut = avail !== null && avail <= 0 && (dailyRate > 0 || belowReorder)
    const leadTime = p.leadTimeDays ?? 14

    // Imminent stockout condition: days supply is less than supplier lead time or below reorder with active demand
    const imminentStockout =
      (daysSupply !== null && daysSupply <= leadTime && dailyRate > 0) ||
      (belowReorder && dailyRate > 0)

    // Excess stock: available units exceed targetStock or days supply > 180
    const target = p.targetStock ?? (p.reorderPoint ? p.reorderPoint * 2 : null)
    const excessUnits =
      target !== null && avail !== null && avail > target
        ? avail - target
        : daysSupply !== null && daysSupply > 180 && avail !== null
          ? Math.round(avail * 0.4)
          : 0
    const excessVal = excessUnits * (p.cost ?? 0)

    return {
      product: p,
      avail,
      dailyRate,
      daysSupply,
      leadTime,
      belowReorder,
      isStockedOut,
      imminentStockout,
      excessUnits,
      excessVal,
    }
  })

  const stockoutRiskProducts = productStockStatus.filter(
    (item) => item.isStockedOut || item.imminentStockout,
  )
  const totalExcessValue = productStockStatus.reduce(
    (sum, item) => sum + item.excessVal,
    0,
  )

  // ----------------------------------------------------
  // SUPPLIER PERFORMANCE ANALYSIS
  // ----------------------------------------------------
  const supplierWindowStart = shiftDate(asOf, -90)
  const supplierPerf = supplierPerformance(w, supplierWindowStart, asOf)
  const supplierOTIFRate = supplierPerf.rate // 0-100 or null if no POs

  const openPurchases = w.purchases.filter(
    (p) =>
      p.orderDate &&
      (!p.receivedDate ||
        p.receivedDate > asOf ||
        p.receivedQuantity < p.quantity),
  )
  const overduePurchases = openPurchases.filter(
    (p) => p.promisedDate && p.promisedDate < asOf,
  )

  // Supplier concentration
  const supplierSpend = new Map<string, number>()
  w.purchases.forEach((p) => {
    const cost = w.products.find((prod) => prod.id === p.productId)?.cost ?? 0
    const spend = p.quantity * cost
    supplierSpend.set(p.supplierId, (supplierSpend.get(p.supplierId) ?? 0) + spend)
  })
  const totalPOSpend = [...supplierSpend.values()].reduce((a, b) => a + b, 0)
  let maxSupplierConcentration = 0
  let topSupplierName = ''
  if (totalPOSpend > 0) {
    supplierSpend.forEach((amt, suppId) => {
      const share = (amt / totalPOSpend) * 100
      if (share > maxSupplierConcentration) {
        maxSupplierConcentration = share
        topSupplierName =
          w.suppliers.find((s) => s.id === suppId)?.name ?? 'Primary supplier'
      }
    })
  }

  // ----------------------------------------------------
  // PILLAR 1: LIQUIDITY & RUNWAY SCORE (0 - 100)
  // ----------------------------------------------------
  let liquidityScore = 80
  const liquidityStrengths: string[] = []
  const liquidityVulnerabilities: string[] = []

  if (!hasCashRecord && activePayables.length === 0) {
    liquidityScore = 75
    liquidityStrengths.push('No outstanding payables recorded')
  } else if (!hasCashRecord && activePayables.length > 0) {
    liquidityScore = 45
    liquidityVulnerabilities.push(
      'Cash balance not recorded; cannot confirm coverage of pending liabilities',
    )
  } else {
    // We have cash record
    if (availableCash >= upcomingPayablesAmount30 && upcomingPayablesAmount30 > 0) {
      liquidityStrengths.push(
        `Liquid cash covers 100% of next 30-day scheduled liabilities (${money(availableCash, currency)})`,
      )
      liquidityScore = 92
    } else if (upcomingPayablesAmount30 > 0) {
      const coverageRatio = availableCash / upcomingPayablesAmount30
      liquidityScore = Math.max(20, Math.min(85, Math.round(coverageRatio * 85)))
      liquidityVulnerabilities.push(
        `Cash covers only ${(coverageRatio * 100).toFixed(0)}% of upcoming 30-day payables (${money(upcomingPayablesAmount30, currency)})`,
      )
    }

    if (overduePayablesAmount > 0) {
      liquidityScore = Math.max(15, liquidityScore - 25)
      liquidityVulnerabilities.push(
        `${money(overduePayablesAmount, currency)} in payables is past due date`,
      )
    }

    if (overdueReceivablesAmount > 0) {
      const overdueRatio =
        activeReceivables.length > 0
          ? overdueReceivablesAmount /
            activeReceivables.reduce((s, f) => s + outstanding(f), 0)
          : 0
      if (overdueRatio > 0.3) {
        liquidityScore = Math.max(20, liquidityScore - 15)
        liquidityVulnerabilities.push(
          `${(overdueRatio * 100).toFixed(0)}% of customer receivables are overdue (${money(overdueReceivablesAmount, currency)})`,
        )
      }
    }
  }

  const liquidityStatus: PillarStatus =
    liquidityScore >= 85
      ? 'optimal'
      : liquidityScore >= 70
        ? 'stable'
        : liquidityScore >= 45
          ? 'warning'
          : 'critical'

  // ----------------------------------------------------
  // PILLAR 2: SUPPLY CHAIN & STOCK RESILIENCE (0 - 100)
  // ----------------------------------------------------
  let inventoryScore = 85
  const inventoryStrengths: string[] = []
  const inventoryVulnerabilities: string[] = []

  if (w.products.length === 0) {
    inventoryScore = 75
    inventoryStrengths.push('No product catalog established yet')
  } else {
    const stockoutCount = stockoutRiskProducts.length
    const totalProducts = w.products.length
    const stockoutRatio = stockoutCount / totalProducts

    if (stockoutCount === 0) {
      inventoryStrengths.push(
        'All active catalog products maintain safe stock levels above reorder points',
      )
      inventoryScore = 95
    } else {
      const penalty = Math.min(50, Math.round(stockoutRatio * 80) + 15)
      inventoryScore = Math.max(25, inventoryScore - penalty)
      inventoryVulnerabilities.push(
        `${stockoutCount} of ${totalProducts} products face immediate stockout or replenishment risk`,
      )
    }

    if (totalExcessValue > 0) {
      inventoryVulnerabilities.push(
        `${money(totalExcessValue, currency)} trapped in excess or slow-moving stock`,
      )
      inventoryScore = Math.max(30, inventoryScore - 10)
    } else if (stockoutCount === 0) {
      inventoryStrengths.push('Balanced inventory turnover with low dead capital')
    }

    if (valuation.stale > 0) {
      inventoryScore = Math.max(25, inventoryScore - 12)
      inventoryVulnerabilities.push(
        `${valuation.stale} stock positions have outdated snapshot counts (>30 days)`,
      )
    }
  }

  const inventoryStatus: PillarStatus =
    inventoryScore >= 85
      ? 'optimal'
      : inventoryScore >= 70
        ? 'stable'
        : inventoryScore >= 45
          ? 'warning'
          : 'critical'

  // ----------------------------------------------------
  // PILLAR 3: SUPPLIER RELIABILITY (0 - 100)
  // ----------------------------------------------------
  let supplierScore = 80
  const supplierStrengths: string[] = []
  const supplierVulnerabilities: string[] = []

  if (w.suppliers.length === 0) {
    supplierScore = 75
    supplierStrengths.push('No direct suppliers registered')
  } else {
    if (supplierOTIFRate !== null) {
      if (supplierOTIFRate >= 85) {
        supplierStrengths.push(
          `Strong supplier delivery execution: ${supplierOTIFRate.toFixed(0)}% On-Time In-Full`,
        )
        supplierScore = Math.round(supplierOTIFRate)
      } else {
        supplierVulnerabilities.push(
          `Sub-par fulfillment: supplier OTIF is only ${supplierOTIFRate.toFixed(0)}%`,
        )
        supplierScore = Math.max(30, Math.round(supplierOTIFRate))
      }
    } else {
      supplierStrengths.push('Purchase order deliveries pending initial baseline')
    }

    if (overduePurchases.length > 0) {
      supplierScore = Math.max(20, supplierScore - 20)
      supplierVulnerabilities.push(
        `${overduePurchases.length} open supplier purchase order(s) are delayed past promised date`,
      )
    }

    if (maxSupplierConcentration > 60 && w.suppliers.length > 1) {
      supplierScore = Math.max(30, supplierScore - 10)
      supplierVulnerabilities.push(
        `High dependency: ${maxSupplierConcentration.toFixed(0)}% of PO spend concentrated with ${topSupplierName}`,
      )
    }
  }

  const supplierStatus: PillarStatus =
    supplierScore >= 85
      ? 'optimal'
      : supplierScore >= 70
        ? 'stable'
        : supplierScore >= 45
          ? 'warning'
          : 'critical'

  // ----------------------------------------------------
  // PILLAR 4: COMMERCIAL & MARGIN HEALTH (0 - 100)
  // ----------------------------------------------------
  let marginScore = 80
  const marginStrengths: string[] = []
  const marginVulnerabilities: string[] = []

  if (w.sales.length === 0) {
    marginScore = 75
    marginStrengths.push('Awaiting commercial sales transactions')
  } else {
    const grossMargin = recentSummary.margin
    if (grossMargin !== null) {
      if (grossMargin >= 30) {
        marginStrengths.push(
          `Healthy commercial gross margin: ${grossMargin.toFixed(1)}%`,
        )
        marginScore = 92
      } else if (grossMargin >= 18) {
        marginStrengths.push(
          `Moderate commercial gross margin: ${grossMargin.toFixed(1)}%`,
        )
        marginScore = 78
      } else if (grossMargin > 0) {
        marginVulnerabilities.push(
          `Thin gross margin (${grossMargin.toFixed(1)}%) leaves low buffer for operating cost shocks`,
        )
        marginScore = 55
      } else {
        marginVulnerabilities.push(
          `Negative gross margin (${grossMargin.toFixed(1)}%): products are selling below cost`,
        )
        marginScore = 20
      }
    } else {
      marginVulnerabilities.push(
        'Incomplete product cost records: unable to calculate reconciled gross margin',
      )
      marginScore = 65
    }

    // Revenue concentration check
    if (sales30.length > 0 && recentSummary.revenue && recentSummary.revenue > 0) {
      const salesByProd = new Map<string, number>()
      sales30.forEach((s) => {
        if (s.productId && s.amount) {
          salesByProd.set(
            s.productId,
            (salesByProd.get(s.productId) ?? 0) + s.amount,
          )
        }
      })
      let maxProdShare = 0
      let topProdName = ''
      salesByProd.forEach((amt, pId) => {
        const share = (amt / recentSummary.revenue!) * 100
        if (share > maxProdShare) {
          maxProdShare = share
          topProdName =
            w.products.find((p) => p.id === pId)?.name ?? 'Top selling product'
        }
      })
      if (maxProdShare > 55 && salesByProd.size > 1) {
        marginScore = Math.max(35, marginScore - 12)
        marginVulnerabilities.push(
          `Vulnerable concentration: ${topProdName} accounts for ${maxProdShare.toFixed(0)}% of revenue`,
        )
      }
    }
  }

  const marginStatus: PillarStatus =
    marginScore >= 85
      ? 'optimal'
      : marginScore >= 70
        ? 'stable'
        : marginScore >= 45
          ? 'warning'
          : 'critical'

  // ----------------------------------------------------
  // OVERALL HEALTH SCORE COMPUTATION
  // ----------------------------------------------------
  const weights = {
    liquidity: 0.3,
    inventory: 0.25,
    suppliers: 0.2,
    profitability: 0.25,
  }

  const overallScore = Math.round(
    liquidityScore * weights.liquidity +
      inventoryScore * weights.inventory +
      supplierScore * weights.suppliers +
      marginScore * weights.profitability,
  )

  const grade: HealthGrade =
    overallScore >= 85
      ? 'Strong'
      : overallScore >= 70
        ? 'Good'
        : overallScore >= 50
          ? 'Fair'
          : 'At Risk'

  const summaryText =
    grade === 'Strong'
      ? 'Business operations display resilient liquidity, balanced inventory turns, and sound supplier reliability.'
      : grade === 'Good'
        ? 'Operations are broadly stable with specific operational improvements available to insulate future cash flows.'
        : grade === 'Fair'
          ? 'Notable operational friction in working capital or stock coverage requires proactive management to avoid escalation.'
          : 'Immediate business threats detected. Critical action required to preserve cash runway and fulfill order commitments.'

  // ----------------------------------------------------
  // 2. DETECT THREATS (CRITICAL CONDITIONS TO PREVENT)
  // ----------------------------------------------------

  // Threat 1: Cash Insolvency / Deficit within 30 days
  if (cashShortfall30d > 0) {
    threats.push({
      id: 'threat-cash-deficit',
      title: 'Projected Cash Deficit within 30 Days',
      severity: 'critical',
      pillar: 'liquidity',
      currentCondition: `Scheduled payables (${money(upcomingPayablesAmount30, currency)}) exceed available liquid reserves (${money(availableCash, currency)}) and risk-adjusted inflows.`,
      futureRisk: `Cash shortfall of ${money(cashShortfall30d, currency)} projected within 30 days. Risk of defaulting on supplier payables, delaying critical shipments, or missing payroll.`,
      impact: `${money(cashShortfall30d, currency)} net shortfall`,
      recommendedAction:
        'Model liquidity preservation in Forecast & Simulate, delay discretionary expenses, and request expedited customer collection.',
      actionLabel: 'Simulate Cash Stress',
      targetPage: 'analysis',
      targetQuery: 'question=Q-CASH-SUFFICIENCY',
    })
  } else if (overduePayablesAmount > 0) {
    threats.push({
      id: 'threat-overdue-payables',
      title: 'Accumulated Overdue Supplier Payables',
      severity: 'warning',
      pillar: 'liquidity',
      currentCondition: `${money(overduePayablesAmount, currency)} in supplier liabilities is past due.`,
      futureRisk:
        'Suppliers may hold pending purchase orders, revoke credit terms, or impose penalty surcharges, triggering inventory shortages.',
      impact: `${money(overduePayablesAmount, currency)} overdue`,
      recommendedAction:
        'Prioritize payments to critical Tier-1 suppliers and reconcile invoice payment dates.',
      actionLabel: 'Review Payables',
      targetPage: 'finance',
      targetQuery: 'tab=payables',
    })
  }

  // Threat 2: Chronic Bad Debt / Uncollected Receivables
  if (overdueReceivablesAmount > 0) {
    const isSevere = overdueReceivablesAmount > 10000 || overdueReceivables.length >= 3
    threats.push({
      id: 'threat-overdue-receivables',
      title: 'Delinquent Receivables & Bad Debt Exposure',
      severity: isSevere ? 'critical' : 'warning',
      pillar: 'liquidity',
      currentCondition: `${money(overdueReceivablesAmount, currency)} across ${overdueReceivables.length} customer invoice(s) is past scheduled payment dates.`,
      futureRisk:
        'Uncollected invoices degrade cash conversion cycles and risk writing off unrecoverable bad debt, impacting net margins directly.',
      impact: `${money(overdueReceivablesAmount, currency)} capital exposed`,
      recommendedAction:
        'Enforce credit holds on delinquent accounts, offer early-payment concessions, and pursue formal collection schedules.',
      actionLabel: 'Inspect Receivables',
      targetPage: 'finance',
      targetQuery: 'tab=receivables',
    })
  }

  // Threat 3: Imminent Stockouts of Core SKUs
  const criticalStockouts = productStockStatus.filter(
    (item) => item.isStockedOut || (item.imminentStockout && item.dailyRate > 0),
  )
  if (criticalStockouts.length > 0) {
    const topStockout = criticalStockouts[0]
    const prodNames = criticalStockouts.map((i) => i.product.name).join(', ')
    const estimatedLostRevenue = criticalStockouts.reduce(
      (sum, item) => sum + item.dailyRate * (item.product.price ?? 50) * 14,
      0,
    )
    threats.push({
      id: 'threat-stockout',
      title: `Imminent Stockout Threat: ${criticalStockouts.length} Product(s)`,
      severity: 'critical',
      pillar: 'inventory',
      currentCondition: `${prodNames} have reached depleted or sub-lead-time inventory levels (${topStockout.daysSupply !== null ? `${topStockout.daysSupply.toFixed(1)} days supply remaining` : 'zero stock'}).`,
      futureRisk:
        'Stockouts will immediately halt customer fulfillment, trigger order cancellations, forfeit sales margins, and erode client trust.',
      impact:
        estimatedLostRevenue > 0
          ? `Est. ${money(estimatedLostRevenue, currency)} lost sales over 14 days`
          : `${criticalStockouts.length} SKU(s) stockout`,
      recommendedAction:
        'Issue expedited purchase orders to suppliers or reallocate available inventory across distribution channels.',
      actionLabel: 'Replenish Inventory',
      targetPage: 'inventory',
      targetQuery: 'filter=low',
    })
  }

  // Threat 4: Supplier Delivery Delays & Slippage
  if (overduePurchases.length > 0) {
    threats.push({
      id: 'threat-supplier-delay',
      title: `${overduePurchases.length} Delayed Supplier Purchase Order(s)`,
      severity: 'warning',
      pillar: 'suppliers',
      currentCondition: `Open orders with promised delivery dates prior to ${asOf} remain unfulfilled.`,
      futureRisk:
        'Supplier delivery bottlenecks trigger cascade stockouts on dependent commercial sales and warehouse idle capacity.',
      impact: `${overduePurchases.length} delayed shipments`,
      recommendedAction:
        'Escalate delayed purchase orders with suppliers, confirm revised ETAs, and prepare contingency safety stock.',
      actionLabel: 'Review PO Status',
      targetPage: 'dashboards',
      targetQuery: 'family=suppliers',
    })
  }

  // Threat 5: High Revenue Concentration
  if (w.products.length > 1 && sales30.length > 0 && recentSummary.revenue) {
    const salesByProd = new Map<string, number>()
    sales30.forEach((s) => {
      if (s.productId && s.amount) {
        salesByProd.set(s.productId, (salesByProd.get(s.productId) ?? 0) + s.amount)
      }
    })
    salesByProd.forEach((amt, pId) => {
      const share = (amt / recentSummary.revenue!) * 100
      if (share > 50) {
        const pName =
          w.products.find((p) => p.id === pId)?.name ?? 'Single product'
        threats.push({
          id: `threat-concentration-${pId}`,
          title: `Severe Single-Product Revenue Concentration`,
          severity: 'warning',
          pillar: 'profitability',
          currentCondition: `${pName} generates ${share.toFixed(0)}% of total monthly sales revenue (${money(amt, currency)}).`,
          futureRisk:
            'A single supply bottleneck, quality defect, or competitor pricing shift on this product creates existential revenue vulnerability.',
          impact: `${share.toFixed(0)}% revenue exposed`,
          recommendedAction:
            'Diversify product promotions, cross-sell secondary categories, and safeguard supplier safety stock for this SKU.',
          actionLabel: 'Analyze Sales',
          targetPage: 'dashboards',
        })
      }
    })
  }

  // ----------------------------------------------------
  // 3. POSSIBLE OPTIMIZATIONS
  // ----------------------------------------------------

  // Optimization 1: Free trapped capital in dead/excess stock
  if (totalExcessValue > 0) {
    optimizations.push({
      id: 'opt-dead-stock',
      title: 'Liquidate Excess Stock to Release Working Capital',
      pillar: 'inventory',
      potentialBenefit: `Unlock up to ${money(totalExcessValue, currency)} in liquid cash`,
      metricImpact: `-${money(totalExcessValue, currency)} holding capital, improved DIO`,
      rationale: `Capital is currently locked in surplus inventory exceeding target replenishment levels. Discounting or bundling these items releases liquidity without requiring debt.`,
      actionLabel: 'Explore Dead Stock',
      targetPage: 'inventory',
      targetQuery: 'filter=excess',
    })
  }

  // Optimization 2: Accelerate Collections via Terms
  if (overdueReceivablesAmount > 0) {
    optimizations.push({
      id: 'opt-accelerate-collections',
      title: 'Accelerate Overdue Inflows to Rebuild Cash Runway',
      pillar: 'liquidity',
      potentialBenefit: `Recover ${money(overdueReceivablesAmount, currency)} in outstanding cash`,
      metricImpact: `+${Math.min(30, Math.round(overdueReceivablesAmount / 1000))} days cash buffer`,
      rationale:
        'Implementing formal dunning notices and offering short-term settlement discounts (e.g. 1.5% net 5) can rapidly accelerate liquid collections.',
      actionLabel: 'Manage Collections',
      targetPage: 'finance',
      targetQuery: 'tab=receivables',
    })
  }

  // Optimization 3: Establish Data-Driven Reorder Points
  const missingReorder = w.products.filter(
    (p) => p.reorderPoint === null || p.safetyStock === null,
  )
  if (missingReorder.length > 0) {
    optimizations.push({
      id: 'opt-reorder-points',
      title: 'Configure Safety Stock Targets for Vulnerable SKUs',
      pillar: 'inventory',
      potentialBenefit: `Protect ${missingReorder.length} products from unmonitored stockouts`,
      metricImpact: '+15% replenishment reliability',
      rationale:
        'Products without formal reorder thresholds or safety stock targets rely on manual guessing, causing recurring emergency freight and stockouts.',
      actionLabel: 'Set Reorder Points',
      targetPage: 'inventory',
    })
  }

  // Optimization 4: Consolidate POs to Reduce Freight & Carbon
  if (w.purchases.length >= 4) {
    optimizations.push({
      id: 'opt-supplier-consolidation',
      title: 'Consolidate Purchase Orders for Freight & Terms Efficiency',
      pillar: 'suppliers',
      potentialBenefit: 'Lower freight expenses and negotiate bulk payment terms',
      metricImpact: 'Estimated 8–12% freight cost reduction & improved ESG score',
      rationale:
        'Grouping split purchase orders into scheduled bi-weekly or monthly consolidated shipments reduces per-unit transportation costs and improves supplier priority.',
      actionLabel: 'Review Suppliers',
      targetPage: 'dashboards',
      targetQuery: 'family=suppliers',
    })
  }

  // Optimization 5: Audit Uncosted Products to Protect Margins
  const uncostedProducts = w.products.filter((p) => p.cost === null)
  if (uncostedProducts.length > 0) {
    optimizations.push({
      id: 'opt-cost-audit',
      title: 'Complete Unit Costs to Prevent Unprofitable Selling',
      pillar: 'profitability',
      potentialBenefit: `Restore true gross margin visibility across ${uncostedProducts.length} SKU(s)`,
      metricImpact: '100% margin audit coverage',
      rationale:
        'Without verified unit costs, sales may inadvertently be executed at a net loss once overhead and freight are factored in.',
      actionLabel: 'Update Product Costs',
      targetPage: 'data',
    })
  }

  // Assemble summary
  const summary: QuickInsightsSummary = {
    criticalThreatCount: threats.filter((t) => t.severity === 'critical').length,
    warningCount: threats.filter((t) => t.severity === 'warning').length,
    optimizationCount: optimizations.length,
    trappedCapitalEstimate: totalExcessValue > 0 ? totalExcessValue : null,
    runwayDays,
    stockoutRiskProductCount: stockoutRiskProducts.length,
    currency,
  }

  const pillars: Record<HealthPillarKey, HealthPillarScore> = {
    liquidity: {
      key: 'liquidity',
      title: 'Liquidity & Runway',
      score: liquidityScore,
      status: liquidityStatus,
      weight: weights.liquidity,
      metricLabel: 'Cash Runway',
      metricValue:
        runwayDays !== null ? `${runwayDays} days` : hasCashRecord ? 'Adequate' : 'Unrecorded',
      summary:
        liquidityStatus === 'optimal' || liquidityStatus === 'stable'
          ? 'Cash reserves and predictable collections maintain comfortable coverage of pending commitments.'
          : 'Liquidity is constrained by scheduled payables or overdue collections.',
      strengths: liquidityStrengths,
      vulnerabilities: liquidityVulnerabilities,
    },
    inventory: {
      key: 'inventory',
      title: 'Supply Chain & Stock',
      score: inventoryScore,
      status: inventoryStatus,
      weight: weights.inventory,
      metricLabel: 'Stockout Risk',
      metricValue:
        stockoutRiskProducts.length === 0
          ? 'None'
          : `${stockoutRiskProducts.length} product(s)`,
      summary:
        inventoryStatus === 'optimal' || inventoryStatus === 'stable'
          ? 'Stock positions satisfy replenishment criteria with healthy turnover velocity.'
          : 'Inventory imbalances detect immediate stockouts or capital locked in slow-moving items.',
      strengths: inventoryStrengths,
      vulnerabilities: inventoryVulnerabilities,
    },
    suppliers: {
      key: 'suppliers',
      title: 'Supplier Reliability',
      score: supplierScore,
      status: supplierStatus,
      weight: weights.suppliers,
      metricLabel: 'OTIF Performance',
      metricValue:
        supplierOTIFRate !== null ? `${supplierOTIFRate.toFixed(0)}%` : 'Baseline pending',
      summary:
        supplierStatus === 'optimal' || supplierStatus === 'stable'
          ? 'Vendors demonstrate dependable order fulfillment within promised timeframes.'
          : 'Supplier delays or severe vendor concentration introduce operational vulnerability.',
      strengths: supplierStrengths,
      vulnerabilities: supplierVulnerabilities,
    },
    profitability: {
      key: 'profitability',
      title: 'Commercial & Margins',
      score: marginScore,
      status: marginStatus,
      weight: weights.profitability,
      metricLabel: 'Gross Margin',
      metricValue:
        recentSummary.margin !== null
          ? `${recentSummary.margin.toFixed(1)}%`
          : 'Cost unconfirmed',
      summary:
        marginStatus === 'optimal' || marginStatus === 'stable'
          ? 'Commercial margins provide sufficient gross profit contribution to absorb operational costs.'
          : 'Margins are compressed or heavily concentrated in narrow catalog lines.',
      strengths: marginStrengths,
      vulnerabilities: marginVulnerabilities,
    },
  }

  const healthScore: BusinessHealthScore = {
    overallScore,
    grade,
    summary: summaryText,
    pillars,
  }

  return {
    healthScore,
    threats,
    optimizations,
    summary,
  }
}
