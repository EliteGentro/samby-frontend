import {
  shiftDate,
  outstanding,
  cutoff,
  type Workspace,
  type Sale,
} from './workspace'

export const periods = [
  'Last 7 days',
  'Last 30 days',
  'Last 12 months',
  'Current quarter',
  'Previous quarter',
  'Last 4 quarters',
  'Selected quarter',
]
export function periodWindow(
  period: string,
  date: string,
  year = Number(date.slice(0, 4)),
  quarter = Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1,
) {
  const current = new Date(`${date}T12:00:00Z`)
  let start = shiftDate(date, -29),
    end = date
  if (period === 'Last 7 days') start = shiftDate(date, -6)
  if (period === 'Last 12 months') {
    const originalDay = current.getUTCDate()
    current.setUTCDate(1)
    current.setUTCMonth(current.getUTCMonth() - 12)
    current.setUTCDate(
      Math.min(
        originalDay,
        new Date(
          Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0),
        ).getUTCDate(),
      ),
    )
    start = shiftDate(current.toISOString().slice(0, 10), 1)
  }
  if (period.includes('quarter')) {
    const y = Number(date.slice(0, 4)),
      q = Math.floor((Number(date.slice(5, 7)) - 1) / 3)
    const first = new Date(
      Date.UTC(
        period === 'Selected quarter' ? year : y,
        period === 'Selected quarter'
          ? (quarter - 1) * 3
          : q * 3 -
              (period === 'Previous quarter'
                ? 3
                : period === 'Last 4 quarters'
                  ? 9
                  : 0),
        1,
        12,
      ),
    )
    start = first.toISOString().slice(0, 10)
    if (period === 'Previous quarter' || period === 'Selected quarter')
      end = new Date(
        Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 3, 0, 12),
      )
        .toISOString()
        .slice(0, 10)
  }
  return { start, end: end > date ? date : end }
}
export const scopedSales = (
  w: Workspace,
  start: string,
  end: string,
  locationId = '',
) =>
  w.sales.filter(
    (s) =>
      s.date >= start &&
      s.date <= end &&
      (!locationId || s.locationId === locationId),
  )
export function comparisonWindow(
  period: string,
  window: { start: string; end: string },
) {
  const end = shiftDate(window.start, -1)
  if (period.includes('quarter')) {
    const start = new Date(`${window.start}T12:00:00Z`)
    start.setUTCMonth(
      start.getUTCMonth() - (period === 'Last 4 quarters' ? 12 : 3),
    )
    return {
      start: start.toISOString().slice(0, 10),
      end,
      label:
        period === 'Last 4 quarters'
          ? 'Previous four quarters'
          : 'Previous quarter',
    }
  }
  const days =
    Math.round(
      (Date.parse(window.end) - Date.parse(window.start)) / 86_400_000,
    ) + 1
  return {
    start: shiftDate(end, 1 - days),
    end,
    label: `Previous ${days} days`,
  }
}

function saleCost(w: Workspace, sale: Sale): number | null {
  const product = w.products.find((p) => p.id === sale.productId)
  if (!product || sale.unit !== product.unit) return null
  if (sale.unitCost !== undefined)
    return sale.unitCost !== null &&
      Number.isFinite(sale.unitCost) &&
      sale.unitCost >= 0 &&
      (sale.costUnit || sale.unit) === sale.unit
      ? sale.unitCost
      : null
  return product.cost !== null &&
    Number.isFinite(product.cost) &&
    product.cost >= 0
    ? product.cost
    : null
}

export function salesSummary(w: Workspace, sales: Sale[]) {
  const candidates = sales.filter(
    (s) =>
      s.amount !== null &&
      s.currency === w.profile.currency &&
      s.amountBasis.trim() !== '',
  )
  const bases = [
    ...new Set(candidates.map((s) => s.amountBasis.trim().toLowerCase())),
  ]
  const amounts = bases.length === 1 ? candidates : []
  const revenue = amounts.length
    ? amounts.reduce(
        (sum, s) => sum + (s.amount ?? 0) * (s.kind === 'return' ? -1 : 1),
        0,
      )
    : null
  const marginSales = amounts.filter(
    (s) =>
      s.quantity !== null &&
      s.unit === w.products.find((p) => p.id === s.productId)?.unit &&
      /net|excluding|before tax|sin impuesto/i.test(s.amountBasis) &&
      !/including tax|with tax/i.test(s.amountBasis) &&
      saleCost(w, s) !== null,
  )
  const grossProfit = marginSales.length
    ? marginSales.reduce(
        (sum, s) =>
          sum +
          ((s.amount ?? 0) - (s.quantity ?? 0) * (saleCost(w, s) ?? 0)) *
            (s.kind === 'return' ? -1 : 1),
        0,
      )
    : null
  const marginRevenue = marginSales.reduce(
    (sum, s) => sum + (s.amount ?? 0) * (s.kind === 'return' ? -1 : 1),
    0,
  )
  return {
    bases,
    basisConflict: bases.length > 1,
    excludedAmounts:
      sales.filter((s) => s.amount !== null).length - amounts.length,
    revenue,
    grossProfit,
    margin:
      grossProfit !== null && marginRevenue > 0
        ? (grossProfit / marginRevenue) * 100
        : null,
    revenueRows: amounts.length,
    marginRows: marginSales.length,
    currentCostRows: marginSales.filter((s) => s.unitCost === undefined).length,
    productCount: new Set(sales.map((s) => s.productId).filter(Boolean)).size,
  }
}
export function salesComparison(
  current: ReturnType<typeof salesSummary>,
  previous: ReturnType<typeof salesSummary>,
) {
  if (current.revenue === null || previous.revenue === null)
    return {
      absolute: null,
      percentage: null,
      reason: 'A comparison needs usable observations in both periods.',
    }
  if (
    current.bases.length !== 1 ||
    previous.bases.length !== 1 ||
    current.bases[0] !== previous.bases[0]
  )
    return {
      absolute: null,
      percentage: null,
      reason:
        'The periods use different sales amount definitions. Reconcile their basis before comparing.',
    }
  const absolute = current.revenue - previous.revenue
  return {
    absolute,
    percentage:
      previous.revenue > 0 ? (absolute / previous.revenue) * 100 : null,
    reason:
      previous.revenue > 0
        ? null
        : 'Percentage change is unavailable because the baseline is not positive.',
  }
}
export function salesSeries(w: Workspace, sales: Sale[]) {
  const bases = new Set(
    sales
      .filter(
        (s) =>
          s.amount !== null &&
          s.currency === w.profile.currency &&
          s.amountBasis.trim(),
      )
      .map((s) => s.amountBasis.trim().toLowerCase()),
  )
  if (bases.size !== 1) return []
  const groups = new Map<string, number>()
  for (const sale of sales)
    if (
      sale.amount !== null &&
      sale.currency === w.profile.currency &&
      sale.amountBasis.trim()
    )
      groups.set(
        sale.date,
        (groups.get(sale.date) ?? 0) +
          sale.amount * (sale.kind === 'return' ? -1 : 1),
      )
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }))
}
export function financeTotals(w: Workspace) {
  const issues: string[] = []
  const counts = new Map<string, number>()
  w.finance.forEach((f) => counts.set(f.id, (counts.get(f.id) ?? 0) + 1))
  const valid = (f: Workspace['finance'][number]) =>
    Number.isFinite(f.amount) &&
    Number.isFinite(f.paidAmount) &&
    f.amount >= 0 &&
    f.paidAmount >= 0 &&
    f.paidAmount <= f.amount &&
    counts.get(f.id) === 1
  const records = w.finance
    .filter((f) => f.currency === w.profile.currency)
    .filter((f) => {
      if (!valid(f)) {
        issues.push(
          `${f.name}: duplicate identity or inconsistent amounts. Excluded from monetary totals until reconciled.`,
        )
        return false
      }
      if (
        (f.kind === 'receivable' || f.kind === 'provider_pending') &&
        f.cashIncluded
      )
        return false
      if (f.kind !== 'provider_pending') return true
      const linked = w.finance.find(
        (r) => r.id === f.linkedRecordId && r.kind === 'receivable',
      )
      const pendingRecords = w.finance.filter(
        (r) =>
          r.kind === 'provider_pending' &&
          r.linkedRecordId === f.linkedRecordId,
      )
      const pending = pendingRecords.reduce((sum, r) => sum + r.amount, 0)
      if (
        !linked ||
        !valid(linked) ||
        linked.cashIncluded ||
        pendingRecords.some((r) => !valid(r) || r.currency !== f.currency) ||
        linked.currency !== f.currency ||
        pending > linked.paidAmount
      ) {
        issues.push(
          `${f.name}: the provider collection needs a reconciled invoice link and paid amount. It is excluded from combined totals until reconciled.`,
        )
        return false
      }
      return true
    })
  return {
    issues,
    included: records.length,
    internal: !records.some(
      (f) => f.kind === 'receivable' || f.kind === 'provider_pending',
    )
      ? null
      : records
          .filter(
            (f) => f.kind === 'receivable' || f.kind === 'provider_pending',
          )
          .reduce((s, f) => s + outstanding(f), 0),
    external: !records.some((f) => f.kind === 'payable')
      ? null
      : records
          .filter((f) => f.kind === 'payable')
          .reduce((s, f) => s + outstanding(f), 0),
    financing: !records.some((f) => f.kind === 'financing')
      ? null
      : records
          .filter((f) => f.kind === 'financing')
          .reduce((s, f) => s + outstanding(f), 0),
    pending: !records.some((f) => f.kind === 'provider_pending')
      ? null
      : records
          .filter((f) => f.kind === 'provider_pending')
          .reduce((s, f) => s + outstanding(f), 0),
  }
}
export function stockValue(w: Workspace, locationId = '') {
  const overlaps = new Set(
    w.products
      .filter(
        (p) =>
          w.stock.some((s) => s.productId === p.id && s.locationId === null) &&
          w.stock.some((s) => s.productId === p.id && s.locationId !== null),
      )
      .map((p) => p.id),
  )
  const positions = w.stock.filter(
    (s) => !locationId || s.locationId === locationId,
  )
  const dates = [...new Set(positions.map((s) => s.asOf))].sort()
  const eligible = w.stock.filter(
    (s) =>
      (locationId || !overlaps.has(s.productId)) &&
      (!locationId || s.locationId === locationId) &&
      s.quantityBasis !== 'available' &&
      w.products.find((p) => p.id === s.productId)?.cost != null,
  )
  return {
    dates,
    dateLabel:
      dates.length === 1
        ? dates[0]
        : dates.length
          ? `${dates[0]} to ${dates[dates.length - 1]}`
          : 'No stock date',
    stale: positions.filter(
      (s) =>
        s.asOf < shiftDate(cutoff(w), -(w.notifications.cadenceDays ?? 30)),
    ).length,
    overlaps: overlaps.size,
    value: eligible.length
      ? eligible.reduce(
          (sum, s) =>
            sum +
            s.onHand *
              (w.products.find((p) => p.id === s.productId)?.cost ?? 0),
          0,
        )
      : null,
    count: eligible.length,
    total: w.stock.filter((s) => !locationId || s.locationId === locationId)
      .length,
  }
}
export function supplierPerformance(w: Workspace, start: string, end: string) {
  const observedThrough = end < cutoff(w) ? end : cutoff(w)
  const due = w.purchases.filter(
    (p) =>
      p.promisedDate &&
      p.promisedDate >= start &&
      p.promisedDate <= observedThrough,
  )
  const onTime = due.filter(
    (p) =>
      p.receivedDate &&
      p.promisedDate &&
      p.receivedDate <= p.promisedDate &&
      p.receivedDate <= observedThrough,
  )
  const inFull = due.filter(
    (p) =>
      p.receivedDate &&
      p.receivedDate <= observedThrough &&
      p.receivedQuantity >= p.quantity,
  )
  const both = onTime.filter((p) => p.receivedQuantity >= p.quantity)
  return {
    due,
    onTime,
    inFull,
    both,
    rate: due.length ? (both.length / due.length) * 100 : null,
  }
}

export {
  capitalMetrics,
  serviceMetrics,
  agingMetrics,
  metricVersion,
} from './historical-metrics'
