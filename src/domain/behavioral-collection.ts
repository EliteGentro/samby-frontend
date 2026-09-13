import {
  cutoff,
  outstanding,
  shiftDate,
  type FinancialRecord,
  type Workspace,
} from './workspace'

export const ASEM_STRESS_DAYS = 76
export const TIME_BUCKETS = [
  '0-30',
  '31-60',
  '61-90',
  '91-120',
  '120+',
] as const
export type TimeBucket = (typeof TIME_BUCKETS)[number]
export type Perspective = 'naive' | 'p50' | 'p80'
export type ConfidenceLevel = 'high' | 'medium' | 'portfolio-benchmark'

export type CustomerBehavioralProfile = {
  customer: string
  sampleCount: number
  totalPaidAmount: number
  onTimeRate: number | null
  p50DelayDays: number
  p80DelayDays: number
  p50DaysToPay: number
  p80DaysToPay: number
  confidence: ConfidenceLevel
  isBenchmark: boolean
}

export type InvoicePrediction = {
  record: FinancialRecord
  customer: string
  amount: number
  outstanding: number
  dueDate: string | null
  naiveExpectedDate: string
  p50ExpectedDate: string
  p80ExpectedDate: string
  asemExpectedDate: string
  p50DelayDays: number
  p80DelayDays: number
  asemDelayDays: number
  activeExpectedDate: string
  confidence: ConfidenceLevel
  isBenchmark: boolean
}

export type MatrixRow = {
  customer: string
  totalOutstanding: number
  openInvoiceCount: number
  profile: CustomerBehavioralProfile
  buckets: Record<TimeBucket, number>
  invoices: InvoicePrediction[]
}

export type BehavioralMatrixOptions = {
  asOf?: string
  perspective?: Perspective
  asemStress?: boolean
}

export type BehavioralMatrixResult = {
  asOf: string
  activePerspective: Perspective
  asemStressEnabled: boolean
  totalOutstanding: number
  openInvoiceCount: number
  customerCount: number
  portfolioProfile: CustomerBehavioralProfile
  customerProfiles: CustomerBehavioralProfile[]
  predictions: InvoicePrediction[]
  matrixRows: MatrixRow[]
  matrixTotals: Record<TimeBucket, number>
  naiveTotals: Record<TimeBucket, number>
  cashLagAmount: number
  cashLag90Amount: number
  weightedP50Days: number
  weightedAsemDays: number
  warnings: string[]
}

function parseDays(dateStr: string): number {
  return Date.parse(`${dateStr}T12:00:00Z`) / 86_400_000
}

export function diffInDays(dateA: string, dateB: string): number {
  return Math.round(parseDays(dateA) - parseDays(dateB))
}

export function calculatePercentile(values: number[], p: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  const index = (sorted.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower
  return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight)
}

function getBucket(daysFromAsOf: number): TimeBucket {
  if (daysFromAsOf <= 30) return '0-30'
  if (daysFromAsOf <= 60) return '31-60'
  if (daysFromAsOf <= 90) return '61-90'
  if (daysFromAsOf <= 120) return '91-120'
  return '120+'
}

type PaymentObservation = {
  customer: string
  recordId: string
  amount: number
  delayDays: number
  paidDate: string
  dueDate: string | null
}

export function extractPaymentObservations(
  workspace: Workspace,
): PaymentObservation[] {
  const observations: PaymentObservation[] = []
  const recordsMap = new Map<string, FinancialRecord>()
  workspace.finance.forEach((r) => recordsMap.set(r.id, r))

  const processedEventRecordIds = new Set<string>()

  if (workspace.financeEvents?.length) {
    for (const event of workspace.financeEvents) {
      if (event.kind !== 'customer_collection') continue
      const record = recordsMap.get(event.recordId)
      if (!record || record.kind !== 'receivable') continue
      if (!Number.isFinite(event.amount) || event.amount <= 0) continue

      const customer = record.counterparty.trim() || 'Unassigned counterparty'
      const baseDueDate = record.dueDate || event.date
      const delayDays = diffInDays(event.date, baseDueDate)

      observations.push({
        customer,
        recordId: record.id,
        amount: event.amount,
        delayDays,
        paidDate: event.date,
        dueDate: record.dueDate,
      })
      processedEventRecordIds.add(record.id)
    }
  }

  // Also include settled receivable records with paidAmount > 0 that did not have a financeEvent
  for (const record of workspace.finance) {
    if (record.kind !== 'receivable') continue
    if (processedEventRecordIds.has(record.id)) continue
    if (
      record.paidAmount > 0 &&
      record.amount > 0 &&
      record.paidAmount >= record.amount &&
      record.expectedDate &&
      record.dueDate
    ) {
      const customer = record.counterparty.trim() || 'Unassigned counterparty'
      const delayDays = diffInDays(record.expectedDate, record.dueDate)
      observations.push({
        customer,
        recordId: record.id,
        amount: record.paidAmount,
        delayDays,
        paidDate: record.expectedDate,
        dueDate: record.dueDate,
      })
    }
  }

  return observations
}

function buildProfile(
  customer: string,
  observations: PaymentObservation[],
  isBenchmark = false,
): CustomerBehavioralProfile {
  const count = observations.length
  const totalAmount = observations.reduce((sum, o) => sum + o.amount, 0)
  const delays = observations.map((o) => o.delayDays)

  const onTimeAmount = observations
    .filter((o) => o.delayDays <= 0)
    .reduce((sum, o) => sum + o.amount, 0)
  const onTimeRate =
    totalAmount > 0 ? Math.round((onTimeAmount / totalAmount) * 100) : null

  const p50DelayDays = calculatePercentile(delays, 0.5)
  const p80DelayDays = calculatePercentile(delays, 0.8)

  const defaultTermsDays = 30
  const p50DaysToPay = Math.max(0, defaultTermsDays + p50DelayDays)
  const p80DaysToPay = Math.max(0, defaultTermsDays + p80DelayDays)

  const confidence: ConfidenceLevel = isBenchmark
    ? 'portfolio-benchmark'
    : count >= 5
      ? 'high'
      : count >= 2
        ? 'medium'
        : 'portfolio-benchmark'

  return {
    customer,
    sampleCount: count,
    totalPaidAmount: totalAmount,
    onTimeRate,
    p50DelayDays,
    p80DelayDays,
    p50DaysToPay,
    p80DaysToPay,
    confidence,
    isBenchmark,
  }
}

export function behavioralCollectionMatrix(
  workspace: Workspace,
  options: BehavioralMatrixOptions = {},
): BehavioralMatrixResult {
  const asOf = options.asOf ?? cutoff(workspace)
  const perspective = options.perspective ?? 'p50'
  const asemStress = Boolean(options.asemStress)
  const warnings: string[] = []

  const observations = extractPaymentObservations(workspace)

  // Global portfolio profile
  const portfolioProfile = buildProfile(
    'Portfolio benchmark',
    observations,
    true,
  )

  // Profiles by customer
  const obsByCustomer = new Map<string, PaymentObservation[]>()
  for (const obs of observations) {
    const list = obsByCustomer.get(obs.customer) ?? []
    list.push(obs)
    obsByCustomer.set(obs.customer, list)
  }

  const customerProfiles = new Map<string, CustomerBehavioralProfile>()
  for (const [cust, obsList] of obsByCustomer.entries()) {
    customerProfiles.set(cust, buildProfile(cust, obsList, false))
  }

  // Active / open receivables
  const openReceivables = workspace.finance.filter(
    (record) =>
      record.kind === 'receivable' &&
      outstanding(record) > 0 &&
      record.currency === workspace.profile.currency,
  )

  const predictions: InvoicePrediction[] = []
  const customerRowsMap = new Map<string, InvoicePrediction[]>()

  for (const record of openReceivables) {
    const cust = record.counterparty.trim() || 'Unassigned counterparty'
    const openAmount = outstanding(record)

    let profile = customerProfiles.get(cust)
    let isBenchmark = false
    if (!profile || profile.sampleCount < 2) {
      profile = {
        ...portfolioProfile,
        customer: cust,
        isBenchmark: true,
      }
      isBenchmark = true
    }

    // Baseline due date (Naive Net 30 assumption)
    const baseDueDate = record.dueDate ?? shiftDate(asOf, 30)

    // Empirical predicted dates
    const p50DelayDays = profile.p50DelayDays
    const p80DelayDays = profile.p80DelayDays
    const asemDelayDays = p50DelayDays + ASEM_STRESS_DAYS

    const p50ExpectedDate = shiftDate(baseDueDate, p50DelayDays)
    const p80ExpectedDate = shiftDate(baseDueDate, p80DelayDays)
    const asemExpectedDate = shiftDate(baseDueDate, asemDelayDays)

    let activeExpectedDate: string
    if (asemStress) {
      activeExpectedDate = asemExpectedDate
    } else if (perspective === 'naive') {
      activeExpectedDate = baseDueDate
    } else if (perspective === 'p80') {
      activeExpectedDate = p80ExpectedDate
    } else {
      activeExpectedDate = p50ExpectedDate
    }

    const pred: InvoicePrediction = {
      record,
      customer: cust,
      amount: record.amount,
      outstanding: openAmount,
      dueDate: record.dueDate,
      naiveExpectedDate: baseDueDate,
      p50ExpectedDate,
      p80ExpectedDate,
      asemExpectedDate,
      p50DelayDays,
      p80DelayDays,
      asemDelayDays,
      activeExpectedDate,
      confidence: profile.confidence,
      isBenchmark,
    }

    predictions.push(pred)

    const list = customerRowsMap.get(cust) ?? []
    list.push(pred)
    customerRowsMap.set(cust, list)
  }

  // Build matrix rows
  const emptyBuckets = (): Record<TimeBucket, number> => ({
    '0-30': 0,
    '31-60': 0,
    '61-90': 0,
    '91-120': 0,
    '120+': 0,
  })

  const matrixTotals = emptyBuckets()
  const naiveTotals = emptyBuckets()

  const matrixRows: MatrixRow[] = []

  for (const [cust, invoices] of customerRowsMap.entries()) {
    const buckets = emptyBuckets()
    const totalCustOutstanding = invoices.reduce(
      (sum, i) => sum + i.outstanding,
      0,
    )
    const profile =
      customerProfiles.get(cust) ??
      buildProfile(cust, obsByCustomer.get(cust) ?? [], true)

    for (const inv of invoices) {
      // Active perspective bucket
      const daysFromAsOf = diffInDays(inv.activeExpectedDate, asOf)
      const bucket = getBucket(daysFromAsOf)
      buckets[bucket] += inv.outstanding
      matrixTotals[bucket] += inv.outstanding

      // Naive Net 30 bucket
      const naiveDays = diffInDays(inv.naiveExpectedDate, asOf)
      const naiveBucket = getBucket(naiveDays)
      naiveTotals[naiveBucket] += inv.outstanding
    }

    matrixRows.push({
      customer: cust,
      totalOutstanding: totalCustOutstanding,
      openInvoiceCount: invoices.length,
      profile,
      buckets,
      invoices,
    })
  }

  // Sort rows by outstanding descending
  matrixRows.sort((a, b) => b.totalOutstanding - a.totalOutstanding)

  const totalOutstanding = openReceivables.reduce(
    (sum, r) => sum + outstanding(r),
    0,
  )

  // Cash lag: cash expected after 30 days under the active model minus naive model
  const activeDelayed = totalOutstanding - matrixTotals['0-30']
  const naiveDelayed = totalOutstanding - naiveTotals['0-30']
  const cashLagAmount = Math.max(0, activeDelayed - naiveDelayed)

  // Critical cash delayed beyond 90 days (severe PyME distress)
  const cashLag90Amount = matrixTotals['91-120'] + matrixTotals['120+']

  // Weighted average days to pay
  let weightedP50Days = 30
  let weightedAsemDays = 30 + ASEM_STRESS_DAYS
  if (totalOutstanding > 0) {
    const sumP50Days = predictions.reduce((sum, inv) => {
      const days = Math.max(0, diffInDays(inv.p50ExpectedDate, asOf))
      return sum + days * inv.outstanding
    }, 0)
    weightedP50Days = Math.round(sumP50Days / totalOutstanding)
    weightedAsemDays = weightedP50Days + (asemStress ? ASEM_STRESS_DAYS : 0)
  }

  if (observations.length === 0) {
    warnings.push(
      'No historical customer payments recorded. Predictions use contractual terms as a baseline reference.',
    )
  } else if (observations.length < 5) {
    warnings.push(
      `Limited history (${observations.length} observed past payment${observations.length === 1 ? '' : 's'}). Accuracy will improve as more collections are recorded in Finance History.`,
    )
  }

  if (asemStress) {
    warnings.push(
      'ASEM stress active (+76 days): Simulates the official average delay documented by ASEM for Mexican SMEs dealing with large clients, shifting collections to late liquidity buckets.',
    )
  }

  return {
    asOf,
    activePerspective: perspective,
    asemStressEnabled: asemStress,
    totalOutstanding,
    openInvoiceCount: openReceivables.length,
    customerCount: matrixRows.length,
    portfolioProfile,
    customerProfiles: [...customerProfiles.values()],
    predictions,
    matrixRows,
    matrixTotals,
    naiveTotals,
    cashLagAmount,
    cashLag90Amount,
    weightedP50Days,
    weightedAsemDays,
    warnings,
  }
}
