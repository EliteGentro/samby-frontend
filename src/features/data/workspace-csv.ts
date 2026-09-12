import type { Workspace } from '../../domain/workspace'

export const importCsvHeaders = {
  sales: [
    'Date',
    'SKU',
    'Product',
    'Quantity',
    'Unit',
    'Amount',
    'Currency',
    'Location',
    'Reference',
    'Kind',
    'Historical unit cost',
  ],
  inventory: [
    'SKU / product reference',
    'Product name',
    'Category',
    'Brand',
    'Unit',
    'Stock quantity',
    'Quantity basis',
    'Reserved quantity',
    'Backordered quantity',
    'Stock date',
    'Location',
    'Unit cost',
    'Selling price',
    'Target stock',
    'Reorder point',
    'Safety stock',
    'Service target %',
    'Service target basis',
  ],
  suppliers: [
    'Supplier name',
    'SKU / product reference',
    'Product name',
    'Category',
    'Brand',
    'Unit',
    'Lead time days',
    'Unit cost',
    'Minimum order quantity',
    'Units per case / pack',
    'Purchase reference',
    'Purchase quantity',
    'Purchase amount',
    'Paid amount',
    'Order date',
    'Promised receipt date',
    'Receipt status',
    'Received quantity',
    'Received date',
    'Expected payment date',
    'Receipt location',
  ],
  finance: [
    'Record reference',
    'Record type',
    'Record / invoice name',
    'Counterparty',
    'Original amount',
    'Amount paid / collected',
    'Currency',
    'Due date',
    'Expected availability / payment date',
    'Category',
    'Linked record reference',
    'Included in cash balance',
  ],
} as const

const value = (input: string | number | boolean | null | undefined) =>
  input == null ? '' : String(input)

export function encodeCsv(rows: (string | number | boolean | null | undefined)[][]) {
  return `${rows
    .map((row) =>
      row
        .map((cell) => {
          const text = value(cell)
          return /[",\n\r]|^\s|\s$/.test(text)
            ? `"${text.replaceAll('"', '""')}"`
            : text
        })
        .join(','),
    )
    .join('\n')}\n`
}

/**
 * Projects an existing workspace into the four reviewed import schemas.
 * It does not synthesize business facts; blank fields remain blank.
 */
export function workspaceToImportCsv(workspace: Workspace) {
  const products = new Map(workspace.products.map((product) => [product.id, product]))
  const locations = new Map(
    workspace.locations.map((location) => [location.id, location.name]),
  )
  const suppliers = new Map(
    workspace.suppliers.map((supplier) => [supplier.id, supplier]),
  )

  const sales = encodeCsv([
    [...importCsvHeaders.sales],
    ...workspace.sales.map((sale) => {
      const product = sale.productId ? products.get(sale.productId) : undefined
      return [
        sale.date,
        product?.sku,
        product?.name,
        sale.quantity,
        sale.unit,
        sale.amount,
        sale.currency,
        sale.locationId ? locations.get(sale.locationId) : '',
        sale.sourceReference,
        sale.kind,
        sale.unitCost,
      ]
    }),
  ])

  const inventory = encodeCsv([
    [...importCsvHeaders.inventory],
    ...workspace.stock.map((position) => {
      const product = products.get(position.productId)
      return [
        product?.sku,
        product?.name,
        product?.category,
        product?.brand,
        product?.unit,
        position.onHand,
        position.quantityBasis ?? 'on-hand',
        position.reserved,
        position.backordered,
        position.asOf,
        position.locationId ? locations.get(position.locationId) : '',
        product?.cost,
        product?.price,
        product?.targetStock,
        product?.reorderPoint,
        product?.safetyStock,
        product?.serviceTarget,
        product?.serviceTargetBasis,
      ]
    }),
  ])

  const purchasesByProduct = new Set(
    workspace.purchases.map((purchase) => purchase.productId),
  )
  const representedSuppliers = new Set(
    workspace.products
      .map((product) => product.supplierId)
      .filter((id): id is string => Boolean(id)),
  )
  const supplierRows: (string | number | boolean | null | undefined)[][] = [
    ...workspace.purchases.map((purchase) => {
      const product = products.get(purchase.productId)
      const supplier = suppliers.get(purchase.supplierId)
      return [
        supplier?.name,
        product?.sku,
        product?.name,
        product?.category,
        product?.brand,
        product?.unit,
        product?.leadTimeDays,
        product?.cost,
        product?.moq,
        product?.casePack,
        purchase.id,
        purchase.quantity,
        purchase.amount,
        purchase.paidAmount,
        purchase.orderDate,
        purchase.promisedDate,
        purchase.receivedDate ? 'received' : 'not-received',
        purchase.receivedQuantity,
        purchase.receivedDate,
        purchase.plannedPaymentDate,
        purchase.locationId ? locations.get(purchase.locationId) : '',
      ]
    }),
    ...workspace.products
      .filter(
        (product) => product.supplierId && !purchasesByProduct.has(product.id),
      )
      .map((product) => [
        suppliers.get(product.supplierId!)?.name,
        product.sku,
        product.name,
        product.category,
        product.brand,
        product.unit,
        product.leadTimeDays,
        product.cost,
        product.moq,
        product.casePack,
      ]),
    ...workspace.suppliers
      .filter((supplier) => !representedSuppliers.has(supplier.id))
      .map((supplier) => [supplier.name]),
  ]
  const purchasing = encodeCsv([
    [...importCsvHeaders.suppliers],
    ...supplierRows,
  ])

  const finance = encodeCsv([
    [...importCsvHeaders.finance],
    ...workspace.finance.map((record) => [
      record.id,
      record.kind,
      record.name,
      record.counterparty,
      record.amount,
      record.paidAmount,
      record.currency,
      record.dueDate,
      record.expectedDate,
      record.category,
      record.linkedRecordId,
      record.cashIncluded,
    ]),
  ])

  return {
    '01-inventory-costs.csv': inventory,
    '02-sales.csv': sales,
    '03-purchasing-suppliers.csv': purchasing,
    '04-finance-collections.csv': finance,
  }
}
