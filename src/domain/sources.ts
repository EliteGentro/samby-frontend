import type { Workspace } from './workspace'
const sourceArrays = [
  'sales',
  'stock',
  'purchases',
  'finance',
  'pendingFinance',
  'commitments',
  'movements',
  'inventoryHistory',
  'serviceObservations',
  'inventoryLayers',
  'paymentTerms',
  'financeEvents',
] as const
export function sourceRecordCounts(w: Workspace, id: string) {
  const removedFinance = new Set(
    w.finance
      .filter((record) => record.sourceId === id)
      .map((record) => record.id),
  )
  return Object.fromEntries(
    sourceArrays.map((key) => [
      key,
      (w[key] ?? []).filter(
        (record) =>
          record.sourceId === id ||
          (key === 'financeEvents' &&
            'recordId' in record &&
            removedFinance.has(record.recordId)),
      ).length,
    ]),
  )
}
export function removeSourceRecords(w: Workspace, id: string): Workspace {
  const removedFinance = new Set(
    w.finance
      .filter((record) => record.sourceId === id)
      .map((record) => record.id),
  )
  return {
    ...w,
    revision: w.revision + 1,
    sales: w.sales.filter((s) => s.sourceId !== id),
    stock: w.stock.filter((s) => s.sourceId !== id),
    purchases: w.purchases.filter((s) => s.sourceId !== id),
    finance: w.finance.filter((s) => s.sourceId !== id),
    pendingFinance: w.pendingFinance?.filter((s) => s.sourceId !== id),
    commitments: w.commitments.filter((s) => s.sourceId !== id),
    movements: w.movements.filter((s) => s.sourceId !== id),
    inventoryHistory: w.inventoryHistory?.filter((s) => s.sourceId !== id),
    serviceObservations: w.serviceObservations?.filter(
      (s) => s.sourceId !== id,
    ),
    inventoryLayers: w.inventoryLayers?.filter((s) => s.sourceId !== id),
    paymentTerms: w.paymentTerms?.filter((s) => s.sourceId !== id),
    financeEvents: w.financeEvents?.filter(
      (s) => s.sourceId !== id && !removedFinance.has(s.recordId),
    ),
    sources: w.sources.filter((s) => s.id !== id),
  }
}
