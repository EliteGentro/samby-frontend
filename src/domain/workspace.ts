import { matrixCapabilities } from './capability-matrix'
export type Mode = 'business' | 'demo'
export type Page =
  | 'home'
  | 'inventory'
  | 'dashboards'
  | 'analysis'
  | 'finance'
  | 'data'
  | 'settings'
export type QuestionKey =
  | 'Q-NEW-ORDER'
  | 'Q-REPLENISH'
  | 'Q-CRITICAL-COLLECTION'
  | 'Q-CASH-SUFFICIENCY'
  | 'Q-DEMAND-CHANGE'
  | 'Q-SLOW-SUPPLIER'
  | 'Q-CUSTOMER-DEBT'
  | 'Q-SUPPLIER-ORDER-STOCKOUT'
  | 'Q-EXPLORE'
  | 'Q-POISON-APPLE'
  | 'Q-DEAD-STOCK'
  | 'Q-TREASURY-STRESS'
export type Category =
  | 'collections'
  | 'suppliers'
  | 'payroll'
  | 'rent'
  | 'taxes'
  | 'financing'
  | 'other'
export type Coverage = {
  state: 'unknown' | 'supplied' | 'absent' | 'omitted'
  startDate: string
  endDate: string
}
export type BusinessProfile = {
  name: string
  currency: string
  timezone: string
  businessType: string
  firstQuestion: string
}
export type Product = {
  id: string
  sku: string
  name: string
  category: string
  brand?: string
  targetStock?: number | null
  unit: string
  cost: number | null
  price: number | null
  supplierId: string | null
  leadTimeDays: number | null
  moq: number | null
  casePack: number | null
  reorderPoint: number | null
  safetyStock: number | null
  serviceTarget: number | null
  serviceTargetBasis?: 'initial-unit-fill' | 'daily-in-stock'
}
export type Location = { id: string; name: string }
export type InventoryPool = {
  id: string
  name: string
  locationIds: string[]
  channelNames: string[]
}
export type StockPosition = {
  sourceId?: string
  id: string
  productId: string
  locationId: string | null
  onHand: number
  reserved: number | null
  asOf: string
  quantityBasis?: 'on-hand' | 'available'
  backordered?: number | null
}
export type Sale = {
  id: string
  date: string
  productId: string | null
  quantity: number | null
  amount: number | null
  unit: string
  currency: string
  locationId: string | null
  sourceId: string
  kind: 'sale' | 'return'
  amountBasis: string
  sourceReference?: string
  unitCost?: number | null
  costUnit?: string
}
export type Supplier = { id: string; name: string; active: boolean }
export type Purchase = {
  sourceId?: string
  locationId?: string | null
  id: string
  productId: string
  supplierId: string
  quantity: number
  amount: number | null
  orderDate: string
  promisedDate: string | null
  receivedDate: string | null
  receivedQuantity: number
  plannedPaymentDate: string | null
  paidAmount: number
}
export type FinancialRecord = {
  sourceId?: string
  id: string
  kind:
    | 'receivable'
    | 'payable'
    | 'financing'
    | 'operating'
    | 'provider_pending'
  name: string
  counterparty: string
  amount: number
  paidAmount: number
  currency: string
  dueDate: string | null
  expectedDate: string | null
  category: Category
  linkedRecordId: string | null
  cashIncluded: boolean
}
export type PendingFinanceRecord = {
  id: string
  kind: 'receivable' | 'payable'
  name: string
  counterparty: string
  currency: string
  amount: number | null
  paidAmount: number | null
  dueDate: string | null
  expectedDate: string | null
  sourceId: string
}
export type FinanceEvent = {
  id: string
  sourceId: string
  kind: 'customer_collection' | 'provider_availability' | 'supplier_payment'
  recordId: string
  paymentReference: string
  date: string
  amount: number
  currency: string
}
export type Commitment = {
  sourceId?: string
  id: string
  name: string
  supplierId: string | null
  amount: number | null
  currency: string
  cadence: 'weekly' | 'monthly'
  nextDate: string | null
  fulfillment: 'unknown' | 'fulfilled' | 'not_fulfilled'
  payment: 'unknown' | 'paid' | 'unpaid'
  linkedPayableId: string | null
}
export type Movement = {
  sourceId?: string
  id: string
  productId: string
  date: string
  type: 'receipt' | 'transfer' | 'adjustment'
  quantity: number
  fromLocationId: string | null
  toLocationId: string | null
  reason: string
}
export type Source = {
  id: string
  name: string
  type: 'manual' | 'csv' | 'xlsx' | 'demo'
  importedAt: string
  rowCount: number
  excludedCount: number
  review?: {
    headers: string[]
    rows: string[][]
    columnMapping: Record<string, number | null>
    interpretation: Record<string, string | boolean>
    acceptedRowIndexes: number[]
    excludedRowIndexes: number[]
  }
}
export type InventorySnapshot = {
  id: string
  productId: string
  locationId: string | null
  asOf: string
  throughDate: string
  method: 'daily-observed' | 'constant-estimate'
  quantity: number
  unit: string
  unitCost: number | null
  currency: string
  sourceId: string
}
export type ServiceObservation = {
  unmetDisposition?: 'unknown' | 'lost' | 'backordered'
  backlogRemaining?: number | null
  backlogAsOf?: string | null
  lostUnitMargin?: number | null
  lostMarginBasis?: string
  orderReference?: string
  deliveredDate?: string | null
  id: string
  date: string
  productId: string
  locationId: string | null
  unit: string
  requested: number | null
  fulfilled: number | null
  availableQuantity: number | null
  phase: 'opening' | 'closing'
  deadline: 'initial-request'
  inStockMinutes: number | null
  observedMinutes: number | null
  sourceId: string
}
export type InventoryLayer = {
  id: string
  productId: string
  locationId: string | null
  receiptDate: string
  asOf: string
  remainingQuantity: number
  unit: string
  sourceId: string
}
export type PaymentTerms = {
  id: string
  party: 'supplier' | 'customer'
  counterparty: string
  supplierId: string | null
  days: number
  startEvent: 'invoice-date' | 'order-date' | 'receipt-date' | 'delivery-date'
  status: 'agreed' | 'proposed'
  reference: string
  sourceId: string
  advancePercent?: number
  advanceDays?: number
}
export type Workspace = {
  version: 1
  id: string
  mode: Mode
  revision: number
  profile: BusinessProfile
  products: Product[]
  locations: Location[]
  inventoryPools?: InventoryPool[]
  inventoryHistory?: InventorySnapshot[]
  serviceObservations?: ServiceObservation[]
  inventoryLayers?: InventoryLayer[]
  paymentTerms?: PaymentTerms[]
  stock: StockPosition[]
  sales: Sale[]
  suppliers: Supplier[]
  purchases: Purchase[]
  finance: FinancialRecord[]
  pendingFinance?: PendingFinanceRecord[]
  financeEvents?: FinanceEvent[]
  commitments: Commitment[]
  movements: Movement[]
  sources: Source[]
  cash: {
    amount: number
    date: string
    phase: 'opening' | 'end-of-day'
    reserve: number | null
  } | null
  budget: { amount: number; startDate: string; endDate: string } | null
  coverage: Record<Category, Coverage>
  muted: string[]
  notifications: {
    enabled: boolean
    severity: 'all' | 'warning' | 'critical'
    snoozed: string[]
    unlocked?: string[]
    dismissed?: string[]
    snoozedUntil?: Record<string, string>
    cadenceDays?: number
  }
  onboarding: {
    step: number
    completed: boolean
    deferred: boolean
    firstAnalysisAt: string | null
    firstComparisonAt: string | null
  }
  standardization: {
    id: string
    date: string
    productId: string
    oldSku: string
    newSku: string
    field?: string
    oldValue?: string
    newValue?: string
    conversionFactor?: number
    affectedRecordIds?: string[]
    sourceIds?: string[]
  }[]
}

export const DEMO_DATE = '2026-09-12'
export const categories: Category[] = [
  'collections',
  'suppliers',
  'payroll',
  'rent',
  'taxes',
  'financing',
  'other',
]
export const today = (timeZone = 'America/Monterrey') =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
export const shiftDate = (date: string, days: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10)
export const money = (value: number | null, currency = 'MXN') =>
  value === null
    ? 'Not provided'
    : new Intl.NumberFormat('en-MX', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
      }).format(value)
export const number = (value: number) =>
  new Intl.NumberFormat('en-MX', { maximumFractionDigits: 1 }).format(value)
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
export const outstanding = (record: FinancialRecord) =>
  Math.max(0, record.amount - record.paidAmount)
export const cutoff = (workspace: Workspace) =>
  workspace.mode === 'demo' ? DEMO_DATE : today(workspace.profile.timezone)
export function availability(
  workspace: Workspace,
  productId: string,
  locationId?: string,
): number | null {
  const positions = workspace.stock.filter(
    (s) =>
      s.productId === productId && (!locationId || s.locationId === locationId),
  )
  if (
    !positions.length ||
    positions.some(
      (s) => s.quantityBasis !== 'available' && s.reserved === null,
    )
  )
    return null
  if (
    positions.some((s) => s.locationId === null) &&
    positions.some((s) => s.locationId !== null)
  )
    return null
  return positions.reduce(
    (sum, s) =>
      sum +
      s.onHand -
      (s.quantityBasis === 'available' ? 0 : (s.reserved ?? 0)),
    0,
  )
}

export function emptyWorkspace(id: string, mode: Mode = 'business'): Workspace {
  return {
    version: 1,
    id,
    mode,
    revision: 0,
    profile: {
      name: '',
      currency: 'MXN',
      timezone: 'America/Monterrey',
      businessType: '',
      firstQuestion: 'sales',
    },
    products: [],
    locations: [],
    stock: [],
    sales: [],
    suppliers: [],
    purchases: [],
    finance: [],
    commitments: [],
    movements: [],
    sources: [],
    cash: null,
    budget: null,
    coverage: Object.fromEntries(
      categories.map((category) => [
        category,
        {
          state: 'unknown',
          startDate: today(),
          endDate: shiftDate(today(), 29),
        },
      ]),
    ) as Record<Category, Coverage>,
    muted: [],
    notifications: { enabled: true, severity: 'all', snoozed: [] },
    onboarding: {
      step: 0,
      completed: false,
      deferred: false,
      firstAnalysisAt: null,
      firstComparisonAt: null,
    },
    standardization: [],
  }
}

export function demoWorkspace(id: string): Workspace {
  const w = emptyWorkspace(id, 'demo')
  w.profile = {
    name: 'Distribuidora Norte',
    currency: 'MXN',
    timezone: 'America/Monterrey',
    businessType: 'Wholesale distributor',
    firstQuestion: 'sales',
  }
  w.locations = [
    { id: 'loc-mty', name: 'Monterrey warehouse' },
    { id: 'loc-saltillo', name: 'Saltillo branch' },
  ]
  w.inventoryPools = [
    {
      id: 'pool-demo',
      name: 'Shared distribution stock',
      locationIds: ['loc-mty', 'loc-saltillo'],
      channelNames: ['Wholesale', 'Online'],
    },
  ]
  w.movements = [
    {
      id: 'move-demo-receipt',
      productId: 'p-1',
      date: '2026-09-11',
      type: 'receipt',
      quantity: 24,
      fromLocationId: null,
      toLocationId: 'loc-mty',
      reason:
        'Received 24 pieces; already included in the September 12 stock snapshot.',
    },
  ]
  w.suppliers = [
    { id: 'sup-1', name: 'Empaques del Norte', active: true },
    { id: 'sup-2', name: 'Industrial MX', active: true },
    { id: 'sup-3', name: 'Oficina Central', active: true },
  ]
  const rows: [string, string, string, number, number, number, number][] = [
    ['EMP-001', 'Shipping box · medium', 'Packaging', 18, 32, 420, 12],
    ['EMP-002', 'Packing tape · 48 mm', 'Packaging', 24, 42, 84, 8],
    ['IND-001', 'Nitrile work gloves', 'Industrial', 58, 95, 238, 9],
    ['IND-002', 'Safety glasses · clear', 'Industrial', 35, 68, 310, 7],
    ['OFC-001', 'Copy paper · 500 sheets', 'Office', 72, 110, 156, 6],
    [' ofc 002 ', 'Permanent marker · black', 'Office', 9, 18, 580, 15],
  ]
  w.products = rows.map(([sku, name, category, cost, price], i) => ({
    id: `p-${i + 1}`,
    sku,
    name,
    category,
    unit: 'pieces',
    cost,
    price,
    supplierId: `sup-${Math.floor(i / 2) + 1}`,
    leadTimeDays: 5 + i,
    moq: 24,
    casePack: 12,
    reorderPoint: 100,
    safetyStock: 24,
    serviceTarget: 95,
  }))
  w.stock = rows.flatMap((row, i) => [
    {
      id: `s-${i}-a`,
      productId: `p-${i + 1}`,
      locationId: 'loc-mty',
      onHand: row[5],
      reserved: i === 1 ? 12 : 0,
      asOf: DEMO_DATE,
    },
    {
      id: `s-${i}-b`,
      productId: `p-${i + 1}`,
      locationId: 'loc-saltillo',
      onHand: Math.floor(row[5] / 3),
      reserved: 0,
      asOf: DEMO_DATE,
    },
  ])
  w.sales = Array.from({ length: 90 }, (_, day) =>
    w.products.map((p, i) => {
      const quantity = rows[i][6] + ((day * 7 + i * 3) % 13)
      return {
        id: `sale-${day}-${i}`,
        date: shiftDate(DEMO_DATE, day - 89),
        productId: p.id,
        quantity,
        amount: quantity * (p.price ?? 0),
        unit: p.unit,
        currency: 'MXN',
        locationId: day % 4 === 0 ? 'loc-saltillo' : 'loc-mty',
        sourceId: 'demo-v04',
        kind: 'sale' as const,
        amountBasis: 'Net sales excluding tax, after discounts and returns',
      }
    }),
  ).flat()
  w.purchases = w.products.map((p, i) => ({
    id: `po-${100 + i}`,
    productId: p.id,
    supplierId: p.supplierId!,
    quantity: 120,
    amount: 120 * (p.cost ?? 0),
    orderDate: shiftDate(DEMO_DATE, -12 + i),
    promisedDate: shiftDate(DEMO_DATE, i - 3),
    receivedDate: i < 3 ? shiftDate(DEMO_DATE, i - 3) : null,
    receivedQuantity: i < 3 ? 120 : 0,
    plannedPaymentDate: shiftDate(DEMO_DATE, i + 5),
    paidAmount: 0,
  }))
  const fin = (
    id: string,
    kind: FinancialRecord['kind'],
    name: string,
    counterparty: string,
    amount: number,
    days: number,
    category: Category,
    paidAmount = 0,
  ): FinancialRecord => ({
    id,
    kind,
    name,
    counterparty,
    amount,
    paidAmount,
    currency: 'MXN',
    dueDate: shiftDate(DEMO_DATE, days),
    expectedDate: shiftDate(DEMO_DATE, Math.max(days, 2)),
    category,
    linkedRecordId: null,
    cashIncluded: false,
  })
  w.finance = [
    fin(
      'inv-1024',
      'receivable',
      'Invoice #1024',
      'Comercial Atlas',
      68400,
      -5,
      'collections',
    ),
    fin(
      'inv-1031',
      'receivable',
      'Invoice #1031',
      'Grupo Rivera',
      42500,
      7,
      'collections',
    ),
    fin(
      'inv-1038',
      'receivable',
      'Invoice #1038',
      'Ferretería Central',
      28000,
      14,
      'collections',
      10000,
    ),
    fin(
      'provider-1',
      'provider_pending',
      'Collected · pending availability',
      'Ferretería Central',
      10000,
      2,
      'collections',
    ),
    fin(
      'bill-201',
      'payable',
      'Supplier bill #201',
      'Empaques del Norte',
      38200,
      5,
      'suppliers',
    ),
    fin(
      'bill-208',
      'payable',
      'Supplier bill #208',
      'Industrial MX',
      29800,
      12,
      'suppliers',
    ),
    fin(
      'payroll-1',
      'operating',
      'September payroll',
      'Team payroll',
      52000,
      3,
      'payroll',
    ),
    fin(
      'rent-1',
      'operating',
      'Warehouse rent',
      'Monterrey warehouse',
      18000,
      18,
      'rent',
    ),
    fin(
      'loan-1',
      'financing',
      'Working capital repayment',
      'Financing lender',
      12000,
      20,
      'financing',
    ),
    ...(id !== 'csv-export-source'
      ? [
          fin(
            'inv-hist-atlas-1',
            'receivable',
            'Invoice #982',
            'Comercial Atlas',
            54000,
            -60,
            'collections',
            54000,
          ),
          fin(
            'inv-hist-atlas-2',
            'receivable',
            'Invoice #1004',
            'Comercial Atlas',
            61000,
            -30,
            'collections',
            61000,
          ),
          fin(
            'inv-hist-rivera-1',
            'receivable',
            'Invoice #990',
            'Grupo Rivera',
            38000,
            -50,
            'collections',
            38000,
          ),
          fin(
            'inv-hist-rivera-2',
            'receivable',
            'Invoice #1012',
            'Grupo Rivera',
            41000,
            -25,
            'collections',
            41000,
          ),
          fin(
            'inv-hist-central-1',
            'receivable',
            'Invoice #975',
            'Ferretería Central',
            25000,
            -80,
            'collections',
            25000,
          ),
        ]
      : []),
  ]
  const prov = w.finance.find((f) => f.id === 'provider-1')
  if (prov) prov.linkedRecordId = 'inv-1038'
  if (id !== 'history' && id !== 'csv-export-source') {
    w.financeEvents = [
      {
        id: 'fe-hist-atlas-1',
        sourceId: 'demo-v04',
        kind: 'customer_collection',
        recordId: 'inv-hist-atlas-1',
        paymentReference: 'DEP-ATLAS-982',
        date: shiftDate(DEMO_DATE, -50),
        amount: 54000,
        currency: 'MXN',
      },
      {
        id: 'fe-hist-atlas-2',
        sourceId: 'demo-v04',
        kind: 'customer_collection',
        recordId: 'inv-hist-atlas-2',
        paymentReference: 'DEP-ATLAS-1004',
        date: shiftDate(DEMO_DATE, -18),
        amount: 61000,
        currency: 'MXN',
      },
      {
        id: 'fe-hist-rivera-1',
        sourceId: 'demo-v04',
        kind: 'customer_collection',
        recordId: 'inv-hist-rivera-1',
        paymentReference: 'SPEI-RIV-990',
        date: shiftDate(DEMO_DATE, -51),
        amount: 38000,
        currency: 'MXN',
      },
      {
        id: 'fe-hist-rivera-2',
        sourceId: 'demo-v04',
        kind: 'customer_collection',
        recordId: 'inv-hist-rivera-2',
        paymentReference: 'SPEI-RIV-1012',
        date: shiftDate(DEMO_DATE, -25),
        amount: 41000,
        currency: 'MXN',
      },
      {
        id: 'fe-hist-central-1',
        sourceId: 'demo-v04',
        kind: 'customer_collection',
        recordId: 'inv-hist-central-1',
        paymentReference: 'CHQ-CENTRAL-975',
        date: shiftDate(DEMO_DATE, -52),
        amount: 25000,
        currency: 'MXN',
      },
    ]
  }
  w.cash = {
    amount: 125500,
    date: DEMO_DATE,
    phase: 'opening',
    reserve: 30000,
  }
  w.budget = {
    amount: 95000,
    startDate: DEMO_DATE,
    endDate: shiftDate(DEMO_DATE, 29),
  }
  w.coverage = Object.fromEntries(
    categories.map((c) => [
      c,
      {
        state: c === 'taxes' || c === 'other' ? 'omitted' : 'supplied',
        startDate: DEMO_DATE,
        endDate: shiftDate(DEMO_DATE, 89),
      },
    ]),
  ) as Workspace['coverage']
  w.commitments = [
    {
      id: 'com-1',
      name: 'Weekly packaging supply',
      supplierId: 'sup-1',
      amount: 38200,
      currency: 'MXN',
      cadence: 'weekly',
      nextDate: shiftDate(DEMO_DATE, 5),
      fulfillment: 'fulfilled',
      payment: 'unpaid',
      linkedPayableId: 'bill-201',
    },
  ]
  w.sources = [
    {
      id: 'demo-v04',
      name: 'SAMBY demonstration dataset',
      type: 'demo',
      importedAt: DEMO_DATE,
      rowCount: w.sales.length,
      excludedCount: 0,
    },
  ]
  w.sales = w.sales.map((sale) => ({
    ...sale,
    unitCost: w.products.find((p) => p.id === sale.productId)!.cost,
    costUnit: sale.unit,
  }))
  w.products = w.products.map((p, index) => ({
    ...p,
    brand: index < 2 ? 'Norte' : 'General',
    targetStock: 200 + index * 25,
  }))
  w.inventoryHistory = w.stock.flatMap((position) =>
    Array.from({ length: 90 }, (_, index) => ({
      id: `history-${position.id}-${index}`,
      productId: position.productId,
      locationId: position.locationId,
      asOf: shiftDate(DEMO_DATE, index - 89),
      throughDate: shiftDate(DEMO_DATE, index - 89),
      method: 'daily-observed' as const,
      quantity: position.onHand + (index < 75 ? 36 : 12),
      unit: 'pieces',
      unitCost: w.products.find((p) => p.id === position.productId)!.cost,
      currency: 'MXN',
      sourceId: 'demo-v04',
    })),
  )
  w.serviceObservations = w.sales.slice(-180).map((sale, index) => ({
    id: `service-${sale.id}`,
    productId: sale.productId!,
    locationId: sale.locationId,
    date: sale.date,
    unit: sale.unit,
    requested: sale.quantity! + (index % 17 === 0 ? 3 : 0),
    fulfilled: sale.quantity,
    availableQuantity: index % 17 === 0 ? 0 : 35,
    phase: 'closing' as const,
    deadline: 'initial-request' as const,
    inStockMinutes: null,
    observedMinutes: null,
    sourceId: 'demo-v04',
  }))
  w.inventoryLayers = w.stock.flatMap((position) =>
    [10, 100].map((age, index) => ({
      id: `layer-${position.id}-${age}`,
      productId: position.productId,
      locationId: position.locationId,
      receiptDate: shiftDate(DEMO_DATE, -age),
      asOf: DEMO_DATE,
      remainingQuantity:
        index === 0
          ? Math.floor(position.onHand * 0.75)
          : position.onHand - Math.floor(position.onHand * 0.75),
      unit: 'pieces',
      sourceId: 'demo-v04',
    })),
  )
  w.paymentTerms = [
    {
      id: 'terms-demo-supplier',
      party: 'supplier',
      supplierId: 'sup-1',
      counterparty: 'Empaques del Norte',
      days: 15,
      startEvent: 'receipt-date',
      status: 'agreed',
      reference: 'Demo supply agreement',
      sourceId: 'demo-v04',
    },
  ]
  w.onboarding = {
    step: 3,
    completed: true,
    deferred: false,
    firstAnalysisAt: DEMO_DATE,
    firstComparisonAt: null,
  }
  return w
}

export const questions: {
  key: QuestionKey
  label: string
  description: string
  horizon: number
  family: 'inventory' | 'cash'
}[] = [
  {
    key: 'Q-NEW-ORDER',
    label: 'Evaluate a new order',
    description: 'Connect an order with stock, purchasing and collections.',
    horizon: 90,
    family: 'inventory',
  },
  {
    key: 'Q-REPLENISH',
    label: 'Plan replenishment',
    description: 'Compare when to order and how much to buy.',
    horizon: 90,
    family: 'inventory',
  },
  {
    key: 'Q-CRITICAL-COLLECTION',
    label: 'Analyze a critical collection',
    description: 'See how a changed collection date affects available cash.',
    horizon: 30,
    family: 'cash',
  },
  {
    key: 'Q-CASH-SUFFICIENCY',
    label: 'Cover upcoming obligations',
    description: 'Review payroll, suppliers, rent and other recorded payments.',
    horizon: 30,
    family: 'cash',
  },
  {
    key: 'Q-DEMAND-CHANGE',
    label: 'Explore a demand change',
    description: 'Test a stated seasonal demand assumption.',
    horizon: 90,
    family: 'inventory',
  },
  {
    key: 'Q-SLOW-SUPPLIER',
    label: 'Test a supplier delay',
    description: 'Understand the effect of a later receipt.',
    horizon: 90,
    family: 'inventory',
  },
  {
    key: 'Q-CUSTOMER-DEBT',
    label: 'Explore later customer payments',
    description: 'Compare receivables and the timing of incoming cash.',
    horizon: 30,
    family: 'cash',
  },
  {
    key: 'Q-SUPPLIER-ORDER-STOCKOUT',
    label: 'Change a supplier order',
    description: 'Test receipt quantities and dates against demand.',
    horizon: 90,
    family: 'inventory',
  },
  {
    key: 'Q-EXPLORE',
    label: 'Explore outcomes',
    description: 'Build a scenario with the supported result families.',
    horizon: 90,
    family: 'inventory',
  },
  {
    key: 'Q-POISON-APPLE',
    label: 'Insolvencia por crecimiento (Poison Apple)',
    description: 'Simula un pedido gigante rentable que compromete la liquidez por anticipos y plazos Net-60.',
    horizon: 90,
    family: 'cash',
  },
  {
    key: 'Q-DEAD-STOCK',
    label: 'Asset-to-Cash Liberator (Inventario muerto)',
    description: 'Escanea SKUs con DIO > 120 días y simula liquidación táctica con descuento para liberar capital.',
    horizon: 90,
    family: 'cash',
  },
  {
    key: 'Q-TREASURY-STRESS',
    label: 'Estrés de tesorería y casos borde',
    description: 'Modela riesgos de nómina (quincena), desfases bancarios SPEI/ACH, espiral con proveedores y disputas.',
    horizon: 60,
    family: 'cash',
  },
]

export type CapabilityScope = {
  productId?: string
  locationId?: string
  startDate?: string
  endDate?: string
  sourceId?: string
}
export type Capability = {
  id: string
  name: string
  question: string
  fields: string
  owner: string
  feeds: string[]
  lifecycle: 'active' | 'deprecated' | 'retired'
  successor?: string
  sunsetDate?: string
  requires?: string[]
  displays?: string[]
  entryMethods?: string[]
  entrySection?: 'sales' | 'inventory' | 'finance' | 'suppliers'
  questionKey?: QuestionKey
  canonical?: boolean
  catalog?: boolean
  presentationGroup?: string
  support?: 'unavailable' | 'demo'
  supportReason?: string
  configuration?: string
  check: (w: Workspace, scope?: CapabilityScope) => boolean
  warning: string
}
const groupedCapability = (
  id: string,
  name: string,
  members: string[],
): Capability => ({
  id,
  name,
  question: name,
  fields: 'Usable inputs for a supported member capability.',
  owner: id === 'sales' ? 'Sales' : 'Forecast & Simulate',
  feeds: [],
  requires: members,
  lifecycle: 'active',
  catalog: false,
  warning: 'Each output retains its own data requirements.',
  check: (w) =>
    matrixCapabilities.some((c) => members.includes(c.id) && c.check(w)),
})
const registry: Capability[] = [
  ...matrixCapabilities,
  groupedCapability('sales', 'Sales overview', [
    'sales-aggregate',
    'sales-product',
    'sales-evolution',
  ]),
  groupedCapability('forecast', 'Demand forecasts', [
    'forecast-naive',
    'forecast-seasonal',
    'forecast-advanced',
  ]),
  {
    id: 'standardization',
    name: 'SKU Standardization',
    question: 'Can product references be easier to recognize?',
    fields: 'Product identity, names and original SKU references.',
    owner: 'Inventory',
    feeds: [],
    requires: [],
    lifecycle: 'active',
    entrySection: 'inventory',
    entryMethods: [
      'Review original product references from manual entry or reviewed sales CSV',
    ],
    displays: ['Inventory: optional SKU Standardization entry'],
    check: (w) =>
      w.products.some((p) => p.id && (p.sku.trim() || p.name.trim())),
    warning:
      'Suggestions require individual or group approval. Original references and product identity are retained.',
  },
]
export const capabilities: Capability[] = registry.map((c) => ({
  ...c,
  feeds: registry
    .filter((downstream) => downstream.requires?.includes(c.id))
    .map((downstream) => downstream.id),
}))
export const catalogCapabilities = capabilities.filter(
  (c) => c.catalog !== false,
)
export const presentationKey = (c: Capability) => c.presentationGroup ?? c.id
export const isCapabilityMuted = (c: Capability, w: Workspace) =>
  w.muted.includes(presentationKey(c)) ||
  w.muted.includes(c.id) ||
  (c.id.startsWith('forecast-') && w.muted.includes('forecast'))
export const canActivateCapability = (
  c: Capability,
  w: Workspace,
  scope?: CapabilityScope,
) =>
  c.lifecycle !== 'retired' &&
  c.support !== 'unavailable' &&
  Boolean(c.displays?.length) &&
  c.check(w, scope)
export function scopedCapabilityWorkspace(
  w: Workspace,
  scope: CapabilityScope,
): Workspace {
  const inDate = (date: string) =>
    Boolean(date) &&
    (!scope.startDate || date >= scope.startDate) &&
    (!scope.endDate || date <= scope.endDate)
  const attributedOnly = Boolean(scope.sourceId),
    unallocated = Boolean(scope.productId || scope.locationId)
  const sales = w.sales.filter(
    (s) =>
      (!scope.productId || s.productId === scope.productId) &&
      (!scope.locationId || s.locationId === scope.locationId) &&
      (!scope.sourceId || s.sourceId === scope.sourceId) &&
      inDate(s.date),
  )
  return {
    ...w,
    products: w.products.filter(
      (p) =>
        (!scope.productId || p.id === scope.productId) &&
        (!attributedOnly ||
          [
            ...sales,
            ...w.stock,
            ...w.purchases,
            ...(w.inventoryHistory ?? []),
            ...(w.serviceObservations ?? []),
            ...(w.inventoryLayers ?? []),
          ].some((s) => s.productId === p.id && s.sourceId === scope.sourceId)),
    ),
    stock: w.stock.filter(
      (s) =>
        (!scope.productId || s.productId === scope.productId) &&
        (!scope.locationId || s.locationId === scope.locationId) &&
        (!scope.sourceId || s.sourceId === scope.sourceId) &&
        (!scope.endDate || s.asOf <= scope.endDate),
    ),
    sales,
    purchases: w.purchases.filter(
      (p) =>
        (!scope.productId || p.productId === scope.productId) &&
        (!scope.locationId || p.locationId === scope.locationId) &&
        (!scope.sourceId || p.sourceId === scope.sourceId),
    ),
    pendingFinance:
      scope.productId || scope.locationId
        ? []
        : (w.pendingFinance ?? []).filter(
            (f) => !scope.sourceId || f.sourceId === scope.sourceId,
          ),
    finance: unallocated
      ? []
      : w.finance.filter(
          (f) => !scope.sourceId || f.sourceId === scope.sourceId,
        ),
    commitments: unallocated
      ? []
      : w.commitments.filter(
          (c) => !scope.sourceId || c.sourceId === scope.sourceId,
        ),
    movements: w.movements.filter(
      (m) =>
        (!scope.productId || m.productId === scope.productId) &&
        (!scope.locationId ||
          m.fromLocationId === scope.locationId ||
          m.toLocationId === scope.locationId) &&
        (!scope.sourceId || m.sourceId === scope.sourceId) &&
        inDate(m.date),
    ),
    paymentTerms: unallocated
      ? []
      : w.paymentTerms?.filter(
          (term) => !scope.sourceId || term.sourceId === scope.sourceId,
        ),
    cash: unallocated || attributedOnly ? null : w.cash,
    budget: unallocated || attributedOnly ? null : w.budget,
    sources: w.sources.filter(
      (s) => !scope.sourceId || s.id === scope.sourceId,
    ),
  }
}
export function capabilityWarnings(
  c: Capability,
  w: Workspace,
  scope?: CapabilityScope,
): string[] {
  const warnings: string[] = []
  if (c.supportReason) warnings.push(c.supportReason)
  if (!c.check(w, scope))
    return [
      ...warnings,
      `Supply ${c.fields} Only the supported source scope becomes eligible.`,
    ]
  if (c.owner === 'Sales' || c.id.startsWith('forecast')) {
    const dates = new Set(w.sales.map((s) => s.date))
    if (dates.size < 28)
      warnings.push(
        `${dates.size} observed dates in this scope. More comparable history improves interpretation. Missing dates are not zero demand.`,
      )
    if (w.sales.some((s) => s.quantity === null))
      warnings.push(
        'Some rows have no quantity. Only the subset with comparable units supports unit-demand outputs.',
      )
    if (
      w.sales.some(
        (s) =>
          s.amount === null ||
          s.currency !== w.profile.currency ||
          !s.amountBasis.trim(),
      )
    )
      warnings.push(
        'Monetary results exclude rows with unknown amount, incompatible currency or unconfirmed amount meaning.',
      )
  }
  if (
    c.id === 'stock' &&
    w.stock.some((s) => s.quantityBasis !== 'available' && s.reserved === null)
  )
    warnings.push(
      'Physical stock is visible, but unknown reservations prevent an available-quantity calculation for those positions.',
    )
  if (
    c.id === 'inventory-value' &&
    w.stock.some(
      (s) =>
        s.quantityBasis === 'available' ||
        w.products.find((p) => p.id === s.productId)?.cost == null,
    )
  )
    warnings.push(
      'Partial valuation: available-only positions and unknown unit costs cannot establish total physical inventory at cost.',
    )
  if (
    [
      'liquidity',
      'cash-gap',
      'reserve',
      'cash-sufficiency',
      'critical-collection',
    ].includes(c.id)
  ) {
    const omitted = Object.entries(w.coverage)
      .filter(([, value]) => value.state === 'omitted')
      .map(([key]) => key)
    if (omitted.length)
      warnings.push(
        `Partial projection: ${omitted.join(', ')} explicitly omitted. This does not establish business-wide sufficiency.`,
      )
  }
  if (['internal-debt', 'external-debt', 'commitments'].includes(c.id))
    warnings.push(
      'Record visibility does not establish every subtotal or timeline. Only compatible amounts and known dates contribute; missing counterparties and dates remain visible.',
    )
  if (c.configuration) warnings.push(c.configuration)
  if (
    c.id === 'stock' &&
    w.stock.some(
      (s) =>
        s.asOf < shiftDate(cutoff(w), -(w.notifications.cadenceDays ?? 30)),
    )
  )
    warnings.push(
      'Some stock snapshots exceed your planning cadence. Their dated values remain visible; confirm current quantities before planning.',
    )
  return warnings
}
export function readiness(
  c: Capability,
  w: Workspace,
  scope?: CapabilityScope,
):
  | 'Not provided'
  | 'Available with warning'
  | 'Available'
  | 'Unavailable in prototype'
  | 'Demo only'
  | 'Retired' {
  if (c.lifecycle === 'retired') return 'Retired'
  if (c.support === 'unavailable') return 'Unavailable in prototype'
  if (c.support === 'demo') return 'Demo only'
  if (!c.check(w, scope)) return 'Not provided'
  return capabilityWarnings(c, w, scope).length
    ? 'Available with warning'
    : 'Available'
}
export const visibleCapability = (w: Workspace, id: string) =>
  capabilities.some(
    (c) =>
      c.id === id &&
      c.lifecycle !== 'retired' &&
      !isCapabilityMuted(c, w) &&
      c.check(w),
  )
