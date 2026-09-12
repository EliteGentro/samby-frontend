import { describe, expect, it } from 'vitest'
import { emptyWorkspace } from '../../domain/workspace'
import { standardizationProposals } from '../../domain/standardization'
import { parseCsv, type Interpretation } from './intake'
import {
  applyBulkImport,
  guessBulkMapping,
  reviewBulkRows,
} from './bulk-intake'

const interpretation: Interpretation = {
  dateFormat: 'iso',
  unit: '',
  currency: 'MXN',
  amountBasis: '',
  rowMeaning: 'transaction',
  duplicatesReviewed: false,
}

describe('category CSV intake', () => {
  it('imports products, costs and scoped stock without normalizing the source SKU', () => {
    const file = parseCsv(
      'SKU / product reference,Product name,Unit,Stock quantity,Quantity basis,Reserved quantity,Stock date,Location,Unit cost,Selling price\ncoffee_500,Coffee 500 g,pieces,20,on-hand,2,2026-08-10,Main,75,120',
    )
    const mapping = guessBulkMapping('inventory', file.headers)
    const reviewed = reviewBulkRows(
      'inventory',
      file,
      mapping,
      interpretation,
      emptyWorkspace('inventory-import'),
    )
    expect(reviewed[0].status).toBe('usable')
    const applied = applyBulkImport(
      emptyWorkspace('inventory-import'),
      'inventory',
      file,
      reviewed,
      interpretation,
      'inventory.csv',
      'csv',
      mapping,
    )
    expect(applied.products[0]).toMatchObject({
      sku: 'coffee_500',
      cost: 75,
      price: 120,
    })
    expect(applied.stock[0]).toMatchObject({
      onHand: 20,
      reserved: 2,
      quantityBasis: 'on-hand',
      sourceId: applied.sources[0].id,
    })
    expect(standardizationProposals(applied)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'sku',
          oldValue: 'coffee_500',
          value: 'COFFEE-500',
        }),
      ]),
    )
  })

  it('keeps a purchase and its linked payable as separate records', () => {
    const inventoryFile = parseCsv(
      'SKU / product reference,Product name,Unit,Stock quantity,Stock date\nP-1,Product one,pieces,10,2026-08-10',
    )
    const inventoryMapping = guessBulkMapping('inventory', inventoryFile.headers)
    const inventoryReview = reviewBulkRows(
      'inventory',
      inventoryFile,
      inventoryMapping,
      interpretation,
      emptyWorkspace('linked-import'),
    )
    let workspace = applyBulkImport(
      emptyWorkspace('linked-import'),
      'inventory',
      inventoryFile,
      inventoryReview,
      interpretation,
      'inventory.csv',
      'csv',
      inventoryMapping,
    )

    const purchaseFile = parseCsv(
      'Supplier name,SKU / product reference,Product name,Unit,Purchase reference,Purchase quantity,Purchase amount,Paid amount,Order date,Receipt status,Received quantity\nSupplier one,P-1,Product one,pieces,PO-1,25,1000,0,2026-08-11,not-received,0',
    )
    const purchaseMapping = guessBulkMapping('suppliers', purchaseFile.headers)
    const purchaseReview = reviewBulkRows(
      'suppliers',
      purchaseFile,
      purchaseMapping,
      interpretation,
      workspace,
    )
    expect(purchaseReview[0].status).toBe('usable')
    workspace = applyBulkImport(
      workspace,
      'suppliers',
      purchaseFile,
      purchaseReview,
      interpretation,
      'purchases.csv',
      'csv',
      purchaseMapping,
    )

    const financeFile = parseCsv(
      'Record reference,Record type,Record / invoice name,Counterparty,Original amount,Amount paid / collected,Currency,Due date,Linked record reference,Included in cash balance\nBILL-1,payable,Supplier invoice,Supplier one,1000,0,MXN,2026-09-01,PO-1,false',
    )
    const financeMapping = guessBulkMapping('finance', financeFile.headers)
    const financeReview = reviewBulkRows(
      'finance',
      financeFile,
      financeMapping,
      interpretation,
      workspace,
    )
    expect(financeReview[0].status).toBe('usable')
    workspace = applyBulkImport(
      workspace,
      'finance',
      financeFile,
      financeReview,
      interpretation,
      'finance.csv',
      'csv',
      financeMapping,
    )
    expect(workspace.purchases).toHaveLength(1)
    expect(workspace.finance[0]).toMatchObject({
      kind: 'payable',
      linkedRecordId: workspace.purchases[0].id,
    })
    expect(workspace.sources.at(-1)?.review?.interpretation).toMatchObject({
      dataset: 'finance',
    })
  })

  it('retains invalid rows for review and imports only the usable subset', () => {
    const file = parseCsv(
      'Record reference,Record type,Record / invoice name,Counterparty,Original amount,Amount paid / collected,Currency\nINV-1,receivable,Invoice one,Customer,500,100,MXN\nINV-2,receivable,Invoice two,Customer,500,600,MXN',
    )
    const mapping = guessBulkMapping('finance', file.headers)
    const workspace = emptyWorkspace('finance-import')
    const reviewed = reviewBulkRows(
      'finance',
      file,
      mapping,
      interpretation,
      workspace,
    )
    expect(reviewed.map((row) => row.status)).toEqual(['usable', 'pending'])
    const applied = applyBulkImport(
      workspace,
      'finance',
      file,
      reviewed,
      interpretation,
      'finance.csv',
      'csv',
      mapping,
    )
    expect(applied.finance).toHaveLength(1)
    expect(applied.sources[0]).toMatchObject({ rowCount: 1, excludedCount: 1 })
  })
})
