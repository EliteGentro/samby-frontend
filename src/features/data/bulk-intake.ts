import {
  cutoff,
  type Category,
  type FinancialRecord,
  type Product,
  type Workspace,
} from '../../domain/workspace'
import {
  optionalNumber,
  parseDate,
  stableId,
  type Interpretation,
  type ParsedFile,
} from './intake'

export type ImportDataset = 'sales' | 'inventory' | 'suppliers' | 'finance'
export type BulkColumnMapping = Record<string, number | null>

export type BulkReviewedRow = {
  index: number
  original: string[]
  status: 'usable' | 'pending' | 'excluded'
  reasons: string[]
  title: string
  details: string[]
  values: Record<string, string | number | null | boolean>
}

type ImportFieldDefinition = {
  key: string
  label: string
  aliases: string[]
}

const field = (
  key: string,
  label: string,
  ...aliases: string[]
): ImportFieldDefinition => ({ key, label, aliases: [label, key, ...aliases] })

export const bulkImportFields: Record<
  Exclude<ImportDataset, 'sales'>,
  ImportFieldDefinition[]
> = {
  inventory: [
    field('sku', 'SKU / product reference', 'sku', 'product id', 'codigo'),
    field('product', 'Product name', 'product', 'producto'),
    field('category', 'Category', 'categoria'),
    field('brand', 'Brand', 'marca'),
    field('unit', 'Unit', 'uom', 'unidad'),
    field('stockQuantity', 'Stock quantity', 'on hand', 'onhand', 'quantity'),
    field('quantityBasis', 'Quantity basis', 'stock basis'),
    field('reserved', 'Reserved quantity', 'reserved'),
    field('backordered', 'Backordered quantity', 'backorder', 'backordered'),
    field('stockDate', 'Stock date', 'as of', 'asof', 'date'),
    field('location', 'Location', 'warehouse', 'sucursal'),
    field('unitCost', 'Unit cost', 'cost', 'costo unitario'),
    field('price', 'Selling price', 'unit price', 'precio'),
    field('targetStock', 'Target stock', 'target inventory'),
    field('reorderPoint', 'Reorder point'),
    field('safetyStock', 'Safety stock'),
    field('serviceTarget', 'Service target %', 'service target'),
    field('serviceTargetBasis', 'Service target basis'),
  ],
  suppliers: [
    field('supplier', 'Supplier name', 'supplier', 'vendor', 'proveedor'),
    field('sku', 'SKU / product reference', 'sku', 'product id', 'codigo'),
    field('product', 'Product name', 'product', 'producto'),
    field('category', 'Category', 'categoria'),
    field('brand', 'Brand', 'marca'),
    field('unit', 'Unit', 'uom', 'unidad'),
    field('leadTime', 'Lead time days', 'lead time'),
    field('unitCost', 'Unit cost', 'cost', 'costo unitario'),
    field('moq', 'Minimum order quantity', 'moq', 'minimum order'),
    field('casePack', 'Units per case / pack', 'case pack', 'pack size'),
    field('purchaseReference', 'Purchase reference', 'purchase order', 'po'),
    field('purchaseQuantity', 'Purchase quantity', 'quantity ordered'),
    field('purchaseAmount', 'Purchase amount', 'order amount'),
    field('paidAmount', 'Paid amount', 'amount paid'),
    field('orderDate', 'Order date'),
    field('promisedDate', 'Promised receipt date', 'promised date'),
    field('receiptStatus', 'Receipt status', 'received status'),
    field('receivedQuantity', 'Received quantity', 'quantity received'),
    field('receivedDate', 'Received date', 'actual receipt date'),
    field('paymentDate', 'Expected payment date', 'planned payment date'),
    field('location', 'Receipt location', 'location', 'warehouse'),
  ],
  finance: [
    field('reference', 'Record reference', 'invoice', 'invoice id', 'id'),
    field('kind', 'Record type', 'kind', 'type'),
    field('name', 'Record / invoice name', 'record name', 'description'),
    field('counterparty', 'Counterparty', 'customer', 'supplier'),
    field('amount', 'Original amount', 'amount', 'total'),
    field('paidAmount', 'Amount paid / collected', 'paid amount', 'collected'),
    field('currency', 'Currency', 'moneda'),
    field('dueDate', 'Due date'),
    field('expectedDate', 'Expected availability / payment date', 'expected date'),
    field('category', 'Category', 'categoria'),
    field('linkedReference', 'Linked record reference', 'linked purchase', 'linked invoice'),
    field('cashIncluded', 'Included in cash balance', 'cash included'),
  ],
}

export const importDatasetNames: Record<ImportDataset, string> = {
  sales: 'sales',
  inventory: 'inventory & costs',
  suppliers: 'purchasing & suppliers',
  finance: 'finance & collections',
}

export const templatePaths: Record<ImportDataset, string> = {
  sales: '/templates/samby-sales-template.csv',
  inventory: '/templates/samby-inventory-costs-template.csv',
  suppliers: '/templates/samby-purchasing-suppliers-template.csv',
  finance: '/templates/samby-finance-collections-template.csv',
}

const normalized = (value: string) => value.toLowerCase().trim()

export function guessBulkMapping(
  dataset: Exclude<ImportDataset, 'sales'>,
  headers: string[],
): BulkColumnMapping {
  return Object.fromEntries(
    bulkImportFields[dataset].map((definition) => {
      const aliases = definition.aliases.map(normalized)
      const index = headers.findIndex((header) => aliases.includes(normalized(header)))
      return [definition.key, index < 0 ? null : index]
    }),
  )
}

const read = (
  row: string[],
  mapping: BulkColumnMapping,
  key: string,
) => (mapping[key] == null ? '' : (row[mapping[key]!] ?? '').trim())

const number = (
  row: string[],
  mapping: BulkColumnMapping,
  key: string,
) => optionalNumber(read(row, mapping, key))

const date = (
  row: string[],
  mapping: BulkColumnMapping,
  key: string,
  format: Interpretation['dateFormat'],
) => {
  const raw = read(row, mapping, key)
  return raw ? parseDate(raw, format) : null
}

const productId = (sku: string, name: string) =>
  sku ? `p-sku-${stableId(sku)}` : `p-name-${stableId(name)}`
const supplierId = (name: string) => `sup-name-${stableId(name)}`
const locationId = (name: string) => `loc-${stableId(name)}`
const purchaseId = (reference: string, fingerprint: string, index: number) =>
  reference
    ? `po-ref-${stableId(reference)}`
    : `po-${fingerprint}-${index}`
const financeId = (reference: string, fingerprint: string, index: number) =>
  reference
    ? `fin-ref-${stableId(reference)}`
    : `fin-${fingerprint}-${index}`

const invalidNumber = (value: number | null) =>
  value !== null && !Number.isFinite(value)
const negative = (value: number | null) =>
  value !== null && (!Number.isFinite(value) || value < 0)

const normalizeReceiptStatus = (value: string) => {
  const status = normalized(value).replaceAll('_', '-').replaceAll(' ', '-')
  if (['received', 'yes', 'complete', 'partial'].includes(status))
    return 'received'
  if (['not-received', 'no', 'open', 'pending'].includes(status))
    return 'not-received'
  return status
}

const normalizeFinanceKind = (value: string): FinancialRecord['kind'] | '' => {
  const kind = normalized(value).replaceAll('-', '_').replaceAll(' ', '_')
  if (['receivable', 'customer_receivable', 'invoice'].includes(kind))
    return 'receivable'
  if (['payable', 'supplier_payable', 'bill'].includes(kind)) return 'payable'
  if (['provider_pending', 'pending_availability'].includes(kind))
    return 'provider_pending'
  if (['financing', 'loan'].includes(kind)) return 'financing'
  if (['operating', 'operating_payment', 'expense'].includes(kind))
    return 'operating'
  return ''
}

const parseBoolean = (value: string): boolean | null => {
  if (!value) return false
  if (['true', 'yes', '1', 'y'].includes(normalized(value))) return true
  if (['false', 'no', '0', 'n'].includes(normalized(value))) return false
  return null
}

function result(
  index: number,
  original: string[],
  reasons: string[],
  excluded: number[],
  title: string,
  details: string[],
  values: BulkReviewedRow['values'],
): BulkReviewedRow {
  return {
    index,
    original,
    status: excluded.includes(index)
      ? 'excluded'
      : reasons.length
        ? 'pending'
        : 'usable',
    reasons,
    title,
    details,
    values,
  }
}

export function reviewBulkRows(
  dataset: Exclude<ImportDataset, 'sales'>,
  file: ParsedFile,
  mapping: BulkColumnMapping,
  interpretation: Interpretation,
  workspace: Workspace,
  excluded: number[] = [],
): BulkReviewedRow[] {
  const sourceId = `src-${dataset}-${file.fingerprint}`
  const repeatedSource = workspace.sources.some((source) => source.id === sourceId)
  const batchScopes = new Set<string>()
  const batchPurchaseIds = new Set<string>()
  const batchProducts = new Map<string, { name: string; unit: string }>()
  const batchFinance = new Map<
    string,
    { kind: FinancialRecord['kind'] | ''; paidAmount: number | null }
  >()
  const batchFinanceIds = new Map<string, number>()

  if (dataset === 'finance') {
    file.rows.forEach((row, index) => {
      const reference = read(row, mapping, 'reference')
      const id = financeId(reference, file.fingerprint, index)
      batchFinance.set(id, {
        kind: normalizeFinanceKind(read(row, mapping, 'kind')),
        paidAmount: number(row, mapping, 'paidAmount'),
      })
      batchFinanceIds.set(id, (batchFinanceIds.get(id) ?? 0) + 1)
    })
  }

  return file.rows.map((row, index) => {
    const reasons: string[] = []
    if (row.length !== file.headers.length)
      reasons.push('Column count differs from the header. Correct this row.')
    if (repeatedSource)
      reasons.push('This file was already imported. It will not be added again.')

    if (dataset === 'inventory') {
      const sku = read(row, mapping, 'sku')
      const name = read(row, mapping, 'product')
      const unit = read(row, mapping, 'unit')
      const onHand = number(row, mapping, 'stockQuantity')
      const asOf = date(row, mapping, 'stockDate', interpretation.dateFormat)
      const rawDate = read(row, mapping, 'stockDate')
      const location = read(row, mapping, 'location')
      const basisValue = normalized(read(row, mapping, 'quantityBasis'))
      const quantityBasis = ['available', 'available-stock'].includes(basisValue)
        ? 'available'
        : ['on-hand', 'on hand', 'physical', ''].includes(basisValue)
          ? 'on-hand'
          : ''
      const reserved = number(row, mapping, 'reserved')
      const backordered = number(row, mapping, 'backordered')
      const unitCost = number(row, mapping, 'unitCost')
      const price = number(row, mapping, 'price')
      const targetStock = number(row, mapping, 'targetStock')
      const reorderPoint = number(row, mapping, 'reorderPoint')
      const safetyStock = number(row, mapping, 'safetyStock')
      const serviceTarget = number(row, mapping, 'serviceTarget')
      const serviceTargetBasis = read(row, mapping, 'serviceTargetBasis')
      if (!sku && !name) reasons.push('Provide a SKU or product name.')
      if (!unit) reasons.push('Provide the stock unit.')
      if (onHand === null || invalidNumber(onHand) || onHand < 0)
        reasons.push('Stock quantity must be a nonnegative number; zero is valid.')
      if (!asOf)
        reasons.push('Provide a usable stock date in the selected format.')
      else if (asOf > cutoff(workspace))
        reasons.push('Stock date must be current or historical.')
      if (!quantityBasis)
        reasons.push('Quantity basis must be on-hand or available.')
      if (quantityBasis === 'available' && reserved !== null)
        reasons.push('Available stock already deducts reservations; leave reserved quantity blank.')
      if ([reserved, backordered, unitCost, price, targetStock, reorderPoint, safetyStock].some(negative))
        reasons.push('Quantities, costs, prices and targets must be nonnegative numbers or blank.')
      if (serviceTarget !== null && (negative(serviceTarget) || serviceTarget > 100))
        reasons.push('Service target must be from 0 to 100, or blank.')
      if (
        serviceTargetBasis &&
        !['initial-unit-fill', 'daily-in-stock'].includes(serviceTargetBasis)
      )
        reasons.push('Service target basis must be initial-unit-fill or daily-in-stock.')
      const key = sku ? `sku:${sku}` : `name:${name}`
      const existing = workspace.products.find((product) =>
        sku ? product.sku === sku : product.id === productId('', name),
      )
      if (existing?.unit && unit && existing.unit !== unit)
        reasons.push(`Existing product uses ${existing.unit}. Review a unit conversion before importing.`)
      const prior = batchProducts.get(key)
      if (prior && (prior.unit !== unit || (name && prior.name && prior.name !== name)))
        reasons.push('The same product reference has conflicting names or units in this file.')
      else batchProducts.set(key, { name, unit })
      const scope = `${key}|${location}`
      if (batchScopes.has(scope))
        reasons.push('Keep one current stock snapshot per product and location in a file.')
      batchScopes.add(scope)
      const values = {
        sku,
        name,
        category: read(row, mapping, 'category'),
        brand: read(row, mapping, 'brand'),
        unit,
        onHand,
        quantityBasis,
        reserved,
        backordered,
        asOf: asOf ?? rawDate,
        location,
        unitCost,
        price,
        targetStock,
        reorderPoint,
        safetyStock,
        serviceTarget,
        serviceTargetBasis,
      }
      return result(
        index,
        row,
        reasons,
        excluded,
        name || sku || 'Unknown product',
        [
          `${onHand ?? 'Unknown'} ${unit || 'units'} · ${quantityBasis || 'unknown basis'}`,
          `${location || 'Aggregate business scope'} · ${(asOf ?? rawDate) || 'Unknown date'}`,
          `Cost ${unitCost ?? 'Unknown'} · price ${price ?? 'Unknown'} ${workspace.profile.currency}`,
        ],
        values,
      )
    }

    if (dataset === 'suppliers') {
      const supplier = read(row, mapping, 'supplier')
      const sku = read(row, mapping, 'sku')
      const name = read(row, mapping, 'product')
      const unit = read(row, mapping, 'unit')
      const leadTime = number(row, mapping, 'leadTime')
      const unitCost = number(row, mapping, 'unitCost')
      const moq = number(row, mapping, 'moq')
      const casePack = number(row, mapping, 'casePack')
      const reference = read(row, mapping, 'purchaseReference')
      const quantity = number(row, mapping, 'purchaseQuantity')
      const amount = number(row, mapping, 'purchaseAmount')
      const paidAmount = number(row, mapping, 'paidAmount')
      const orderDate = date(row, mapping, 'orderDate', interpretation.dateFormat)
      const rawOrderDate = read(row, mapping, 'orderDate')
      const promisedDate = date(row, mapping, 'promisedDate', interpretation.dateFormat)
      const rawPromisedDate = read(row, mapping, 'promisedDate')
      const receivedDate = date(row, mapping, 'receivedDate', interpretation.dateFormat)
      const rawReceivedDate = read(row, mapping, 'receivedDate')
      const paymentDate = date(row, mapping, 'paymentDate', interpretation.dateFormat)
      const rawPaymentDate = read(row, mapping, 'paymentDate')
      const receiptStatus = normalizeReceiptStatus(read(row, mapping, 'receiptStatus'))
      const receivedQuantity = number(row, mapping, 'receivedQuantity')
      const location = read(row, mapping, 'location')
      const hasTerms = [leadTime, unitCost, moq, casePack].some((value) => value !== null)
      const hasPurchase = quantity !== null || Boolean(reference || rawOrderDate)
      if (!supplier) reasons.push('Provide the supplier name.')
      if ((sku || name || hasTerms || hasPurchase) && (!sku && !name))
        reasons.push('Product terms or a purchase need a SKU or product name.')
      if ((sku || name) && !unit)
        reasons.push('Products in supplier rows need a unit.')
      if ([leadTime, unitCost, moq, casePack, amount, paidAmount, receivedQuantity].some(negative))
        reasons.push('Supplier terms and purchase amounts must be nonnegative numbers or blank.')
      if (leadTime !== null && (!Number.isFinite(leadTime) || !Number.isInteger(leadTime)))
        reasons.push('Lead time uses whole calendar days.')
      if ((moq !== null && moq <= 0) || (casePack !== null && casePack <= 0))
        reasons.push('Minimum order and case-pack quantities must be positive when supplied.')
      if (hasPurchase) {
        if (quantity === null || !Number.isFinite(quantity) || quantity <= 0)
          reasons.push('A purchase needs a positive purchase quantity.')
        if (!orderDate) reasons.push('A purchase needs a usable order date.')
        else if (orderDate > cutoff(workspace)) reasons.push('Order date must be current or historical.')
        if (!['received', 'not-received'].includes(receiptStatus))
          reasons.push('Receipt status must be received or not-received.')
        if (paidAmount === null) reasons.push('Confirm paid amount, including zero when unpaid.')
        if (amount !== null && paidAmount !== null && paidAmount > amount)
          reasons.push('Paid amount cannot exceed the purchase amount.')
        if (rawPromisedDate && !promisedDate) reasons.push('Promised receipt date is invalid.')
        if (rawPaymentDate && !paymentDate) reasons.push('Expected payment date is invalid.')
        if (receiptStatus === 'received') {
          if (
            receivedQuantity === null ||
            !Number.isFinite(receivedQuantity) ||
            receivedQuantity <= 0 ||
            (quantity !== null && receivedQuantity > quantity)
          )
            reasons.push('A received purchase needs a positive received quantity no greater than ordered.')
          if (!receivedDate) reasons.push('A received purchase needs a usable received date.')
          else if ((orderDate && receivedDate < orderDate) || receivedDate > cutoff(workspace))
            reasons.push('Received date must follow the order date and be current or historical.')
        } else if (rawReceivedDate || (receivedQuantity !== null && receivedQuantity !== 0))
          reasons.push('A not-received purchase cannot include a receipt date or received quantity.')
        const id = purchaseId(reference, file.fingerprint, index)
        if (batchPurchaseIds.has(id))
          reasons.push('Purchase references must be unique within the file.')
        batchPurchaseIds.add(id)
        if (workspace.purchases.some((purchase) => purchase.id === id))
          reasons.push('This purchase reference was already imported.')
      }
      const existing = workspace.products.find((product) =>
        sku ? product.sku === sku : product.id === productId('', name),
      )
      if (existing?.unit && unit && existing.unit !== unit)
        reasons.push(`Existing product uses ${existing.unit}. Review a unit conversion before importing.`)
      const values = {
        supplier,
        sku,
        name,
        category: read(row, mapping, 'category'),
        brand: read(row, mapping, 'brand'),
        unit,
        leadTime,
        unitCost,
        moq,
        casePack,
        reference,
        quantity,
        amount,
        paidAmount,
        orderDate: orderDate ?? rawOrderDate,
        promisedDate: promisedDate ?? rawPromisedDate,
        receiptStatus,
        receivedQuantity,
        receivedDate: receivedDate ?? rawReceivedDate,
        paymentDate: paymentDate ?? rawPaymentDate,
        location,
      }
      return result(
        index,
        row,
        reasons,
        excluded,
        supplier || 'Unknown supplier',
        [
          `${name || sku || 'Supplier-only row'} · lead time ${leadTime ?? 'Unknown'} days`,
          hasPurchase
            ? `Purchase ${reference || index + 1} · ${quantity ?? 'Unknown'} ${unit || 'units'} · ${amount ?? 'Unknown'} ${workspace.profile.currency}`
            : 'Supplier terms only; no purchase created',
          hasPurchase
            ? `${receiptStatus || 'Unknown receipt status'} · received ${receivedQuantity ?? 'Unknown'} · paid ${paidAmount ?? 'Unknown'}`
            : `Cost ${unitCost ?? 'Unknown'} · MOQ ${moq ?? 'Unknown'} · pack ${casePack ?? 'Unknown'}`,
        ],
        values,
      )
    }

    const reference = read(row, mapping, 'reference')
    const kind = normalizeFinanceKind(read(row, mapping, 'kind'))
    const name = read(row, mapping, 'name')
    const counterparty = read(row, mapping, 'counterparty')
    const amount = number(row, mapping, 'amount')
    const paidAmount = number(row, mapping, 'paidAmount')
    const currency = read(row, mapping, 'currency').toUpperCase() || interpretation.currency
    const dueDate = date(row, mapping, 'dueDate', interpretation.dateFormat)
    const rawDueDate = read(row, mapping, 'dueDate')
    const expectedDate = date(row, mapping, 'expectedDate', interpretation.dateFormat)
    const rawExpectedDate = read(row, mapping, 'expectedDate')
    const categoryValue = normalized(read(row, mapping, 'category'))
    const linkedReference = read(row, mapping, 'linkedReference')
    const cashIncluded = parseBoolean(read(row, mapping, 'cashIncluded'))
    const id = financeId(reference, file.fingerprint, index)
    const forcedCategory: Category | '' =
      kind === 'receivable' || kind === 'provider_pending'
        ? 'collections'
        : kind === 'payable'
          ? 'suppliers'
          : kind === 'financing'
            ? 'financing'
            : ''
    const category = forcedCategory || categoryValue
    if (!kind)
      reasons.push('Record type must be receivable, provider_pending, payable, financing or operating.')
    if (!name) reasons.push('Provide the record or invoice name.')
    if (!counterparty) reasons.push('Provide the customer, supplier or counterparty.')
    if (amount === null || negative(amount)) reasons.push('Original amount must be a nonnegative number.')
    if (paidAmount === null || negative(paidAmount))
      reasons.push('Confirm amount paid or collected, including zero.')
    if (amount !== null && paidAmount !== null && paidAmount > amount)
      reasons.push('Paid or collected amount cannot exceed the original amount.')
    if (currency !== workspace.profile.currency)
      reasons.push(`Working currency is ${workspace.profile.currency}. Currency conversion is not supported.`)
    if (rawDueDate && !dueDate) reasons.push('Due date is invalid.')
    if (rawExpectedDate && !expectedDate) reasons.push('Expected date is invalid.')
    if (kind === 'operating' && !['payroll', 'rent', 'taxes', 'other'].includes(category))
      reasons.push('Operating records need category payroll, rent, taxes or other.')
    if (cashIncluded === null)
      reasons.push('Included in cash balance must be true/false, yes/no or 1/0.')
    if (workspace.finance.some((record) => record.id === id))
      reasons.push('This financial reference was already imported.')
    if ((batchFinanceIds.get(id) ?? 0) > 1)
      reasons.push('Financial record references must be unique within the file.')
    let linkedRecordId: string | null = null
    if (linkedReference) {
      if (kind === 'payable') {
        const proposedId = purchaseId(linkedReference, '', 0)
        linkedRecordId = workspace.purchases.some((purchase) => purchase.id === proposedId)
          ? proposedId
          : workspace.purchases.some((purchase) => purchase.id === linkedReference)
            ? linkedReference
            : null
        if (!linkedRecordId)
          reasons.push('Linked purchase reference was not found. Import purchasing first or remove the link.')
      } else if (kind === 'provider_pending') {
        const proposedId = financeId(linkedReference, '', 0)
        const linked = workspace.finance.find((record) => record.id === proposedId) ??
          workspace.finance.find((record) => record.id === linkedReference)
        const batchLinked = batchFinance.get(proposedId)
        linkedRecordId = linked?.id ?? (batchLinked?.kind === 'receivable' ? proposedId : null)
        if (!linkedRecordId || (linked && linked.kind !== 'receivable'))
          reasons.push('Provider-pending funds must link to a customer receivable reference.')
        const collected = linked?.paidAmount ?? batchLinked?.paidAmount
        if (amount !== null && collected != null && amount > collected)
          reasons.push('Provider-pending amount cannot exceed the linked invoice collected amount.')
      } else reasons.push('Linked references apply only to payables and provider-pending records.')
    }
    const values = {
      reference,
      kind,
      name,
      counterparty,
      amount,
      paidAmount,
      currency,
      dueDate: dueDate ?? rawDueDate,
      expectedDate: expectedDate ?? rawExpectedDate,
      category,
      linkedRecordId,
      cashIncluded: cashIncluded ?? false,
    }
    return result(
      index,
      row,
      reasons,
      excluded,
      name || reference || 'Unknown financial record',
      [
        `${kind || 'Unknown type'} · ${counterparty || 'Unknown counterparty'}`,
        `${amount ?? 'Unknown'} original · ${paidAmount ?? 'Unknown'} paid/collected · ${currency}`,
        `Due ${(dueDate ?? rawDueDate) || 'Unknown'} · expected ${(expectedDate ?? rawExpectedDate) || 'Unscheduled'}`,
      ],
      values,
    )
  })
}

const text = (row: BulkReviewedRow, key: string) => String(row.values[key] ?? '')
const numeric = (row: BulkReviewedRow, key: string) => row.values[key] as number | null

function sourceReview(
  dataset: Exclude<ImportDataset, 'sales'>,
  file: ParsedFile,
  rows: BulkReviewedRow[],
  interpretation: Interpretation,
  mapping: BulkColumnMapping,
) {
  return {
    headers: file.headers,
    rows: file.rows,
    columnMapping: mapping,
    interpretation: {
      dataset,
      dateFormat: interpretation.dateFormat,
      currency: interpretation.currency,
    },
    acceptedRowIndexes: rows.filter((row) => row.status === 'usable').map((row) => row.index),
    excludedRowIndexes: rows.filter((row) => row.status === 'excluded').map((row) => row.index),
  }
}

export function applyBulkImport(
  workspace: Workspace,
  dataset: Exclude<ImportDataset, 'sales'>,
  file: ParsedFile,
  rows: BulkReviewedRow[],
  interpretation: Interpretation,
  sourceName: string,
  sourceType: 'csv' | 'xlsx',
  mapping: BulkColumnMapping,
): Workspace {
  const usable = rows.filter((row) => row.status === 'usable')
  if (!usable.length)
    throw new Error('No usable rows were selected. Correct the pending rows or continue later.')
  const sourceId = `src-${dataset}-${file.fingerprint}`
  let products = [...workspace.products]
  const locations = [...workspace.locations]
  let stock = [...workspace.stock]
  const suppliers = [...workspace.suppliers]
  const purchases = [...workspace.purchases]
  const finance = [...workspace.finance]

  const ensureLocation = (name: string) => {
    if (!name) return null
    let location = locations.find((item) => item.name === name)
    if (!location) {
      location = { id: locationId(name), name }
      locations.push(location)
    }
    return location
  }
  const ensureProduct = (row: BulkReviewedRow) => {
    const sku = text(row, 'sku')
    const name = text(row, 'name')
    let product = products.find((item) =>
      sku ? item.sku === sku : item.id === productId('', name),
    )
    if (!product) {
      product = {
        id: productId(sku, name),
        sku: sku || `INT-${stableId(name).toUpperCase()}`,
        name: name || sku,
        category: text(row, 'category'),
        brand: text(row, 'brand'),
        unit: text(row, 'unit'),
        cost: null,
        price: null,
        supplierId: null,
        leadTimeDays: null,
        moq: null,
        casePack: null,
        reorderPoint: null,
        safetyStock: null,
        serviceTarget: null,
      }
      products.push(product)
    }
    return product
  }

  for (const row of usable) {
    if (dataset === 'inventory') {
      const product = ensureProduct(row)
      const updated: Product = {
        ...product,
        name: text(row, 'name') || product.name,
        category: text(row, 'category') || product.category,
        brand: text(row, 'brand') || product.brand,
        cost: numeric(row, 'unitCost') ?? product.cost,
        price: numeric(row, 'price') ?? product.price,
        targetStock: numeric(row, 'targetStock') ?? product.targetStock,
        reorderPoint: numeric(row, 'reorderPoint') ?? product.reorderPoint,
        safetyStock: numeric(row, 'safetyStock') ?? product.safetyStock,
        serviceTarget: numeric(row, 'serviceTarget') ?? product.serviceTarget,
        serviceTargetBasis:
          (text(row, 'serviceTargetBasis') as Product['serviceTargetBasis']) ||
          product.serviceTargetBasis,
      }
      products = products.map((item) => (item.id === updated.id ? updated : item))
      const location = ensureLocation(text(row, 'location'))
      const stockLocationId = location?.id ?? null
      stock = stock.filter(
        (item) =>
          !(
            item.productId === updated.id &&
            item.locationId === stockLocationId
          ),
      )
      stock.push({
        id: `stock-${file.fingerprint}-${row.index}`,
        sourceId,
        productId: updated.id,
        locationId: stockLocationId,
        onHand: numeric(row, 'onHand')!,
        reserved:
          text(row, 'quantityBasis') === 'available'
            ? null
            : numeric(row, 'reserved'),
        backordered: numeric(row, 'backordered'),
        quantityBasis: text(row, 'quantityBasis') as 'on-hand' | 'available',
        asOf: text(row, 'asOf'),
      })
    } else if (dataset === 'suppliers') {
      const supplierName = text(row, 'supplier')
      let supplier = suppliers.find((item) => item.name === supplierName)
      if (!supplier) {
        supplier = { id: supplierId(supplierName), name: supplierName, active: true }
        suppliers.push(supplier)
      }
      const hasProduct = Boolean(text(row, 'sku') || text(row, 'name'))
      let product: Product | undefined
      if (hasProduct) {
        product = ensureProduct(row)
        const updated = {
          ...product,
          name: text(row, 'name') || product.name,
          category: text(row, 'category') || product.category,
          brand: text(row, 'brand') || product.brand,
          supplierId: supplier.id,
          leadTimeDays: numeric(row, 'leadTime') ?? product.leadTimeDays,
          cost: numeric(row, 'unitCost') ?? product.cost,
          moq: numeric(row, 'moq') ?? product.moq,
          casePack: numeric(row, 'casePack') ?? product.casePack,
        }
        products = products.map((item) => (item.id === updated.id ? updated : item))
        product = updated
      }
      const quantity = numeric(row, 'quantity')
      if (quantity !== null && product) {
        const reference = text(row, 'reference')
        const location = ensureLocation(text(row, 'location'))
        purchases.push({
          id: purchaseId(reference, file.fingerprint, row.index),
          sourceId,
          productId: product.id,
          supplierId: supplier.id,
          quantity,
          amount: numeric(row, 'amount'),
          paidAmount: numeric(row, 'paidAmount')!,
          orderDate: text(row, 'orderDate'),
          promisedDate: text(row, 'promisedDate') || null,
          receivedDate:
            text(row, 'receiptStatus') === 'received'
              ? text(row, 'receivedDate')
              : null,
          receivedQuantity:
            text(row, 'receiptStatus') === 'received'
              ? numeric(row, 'receivedQuantity')!
              : 0,
          plannedPaymentDate: text(row, 'paymentDate') || null,
          locationId: location?.id ?? null,
        })
      }
    } else {
      finance.push({
        id: financeId(text(row, 'reference'), file.fingerprint, row.index),
        sourceId,
        kind: text(row, 'kind') as FinancialRecord['kind'],
        name: text(row, 'name'),
        counterparty: text(row, 'counterparty'),
        amount: numeric(row, 'amount')!,
        paidAmount: numeric(row, 'paidAmount')!,
        currency: text(row, 'currency'),
        dueDate: text(row, 'dueDate') || null,
        expectedDate: text(row, 'expectedDate') || null,
        category: text(row, 'category') as Category,
        linkedRecordId: text(row, 'linkedRecordId') || null,
        cashIncluded: row.values.cashIncluded === true,
      })
    }
  }

  return {
    ...workspace,
    revision: workspace.revision + 1,
    products,
    locations,
    stock,
    suppliers,
    purchases,
    finance,
    sources: [
      ...workspace.sources,
      {
        id: sourceId,
        name: sourceName,
        type: sourceType,
        importedAt: new Date().toISOString(),
        rowCount: usable.length,
        excludedCount: rows.length - usable.length,
        review: sourceReview(dataset, file, rows, interpretation, mapping),
      },
    ],
  }
}
