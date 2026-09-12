import type { Product, Workspace } from './workspace'
export type StandardizationField =
  | 'sku'
  | 'name'
  | 'category'
  | 'brand'
  | 'supplierName'
  | 'unit'
  | 'cost'
  | 'price'
  | 'moq'
  | 'casePack'
export type StandardizationProposal = {
  id: string
  productId: string
  field: StandardizationField
  oldValue: string
  value: string
  reason: string
  selected: boolean
  rejected: boolean
  factor?: number
  basis?: string
}
export const standardizationFields: StandardizationField[] = [
  'sku',
  'name',
  'category',
  'brand',
  'supplierName',
  'unit',
  'cost',
  'price',
  'moq',
  'casePack',
]
export function originalValue(
  w: Workspace,
  p: Product,
  field: StandardizationField,
) {
  return String(
    field === 'supplierName'
      ? (w.suppliers.find((s) => s.id === p.supplierId)?.name ?? '')
      : (p[field] ?? ''),
  )
}
const clean = (value: string) => value.trim().replace(/\s+/g, ' ')
export function standardizationProposals(
  w: Workspace,
): StandardizationProposal[] {
  const result: StandardizationProposal[] = [],
    seenSuppliers = new Set<string>()
  for (const p of w.products)
    for (const field of [
      'sku',
      'name',
      'category',
      'brand',
      'supplierName',
      'unit',
    ] as const) {
      const oldValue = originalValue(w, p, field)
      if (field === 'supplierName') {
        if (!p.supplierId || seenSuppliers.has(p.supplierId)) continue
        seenSuppliers.add(p.supplierId)
      }
      let value =
        field === 'sku'
          ? clean(oldValue)
              .toUpperCase()
              .replace(/[\s_]+/g, '-')
          : clean(oldValue)
      if (
        field === 'sku' &&
        (!value ||
          w.products.some((other) => other.id !== p.id && other.sku === value))
      )
        value = `${value || 'SKU'}-${p.id.slice(-6).toUpperCase()}`
      if (field === 'category' || field === 'brand')
        value =
          w.products
            .map((other) => originalValue(w, other, field))
            .find(
              (candidate) =>
                clean(candidate).toLowerCase() === value.toLowerCase() &&
                candidate === clean(candidate),
            ) ?? value
      if (field === 'unit' && /^(pcs|pc|piece)$/i.test(value)) value = 'pieces'
      if (oldValue !== value)
        result.push({
          id: `${p.id}-${field}`,
          productId: p.id,
          field,
          oldValue,
          value,
          reason:
            field === 'sku'
              ? 'Normalize formatting or resolve a conflicting/missing reference without merging product identities.'
              : field === 'unit'
                ? 'Possible unit alias. A confirmed conversion factor and source basis are required.'
                : 'Normalize inconsistent whitespace or naming while retaining identity.',
          selected: false,
          rejected: false,
          ...(field === 'unit' ? { factor: 1, basis: '' } : {}),
        })
    }
  return result
}
export function affectedStandardizationRecords(
  w: Workspace,
  proposal: StandardizationProposal,
) {
  const p = w.products.find((product) => product.id === proposal.productId)
  const products =
    proposal.field === 'supplierName' && p?.supplierId
      ? w.products.filter((item) => item.supplierId === p.supplierId)
      : w.products.filter((item) => item.id === proposal.productId)
  const ids = new Set(products.map((item) => item.id))
  const records = [
    ...w.sales,
    ...w.stock,
    ...w.purchases,
    ...w.movements,
    ...(w.inventoryHistory ?? []),
    ...(w.serviceObservations ?? []),
    ...(w.inventoryLayers ?? []),
  ].filter((record) => record.productId && ids.has(record.productId))
  return {
    products,
    records,
    sourceIds: [
      ...new Set(
        records.flatMap((record) =>
          'sourceId' in record && record.sourceId ? [record.sourceId] : [],
        ),
      ),
    ],
  }
}
export function applyStandardization(
  w: Workspace,
  proposals: StandardizationProposal[],
): Workspace {
  const originalProducts = new Map(
    w.products.map((product) => [product.id, product]),
  )
  const chosen = proposals.filter((p) => p.selected && !p.rejected)
  if (!chosen.length) throw new Error('Select at least one reviewed change.')
  if (
    chosen.some(
      (p) =>
        p.field === 'unit' &&
        chosen.some(
          (other) =>
            other.productId === p.productId &&
            ['cost', 'price', 'moq', 'casePack'].includes(other.field),
        ),
    )
  )
    throw new Error(
      'Review unit conversion separately from cost, price, MOQ or case-pack overrides so their unit basis is unambiguous.',
    )
  if (
    new Set(
      chosen
        .filter((p) => p.field === 'supplierName')
        .map((p) => originalProducts.get(p.productId)?.supplierId),
    ).size !== chosen.filter((p) => p.field === 'supplierName').length
  )
    throw new Error('Select one correction for each shared supplier identity.')
  if (
    new Set(chosen.map((p) => `${p.productId}-${p.field}`)).size !==
    chosen.length
  )
    throw new Error('Keep one selected change per product and field.')
  let next = structuredClone(w)
  const nextProducts = new Map(
    next.products.map((product) => [product.id, product]),
  )
  for (const proposal of chosen) {
    const product = nextProducts.get(proposal.productId),
      original = originalProducts.get(proposal.productId)
    if (
      !product ||
      !original ||
      originalValue(w, original, proposal.field) !== proposal.oldValue
    )
      throw new Error(
        'A source value changed since the proposal. Reopen Standardization to review current values.',
      )
    const value = proposal.value.trim(),
      affected = affectedStandardizationRecords(w, proposal)
    if (
      ['sku', 'name', 'unit', 'supplierName'].includes(proposal.field) &&
      !value
    )
      throw new Error(
        'Product references, names, units and supplier names cannot be empty.',
      )
    if (proposal.field === 'supplierName') {
      if (!product.supplierId)
        throw new Error(
          'A supplier identity must be linked before changing its name.',
        )
      next.suppliers = next.suppliers.map((s) =>
        s.id === product.supplierId ? { ...s, name: value } : s,
      )
      next.paymentTerms = next.paymentTerms?.map((term) =>
        term.supplierId === product.supplierId
          ? { ...term, counterparty: value }
          : term,
      )
    } else if (proposal.field === 'unit') {
      const factor = proposal.factor
      if (
        !factor ||
        !Number.isFinite(factor) ||
        factor <= 0 ||
        !proposal.basis?.trim()
      )
        throw new Error(
          'Unit changes require a positive explicit factor and the source establishing that conversion.',
        )
      const oldUnit = product.unit
      if (
        next.sales.some(
          (s) =>
            s.productId === product.id &&
            s.unitCost != null &&
            (s.costUnit || s.unit) !== oldUnit,
        )
      )
        throw new Error(
          'A historical cost uses another unit basis. Confirm its own conversion before changing the product unit.',
        )
      const unitRecords = [
        ...next.sales,
        ...(next.inventoryHistory ?? []),
        ...(next.serviceObservations ?? []),
        ...(next.inventoryLayers ?? []),
      ].filter((record) => record.productId === product.id)
      if (unitRecords.some((record) => record.unit && record.unit !== oldUnit))
        throw new Error(
          'Linked records use multiple units. Resolve their original unit bases individually before changing the product-wide unit.',
        )
      const times = (n: number | null | undefined) =>
        n == null ? n : n * factor
      const divide = (n: number | null | undefined) =>
        n == null ? n : n / factor
      Object.assign(product, {
        unit: value,
        cost: divide(product.cost),
        price: divide(product.price),
        moq: times(product.moq),
        casePack: times(product.casePack),
        reorderPoint: times(product.reorderPoint),
        safetyStock: times(product.safetyStock),
        targetStock: times(product.targetStock),
      })
      next.stock = next.stock.map((s) =>
        s.productId === product.id
          ? {
              ...s,
              onHand: s.onHand * factor,
              reserved: times(s.reserved) ?? null,
              backordered: times(s.backordered),
            }
          : s,
      )
      next.sales = next.sales.map((s) =>
        s.productId === product.id
          ? {
              ...s,
              unit: value,
              quantity: times(s.quantity) ?? null,
              unitCost: divide(s.unitCost),
              costUnit: s.unitCost == null ? s.costUnit : value,
            }
          : s,
      )
      next.purchases = next.purchases.map((p) =>
        p.productId === product.id
          ? {
              ...p,
              quantity: p.quantity * factor,
              receivedQuantity: p.receivedQuantity * factor,
            }
          : p,
      )
      next.movements = next.movements.map((m) =>
        m.productId === product.id
          ? { ...m, quantity: m.quantity * factor }
          : m,
      )
      next.inventoryHistory = next.inventoryHistory?.map((s) =>
        s.productId === product.id
          ? {
              ...s,
              unit: value,
              quantity: s.quantity * factor,
              unitCost: divide(s.unitCost) ?? null,
            }
          : s,
      )
      next.inventoryLayers = next.inventoryLayers?.map((s) =>
        s.productId === product.id
          ? {
              ...s,
              unit: value,
              remainingQuantity: s.remainingQuantity * factor,
            }
          : s,
      )
      next.serviceObservations = next.serviceObservations?.map((s) =>
        s.productId === product.id
          ? {
              ...s,
              unit: value,
              requested: times(s.requested) ?? null,
              fulfilled: times(s.fulfilled) ?? null,
              availableQuantity: times(s.availableQuantity) ?? null,
              backlogRemaining: times(s.backlogRemaining),
              lostUnitMargin:
                s.lostUnitMargin == null
                  ? s.lostUnitMargin
                  : s.lostUnitMargin / factor,
            }
          : s,
      )
    } else if (['cost', 'price', 'moq', 'casePack'].includes(proposal.field)) {
      const amount = value === '' ? null : Number(value)
      if (
        amount !== null &&
        (!Number.isFinite(amount) ||
          amount < 0 ||
          (proposal.field === 'casePack' && amount === 0))
      )
        throw new Error(
          'Costs and MOQ must be nonnegative; a known case pack must be positive. Blank is unknown.',
        )
      Object.assign(product, { [proposal.field]: amount })
    } else Object.assign(product, { [proposal.field]: value })
    next.standardization.push({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      productId: product.id,
      oldSku: original.sku,
      newSku: product.sku,
      field: proposal.field,
      oldValue: proposal.oldValue,
      newValue: value,
      conversionFactor: proposal.field === 'unit' ? proposal.factor : undefined,
      affectedRecordIds: affected.records.map((record) => record.id),
      sourceIds: affected.sourceIds,
    })
  }
  if (new Set(next.products.map((p) => p.sku)).size !== next.products.length)
    throw new Error(
      'The selected SKU changes create a collision. Product identities cannot be silently merged.',
    )
  next = { ...next, revision: w.revision + 1 }
  return next
}
