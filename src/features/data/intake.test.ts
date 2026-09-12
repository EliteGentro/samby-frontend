import { describe, expect, it } from 'vitest'
import { emptyWorkspace } from '../../domain/workspace'
import {
  applyReviewedSales,
  guessMapping,
  parseCsv,
  parseDate,
  reviewRows,
  type Interpretation,
} from './intake'

const interpretation: Interpretation = {
  dateFormat: 'iso',
  unit: '',
  currency: 'MXN',
  amountBasis: 'Net excluding tax, after discounts; returns separate',
  rowMeaning: 'transaction',
  duplicatesReviewed: false,
}
const business = () => emptyWorkspace('business-test')

describe('CSV sales intake', () => {
  it('reads quoted commas, escaped quotes and multiline names without changing source values', () => {
    const file = parseCsv(
      'Date,SKU,Product,Quantity,Unit,Amount\r\n2026-08-10,P1,"Tape, ""wide""\nblue",0,pieces,0\r\n',
    )
    expect(file.headers).toEqual([
      'Date',
      'SKU',
      'Product',
      'Quantity',
      'Unit',
      'Amount',
    ])
    expect(file.rows).toEqual([
      ['2026-08-10', 'P1', 'Tape, "wide"\nblue', '0', 'pieces', '0'],
    ])
    const reviewed = reviewRows(
      file,
      guessMapping(file.headers),
      interpretation,
      business(),
    )
    expect(reviewed[0]).toMatchObject({
      status: 'usable',
      quantity: 0,
      amount: 0,
    })
  })

  it('detects a semicolon delimiter outside quoted headers', () => {
    const file = parseCsv(
      'Date;"Product, commercial name";Amount\n2026-08-10;Tape;100',
    )
    expect(file.headers).toEqual(['Date', 'Product, commercial name', 'Amount'])
    expect(file.rows[0]).toEqual(['2026-08-10', 'Tape', '100'])
  })

  it('rejects unclosed quotes and files without rows', () => {
    expect(() => parseCsv('Date,SKU\n2026-08-10,"P1')).toThrow('not closed')
    expect(() => parseCsv('Date,SKU')).toThrow('no data rows')
  })

  it('applies only the confirmed usable subset and does not invent missing quantities', () => {
    const file = parseCsv(
      'Date,Amount\n2026-08-10,125\nnot-a-date,250\n2026-08-12,0\n2026-08-13,900',
    )
    const workspace = business()
    const reviewed = reviewRows(
      file,
      guessMapping(file.headers),
      interpretation,
      workspace,
      [3],
    )
    expect(reviewed.map((row) => row.status)).toEqual([
      'usable',
      'pending',
      'usable',
      'excluded',
    ])
    const applied = applyReviewedSales(
      workspace,
      file,
      reviewed,
      interpretation,
      'sales.csv',
      'csv',
    )
    expect(
      applied.sales.map((sale) => ({
        amount: sale.amount,
        quantity: sale.quantity,
        productId: sale.productId,
      })),
    ).toEqual([
      { amount: 125, quantity: null, productId: null },
      { amount: 0, quantity: null, productId: null },
    ])
    expect(applied.products).toEqual([])
    expect(applied.sources[0]).toMatchObject({
      name: 'sales.csv',
      type: 'csv',
      rowCount: 2,
      excludedCount: 2,
    })
    expect(workspace.sales).toEqual([])
  })

  it('detects identical reimports and keeps confirmed record identifiers stable', () => {
    const file = parseCsv(
      'Date,SKU,Quantity,Unit,Invoice\n2026-08-10,P1,4,pieces,INV-12',
    )
    const firstReview = reviewRows(
      file,
      guessMapping(file.headers),
      interpretation,
      business(),
    )
    const workspace = applyReviewedSales(
      business(),
      file,
      firstReview,
      interpretation,
      'first.csv',
      'csv',
    )
    const repeatedReview = reviewRows(
      parseCsv('Date,SKU,Quantity,Unit,Invoice\n2026-08-10,P1,4,pieces,INV-12'),
      guessMapping(file.headers),
      interpretation,
      workspace,
    )
    expect(repeatedReview[0].status).toBe('excluded')
    expect(repeatedReview[0].reasons).toContain(
      'This row was already imported. It will not be added again.',
    )
    expect(workspace.sales[0].sourceReference).toBe('INV-12')
    expect(() =>
      applyReviewedSales(
        workspace,
        file,
        repeatedReview,
        interpretation,
        'second.csv',
        'csv',
      ),
    ).toThrow('No usable rows')
  })

  it('keeps incompatible units and ambiguous product identity pending', () => {
    const file = parseCsv(
      'Date,SKU,Product,Quantity,Unit\n2026-08-10,P1,Tape,4,pieces\n2026-08-11,P1,Tape,2,boxes\n2026-08-12,P1,Paper,3,pieces',
    )
    const reviewed = reviewRows(
      file,
      guessMapping(file.headers),
      interpretation,
      business(),
    )
    expect(reviewed.map((row) => row.status)).toEqual([
      'usable',
      'pending',
      'pending',
    ])
    expect(reviewed[1].reasons.join(' ')).toContain('conversion')
    expect(reviewed[2].reasons.join(' ')).toContain('another product name')
  })

  it('keeps returns distinct and never treats an order as a sale', () => {
    const file = parseCsv(
      'Date,SKU,Quantity,Unit,Kind\n2026-08-10,P1,2,pieces,return\n2026-08-10,P1,3,pieces,pending order',
    )
    const reviewed = reviewRows(
      file,
      guessMapping(file.headers),
      interpretation,
      business(),
    )
    const applied = applyReviewedSales(
      business(),
      file,
      reviewed,
      interpretation,
      'sales.csv',
      'csv',
    )
    expect(applied.sales).toHaveLength(1)
    expect(applied.sales[0]).toMatchObject({ kind: 'return', quantity: 2 })
    expect(reviewed[1].status).toBe('pending')
  })

  it('does not accept unconfirmed amount meaning or incompatible currency', () => {
    const file = parseCsv('Date,Amount,Currency\n2026-08-10,15,USD')
    const reviewed = reviewRows(
      file,
      guessMapping(file.headers),
      { ...interpretation, amountBasis: '' },
      business(),
    )
    expect(reviewed[0].status).toBe('pending')
    expect(reviewed[0].reasons).toEqual([
      'Confirm whether amounts include tax, discounts and returns.',
      'Working currency is MXN. Currency conversion is not supported.',
    ])
  })
})

describe('explicit date interpretation', () => {
  it('uses the selected format without guessing ambiguous dates', () => {
    expect(parseDate('02/03/2026', 'dmy')).toBe('2026-03-02')
    expect(parseDate('02/03/2026', 'mdy')).toBe('2026-02-03')
    expect(parseDate('2026-02-30', 'iso')).toBeNull()
    expect(parseDate('2026-02-28', 'iso')).toBe('2026-02-28')
  })
})

it.each(['Reference', 'Order reference', 'Invoice reference'])(
  'preserves a %s column through confirmed import',
  (header) => {
    const workspace = business()
    const file = parseCsv(
      `Date,Amount,Currency,${header}\n2025-01-03,725,MXN,INV-HISTORY`,
    )
    const mapping = guessMapping(file.headers)
    const reviewed = reviewRows(file, mapping, interpretation, workspace)
    const applied = applyReviewedSales(
      workspace,
      file,
      reviewed,
      interpretation,
      'sales.csv',
      'csv',
      mapping,
    )
    expect(applied.sales).toHaveLength(1)
    expect(applied.sales[0]).toMatchObject({
      amount: 725,
      sourceReference: 'INV-HISTORY',
      productId: null,
    })
  },
)
