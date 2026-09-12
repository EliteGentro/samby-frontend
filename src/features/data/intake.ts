import {
  today,
  type Product,
  type Sale,
  type Workspace,
} from '../../domain/workspace'

export type ImportField =
  | 'date'
  | 'sku'
  | 'product'
  | 'quantity'
  | 'unit'
  | 'amount'
  | 'currency'
  | 'location'
  | 'reference'
  | 'kind'
  | 'unitCost'
export type ColumnMapping = Record<ImportField, number | null>
export type Interpretation = {
  dateFormat: 'iso' | 'dmy' | 'mdy'
  unit: string
  currency: string
  amountBasis: string
  rowMeaning: 'transaction' | 'daily' | 'invoice-total'
  duplicatesReviewed: boolean
}
export type ParsedFile = {
  headers: string[]
  rows: string[][]
  fingerprint: string
}
export type ReviewedRow = {
  index: number
  original: string[]
  status: 'usable' | 'pending' | 'excluded'
  reasons: string[]
  date: string
  sku: string
  name: string
  quantity: number | null
  unit: string
  amount: number | null
  currency: string
  location: string
  reference: string
  kind: 'sale' | 'return'
  unitCost: number | null
}

export const importFields: {
  key: ImportField
  label: string
  help: string
}[] = [
  {
    key: 'date',
    label: 'Sale date',
    help: 'Required. The recorded sale or return date. Use YYYY-MM-DD for manual entry; confirm the format for imports. Missing dates do not become zero-sales days.',
  },
  {
    key: 'sku',
    label: 'SKU / product reference',
    help: 'Optional if a product name is supplied. Your original product reference identifies the item; similar names are never merged.',
  },
  {
    key: 'product',
    label: 'Product name',
    help: 'Optional for aggregate amounts. A name without an SKU proposes an internal reference for your confirmation.',
  },
  {
    key: 'quantity',
    label: 'Quantity sold',
    help: 'Optional when an amount is known. Recorded quantity in the stated unit; use decimal points. Blank stays unknown and zero stays recorded.',
  },
  {
    key: 'unit',
    label: 'Unit',
    help: 'Required for quantities. Use a comparable unit for each product, such as pieces or kilograms. Units are not converted automatically.',
  },
  {
    key: 'amount',
    label: 'Sale amount',
    help: 'Optional when product quantity is known. Total amount for this row, not the unit price. Confirm tax, discounts and return treatment below.',
  },
  {
    key: 'currency',
    label: 'Currency',
    help: 'Optional if it matches the working currency. All amounts must use that currency; no conversion is assumed.',
  },
  {
    key: 'location',
    label: 'Location',
    help: 'Optional. The branch, warehouse or sales location. Blank retains aggregate scope without an invented location split.',
  },
  {
    key: 'reference',
    label: 'Order / invoice reference',
    help: 'Optional. Original order or invoice reference used to distinguish records and review repeated invoice totals.',
  },
  {
    key: 'kind',
    label: 'Sale / return',
    help: 'Sale by default. Mark returns explicitly; use nonnegative quantities and amounts. Returns remain separate from sales.',
  },
  {
    key: 'unitCost',
    label: 'Historical cost per sold unit',
    help: 'Optional. Historical cost for one sold unit on that date, in the working currency. Required for a supported historical margin.',
  },
]

export function stableId(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1)
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return (hash >>> 0).toString(36)
}

export function parseCsv(text: string): ParsedFile {
  const input = text.replace(/^\uFEFF/, '')
  if (!input.trim())
    throw new Error(
      'This file is empty. Add a header row and at least one data row.',
    )
  const delimiters = [',', ';', '\t']
  const counts = [0, 0, 0]
  let headerQuoted = false
  for (let i = 0; i < input.length; i += 1) {
    if (input[i] === '"' && headerQuoted && input[i + 1] === '"') {
      i += 1
      continue
    }
    if (input[i] === '"') headerQuoted = !headerQuoted
    if (!headerQuoted && ['\n', '\r'].includes(input[i])) break
    if (!headerQuoted) {
      const index = delimiters.indexOf(input[i])
      if (index >= 0) counts[index] += 1
    }
  }
  const delimiter = delimiters[counts.indexOf(Math.max(...counts))]
  const rows: string[][] = []
  let row: string[] = [],
    cell = '',
    quoted = false,
    afterQuote = false
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
        afterQuote = true
      } else cell += char
    } else if (char === '"' && cell.length === 0) quoted = true
    else if (char === delimiter) {
      row.push(cell)
      cell = ''
      afterQuote = false
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1
      row.push(cell)
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
      cell = ''
      afterQuote = false
    } else if (afterQuote && char.trim())
      throw new Error(
        `Unexpected text after a quoted cell near character ${i + 1}. Correct the CSV and try again.`,
      )
    else if (!afterQuote) cell += char
  }
  if (quoted)
    throw new Error(
      'A quoted cell is not closed. Correct the CSV before importing it.',
    )
  row.push(cell)
  if (row.some((value) => value.trim() !== '')) rows.push(row)
  if (rows.length < 2) throw new Error('The file has headers but no data rows.')
  if (rows.length > 10001)
    throw new Error(
      'This prototype accepts up to 10,000 rows per file. Split the file and try again.',
    )
  const headers = rows[0].map(
    (value, index) => value.trim() || `Column ${index + 1}`,
  )
  return {
    headers,
    rows: rows.slice(1),
    fingerprint: stableId(JSON.stringify(rows)),
  }
}

export function guessMapping(headers: string[]): ColumnMapping {
  const aliases: Record<ImportField, string[]> = {
    date: ['date', 'sale date', 'fecha', 'fecha de venta'],
    sku: ['sku', 'product id', 'product_id', 'codigo', 'código', 'referencia'],
    product: ['product', 'product name', 'producto', 'nombre'],
    quantity: ['quantity', 'qty', 'cantidad', 'unidades'],
    unit: ['unit', 'unidad', 'uom'],
    amount: ['amount', 'total', 'sale amount', 'importe', 'venta'],
    currency: ['currency', 'moneda'],
    location: ['location', 'warehouse', 'ubicacion', 'sucursal'],
    reference: [
      'reference',
      'order reference',
      'invoice reference',
      'invoice',
      'invoice id',
      'order',
      'order id',
      'factura',
      'pedido',
    ],
    kind: ['kind', 'type', 'tipo'],
    unitCost: [
      'unit cost',
      'unitcost',
      'historical unit cost',
      'costo unitario',
      'cost per unit',
    ],
  }
  return Object.fromEntries(
    importFields.map(({ key }) => {
      const index = headers.findIndex((header) =>
        aliases[key].includes(header.toLowerCase().trim()),
      )
      return [key, index < 0 ? null : index]
    }),
  ) as ColumnMapping
}

export function parseDate(
  value: string,
  format: Interpretation['dateFormat'],
): string | null {
  const parts = value.trim().split(format === 'iso' ? '-' : '/')
  if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part)))
    return null
  const [year, month, day] =
    format === 'iso'
      ? parts.map(Number)
      : format === 'dmy'
        ? [Number(parts[2]), Number(parts[1]), Number(parts[0])]
        : [Number(parts[2]), Number(parts[0]), Number(parts[1])]
  if (
    year < 1900 ||
    year > 2200 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    return null
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return new Date(`${iso}T12:00:00Z`).toISOString().slice(0, 10) === iso
    ? iso
    : null
}

export function optionalNumber(value: string): number | null {
  if (!value.trim()) return null
  if (!/^-?\d+(\.\d+)?$/.test(value.trim())) return Number.NaN
  const number = Number(value)
  return Number.isFinite(number) ? number : Number.NaN
}

export function reviewRows(
  file: ParsedFile,
  mapping: ColumnMapping,
  interpretation: Interpretation,
  workspace: Workspace,
  excluded: number[] = [],
): ReviewedRow[] {
  const read = (row: string[], field: ImportField) =>
    mapping[field] === null ? '' : (row[mapping[field]!] ?? '').trim()
  const existingRefs = new Set(workspace.sales.map((s) => s.id))
  const batchUnits = new Map<string, string>()
  const batchNames = new Map<string, string>()
  return file.rows.map((row, index) => {
    const reasons: string[] = []
    const date = parseDate(read(row, 'date'), interpretation.dateFormat)
    const sku = read(row, 'sku'),
      name = read(row, 'product'),
      unit = read(row, 'unit') || interpretation.unit
    const currency =
      read(row, 'currency').toUpperCase() || interpretation.currency
    const quantity = optionalNumber(read(row, 'quantity')),
      amount = optionalNumber(read(row, 'amount')),
      unitCost = optionalNumber(read(row, 'unitCost'))
    const kindValue = read(row, 'kind').toLowerCase()
    const kind = ['return', 'devolución', 'devolucion'].includes(kindValue)
      ? 'return'
      : 'sale'
    if (row.length !== file.headers.length)
      reasons.push('Column count differs from the header. Correct this row.')
    if (!date) reasons.push('A usable date in the selected format is required.')
    if (date && date > today())
      reasons.push('Future orders belong in a scenario, not sales history.')
    if (quantity === null && amount === null)
      reasons.push('Provide quantity or a sale amount.')
    if (
      unitCost !== null &&
      (!Number.isFinite(unitCost) || unitCost < 0 || quantity === null || !unit)
    )
      reasons.push(
        'Historical unit cost must be nonnegative and match a supplied quantity/unit.',
      )
    if (Number.isNaN(quantity) || Number.isNaN(amount))
      reasons.push(
        'Use numbers with a decimal point and no thousands separator.',
      )
    if (quantity !== null && !sku && !name)
      reasons.push('Unit quantities need a product reference or name.')
    if (quantity !== null && !unit)
      reasons.push('Confirm the unit for quantities.')
    if (amount !== null && !interpretation.amountBasis.trim())
      reasons.push(
        'Confirm whether amounts include tax, discounts and returns.',
      )
    if (amount !== null && currency !== workspace.profile.currency)
      reasons.push(
        `Working currency is ${workspace.profile.currency}. Currency conversion is not supported.`,
      )
    if (
      kindValue &&
      !['sale', 'venta', 'return', 'devolución', 'devolucion'].includes(
        kindValue,
      )
    )
      reasons.push(
        'Only completed sales and identified returns are supported. Orders/cancellations stay pending.',
      )
    if ((quantity !== null && quantity < 0) || (amount !== null && amount < 0))
      reasons.push(
        'Keep negative adjustments pending. Enter returns as positive amounts with type Return.',
      )
    const product = workspace.products.find((p) =>
      sku ? p.sku === sku : p.id === `p-name-${stableId(name)}`,
    )
    if (product && product.unit && unit && product.unit !== unit)
      reasons.push(
        `Existing product uses ${product.unit}. Unit conversions require a separate confirmed basis.`,
      )
    const productKey = sku ? `sku-${sku}` : name ? `name-${name}` : ''
    if (productKey && unit) {
      const priorUnit = batchUnits.get(productKey)
      if (priorUnit && priorUnit !== unit)
        reasons.push(
          `The same product uses ${priorUnit} elsewhere in this batch. Confirm a conversion before combining units.`,
        )
      else batchUnits.set(productKey, unit)
    }
    if (sku && name) {
      const priorName = batchNames.get(sku) ?? product?.name
      if (priorName && priorName !== name)
        reasons.push(
          'This SKU has another product name. Review the identity before combining its records.',
        )
      else batchNames.set(sku, name)
    }
    if (
      interpretation.rowMeaning === 'invoice-total' &&
      !interpretation.duplicatesReviewed
    )
      reasons.push(
        'Confirm repeated invoice totals have been excluded before monetary aggregation.',
      )
    if (existingRefs.has(`sale-${file.fingerprint}-${index}`))
      reasons.push('This row was already imported. It will not be added again.')
    return {
      index,
      original: row,
      status:
        excluded.includes(index) ||
        reasons.some((reason) => reason.startsWith('This row was already'))
          ? 'excluded'
          : reasons.length
            ? 'pending'
            : 'usable',
      reasons,
      date: date ?? read(row, 'date'),
      sku,
      name,
      quantity,
      unit,
      amount,
      currency,
      location: read(row, 'location'),
      reference: read(row, 'reference'),
      kind,
      unitCost,
    }
  })
}

export function applyReviewedSales(
  workspace: Workspace,
  file: ParsedFile,
  rows: ReviewedRow[],
  interpretation: Interpretation,
  sourceName: string,
  sourceType: 'manual' | 'csv' | 'xlsx',
  mapping?: ColumnMapping,
): Workspace {
  const usable = rows.filter((row) => row.status === 'usable')
  if (usable.length === 0)
    throw new Error(
      'No usable rows were selected. Correct the pending rows or continue later.',
    )
  const products = [...workspace.products],
    locations = [...workspace.locations],
    sales = [...workspace.sales]
  for (const row of usable) {
    const id = `sale-${file.fingerprint}-${row.index}`
    if (sales.some((sale) => sale.id === id)) continue
    let product: Product | undefined
    if (row.sku || row.name) {
      product = products.find((p) =>
        row.sku ? p.sku === row.sku : p.id === `p-name-${stableId(row.name)}`,
      )
      if (!product) {
        product = {
          id: row.sku
            ? `p-sku-${stableId(row.sku)}`
            : `p-name-${stableId(row.name)}`,
          sku: row.sku || `INT-${stableId(row.name).toUpperCase()}`,
          name: row.name || row.sku,
          category: '',
          unit: row.unit,
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
    }
    let location = locations.find((item) => item.name === row.location)
    if (row.location && !location) {
      location = { id: `loc-${stableId(row.location)}`, name: row.location }
      locations.push(location)
    }
    const sale: Sale = {
      id,
      date: row.date,
      productId: product?.id ?? null,
      quantity: row.quantity,
      amount: row.amount,
      unit: row.unit,
      currency: row.currency,
      locationId: location?.id ?? null,
      sourceId: `src-${file.fingerprint}`,
      kind: row.kind,
      unitCost: row.unitCost,
      costUnit: row.unitCost === null ? undefined : row.unit,
      amountBasis: interpretation.amountBasis,
      ...(row.reference ? { sourceReference: row.reference } : {}),
    }
    sales.push(sale)
  }
  return {
    ...workspace,
    revision: workspace.revision + 1,
    products,
    locations,
    sales,
    sources: [
      ...workspace.sources.filter(
        (source) => source.id !== `src-${file.fingerprint}`,
      ),
      {
        id: `src-${file.fingerprint}`,
        name: sourceName,
        type: sourceType,
        importedAt: new Date().toISOString(),
        rowCount: sales.filter(
          (sale) => sale.sourceId === `src-${file.fingerprint}`,
        ).length,
        excludedCount: Math.max(
          0,
          rows.length -
            sales.filter((sale) => sale.sourceId === `src-${file.fingerprint}`)
              .length,
        ),
        review: {
          headers: file.headers,
          rows: file.rows,
          columnMapping: mapping ?? guessMapping(file.headers),
          interpretation: { ...interpretation },
          acceptedRowIndexes: rows
            .filter((row) =>
              sales.some(
                (sale) => sale.id === `sale-${file.fingerprint}-${row.index}`,
              ),
            )
            .map((row) => row.index),
          excludedRowIndexes: rows
            .filter(
              (row) =>
                row.status === 'excluded' &&
                !sales.some(
                  (sale) => sale.id === `sale-${file.fingerprint}-${row.index}`,
                ),
            )
            .map((row) => row.index),
        },
      },
    ],
  }
}
