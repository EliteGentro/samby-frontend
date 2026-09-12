import { cutoff, type Workspace } from '../../domain/workspace'
import {
  financeTotals,
  salesSummary,
  scopedSales,
  stockValue,
} from '../../domain/selectors'

export function DataQuality({
  workspace: w,
  start,
  end,
  location = '',
}: {
  workspace: Workspace
  start: string
  end: string
  location?: string
}) {
  const rows = scopedSales(w, start, end, location),
    sales = salesSummary(w, rows),
    stock = stockValue(w, location),
    finance = financeTotals(w)
  const warnings = [
    ...(sales.basisConflict
      ? [
          `Monetary totals are unavailable: ${sales.bases.length} different amount meanings occur in this scope. Review sources or select a compatible subset before combining amounts. Individual records remain available.`,
        ]
      : []),
    ...(sales.excludedAmounts
      ? [
          `${sales.excludedAmounts} monetary rows cannot enter this scope's total because currency or amount meanings are incompatible or missing. Correct the source interpretation; compatible records can continue.`,
        ]
      : []),
    ...(stock.stale
      ? [
          `${stock.stale} stock snapshots exceed the ${w.notifications.cadenceDays ?? 30}-day planning cadence. Values retain their source dates (${stock.dateLabel}). Confirm updated quantities before using them as current opening stock.`,
        ]
      : []),
    ...(stock.count < stock.total
      ? [
          `Inventory valuation covers ${stock.count} of ${stock.total} positions. Unknown cost, available-only quantities or overlapping scopes are excluded; complete the missing cost/on-hand basis to expand coverage.`,
        ]
      : []),
    ...finance.issues,
  ]
  return (
    <div className="data-quality">
      <p className="small muted">
        {w.mode === 'demo' ? 'Demo sources' : 'Confirmed sources'} ·{' '}
        {new Set(rows.map((s) => s.sourceId)).size} sales sources ·{' '}
        {rows.length} records ·{' '}
        {location
          ? w.locations.find((l) => l.id === location)?.name
          : 'All supplied scope'}{' '}
        · {start} to {end} · {w.profile.timezone}
        {stock.dates.length ? ` · Stock as of ${stock.dateLabel}` : ''}
      </p>
      <details className="small muted">
        <summary>Source and calculation details</summary>
        <p>
          Confirmed source revisions · workspace revision {w.revision} ·
          calculation version 0.4.1. Amounts use the confirmed currency and
          interpretation. Values cover only the stated population.
        </p>
      </details>
      {warnings.map((warning) => (
        <p className="notice small" key={warning}>
          {warning}
        </p>
      ))}
      {end < cutoff(w) && (
        <p className="small muted">
          Current financial records remain distinct from the selected historical
          period. Past balances need historical snapshots or a complete event
          ledger.
        </p>
      )}
    </div>
  )
}
