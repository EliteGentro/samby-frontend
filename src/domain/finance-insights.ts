import {
  cutoff,
  outstanding,
  shiftDate,
  type FinancialRecord,
  type Workspace,
} from './workspace'
import { financeTotals } from './selectors'

export type FinanceInsightKind = 'internal' | 'external'
const dateNumber = (value: string) =>
  Date.parse(`${value}T00:00:00Z`) / 86_400_000
const validDate = (value: string | null): value is string =>
  Boolean(
    value &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(dateNumber(value)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
  )
const validAmount = (record: FinancialRecord) =>
  Number.isFinite(record.amount) &&
  Number.isFinite(record.paidAmount) &&
  record.amount >= 0 &&
  record.paidAmount >= 0 &&
  record.paidAmount <= record.amount

export function financeInsights(
  workspace: Workspace,
  kind: FinanceInsightKind,
  asOf = cutoff(workspace),
  start = asOf,
  end = shiftDate(start, 29),
) {
  const balanceAsOf = cutoff(workspace)
  const historicalUnavailable = asOf !== balanceAsOf
  const candidates = workspace.finance.filter((record) =>
    kind === 'internal'
      ? record.kind === 'receivable' || record.kind === 'provider_pending'
      : record.kind === 'payable',
  )
  const warnings: string[] = []
  const pending = (workspace.pendingFinance ?? []).filter(
    (record) =>
      record.kind === (kind === 'internal' ? 'receivable' : 'payable'),
  )
  if (pending.length)
    warnings.push(
      `${pending.length} incomplete ${kind === 'internal' ? 'receivable' : 'payable'} records remain outside numerical balances: ${pending.map((record) => record.name).join(', ')}. Their unknown amounts are not zero; this financial scope is incomplete.`,
    )
  const excluded: { id: string; name: string; reason: string }[] = []
  const idCounts = new Map<string, number>()
  workspace.finance.forEach((record) =>
    idCounts.set(record.id, (idCounts.get(record.id) ?? 0) + 1),
  )
  const eligible = candidates.filter((record) => {
    let reason: string | null = null
    if ((idCounts.get(record.id) ?? 0) > 1)
      reason = 'Duplicate financial identity; reconcile repeated records.'
    else if (!validAmount(record))
      reason = 'Unknown, negative or inconsistent original/paid amount.'
    else if (record.currency !== workspace.profile.currency)
      reason = `Working currency is ${workspace.profile.currency}; no conversion is assumed.`
    else if (kind === 'internal' && record.cashIncluded)
      reason =
        'Already reflected in available cash; excluded from pending customer balances.'
    else if (record.kind === 'provider_pending') {
      const invoice = workspace.finance.find(
        (item) =>
          item.id === record.linkedRecordId && item.kind === 'receivable',
      )
      const linked = workspace.finance.filter(
        (item) =>
          item.kind === 'provider_pending' &&
          item.linkedRecordId === record.linkedRecordId,
      )
      if (
        !invoice ||
        !validAmount(invoice) ||
        invoice.cashIncluded ||
        (idCounts.get(invoice.id) ?? 0) !== 1 ||
        invoice.currency !== record.currency ||
        linked.some(
          (item) =>
            !validAmount(item) ||
            item.currency !== record.currency ||
            (idCounts.get(item.id) ?? 0) > 1,
        ) ||
        linked.reduce((sum, item) => sum + item.amount, 0) > invoice.paidAmount
      )
        reason =
          'Provider-pending funds require a reconciled invoice link and collected amount; payment stages cannot be added twice.'
    }
    if (reason) excluded.push({ id: record.id, name: record.name, reason })
    return reason === null
  })
  const reconciled = financeTotals({ ...workspace, finance: eligible })
  const total = eligible.length
    ? kind === 'internal'
      ? reconciled.internal
      : reconciled.external
    : null
  const active = eligible.filter((record) => outstanding(record) > 0)
  const bands = [
    {
      key: 'not-due',
      label: 'Not yet due',
      amount: 0,
      recordIds: [] as string[],
    },
    {
      key: 'due-today',
      label: 'Due today',
      amount: 0,
      recordIds: [] as string[],
    },
    {
      key: '1-30',
      label: 'Overdue 1–30 days',
      amount: 0,
      recordIds: [] as string[],
    },
    {
      key: '31-60',
      label: 'Overdue 31–60 days',
      amount: 0,
      recordIds: [] as string[],
    },
    {
      key: '61-90',
      label: 'Overdue 61–90 days',
      amount: 0,
      recordIds: [] as string[],
    },
    {
      key: '91+',
      label: 'Overdue 91+ days',
      amount: 0,
      recordIds: [] as string[],
    },
    {
      key: 'undated',
      label: 'Due date unknown',
      amount: 0,
      recordIds: [] as string[],
    },
    {
      key: 'provider',
      label: 'Provider availability pending',
      amount: 0,
      recordIds: [] as string[],
    },
  ]
  const bandsByKey = new Map(bands.map((band) => [band.key, band]))
  const parties = new Map<
    string,
    { name: string; amount: number; recordIds: string[] }
  >()
  const dates = new Map<
    string,
    {
      date: string
      receivable: number
      provider: number
      payable: number
      recordIds: string[]
    }
  >()
  let overdue = 0,
    unscheduled = 0,
    beforeWindow = 0,
    beyondWindow = 0,
    unknownParty = 0,
    invalidDates = 0
  for (const record of active) {
    const amount = outstanding(record)
    const days = validDate(record.dueDate)
      ? Math.floor(dateNumber(balanceAsOf) - dateNumber(record.dueDate))
      : null
    const bucket =
      record.kind === 'provider_pending'
        ? 'provider'
        : days === null
          ? 'undated'
          : days < 0
            ? 'not-due'
            : days === 0
              ? 'due-today'
              : days <= 30
                ? '1-30'
                : days <= 60
                  ? '31-60'
                  : days <= 90
                    ? '61-90'
                    : '91+'
    const band = bandsByKey.get(bucket)
    if (!band) throw new Error(`Unknown aging bucket: ${bucket}`)
    band.amount += amount
    band.recordIds.push(record.id)
    if (record.kind !== 'provider_pending' && days !== null && days > 0)
      overdue += amount
    const name = record.counterparty.trim() || 'Unassigned counterparty'
    if (!record.counterparty.trim()) unknownParty += amount
    const party = parties.get(name) ?? { name, amount: 0, recordIds: [] }
    party.amount += amount
    party.recordIds.push(record.id)
    parties.set(name, party)
    if (!validDate(record.expectedDate)) {
      unscheduled += amount
      if (record.expectedDate) invalidDates++
      continue
    }
    if (record.expectedDate < start) {
      beforeWindow += amount
      continue
    }
    if (record.expectedDate > end) {
      beyondWindow += amount
      continue
    }
    const date = dates.get(record.expectedDate) ?? {
      date: record.expectedDate,
      receivable: 0,
      provider: 0,
      payable: 0,
      recordIds: [],
    }
    date[
      record.kind === 'receivable'
        ? 'receivable'
        : record.kind === 'provider_pending'
          ? 'provider'
          : 'payable'
    ] += amount
    date.recordIds.push(record.id)
    dates.set(record.expectedDate, date)
  }
  const concentration = [...parties.values()]
    .sort((a, b) => b.amount - a.amount)
    .map((party) => ({
      ...party,
      share: total !== null && total > 0 ? (party.amount / total) * 100 : null,
    }))
  if (historicalUnavailable)
    warnings.push(
      `Current supplied records do not reconstruct financial balances on ${asOf}. Aging and concentration are available only for the current business date ${balanceAsOf}.`,
    )
  if (excluded.length)
    warnings.push(
      `${excluded.length} records are excluded from monetary subtotals. The remaining values cover only reconciled supplied records; excluded amounts are not assumed zero.`,
    )
  if (unknownParty > 0)
    warnings.push(
      'Unassigned counterparties remain in the known monetary denominator as a separate bucket; concentration is not a complete customer or supplier population.',
    )
  if (unscheduled > 0)
    warnings.push(
      'Amounts without usable expected dates remain unscheduled. Contractual due dates never substitute for collection or payment dates.',
    )
  if (beforeWindow > 0)
    warnings.push(
      `Some current outstanding amounts have expected dates before ${start}. They are outside this selected timeline and may require rescheduling.`,
    )
  if (beyondWindow > 0)
    warnings.push(
      `Expected events after ${end} remain outstanding outside the selected timeline.`,
    )
  if (invalidDates)
    warnings.push(
      `${invalidDates} expected dates are uninterpretable and require source review.`,
    )
  const sourceIds = [
    ...new Set(
      eligible
        .map((record) => record.sourceId)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  return {
    kind,
    asOf: balanceAsOf,
    requestedAsOf: asOf,
    start,
    end,
    historicalUnavailable,
    total: historicalUnavailable ? null : total,
    overdue: historicalUnavailable || total === null ? null : overdue,
    providerPending:
      historicalUnavailable || total === null ? null : reconciled.pending,
    eligibleCount: eligible.length,
    candidateCount: candidates.length,
    activeCount: active.length,
    aging: historicalUnavailable
      ? []
      : bands.filter((band) => kind === 'internal' || band.key !== 'provider'),
    concentration: historicalUnavailable ? [] : concentration,
    timeline: [...dates.values()].sort((a, b) => a.date.localeCompare(b.date)),
    unscheduled: total === null ? null : unscheduled,
    beforeWindow: total === null ? null : beforeWindow,
    beyondWindow: total === null ? null : beyondWindow,
    settledCount: eligible.length - active.length,
    sourceIds,
    sources: sourceIds.map((id) => ({
      id,
      name:
        workspace.sources.find((source) => source.id === id)?.name ??
        'Source not found',
      importedAt:
        workspace.sources.find((source) => source.id === id)?.importedAt ??
        null,
    })),
    records: eligible,
    excluded,
    warnings,
  }
}
