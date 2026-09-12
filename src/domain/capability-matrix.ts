import {
  capitalMetrics,
  serviceMetrics,
  agingMetrics,
  historicalStockValue,
} from './historical-metrics'
import type {
  Capability,
  CapabilityScope,
  FinancialRecord,
  Sale,
  Workspace,
} from './workspace'

const finite = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n)
const validDate = (date: string | null | undefined): date is string =>
  Boolean(
    date &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(date)) &&
      new Date(date).toISOString().slice(0, 10) === date,
  )
const reference = (w: Workspace) =>
  w.mode === 'demo'
    ? '2026-09-12'
    : new Intl.DateTimeFormat('en-CA', { timeZone: w.profile.timezone }).format(
        new Date(),
      )
const plusDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000)
    .toISOString()
    .slice(0, 10)
const knownProduct = (w: Workspace, id: string | null) =>
  w.products.some((p) => p.id === id && p.unit.trim())
const quantityRow = (w: Workspace, s: Sale) =>
  validDate(s.date) &&
  s.date <= reference(w) &&
  finite(s.quantity) &&
  s.quantity >= 0 &&
  w.products.some(
    (p) => p.id === s.productId && p.unit === s.unit && Boolean(p.unit.trim()),
  )
const amountRow = (w: Workspace, s: Sale) =>
  validDate(s.date) &&
  s.date <= reference(w) &&
  finite(s.amount) &&
  s.amount >= 0 &&
  s.currency === w.profile.currency &&
  Boolean(s.amountBasis.trim())
const demand = (w: Workspace, id?: string) =>
  w.sales.some((s) => (!id || s.productId === id) && quantityRow(w, s))
const monetary = (w: Workspace) => {
  const rows = w.sales.filter((s) => amountRow(w, s))
  return (
    rows.length > 0 &&
    new Set(rows.map((s) => s.amountBasis.trim().toLowerCase())).size === 1
  )
}
const productSales = (w: Workspace) =>
  w.sales.some(
    (s) =>
      knownProduct(w, s.productId) && (quantityRow(w, s) || amountRow(w, s)),
  )
const evolution = (w: Workspace) =>
  (monetary(w) &&
    new Set(w.sales.filter((s) => amountRow(w, s)).map((s) => s.date)).size >
      1) ||
  w.products.some(
    (p) =>
      new Set(
        w.sales
          .filter((s) => s.productId === p.id && quantityRow(w, s))
          .map((s) => s.date),
      ).size > 1,
  )
const physicalStock = (w: Workspace) =>
  w.stock.some(
    (s) =>
      knownProduct(w, s.productId) &&
      finite(s.onHand) &&
      validDate(s.asOf) &&
      s.asOf <= reference(w),
  )
const availableStock = (w: Workspace, id?: string) =>
  w.products.some((p) => {
    if (id && p.id !== id) return false
    const positions = w.stock.filter((s) => s.productId === p.id)
    return (
      positions.length > 0 &&
      !(
        positions.some((s) => s.locationId === null) &&
        positions.some((s) => s.locationId !== null)
      ) &&
      positions.every(
        (s) =>
          finite(s.onHand) &&
          s.onHand >= 0 &&
          validDate(s.asOf) &&
          s.asOf <= reference(w) &&
          (s.quantityBasis === 'available' ||
            (finite(s.reserved) && s.reserved >= 0 && s.reserved <= s.onHand)),
      )
    )
  })
const valuedStock = (w: Workspace) =>
  w.stock.some(
    (s) =>
      s.quantityBasis !== 'available' &&
      finite(s.onHand) &&
      validDate(s.asOf) &&
      s.asOf <= reference(w) &&
      w.products.some(
        (p) =>
          p.id === s.productId &&
          p.unit.trim() &&
          finite(p.cost) &&
          p.cost >= 0,
      ),
  )
const margin = (w: Workspace) =>
  monetary(w) &&
  w.sales.some(
    (s) =>
      amountRow(w, s) &&
      quantityRow(w, s) &&
      /net|excluding tax|excl(?:uding)?[. ]?tax/i.test(s.amountBasis) &&
      w.products.some(
        (p) => p.id === s.productId && finite(p.cost) && p.cost >= 0,
      ),
  )
const productField = (
  w: Workspace,
  field: 'leadTimeDays' | 'reorderPoint' | 'safetyStock',
) =>
  w.products.some(
    (p) => Boolean(p.unit.trim()) && finite(p[field]) && p[field]! >= 0,
  )
const seasonal = (w: Workspace) =>
  w.products.some((p) => {
    const dates = new Set(
      w.sales
        .filter((s) => s.productId === p.id && quantityRow(w, s))
        .map((s) => s.date),
    )
    const last = [...dates].sort().at(-1)
    return Boolean(
      last &&
        Array.from({ length: 7 }, (_, index) => plusDays(last, -index)).every(
          (date) => dates.has(date),
        ),
    )
  })
const usableFinance = (w: Workspace, f: FinancialRecord) =>
  Boolean(f.id && f.name.trim()) &&
  finite(f.amount) &&
  finite(f.paidAmount) &&
  f.amount >= 0 &&
  f.paidAmount >= 0 &&
  f.paidAmount <= f.amount &&
  f.currency === w.profile.currency
const collection = (w: Workspace) =>
  w.finance.some(
    (f) =>
      ['receivable', 'provider_pending'].includes(f.kind) &&
      usableFinance(w, f) &&
      f.amount > f.paidAmount &&
      validDate(f.expectedDate) &&
      f.expectedDate >= reference(w) &&
      !f.cashIncluded,
  )
const budget = (w: Workspace) =>
  Boolean(
    w.budget &&
      finite(w.budget.amount) &&
      w.budget.amount >= 0 &&
      validDate(w.budget.startDate) &&
      validDate(w.budget.endDate) &&
      w.budget.startDate <= w.budget.endDate &&
      w.purchases.some(
        (p) =>
          finite(p.amount) &&
          p.amount >= 0 &&
          validDate(p.orderDate) &&
          p.orderDate >= w.budget!.startDate &&
          p.orderDate <= w.budget!.endDate,
      ),
  )
const cash = (w: Workspace, scope?: CapabilityScope) => {
  const start = scope?.startDate || reference(w),
    end = scope?.endDate || plusDays(start, 29)
  const inside = (date: string | null) =>
    validDate(date) && date >= start && date <= end
  const opening =
    w.cash &&
    finite(w.cash.amount) &&
    ((w.cash.phase === 'opening' && w.cash.date === start) ||
      (w.cash.phase === 'end-of-day' && w.cash.date === plusDays(start, -1)))
  const reviewed = Object.values(w.coverage).every(
    (c) => c.state !== 'unknown' && c.startDate <= start && c.endDate >= end,
  )
  const event =
    w.finance.some(
      (f) =>
        usableFinance(w, f) &&
        f.amount > f.paidAmount &&
        inside(f.expectedDate) &&
        !f.cashIncluded,
    ) ||
    w.purchases.some(
      (p) =>
        finite(p.amount) &&
        p.amount > p.paidAmount &&
        inside(p.plannedPaymentDate),
    ) ||
    w.commitments.some(
      (c) =>
        finite(c.amount) &&
        c.amount > 0 &&
        c.currency === w.profile.currency &&
        c.payment !== 'paid' &&
        inside(c.nextDate),
    )
  return Boolean(opening && event && reviewed)
}
const openSupply = (w: Workspace) =>
  w.purchases.some(
    (p) =>
      finite(p.quantity) &&
      p.quantity > p.receivedQuantity &&
      validDate(p.orderDate) &&
      validDate(p.promisedDate) &&
      availableStock(w, p.productId) &&
      demand(w, p.productId),
  )

export const matrixCapabilities: Capability[] = [
  {
    id: 'sales-aggregate',
    firstResult: { page: 'home', label: 'Recorded sales' },
    name: 'Aggregate monetary sales summary',
    question:
      'Aggregate monetary sales summary · what does my supplied scope support?',
    fields: 'Usable date/period, amount, currency and understood row meaning.',
    owner: 'Sales',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'sales',
    entryMethods: [
      'Manual sales entry',
      'Reviewed sales CSV/XLS/XLSX with worksheet and column review',
    ],
    warning:
      'No product-level demand, unit replenishment, cash collection or margin claims.',
    displays: [
      'Home: recorded-sales indicator, sales chart and product-sales table',
      'Inventory dashboard: recorded-sales indicator, products-sold indicator and sales chart',
    ],
    presentationGroup: 'sales',
    check: (w) => monetary(w),
  },
  {
    id: 'sales-product',
    firstResult: { page: 'home', label: 'Product sales' },
    name: 'Product sales summary',
    question: 'Product sales summary · what does my supplied scope support?',
    fields:
      'Date/period, identifiable product and quantity with comparable unit and/or amount.',
    owner: 'Sales',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'sales',
    entryMethods: [
      'Manual sales entry',
      'Reviewed sales CSV/XLS/XLSX with worksheet and column review',
    ],
    warning:
      'Amount-only data supports monetary results; quantity-only data does not support monetary totals.',
    displays: [
      'Home: recorded-sales indicator, sales chart and product-sales table',
      'Inventory dashboard: recorded-sales indicator, products-sold indicator and sales chart',
    ],
    presentationGroup: 'sales',
    check: (w) => productSales(w),
  },
  {
    id: 'sales-evolution',
    name: 'Sales evolution',
    question: 'Sales evolution · what does my supplied scope support?',
    fields: 'Comparable periods with known cadence and coverage.',
    owner: 'Sales',
    requires: ['sales-aggregate', 'sales-product'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'sales',
    entryMethods: [
      'Manual sales entry',
      'Reviewed sales CSV/XLS/XLSX with worksheet and column review',
    ],
    warning:
      'One observation is not a trend; absent rows are not automatically zero-sales days.',
    displays: [
      'Home: recorded-sales indicator, sales chart and product-sales table',
      'Inventory dashboard: recorded-sales indicator, products-sold indicator and sales chart',
    ],
    presentationGroup: 'sales',
    check: (w) => evolution(w),
  },
  {
    id: 'stock',
    firstResult: { page: 'inventory', label: 'Recorded stock' },
    name: 'Current stock visibility',
    question: 'What stock has been recorded?',
    fields:
      'At least one identifiable product, interpretable quantity, unit, scope and as-of date; disclose an accepted estimated date.',
    owner: 'Inventory',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'inventory',
    entryMethods: ['Manual stock snapshot and product cost/price entry'],
    warning:
      'Stale stock, unknown physical distribution, negative stock, or available quantity exceeding on hand.',
    displays: [
      'Home: recorded stock-threshold alerts',
      'Inventory: stock indicators',
      'Inventory dashboard: stock measures',
    ],
    presentationGroup: 'stock',
    check: (w) => physicalStock(w),
  },
  {
    id: 'inventory-value',
    firstResult: { page: 'inventory', label: 'Inventory value' },
    name: 'Inventory value',
    question: 'How much is held in inventory?',
    fields: 'Quantity and compatible unit cost for the displayed subset.',
    owner: 'Inventory',
    requires: ['stock'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'inventory',
    entryMethods: ['Manual stock snapshot and product cost/price entry'],
    warning: 'Unknown costs do not become zero; disclose partial valuation.',
    displays: [
      'Home, Inventory and Inventory dashboard: inventory-at-cost indicators',
    ],
    presentationGroup: 'inventory-value',
    check: (w, scope) =>
      scope?.endDate && scope.endDate < reference(w)
        ? historicalStockValue(w, scope.endDate, scope).value !== null
        : valuedStock(w) ||
          historicalStockValue(w, reference(w), scope).value !== null,
  },
  {
    id: 'margin',
    name: 'Gross margin',
    question: 'Gross margin · what does my supplied scope support?',
    fields:
      'Compatible sales amount and cost basis for the same products, quantity, period and amount definition.',
    owner: 'Sales',
    requires: ['sales-product'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'inventory',
    entryMethods: ['Manual stock snapshot and product cost/price entry'],
    warning:
      'No margin for uncovered products; gross margin is not net profit or cash.',
    displays: ['Inventory dashboard: gross-margin indicator'],
    presentationGroup: 'margin',
    check: (w) => margin(w),
  },
  {
    id: 'turnover-dio',
    name: 'Turnover and DIO',
    question: 'Turnover and DIO' + ' for the confirmed scope',
    fields:
      'Dated costed sales and historical physical inventory at compatible cost covering the selected period.',
    owner: 'Inventory',
    requires: ['sales-product', 'stock'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'inventory',
    entryMethods: [
      'Reviewed inventory-history observations or explicit interval estimates',
      'Reviewed sales CSV/Excel or manual sales with historical unit cost',
    ],
    displays: [
      'Inventory Executive and Inventory dashboard: shared capital panel with average inventory, turnover, DIO, GMROI and product/category tables',
    ],
    warning:
      'Sparse inventory intervals are explicitly estimated; gaps and incompatible cost scopes are excluded. Period ratios are not annualized.',
    check: (w, scope) => {
      const end = scope?.endDate || reference(w),
        start = scope?.startDate || plusDays(end, -29)
      const result = capitalMetrics(w, start, end, scope)
      return result.turnover !== null || result.dio !== null
    },
  },
  {
    id: 'gmroi',
    presentationGroup: 'turnover-dio',
    name: 'GMROI',
    question: 'GMROI' + ' for the confirmed scope',
    fields:
      'Compatible period gross profit and positive time-weighted inventory at historical cost.',
    owner: 'Inventory',
    requires: ['turnover-dio', 'margin'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'inventory',
    entryMethods: [
      'Reviewed inventory history',
      'Reviewed net sales with historical unit cost',
    ],
    displays: [
      'Inventory Executive and Inventory dashboard: shared capital panel with average inventory, turnover, DIO, GMROI and product/category tables',
    ],
    warning:
      'Gross profit and average inventory must describe the same product/location coverage. No ratio for a nonpositive denominator.',
    check: (w, scope) => {
      const end = scope?.endDate || reference(w)
      return (
        capitalMetrics(w, scope?.startDate || plusDays(end, -29), end, scope)
          .gmroi !== null
      )
    },
  },
  {
    id: 'service',
    name: 'In-stock/fill measures',
    question: 'In-stock/fill measures' + ' for the confirmed scope',
    fields:
      'Initially requested and fulfilled quantities, daily available-stock observations or measured availability duration.',
    owner: 'Inventory',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'inventory',
    entryMethods: [
      'Reviewed observed-service entry, with initial-request deadline and observation phase',
    ],
    displays: [
      'Service dashboard: unit fill, line fill, daily in-stock rate, unmet units and measured duration',
    ],
    warning:
      'Sales do not establish requested demand. Daily states and measured duration stay distinct; missed days remain unobserved.',
    check: (w, scope) => {
      const end = scope?.endDate || reference(w)
      return serviceMetrics(
        w,
        scope?.startDate || plusDays(end, -29),
        end,
        scope,
      ).some(
        (row) =>
          row.fillRate !== null ||
          row.inStockRate !== null ||
          row.observedMinutes > 0,
      )
    },
  },
  {
    id: 'aged-excess',
    name: 'Aged/excess inventory',
    question: 'Aged/excess inventory' + ' for the confirmed scope',
    fields:
      'Receipt layers reconciled to same-date physical stock; excess additionally needs an explicit product-wide target.',
    owner: 'Inventory',
    requires: ['stock'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'inventory',
    entryMethods: [
      'Reviewed receipt-age layers',
      'Reviewed physical stock and product target',
    ],
    displays: [
      'Inventory and Inventory dashboard: age bands, unknown-age coverage and excess units/value',
    ],
    warning:
      'Age is calendar days since original receipt. No inferred FIFO age; location-only scope cannot inherit a business-wide target.',
    check: (w, scope) =>
      agingMetrics(w, scope?.endDate || reference(w), scope).some(
        (row) =>
          row.bands.some((band) => band.quantity !== null) ||
          row.excess !== null,
      ),
  },
  {
    id: 'demand-growth',
    name: 'Demand-growth scenario control',
    question:
      'Demand-growth scenario control · what does my supplied scope support?',
    fields: 'A dated demand basis and an explicit growth assumption.',
    owner: 'Forecast & Simulate',
    requires: ['sales-product'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'sales',
    entryMethods: [
      'Manual sales entry',
      'Reviewed sales CSV/XLS/XLSX with worksheet and column review',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'Sparse history and stockouts; assumed growth is not a validated forecast. Downstream inventory/cash results require their own inputs.',
    displays: [],
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    check: (w) => demand(w),
  },
  {
    id: 'seasonality',
    name: 'Seasonality control',
    question: 'Seasonality control · what does my supplied scope support?',
    fields: 'Dated demand and a meaningful selectable seasonal interval.',
    owner: 'Forecast & Simulate',
    requires: ['sales-product'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'sales',
    entryMethods: [
      'Manual sales entry',
      'Reviewed sales CSV/XLS/XLSX with worksheet and column review',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'Short history or gaps; seasonal-naïve still requires a comparable prior observation.',
    displays: [],
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    check: (w) => seasonal(w),
  },
  {
    id: 'price',
    name: 'Price/discount scenario',
    question: 'Price/discount scenario · what does my supplied scope support?',
    fields:
      'Current or explicit scenario price and scoped quantities/demand basis.',
    owner: 'Forecast & Simulate',
    requires: ['sales-product'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'inventory',
    entryMethods: [
      'Manual stock snapshot and product cost/price entry',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'No automatic causal demand response without supported evidence or an explicit assumption.',
    displays: [
      'Forecast & Simulate: optional assumed selling-price and unit-cost fields; required focused inputs and retained assumptions stay accessible',
    ],
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    check: (w) =>
      w.products.some(
        (p) =>
          finite(p.price) &&
          w.sales.some((s) => s.productId === p.id && quantityRow(w, s)),
      ),
  },
  {
    id: 'lead-time',
    name: 'Supplier lead-time scenario control',
    question:
      'Supplier lead-time scenario control · what does my supplied scope support?',
    fields:
      'Quoted lead time, usable dated order/receipt history or an explicit scoped lead-time assumption, including the starting event.',
    owner: 'Forecast & Simulate',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'suppliers',
    entryMethods: [
      'Manual supplier/product terms and purchase entry',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'Timing assumptions do not establish reliability or agreed terms; consequential outputs require inventory/demand/events as applicable.',
    displays: [],
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    check: (w) =>
      productField(w, 'leadTimeDays') ||
      w.purchases.some(
        (p) =>
          validDate(p.orderDate) &&
          validDate(p.receivedDate) &&
          p.receivedDate! >= p.orderDate,
      ),
  },
  {
    id: 'suppliers',
    name: 'Supplier reliability',
    question: 'Supplier reliability · what does my supplied scope support?',
    fields:
      'Usable promised/actual dates and quantities for the selected delivery measure and supported supplier subset.',
    owner: 'Inventory',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'suppliers',
    entryMethods: ['Manual supplier/product terms and purchase entry'],
    warning:
      'Few completed orders or partial coverage; no fabricated supplier scores.',
    displays: [
      'Inventory dashboard: supplier delivery measures and observations',
    ],
    presentationGroup: 'suppliers',
    check: (w, scope) =>
      w.purchases.some(
        (p) =>
          knownProduct(w, p.productId) &&
          validDate(p.promisedDate) &&
          p.promisedDate! <= reference(w) &&
          (!scope?.startDate || p.promisedDate! >= scope.startDate) &&
          (!scope?.endDate || p.promisedDate! <= scope.endDate) &&
          finite(p.quantity) &&
          p.quantity > 0 &&
          finite(p.receivedQuantity) &&
          p.receivedQuantity >= 0,
      ),
  },
  {
    id: 'service-target',
    name: 'Service target',
    question: 'Service target · what does my supplied scope support?',
    fields: 'Defined scope and user-selected target.',
    owner: 'Inventory',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'inventory',
    entryMethods: ['Reviewed product-wide inventory policy entry'],
    warning: 'No historical comparison where service records are absent.',
    displays: [],
    check: (w) =>
      w.products.some(
        (p) =>
          finite(p.serviceTarget) &&
          p.serviceTarget! >= 0 &&
          p.serviceTarget! <= 100,
      ),
  },
  {
    id: 'reorder-point',
    name: 'Reorder point',
    question: 'Reorder point · what does my supplied scope support?',
    fields: 'Existing value or explicit scenario entry.',
    owner: 'Inventory',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'inventory',
    entryMethods: ['Reviewed product-wide inventory policy entry'],
    warning:
      'Missing demand/lead-time support is disclosed; label manual assumptions.',
    displays: [],
    check: (w) => productField(w, 'reorderPoint'),
  },
  {
    id: 'safety-stock',
    name: 'Safety stock',
    question: 'Safety stock · what does my supplied scope support?',
    fields:
      'Existing or explicitly entered stock quantity with compatible unit.',
    owner: 'Inventory',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'inventory',
    entryMethods: ['Reviewed product-wide inventory policy entry'],
    warning:
      'Missing forecast-error or lead-time variability limits interpretation.',
    displays: [],
    check: (w) => productField(w, 'safetyStock'),
  },
  {
    id: 'order-quantity',
    name: 'Order quantity',
    question: 'Order quantity · what does my supplied scope support?',
    fields: 'Existing or proposed quantity and unit.',
    owner: 'Forecast & Simulate',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'suppliers',
    entryMethods: [
      'Manual supplier/product terms and purchase entry',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning: 'Conflicts with MOQ, pack, budget or capacity must be visible.',
    displays: [],
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    check: (w) =>
      w.purchases.some(
        (p) =>
          knownProduct(w, p.productId) && finite(p.quantity) && p.quantity >= 0,
      ),
  },
  {
    id: 'purchase-constraints',
    name: 'MOQ/case pack',
    question: 'MOQ/case pack · what does my supplied scope support?',
    fields: 'At least one usable scoped purchasing constraint.',
    owner: 'Inventory',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'suppliers',
    entryMethods: ['Manual supplier/product terms and purchase entry'],
    warning: 'Missing or conflicting supplier-specific constraints.',
    displays: [],
    check: (w) =>
      w.products.some(
        (p) =>
          (finite(p.moq) && p.moq! >= 0) ||
          (finite(p.casePack) && p.casePack! > 0),
      ),
  },
  {
    id: 'payment-terms',
    name: 'Payment terms',
    question: 'Payment terms' + ' for the confirmed scope',
    fields:
      'Named supplier/customer, calendar-day offset, starting event and agreed or proposed status.',
    owner: 'Finance',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'finance',
    entryMethods: [
      'Reviewed supplier/customer payment terms, including explicit advance offsets',
    ],
    displays: ['Finance: recorded payment terms register'],
    warning:
      'Saving terms never changes existing financial dates. Proposed terms need hypothetical scenario consent; the starting event is preserved.',
    check: (w) =>
      (w.paymentTerms ?? []).some(
        (term) =>
          term.counterparty.trim() &&
          Number.isInteger(term.days) &&
          term.days >= 0 &&
          [
            'invoice-date',
            'order-date',
            'receipt-date',
            'delivery-date',
          ].includes(term.startEvent),
      ),
  },
  {
    id: 'budget',
    name: 'Purchasing-budget comparison',
    question:
      'Purchasing-budget comparison · what does my supplied scope support?',
    fields:
      'Budget amount/period/scope and proposed or committed purchase amounts.',
    owner: 'Finance',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'finance',
    entryMethods: ['Manual financial record, cash, budget or coverage entry'],
    warning:
      'Shows spend against budget, never absolute cash or liquidity sufficiency.',
    displays: ['Finance: purchasing-budget summary'],
    presentationGroup: 'budget',
    check: (w) => budget(w),
  },
  {
    id: 'customer-delay',
    name: 'Customer-payment delay',
    question: 'Customer-payment delay · what does my supplied scope support?',
    fields:
      'Identifiable outstanding or pending collection with usable amount/date and specified delay or alternative date.',
    owner: 'Forecast & Simulate',
    requires: ['internal-debt'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'finance',
    entryMethods: [
      'Manual financial record, cash, budget or coverage entry',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'Expected dates are estimates; a standalone delay without a cash event has no computable cash impact. Absolute cash results also require opening cash.',
    displays: [
      'Forecast & Simulate: optional collection-timing fields in Explore and Cash Sufficiency; required collection question fields stay accessible',
    ],
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    check: (w) => collection(w),
  },
  {
    id: 'incoming-late',
    name: 'Incoming late payments',
    question: 'Incoming late payments · what does my supplied scope support?',
    fields: 'Amount outstanding, due date and current status.',
    owner: 'Finance',
    requires: ['internal-debt'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'finance',
    entryMethods: ['Manual financial record, cash, budget or coverage entry'],
    warning:
      'Expected collection date may be missing; still show overdue amount without inventing collection timing.',
    displays: [
      'Home, Finance and Finance dashboard: Internal Debt indicators',
      'Home: overdue collection alerts',
    ],
    presentationGroup: 'internal-debt',
    check: (w) =>
      w.finance.some(
        (f) =>
          f.kind === 'receivable' &&
          usableFinance(w, f) &&
          validDate(f.dueDate),
      ),
  },
  {
    id: 'outgoing-late',
    name: 'Outgoing late payments',
    question: 'Outgoing late payments · what does my supplied scope support?',
    fields: 'Amount outstanding, due date and current status.',
    owner: 'Finance',
    requires: ['external-debt'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'finance',
    entryMethods: ['Manual financial record, cash, budget or coverage entry'],
    warning: 'Do not invent a missing planned payment date.',
    displays: ['Finance and Finance dashboard: External Debt indicators'],
    presentationGroup: 'external-debt',
    check: (w) =>
      w.finance.some(
        (f) =>
          f.kind === 'payable' && usableFinance(w, f) && validDate(f.dueDate),
      ),
  },
  {
    id: 'financing',
    firstResult: { page: 'finance', label: 'Known financing payments' },
    name: 'Financing Debt outlook',
    question: 'Financing Debt outlook · what does my supplied scope support?',
    fields: 'Balance and known next-payment amount/date for the timed outlook.',
    owner: 'Finance',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'finance',
    entryMethods: ['Manual financial record, cash, budget or coverage entry'],
    warning:
      'An incomplete schedule supports only the known period; interest/maturity may remain unknown.',
    displays: [
      'Finance and Finance dashboard: known financing-payment indicators',
    ],
    presentationGroup: 'financing',
    check: (w) =>
      w.finance.some(
        (f) =>
          f.kind === 'financing' &&
          usableFinance(w, f) &&
          validDate(f.expectedDate),
      ),
  },
  {
    id: 'forecast-naive',
    name: 'Naïve forecast',
    question: 'Naïve forecast · what does my supplied scope support?',
    fields:
      'At least one comparable prior observation for the selected scope/cadence.',
    owner: 'Forecast & Simulate',
    requires: ['sales-product'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'sales',
    entryMethods: [
      'Manual sales entry',
      'Reviewed sales CSV/XLS/XLSX with worksheet and column review',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'Very short history and censored observations; not evidence of a trend.',
    displays: [
      'Forecast & Simulate: naive engine option for new forecasts (saved history and pinned dependencies stay accessible)',
    ],
    presentationGroup: 'forecast-naive',
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    check: (w) => demand(w),
  },
  {
    id: 'forecast-seasonal',
    name: 'Seasonal-naïve forecast',
    question: 'Seasonal-naïve forecast · what does my supplied scope support?',
    fields: 'A comparable prior seasonal observation at the selected lag.',
    owner: 'Forecast & Simulate',
    requires: ['sales-product', 'seasonality'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'sales',
    entryMethods: [
      'Manual sales entry',
      'Reviewed sales CSV/XLS/XLSX with worksheet and column review',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'Missing seasonal periods or changed promotions; no fabricated seasonal history.',
    displays: [
      'Forecast & Simulate: seasonal engine option for new forecasts (saved history and pinned dependencies stay accessible)',
    ],
    presentationGroup: 'forecast-seasonal',
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    check: (w) => seasonal(w),
  },
  {
    id: 'forecast-advanced',
    name: 'LightGBM/CatBoost forecast',
    question:
      'LightGBM/CatBoost forecast · what does my supplied scope support?',
    fields:
      'The documented prerequisites of the configured advanced engine and its required selected drivers for the supported scope.',
    owner: 'Forecast & Simulate',
    requires: ['sales-product'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'sales',
    entryMethods: [
      'Manual sales entry',
      'Reviewed sales CSV/XLS/XLSX with worksheet and column review',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'LightGBM and CatBoost use 56 consecutive observed days ending before the forecast start, fixed lag/calendar inputs and a 14-day holdout. Eligibility and driver availability are revalidated against each selected run scope; absent dates are never filled as zero.',
    displays: [
      'Forecast & Simulate: advanced engine option for new forecasts (saved history and pinned dependencies stay accessible)',
    ],
    presentationGroup: 'forecast-advanced',
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    check: (w) =>
      w.products.some((product) => {
        const dates = new Set(
          w.sales
            .filter(
              (sale) => sale.productId === product.id && quantityRow(w, sale),
            )
            .map((sale) => sale.date),
        )
        return Array.from({ length: 56 }, (_, index) =>
          plusDays(reference(w), -index - 1),
        ).every((date) => dates.has(date))
      }),
  },
  {
    id: 'forecast-inventory',
    name: 'Forecast-driven inventory simulation',
    question:
      'Forecast-driven inventory simulation · what does my supplied scope support?',
    fields:
      'Eligible forecast run that succeeds before numerical consumption, starting stock, relevant policy controls, scope and horizon. A pending reference can be saved and awaited.',
    owner: 'Forecast & Simulate',
    requires: ['forecast', 'stock'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'inventory',
    entryMethods: [
      'Manual stock snapshot and product cost/price entry',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'Missing costs, suppliers or finance restrict the corresponding result families.',
    displays: [],
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    check: (w) => demand(w) && availableStock(w),
  },
  {
    id: 'declared-order',
    name: 'Declared-order scenario',
    question: 'Declared-order scenario · what does my supplied scope support?',
    fields:
      'Product/quantity, delivery timing and stock/supply facts or explicit assumptions needed for the requested fulfillment outputs.',
    owner: 'Forecast & Simulate',
    requires: ['stock'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'inventory',
    entryMethods: [
      'Manual stock snapshot and product cost/price entry',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'No sales history required merely to test a declared order; no full feasibility claim without the corresponding operational/financial inputs.',
    displays: [],
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    questionKey: 'Q-NEW-ORDER',
    check: (w) => availableStock(w),
  },
  {
    id: 'critical-collection',
    name: 'Critical-collection cash scenario',
    question:
      'Critical-collection cash scenario · what does my supplied scope support?',
    fields:
      'Opening cash with reference date, a dated collection event, disclosed timed commitments and a changed collection assumption.',
    owner: 'Forecast & Simulate',
    requires: ['internal-debt', 'liquidity'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'finance',
    entryMethods: [
      'Manual financial record, cash, budget or coverage entry',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'No inventory forecast required; omitted obligations prevent business-wide sufficiency claims.',
    displays: [],
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    questionKey: 'Q-CRITICAL-COLLECTION',
    check: (w, scope) => cash(w, scope) && collection(w),
  },
  {
    id: 'liquidity',
    firstResult: { page: 'finance', label: 'Cash outlook' },
    name: 'Daily 30-day liquidity projection',
    question:
      'Daily 30-day liquidity projection · what does my supplied scope support?',
    fields:
      'Opening cash with date/scope, at least one future timed cash-flow event and explicit review of included and omitted categories.',
    owner: 'Finance',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'finance',
    entryMethods: ['Manual financial record, cash, budget or coverage entry'],
    warning:
      'Missing payroll, rent, taxes, financing or other obligations means a partial projection. A purchasing budget never substitutes for cash.',
    displays: [
      'Home, Finance and Finance dashboard: current cash indicators',
      'Finance: upcoming payment calendar and optional cash alerts',
    ],
    presentationGroup: 'liquidity',
    check: (w, scope) => cash(w, scope),
  },
  {
    id: 'cash-gap',
    name: 'Cash-gap date and amount',
    question: 'Cash-gap date and amount · what does my supplied scope support?',
    fields:
      'A computable daily balance curve; identify any below-zero dates and deficit under §23.',
    owner: 'Finance',
    requires: ['liquidity'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'finance',
    entryMethods: ['Manual financial record, cash, budget or coverage entry'],
    warning:
      'Report included scope and missing obligations even when the recorded curve contains no gap.',
    displays: [
      'Home, Finance and Finance dashboard: current cash indicators',
      'Finance: upcoming payment calendar and optional cash alerts',
    ],
    presentationGroup: 'liquidity',
    check: (w, scope) => cash(w, scope),
  },
  {
    id: 'reserve',
    name: 'Additional liquidity to preserve reserve',
    question:
      'Additional liquidity to preserve reserve · what does my supplied scope support?',
    fields:
      'Usable cash curve and owner-selected reserve for the same scope/horizon.',
    owner: 'Finance',
    requires: ['liquidity'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'finance',
    entryMethods: ['Manual financial record, cash, budget or coverage entry'],
    warning:
      'Without a reserve, show only supported zero-cash-gap measures; do not invent a target.',
    displays: [
      'Forecast & Simulate: optional reserve-target field; current cash displays and saved reserve results stay accessible',
    ],
    check: (w, scope) =>
      cash(w, scope) && finite(w.cash?.reserve) && w.cash!.reserve! >= 0,
  },
  {
    id: 'integrated-scenario',
    name: 'Integrated commercial/operational/financial scenario',
    question:
      'Integrated commercial/operational/financial scenario · what does my supplied scope support?',
    fields:
      'Minimum inputs for every requested result family, with explicit assumptions and traceability.',
    owner: 'Forecast & Simulate',
    requires: ['stock', 'sales-product', 'liquidity'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'inventory',
    entryMethods: [
      'Manual stock snapshot and product cost/price entry',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'Partial results remain useful but do not certify global business viability.',
    displays: [],
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    check: (w, scope) =>
      availableStock(w) && demand(w) && margin(w) && cash(w, scope),
  },
  {
    id: 'cash-sufficiency',
    name: 'Cash sufficiency for payroll, suppliers and rent',
    question:
      'Cash sufficiency for payroll, suppliers and rent · what does my supplied scope support?',
    fields:
      'Opening cash with reference date and dated/scheduled events for the selected horizon; review payroll, supplier, rent and other relevant categories as supplied, confirmed absent or omitted. At least one future timed event is required for the projection.',
    owner: 'Forecast & Simulate',
    requires: ['liquidity'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'finance',
    entryMethods: [
      'Manual financial record, cash, budget or coverage entry',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'Sufficiency is conditional on included categories and dates; omitted categories keep the result partial. Modeled levers are not instructions or guaranteed financing.',
    displays: [],
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    questionKey: 'Q-CASH-SUFFICIENCY',
    check: (w, scope) => cash(w, scope),
  },
  {
    id: 'replenishment',
    name: 'Replenishment timing and quantity',
    question:
      'Replenishment timing and quantity · what does my supplied scope support?',
    fields:
      'Starting stock, usable demand path, supplier lead time, existing/on-order supply and applicable MOQ/case-pack/order constraints for the selected SKU/location/horizon.',
    owner: 'Forecast & Simulate',
    requires: ['stock', 'forecast-naive', 'lead-time', 'purchase-constraints'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'suppliers',
    entryMethods: [
      'Manual supplier/product terms and purchase entry',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'Scenario-dependent stockout/service/cash tradeoffs; no universally optimal policy label.',
    displays: [],
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    questionKey: 'Q-REPLENISH',
    check: (w) =>
      w.products.some(
        (p) =>
          availableStock(w, p.id) &&
          demand(w, p.id) &&
          finite(p.leadTimeDays) &&
          p.leadTimeDays! >= 0,
      ),
  },
  {
    id: 'demand-change',
    name: 'Vacation/low-season/high-season demand change',
    question:
      'Vacation/low-season/high-season demand change · what does my supplied scope support?',
    fields:
      'Completed forecast or dated baseline demand series plus explicit dated multiplier/override or supported seasonal assumption.',
    owner: 'Forecast & Simulate',
    requires: ['sales-product'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'sales',
    entryMethods: [
      'Manual sales entry',
      'Reviewed sales CSV/XLS/XLSX with worksheet and column review',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'Not a validated causal forecast unless the model supports that claim. Inventory/purchase/cash outputs require their own inputs; show changed dates and the comparison baseline.',
    displays: [],
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    questionKey: 'Q-DEMAND-CHANGE',
    check: (w) => demand(w),
  },
  {
    id: 'supplier-delay',
    name: 'Slower-supplier scenario',
    question: 'Slower-supplier scenario · what does my supplied scope support?',
    fields:
      'Usable lead time or explicit assumption, starting inventory, dated demand basis and open/planned replenishment events.',
    owner: 'Forecast & Simulate',
    requires: ['stock', 'forecast-naive', 'lead-time'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'suppliers',
    entryMethods: [
      'Manual supplier/product terms and purchase entry',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'A slower lead-time assumption does not establish supplier unreliability; expose dated stockout/backorder and receipt effects where supported.',
    displays: [],
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    questionKey: 'Q-SLOW-SUPPLIER',
    check: (w) => openSupply(w),
  },
  {
    id: 'customer-accumulation',
    name: 'Customer-debt accumulation scenario',
    question:
      'Customer-debt accumulation scenario · what does my supplied scope support?',
    fields:
      'Current receivables plus explicit assumptions for new credit sales, delayed collections, unpaid share or shifted dates. Absolute cash balance/floor/gap also requires opening cash and dated obligations/events; a receipt-timing or amount delta alone must be labeled as such.',
    owner: 'Forecast & Simulate',
    requires: ['internal-debt'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'finance',
    entryMethods: [
      'Manual financial record, cash, budget or coverage entry',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'No invented default probabilities or collection behavior; separate receivable growth, sales and cash.',
    displays: [],
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    questionKey: 'Q-CUSTOMER-DEBT',
    check: (w) => collection(w),
  },
  {
    id: 'supplier-stockout',
    name: 'Supplier-order change stockout scenario',
    question:
      'Supplier-order change stockout scenario · what does my supplied scope support?',
    fields:
      'Starting stock, current/proposed supplier order quantity and receipt date, usable demand path and applicable lead-time/MOQ/case-pack constraints.',
    owner: 'Forecast & Simulate',
    requires: ['stock', 'forecast-naive', 'order-quantity'],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'suppliers',
    entryMethods: [
      'Manual supplier/product terms and purchase entry',
      'Explicit assumptions in Forecast & Simulate',
    ],
    warning:
      'May show dated stockout/lost/backordered units under the assumption; no unrecorded emergency supply.',
    displays: [],
    configuration:
      'Configure the selected scope, horizon and assumptions in Forecast & Simulate. Saved forecast dependencies and requested result families are validated on submission; current records alone do not certify a runnable scenario.',
    questionKey: 'Q-SUPPLIER-ORDER-STOCKOUT',
    check: (w) => openSupply(w),
  },
  {
    id: 'period-filter',
    name: 'Dashboard period filtering',
    question:
      'Dashboard period filtering · what does my supplied scope support?',
    fields:
      "The metric's own minimums plus dates appropriate to its temporal basis under §23.",
    owner: 'Dashboards',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'sales',
    entryMethods: [
      'Manual sales entry',
      'Reviewed sales CSV/XLS/XLSX with worksheet and column review',
    ],
    warning:
      'Disclose undated/excluded coverage, records outside range, timezone/date inconsistencies, short comparison history and partial quarters. Historical reporting periods do not silently become future planning horizons.',
    displays: [],
    check: (w) =>
      w.sales.some((s) => validDate(s.date)) ||
      w.stock.some((s) => validDate(s.asOf)) ||
      w.finance.some((f) => validDate(f.dueDate)),
  },
  {
    id: 'internal-debt',
    firstResult: {
      page: 'finance',
      label: 'Receivables and pending collections',
    },
    name: 'Internal Debt records and outputs',
    question:
      'Internal Debt records and outputs · what does my supplied scope support?',
    fields:
      'One identifiable record enables record visibility. A monetary subtotal requires usable non-overlapping amount/status/currency; overdue totals require due dates; expected collection/availability timelines require corresponding usable dates.',
    owner: 'Finance',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'finance',
    entryMethods: ['Manual financial record, cash, budget or coverage entry'],
    warning:
      'Missing dates stay unscheduled; flag stale synchronization, duplicate provider references, inconsistent amount/status/currency and partial customer coverage. An incomplete record does not unlock unsupported totals or timelines.',
    displays: [
      'Home, Finance and Finance dashboard: Internal Debt indicators',
      'Home: overdue collection alerts',
    ],
    presentationGroup: 'internal-debt',
    check: (w) =>
      [...w.finance, ...(w.pendingFinance ?? [])].some(
        (f) =>
          ['receivable', 'provider_pending'].includes(f.kind) &&
          f.id &&
          f.name.trim(),
      ),
  },
  {
    id: 'external-debt',
    firstResult: { page: 'finance', label: 'Supplier payables' },
    name: 'External Debt records and outputs',
    question:
      'External Debt records and outputs · what does my supplied scope support?',
    fields:
      'One identifiable payable enables record visibility. Monetary subtotals require usable outstanding amount/status/currency; supplier breakdowns require supplier identity; overdue/timed outputs require appropriate due/expected/planned dates.',
    owner: 'Finance',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'finance',
    entryMethods: ['Manual financial record, cash, budget or coverage entry'],
    warning:
      'Missing supplier/dates, negative or inconsistent amounts, duplicate references, stale payment status and inactive suppliers are disclosed. Preserve the calculable subset; do not invent missing values.',
    displays: ['Finance and Finance dashboard: External Debt indicators'],
    presentationGroup: 'external-debt',
    check: (w) =>
      [...w.finance, ...(w.pendingFinance ?? [])].some(
        (f) => f.kind === 'payable' && f.id && f.name.trim(),
      ),
  },
  {
    id: 'commitments',
    name: 'Recurring supplier commitments',
    question:
      'Recurring supplier commitments · what does my supplied scope support?',
    fields:
      'One identifiable active commitment enables record visibility. Period-level expected/fulfilled views require cadence or covered period and relevant status; monetary obligations require a known amount/currency; cash timing requires a usable event date and non-duplicate payable/event link.',
    owner: 'Finance',
    requires: [],
    feeds: [],
    lifecycle: 'active',
    canonical: true,
    entrySection: 'finance',
    entryMethods: ['Manual financial record, cash, budget or coverage entry'],
    warning:
      'Flag missing cadence/supplier/status, duplicates or overlapping periods, inconsistent linked fulfillment, missing expected order/payable links, past periods without status and inactive suppliers. Fulfilled never means paid without separate payment evidence.',
    displays: ['Finance: recurring-commitment summary'],
    presentationGroup: 'commitments',
    check: (w) => w.commitments.some((c) => c.id && c.name.trim()),
  },
]
