import { useMemo, useState } from 'react'
import { BarChart2, Clock, Layers, PieChart } from 'lucide-react'
import {
  availability,
  money,
  number,
  type Workspace,
} from '../../domain/workspace'
import { useTheme } from '../../lib/theme'

export function InventoryGraphsPanel({
  workspace: w,
  location,
  onSelectLocation,
}: {
  workspace: Workspace
  location: string
  onSelectLocation: (locId: string) => void
}) {
  const { resolvedTheme } = useTheme()

  const locationColors = useMemo(
    () =>
      resolvedTheme === 'dark'
        ? ['#60a5fa', '#2dd4bf', '#fbbf24', '#c084fc']
        : ['#2563eb', '#0d9488', '#d97706', '#7c3aed'],
    [resolvedTheme],
  )
  const locationStats = useMemo(() => {
    const locs = w.locations.map((l) => {
      let locUnits = 0
      let locValue = 0
      for (const p of w.products) {
        const a = availability(w, p.id, l.id) ?? 0
        locUnits += a
        locValue += a * (p.cost ?? 0)
      }
      return { id: l.id, name: l.name, units: locUnits, value: locValue }
    })
    const totalLocUnits = locs.reduce((s, l) => s + l.units, 0)
    return locs.map((l) => ({
      ...l,
      pct: totalLocUnits > 0 ? Math.round((l.units / totalLocUnits) * 100) : 0,
    }))
  }, [w])

  const healthStats = useMemo(() => {
    let below = 0
    let healthy = 0
    let unconfigured = 0
    for (const p of w.products) {
      const a = availability(w, p.id, location)
      if (p.reorderPoint === null || a === null) {
        unconfigured++
      } else if (a < p.reorderPoint) {
        below++
      } else {
        healthy++
      }
    }
    const total = w.products.length
    return { below, healthy, unconfigured, total }
  }, [w, location])

  const pipelineStats = useMemo(() => {
    const onHand = w.products.reduce(
      (sum, p) => sum + (availability(w, p.id, location) ?? 0),
      0,
    )
    const onOrder = w.purchases
      .filter((p) => !location || p.locationId === location)
      .reduce(
        (sum, p) =>
          sum +
          (p.receivedDate === null
            ? Math.max(0, p.quantity - (p.receivedQuantity ?? 0))
            : 0),
        0,
      )
    return { onHand, onOrder }
  }, [w, location])

  return (
    <div className="space-y-6 pt-4">
      <div className="grid gap-4 md:grid-cols-2">
        <CategoryDistribution workspace={w} location={location} />

        <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs transition-colors">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Clock size={18} className="text-amber-500 dark:text-amber-400" />
                <span>Stock Health & Reorder Thresholds</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Products relative to configured reorder points
              </p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                style={{
                  width: `${(healthStats.healthy / (healthStats.total || 1)) * 100}%`,
                }}
                className="bg-emerald-500 transition-[width] dark:bg-emerald-400"
                title={`Healthy: ${healthStats.healthy} products`}
              />
              <div
                style={{
                  width: `${(healthStats.below / (healthStats.total || 1)) * 100}%`,
                }}
                className="bg-rose-500 transition-[width] dark:bg-rose-400"
                title={`Below reorder point: ${healthStats.below} products`}
              />
              <div
                style={{
                  width: `${(healthStats.unconfigured / (healthStats.total || 1)) * 100}%`,
                }}
                className="bg-muted-foreground/30 transition-[width] dark:bg-muted-foreground/40"
                title={`No threshold: ${healthStats.unconfigured} products`}
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300">
                <p className="font-mono text-lg font-bold">{healthStats.healthy}</p>
                <p className="text-[11px] opacity-85">Above threshold</p>
              </div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300">
                <p className="font-mono text-lg font-bold">{healthStats.below}</p>
                <p className="text-[11px] opacity-85">Below reorder point</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/60 p-2.5 text-muted-foreground">
                <p className="font-mono text-lg font-bold text-foreground">{healthStats.unconfigured}</p>
                <p className="text-[11px] opacity-85">Unconfigured</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs transition-colors">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-foreground">
                <PieChart size={18} className="text-teal-600 dark:text-teal-400" />
                <span>Multi-Location Allocation</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Distribution across storage locations
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {location ? 'Filtered' : 'All locations'}
            </span>
          </div>
          <div className="mt-4">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {locationStats.map((loc, i) => (
                <div
                  key={loc.id}
                  style={{
                    width: `${loc.pct}%`,
                    backgroundColor: locationColors[i % locationColors.length],
                  }}
                  className={`transition-opacity ${!location || location === loc.id ? 'opacity-100' : 'opacity-30'}`}
                  title={`${loc.name}: ${loc.units} units (${loc.pct}%)`}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {locationStats.map((loc, i) => {
                const isSelected = location === loc.id
                return (
                  <button
                    type="button"
                    key={loc.id}
                    onClick={() => onSelectLocation(isSelected ? '' : loc.id)}
                    className={`rounded-lg border p-2 text-left transition ${
                      isSelected
                        ? 'border-secondary bg-secondary/10 ring-1 ring-secondary'
                        : 'border-border bg-card/60 hover:border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: locationColors[i % locationColors.length] }}
                      />
                      <span className="truncate">{loc.name}</span>
                    </div>
                    <p className="mt-1 font-mono font-bold text-foreground">
                      {number(loc.units)} units
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {money(loc.value, w.profile.currency)} ({loc.pct}%)
                    </p>
                  </button>
                )
              })}
              {locationStats.length === 0 && (
                <p className="col-span-3 text-xs text-muted-foreground">
                  No distinct locations defined.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs transition-colors">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Layers size={18} className="text-indigo-600 dark:text-indigo-400" />
                <span>Replenishment Pipeline</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Available on-hand vs incoming supplier orders
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg border border-border/60 bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">On hand (Available)</p>
              <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                {number(pipelineStats.onHand)}
              </p>
              <p className="text-[11px] text-muted-foreground/80">Current positions</p>
            </div>
            <div className="rounded-lg border border-secondary/20 bg-secondary/10 p-3">
              <p className="text-xs font-semibold text-secondary">
                Incoming orders (POs)
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-secondary">
                +{number(pipelineStats.onOrder)}
              </p>
              <p className="text-[11px] text-muted-foreground">Pending delivery</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CategoryDistribution({
  workspace: w,
  location,
}: {
  workspace: Workspace
  location: string
}) {
  const [metric, setMetric] = useState<'value' | 'units'>('value')

  const categoryStats = useMemo(() => {
    const map = new Map<
      string,
      { value: number; units: number; count: number }
    >()
    for (const p of w.products) {
      const cat = p.category || 'Uncategorized'
      const avail = availability(w, p.id, location) ?? 0
      const cost = p.cost ?? 0
      const existing = map.get(cat) ?? { value: 0, units: 0, count: 0 }
      map.set(cat, {
        value: existing.value + avail * cost,
        units: existing.units + avail,
        count: existing.count + 1,
      })
    }
    const entries = Array.from(map.entries()).map(([name, s]) => ({
      name,
      ...s,
    }))
    const totalVal = entries.reduce((s, e) => s + e.value, 0)
    const totalUnits = entries.reduce((s, e) => s + e.units, 0)
    const maxVal = Math.max(1, ...entries.map((e) => e.value))
    const maxUnits = Math.max(1, ...entries.map((e) => e.units))
    return {
      entries,
      totalVal,
      totalUnits,
      maxVal,
      maxUnits,
    }
  }, [w, location])

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs transition-colors">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2 font-bold text-foreground">
            <BarChart2 size={18} className="text-secondary" />
            <span>Stock Distribution by Category</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Capital valuation vs available units
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border/60 bg-muted p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMetric('value')}
            className={`rounded-md px-2.5 py-1 transition ${
              metric === 'value'
                ? 'bg-card font-bold text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Value
          </button>
          <button
            type="button"
            onClick={() => setMetric('units')}
            className={`rounded-md px-2.5 py-1 transition ${
              metric === 'units'
                ? 'bg-card font-bold text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Units
          </button>
        </div>
      </div>
      <div className="mt-4 space-y-3.5">
        {categoryStats.entries.map((cat) => {
          const barWidth =
            metric === 'value'
              ? Math.round((cat.value / categoryStats.maxVal) * 100)
              : Math.round((cat.units / categoryStats.maxUnits) * 100)
          return (
            <div key={cat.name} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground">
                  {cat.name}{' '}
                  <span className="font-normal text-muted-foreground">
                    ({cat.count} SKUs)
                  </span>
                </span>
                <span className="font-mono font-bold text-foreground">
                  {metric === 'value'
                    ? money(cat.value, w.profile.currency)
                    : `${number(cat.units)} units`}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-secondary transition-[width]"
                  style={{ width: `${Math.max(6, barWidth)}%` }}
                />
              </div>
            </div>
          )
        })}
        {categoryStats.entries.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No categorized products in catalog.
          </p>
        )}
      </div>
    </div>
  )
}
