import { Calculator, Database } from 'lucide-react'
import { DisclosureCard } from '../../components/ui/disclosure-card'
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
  const sourceCount = new Set(rows.map((sale) => sale.sourceId)).size
  const scopeLabel = location
    ? w.locations.find((item) => item.id === location)?.name
    : 'All supplied scope'

  return (
    <div className="data-quality">
      <DisclosureCard
        title="Source and calculation details"
        description={`${w.mode === 'demo' ? 'Demo sources' : 'Confirmed sources'} · ${sourceCount} sales sources · ${rows.length} records · ${scopeLabel} · ${start} to ${end}`}
        icon={<Database className="size-4" />}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
              <Database className="size-3.5 text-secondary" />
              Source scope
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Workspace revision {w.revision} · {w.profile.timezone}
              {stock.dates.length ? ` · Stock as of ${stock.dateLabel}` : ''}.
              Values stay linked to the confirmed source revisions in this
              scope.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
              <Calculator className="size-3.5 text-secondary" />
              Calculation basis
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Calculation version 0.4.1. Amounts use the confirmed currency and
              interpretation, and values cover only the stated population.
            </p>
          </div>
        </div>
      </DisclosureCard>
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
