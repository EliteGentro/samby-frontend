import {
  capabilities,
  catalogCapabilities,
  isCapabilityMuted,
  cutoff,
  shiftDate,
  type Workspace,
} from './workspace'

export type WorkspaceNotice = {
  id: string
  capability: string
  type: 'Unlock' | 'Coverage / quality' | 'Freshness' | 'Lifecycle'
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
}
const capabilitiesById = new Map(
  capabilities.map((capability) => [capability.id, capability]),
)
export function workspaceNotices(
  w: Workspace,
  now = new Date(),
): WorkspaceNotice[] {
  const notices: WorkspaceNotice[] = []
  const add = (notice: WorkspaceNotice) => notices.push(notice)
  for (const id of w.notifications.unlocked ?? []) {
    const capability = capabilitiesById.get(id)
    if (capability?.check(w))
      add({
        id: `unlock-${id}`,
        capability: id,
        type: 'Unlock',
        severity: 'info',
        title: `${capability.name} is available`,
        detail: `Usable inputs now support this capability. Review its product, date and source scope in Add-ons & Data.`,
      })
  }
  const omitted = Object.entries(w.coverage)
    .filter(([, c]) => c.state === 'unknown' || c.state === 'omitted')
    .map(([key]) => key)
  if (w.cash && omitted.length)
    add({
      id: 'cash-coverage',
      capability: 'liquidity',
      type: 'Coverage / quality',
      severity: 'warning',
      title: 'Cash planning has partial coverage',
      detail: `${omitted.join(', ')} remain unknown or omitted. Supported partial projections can continue. Review categories and dates in financial intake.`,
    })
  const unknown = w.stock.filter(
    (s) => s.reserved === null && s.quantityBasis !== 'available',
  )
  if (unknown.length)
    add({
      id: 'unknown-availability',
      capability: 'stock',
      type: 'Coverage / quality',
      severity: 'warning',
      title: 'Some available quantities are unknown',
      detail: `${unknown.length} stock positions have no reservation basis. Their on-hand records remain visible; confirm reservations or available quantity to calculate availability.`,
    })
  const stale = w.stock.filter(
    (s) => s.asOf < shiftDate(cutoff(w), -(w.notifications.cadenceDays ?? 30)),
  )
  if (stale.length)
    add({
      id: 'stale-stock',
      capability: 'stock',
      type: 'Freshness',
      severity: 'warning',
      title: 'Review older stock snapshots',
      detail: `${stale.length} positions exceed your ${w.notifications.cadenceDays ?? 30}-day planning cadence. Existing snapshots remain usable with their dates. Confirm new quantities before planning.`,
    })
  const excluded = w.sources.reduce((sum, s) => sum + s.excludedCount, 0)
  if (excluded)
    add({
      id: 'source-exclusions',
      capability: 'sales',
      type: 'Coverage / quality',
      severity: 'warning',
      title: 'Sales exclude reviewed source rows',
      detail: `${excluded} source rows were explicitly excluded. Totals cover accepted rows only. Reopen the source review to correct missing or invalid information.`,
    })
  const dates = new Set(
    w.sales.filter((s) => s.quantity !== null).map((s) => s.date),
  )
  if (dates.size > 0 && dates.size < 28)
    add({
      id: 'short-demand-history',
      capability: 'forecast',
      type: 'Coverage / quality',
      severity: 'warning',
      title: 'Demand history is short',
      detail: `${dates.size} observed dates support the supplied scope. An eligible naïve benchmark can continue; more comparable history can support seasonal analysis. Missing dates are not zero demand.`,
    })
  for (const c of catalogCapabilities.filter((c) => c.lifecycle !== 'active'))
    add({
      id: `lifecycle-${c.id}`,
      capability: c.id,
      type: 'Lifecycle',
      severity: c.lifecycle === 'retired' ? 'critical' : 'warning',
      title: `${c.name} is ${c.lifecycle}`,
      detail:
        'Review the catalog for the successor and history access. Saved results retain their original engine and warnings.',
    })
  const rank = { info: 0, warning: 1, critical: 2 },
    floor =
      w.notifications.severity === 'all' ? 0 : rank[w.notifications.severity]
  const dismissed = new Set(w.notifications.dismissed)
  return w.notifications.enabled
    ? notices.filter(
        (n) =>
          !isNoticeMuted(n.capability, w) &&
          rank[n.severity] >= floor &&
          !dismissed.has(n.id) &&
          Date.parse(w.notifications.snoozedUntil?.[n.id] ?? '1970-01-01') <=
            now.getTime(),
      )
    : []
}

function isNoticeMuted(id: string, w: Workspace) {
  const c = capabilitiesById.get(id)
  return c ? isCapabilityMuted(c, w) : w.muted.includes(id)
}
