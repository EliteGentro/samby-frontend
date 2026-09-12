import { cutoff, type FinanceEvent, type Workspace } from './workspace'

export const financeEventKinds = {
  customer_collection: {
    label: 'Customer collection',
    recordKind: 'receivable',
  },
  provider_availability: {
    label: 'Provider funds made available',
    recordKind: 'provider_pending',
  },
  supplier_payment: { label: 'Supplier payment', recordKind: 'payable' },
} as const

const reference = (event: FinanceEvent) =>
  `${event.kind}:${event.paymentReference.trim().toLowerCase()}`
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
const validAmount = (value: number) => Number.isFinite(value) && value >= 0

export function financeEventIssues(
  workspace: Workspace,
  events = workspace.financeEvents ?? [],
) {
  return events.map((event) => {
    const record = workspace.finance.find(
      (record) => record.id === event.recordId,
    )
    const label = financeEventKinds[event.kind]
    let reason: string | null = null
    if (!event.id || events.filter((item) => item.id === event.id).length !== 1)
      reason = 'Duplicate or missing event identity.'
    else if (
      !event.paymentReference.trim() ||
      events.filter((item) => reference(item) === reference(event)).length !== 1
    )
      reason =
        'Each payment stage needs a unique source reference; split allocations need distinct allocation references.'
    else if (
      !label ||
      !record ||
      workspace.finance.filter((item) => item.id === event.recordId).length !==
        1 ||
      record.kind !== label.recordKind
    )
      reason =
        'Link this event to one confirmed financial record of the matching stage.'
    else if (!validDate(event.date) || event.date > cutoff(workspace))
      reason =
        'Record the actual historical event date; planned future dates belong in the financial register.'
    else if (
      !validAmount(event.amount) ||
      event.currency !== workspace.profile.currency ||
      record.currency !== event.currency
    )
      reason =
        'Use a known nonnegative amount in the record and workspace currency; no currency conversion is inferred.'
    else if (
      !validAmount(record.amount) ||
      !validAmount(record.paidAmount) ||
      record.paidAmount > record.amount
    )
      reason =
        'Reconcile the original and cumulative paid amounts of the linked record first.'
    else {
      const recorded = events
        .filter(
          (item) =>
            item.recordId === event.recordId &&
            item.kind === event.kind &&
            validAmount(item.amount) &&
            item.currency === event.currency,
        )
        .reduce((sum, item) => sum + item.amount, 0)
      if (recorded > record.paidAmount + 1e-8)
        reason =
          'Historical event amounts exceed the linked record’s cumulative paid or made-available amount. Reconcile that financial record first.'
      if (!reason && event.kind === 'provider_availability') {
        const invoice = workspace.finance.find(
          (item) =>
            item.id === record.linkedRecordId && item.kind === 'receivable',
        )
        const providerRecords = workspace.finance.filter(
          (item) =>
            item.kind === 'provider_pending' &&
            item.linkedRecordId === record.linkedRecordId,
        )
        if (
          !invoice ||
          invoice.currency !== event.currency ||
          !validAmount(invoice.paidAmount) ||
          providerRecords.some(
            (item) =>
              !validAmount(item.amount) || item.currency !== event.currency,
          ) ||
          providerRecords.reduce((sum, item) => sum + item.amount, 0) >
            invoice.paidAmount + 1e-8
        )
          reason =
            'Provider availability requires a reconciled invoice collection link; it is a later stage of the same money.'
        const collection = events.find(
          (item) =>
            item.kind === 'customer_collection' &&
            item.paymentReference.trim().toLowerCase() ===
              event.paymentReference.trim().toLowerCase(),
        )
        if (
          !reason &&
          collection &&
          (collection.recordId !== invoice?.id ||
            collection.date > event.date ||
            collection.amount < event.amount)
        )
          reason =
            'The matching collection reference must belong to the linked invoice, precede availability and cover the available amount.'
      }
    }
    return { event, record, reason }
  })
}

export function financeHistory(
  workspace: Workspace,
  start: string,
  end: string,
  kind?: 'internal' | 'external',
) {
  const reviewed = financeEventIssues(workspace)
  const scoped = reviewed.filter(
    (item) =>
      !kind ||
      (kind === 'external'
        ? item.event.kind === 'supplier_payment'
        : item.event.kind !== 'supplier_payment'),
  )
  const excluded = scoped.filter((item) => item.reason !== null)
  const rows = scoped
    .filter(
      (item) =>
        item.reason === null &&
        item.event.date >= start &&
        item.event.date <= end,
    )
    .sort((a, b) => b.event.date.localeCompare(a.event.date))
  const sum = (stage: FinanceEvent['kind']) => {
    const selected = rows.filter((item) => item.event.kind === stage)
    return selected.length
      ? selected.reduce((amount, item) => amount + item.event.amount, 0)
      : null
  }
  const warnings: string[] = []
  if (excluded.length)
    warnings.push(
      `${excluded.length} historical events need reconciliation and are excluded from period subtotals.`,
    )
  if (
    rows.some(
      (item) =>
        item.event.kind === 'provider_availability' &&
        !reviewed.some(
          (other) =>
            other.reason === null &&
            other.event.kind === 'customer_collection' &&
            other.event.paymentReference.trim().toLowerCase() ===
              item.event.paymentReference.trim().toLowerCase(),
        ),
    )
  )
    warnings.push(
      'Some provider availability events have no matching dated collection observation. The invoice link establishes the payment stage; the earlier collection date remains unobserved.',
    )
  const recordedByRecord = new Map<string, number>()
  reviewed
    .filter((item) => item.reason === null)
    .forEach((item) =>
      recordedByRecord.set(
        item.event.recordId,
        (recordedByRecord.get(item.event.recordId) ?? 0) + item.event.amount,
      ),
    )
  const undatedPaid = workspace.finance
    .filter((record) =>
      kind === 'external'
        ? record.kind === 'payable'
        : kind === 'internal'
          ? ['receivable', 'provider_pending'].includes(record.kind)
          : ['receivable', 'provider_pending', 'payable'].includes(record.kind),
    )
    .some(
      (record) =>
        validAmount(record.paidAmount) &&
        record.paidAmount > (recordedByRecord.get(record.id) ?? 0) + 1e-8,
    )
  if (undatedPaid)
    warnings.push(
      'Some cumulative paid or made-available amounts have no dated observations. They are not assigned to this reporting period; historical coverage is partial.',
    )
  return {
    start,
    end,
    rows,
    excluded,
    warnings,
    collections: sum('customer_collection'),
    available: sum('provider_availability'),
    payments: sum('supplier_payment'),
  }
}
