import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  demoWorkspace,
  emptyWorkspace,
  type Workspace,
} from '../../domain/workspace'
import { Onboarding, type DataSection } from './Onboarding'

beforeEach(() => sessionStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Harness({
  initialSection,
  onChange = () => {},
  onClose = () => {},
}: {
  initialSection?: DataSection
  onChange?: (workspace: Workspace) => void
  onClose?: () => void
}) {
  const [workspace, setWorkspace] = useState(() =>
    emptyWorkspace('intake-ui-test'),
  )
  return (
    <Onboarding
      workspace={workspace}
      onChange={(next) => {
        setWorkspace(next)
        onChange(next)
      }}
      onClose={onClose}
      initialSection={initialSection}
    />
  )
}

describe('onboarding confirmation boundaries', () => {
  it('offers a downloadable CSV template for every core data category', () => {
    render(<Harness initialSection="sales" />)
    expect(screen.getByRole('link', { name: /Download sales template/ })).toHaveAttribute(
      'href',
      '/templates/samby-sales-template.csv',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Inventory & costs' }))
    expect(
      screen.getByRole('link', { name: /Download inventory & costs template/ }),
    ).toHaveAttribute('href', '/templates/samby-inventory-costs-template.csv')
    fireEvent.click(
      screen.getByRole('button', { name: 'Purchasing & suppliers' }),
    )
    expect(
      screen.getByRole('link', {
        name: /Download purchasing & suppliers template/,
      }),
    ).toHaveAttribute(
      'href',
      '/templates/samby-purchasing-suppliers-template.csv',
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Finance & collections' }),
    )
    expect(
      screen.getByRole('link', {
        name: /Download finance & collections template/,
      }),
    ).toHaveAttribute(
      'href',
      '/templates/samby-finance-collections-template.csv',
    )
  })

  it('reviews and applies an inventory CSV through the shared import flow', async () => {
    const changed = vi.fn()
    render(<Harness initialSection="inventory" onChange={changed} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Import inventory & costs' }),
    )
    const csv =
      'SKU / product reference,Product name,Unit,Stock quantity,Quantity basis,Reserved quantity,Stock date,Location,Unit cost\nDEMO_1,Demo product,pieces,12,on-hand,1,2026-08-10,Main,25'
    const file = new File(
      [csv],
      'inventory.csv',
      { type: 'text/csv' },
    )
    Object.defineProperty(file, 'text', { value: async () => csv })
    fireEvent.change(
      screen.getByLabelText('Choose your inventory & costs file'),
      { target: { files: [file] } },
    )
    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          name: 'Check how your inventory & costs are understood.',
        }),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText('1 usable')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/I confirm these mappings/))
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm & apply 1 rows' }),
    )
    const result = changed.mock.lastCall?.[0] as Workspace
    expect(result.products[0]).toMatchObject({ sku: 'DEMO_1', cost: 25 })
    expect(result.stock[0]).toMatchObject({ onHand: 12, reserved: 1 })
  })

  it('defers without claiming a first analysis', () => {
    const changed = vi.fn()
    render(<Harness initialSection="sales" onChange={changed} />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue for now' }))
    expect(
      screen.getByText(
        'You have deferred data entry. No analysis has been calculated.',
      ),
    ).toBeInTheDocument()
    expect(changed.mock.lastCall?.[0].onboarding).toMatchObject({
      completed: true,
      deferred: true,
      firstAnalysisAt: null,
    })
    expect(changed.mock.lastCall?.[0].sales).toEqual([])
  })

  it('keeps stock uncommitted until the owner confirms its review', () => {
    const changed = vi.fn()
    render(<Harness initialSection="inventory" onChange={changed} />)
    fireEvent.change(screen.getByLabelText(/SKU or product reference/), {
      target: { value: 'BOX-1' },
    })
    fireEvent.change(screen.getByLabelText(/Recorded stock quantity/), {
      target: { value: '0' },
    })
    fireEvent.change(screen.getByLabelText(/^Unit$/), {
      target: { value: 'pieces' },
    })
    fireEvent.change(screen.getByLabelText('Stock date'), {
      target: { value: '2026-08-10' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review inventory' }))
    expect(
      screen.getByText(
        'Reservations are unknown. Available stock cannot be calculated.',
      ),
    ).toBeInTheDocument()
    expect(changed).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Confirm & apply' }),
    ).toBeDisabled()
    fireEvent.click(
      screen.getByLabelText('I confirm these values and their stated meaning.'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & apply' }))
    expect(changed.mock.lastCall?.[0].stock[0]).toMatchObject({
      onHand: 0,
      reserved: null,
      quantityBasis: 'on-hand',
      asOf: '2026-08-10',
    })
  })

  it('preserves confirmed zero backlog and product policy with explicit scope', () => {
    const changed = vi.fn()
    render(<Harness initialSection="inventory" onChange={changed} />)
    fireEvent.change(screen.getByLabelText(/SKU or product reference/), {
      target: { value: 'POL-1' },
    })
    fireEvent.change(screen.getByLabelText(/Recorded stock quantity/), {
      target: { value: '20' },
    })
    fireEvent.change(screen.getByLabelText(/^Unit$/), {
      target: { value: 'pieces' },
    })
    fireEvent.change(screen.getByLabelText('Stock date'), {
      target: { value: '2026-08-10' },
    })
    fireEvent.change(screen.getByLabelText(/Backordered quantity/), {
      target: { value: '0' },
    })
    fireEvent.change(screen.getByLabelText(/Reorder point/), {
      target: { value: '10' },
    })
    fireEvent.change(screen.getByLabelText(/Service target %/), {
      target: { value: '95' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review inventory' }))
    expect(
      screen.getByText(/Applies to this product across supplied locations/),
    ).toBeInTheDocument()
    expect(changed).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByLabelText('I confirm these values and their stated meaning.'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & apply' }))
    expect(changed.mock.lastCall?.[0].stock[0]).toMatchObject({
      backordered: 0,
      reserved: null,
    })
    expect(changed.mock.lastCall?.[0].products[0]).toMatchObject({
      reorderPoint: 10,
      safetyStock: null,
      serviceTarget: 95,
    })
  })

  it('reports unavailable draft storage without preventing current-session entry', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })
    const changed = vi.fn()
    render(<Harness initialSection="sales" onChange={changed} />)
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Browser storage is unavailable or full',
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue for now' }))
    expect(changed.mock.lastCall?.[0].onboarding.deferred).toBe(true)
  })

  it('cancels a manual financial review without creating records', () => {
    const changed = vi.fn(),
      closed = vi.fn()
    render(
      <Harness initialSection="finance" onChange={changed} onClose={closed} />,
    )
    fireEvent.change(screen.getByLabelText('Record / invoice name'), {
      target: { value: 'INV-22' },
    })
    fireEvent.change(
      screen.getByLabelText('Customer, supplier or counterparty'),
      { target: { value: 'Atlas' } },
    )
    fireEvent.change(screen.getByLabelText('Original amount · MXN'), {
      target: { value: '1000' },
    })
    fireEvent.change(screen.getByLabelText(/Amount already paid/), {
      target: { value: '250' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Review financial record' }),
    )
    expect(screen.getByText(/Unscheduled/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel review' }))
    expect(changed).not.toHaveBeenCalled()
    expect(closed).toHaveBeenCalledOnce()
  })

  it('keeps a receipt amount separate from the available cash form', () => {
    render(<Harness initialSection="finance" />)
    fireEvent.change(screen.getByLabelText('Original amount · MXN'), {
      target: { value: '1000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Available cash' }))
    expect(screen.getByLabelText('Available cash · MXN')).toHaveValue('')
  })

  it('stores the confirmed mapping and original rows separately from accepted sales', () => {
    const changed = vi.fn()
    render(<Harness initialSection="sales" onChange={changed} />)
    fireEvent.click(
      screen.getByRole('button', { name: /Enter sales manually/ }),
    )
    fireEvent.change(screen.getByLabelText('Date row 1'), {
      target: { value: '2026-08-10' },
    })
    fireEvent.change(screen.getByLabelText('Amount row 1'), {
      target: { value: '150' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Review these sales/ }))
    fireEvent.change(screen.getByLabelText(/Amount definition/), {
      target: { value: 'Net excluding tax, after discounts' },
    })
    fireEvent.click(screen.getByLabelText(/I confirm these mappings/))
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm & apply 1 rows' }),
    )
    const result = changed.mock.lastCall?.[0] as Workspace
    expect(result.sales[0]).toMatchObject({
      amount: 150,
      quantity: null,
      productId: null,
    })
    expect(result.sources[0].review).toMatchObject({
      columnMapping: { date: 0, amount: 5 },
      acceptedRowIndexes: [0],
      excludedRowIndexes: [],
      interpretation: { amountBasis: 'Net excluding tax, after discounts' },
    })
    expect(result.sources[0].review?.rows[0][5]).toBe('150')
    fireEvent.click(
      screen.getByRole('button', { name: 'Add more information' }),
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Manual sales entry · 1 accepted rows',
      }),
    )
    expect(
      screen.getByRole('heading', { name: 'Confirmed source review' }),
    ).toBeInTheDocument()
  })

  it('records recurring expectations with independent unknown fulfillment and payment', () => {
    const changed = vi.fn()
    render(<Harness initialSection="finance" onChange={changed} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Recurring commitments' }),
    )
    fireEvent.change(screen.getByLabelText('Commitment name'), {
      target: { value: 'Monthly packaging agreement' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review commitment' }))
    expect(changed).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByLabelText('I confirm these values and their stated meaning.'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & apply' }))
    const result = changed.mock.lastCall?.[0] as Workspace
    expect(result.commitments[0]).toMatchObject({
      name: 'Monthly packaging agreement',
      amount: null,
      nextDate: null,
      fulfillment: 'unknown',
      payment: 'unknown',
      linkedPayableId: null,
    })
    expect(result.finance).toEqual([])
  })

  it('restores manual sales fields after closing and reopening the session draft', () => {
    const first = render(<Harness initialSection="sales" />)
    fireEvent.click(
      screen.getByRole('button', { name: /Enter sales manually/ }),
    )
    fireEvent.change(screen.getByLabelText('Date row 1'), {
      target: { value: '2026-08-10' },
    })
    fireEvent.change(screen.getByLabelText('Amount row 1'), {
      target: { value: '150' },
    })
    first.unmount()
    render(<Harness initialSection="sales" />)
    expect(screen.getByLabelText('Date row 1')).toHaveValue('2026-08-10')
    expect(screen.getByLabelText('Amount row 1')).toHaveValue('150')
  })
  it('links a supplier invoice to its purchase without duplicating a new purchase', () => {
    const workspace = demoWorkspace('intake-ui-test'),
      changed = vi.fn()
    const purchase = workspace.purchases[0]
    render(
      <Onboarding
        workspace={workspace}
        onChange={changed}
        onClose={() => {}}
        initialSection="finance"
      />,
    )
    fireEvent.change(screen.getByLabelText('Record type'), {
      target: { value: 'payable' },
    })
    fireEvent.change(screen.getByLabelText('Record / invoice name'), {
      target: { value: 'Supplier invoice with purchase link' },
    })
    fireEvent.change(
      screen.getByLabelText('Customer, supplier or counterparty'),
      { target: { value: 'Empaques del Norte' } },
    )
    fireEvent.change(screen.getByLabelText('Original amount · MXN'), {
      target: { value: String(purchase.amount) },
    })
    fireEvent.change(screen.getByLabelText(/Amount already paid/), {
      target: { value: String(purchase.paidAmount) },
    })
    fireEvent.change(screen.getByLabelText(/Linked purchase order/), {
      target: { value: purchase.id },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Review financial record' }),
    )
    fireEvent.click(
      screen.getByLabelText('I confirm these values and their stated meaning.'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & apply' }))
    const result = changed.mock.lastCall?.[0] as Workspace
    expect(result.finance.at(-1)).toMatchObject({
      kind: 'payable',
      linkedRecordId: purchase.id,
      amount: purchase.amount,
    })
    expect(result.purchases).toEqual(workspace.purchases)
  })

  it('confirms a pool membership and channels without copying stock', () => {
    const workspace = demoWorkspace('intake-ui-test'),
      changed = vi.fn()
    render(
      <Onboarding
        workspace={workspace}
        onChange={changed}
        onClose={() => {}}
        initialSection="inventory"
      />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Shared inventory pool' }),
    )
    fireEvent.change(screen.getByLabelText('Pool name'), {
      target: { value: 'Online fulfillment pool' },
    })
    fireEvent.click(screen.getByLabelText(workspace.locations[0].name))
    fireEvent.change(screen.getByLabelText(/Sales channels using this pool/), {
      target: { value: 'Web shop, Counter sales' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review shared pool' }))
    expect(changed).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByLabelText('I confirm these values and their stated meaning.'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & apply' }))
    const result = changed.mock.lastCall?.[0] as Workspace
    expect(result.inventoryPools?.at(-1)).toMatchObject({
      name: 'Online fulfillment pool',
      locationIds: [workspace.locations[0].id],
      channelNames: ['Web shop', 'Counter sales'],
    })
    expect(result.stock).toEqual(workspace.stock)
  })

  it('continues into the selected first decision with confirmed data', () => {
    const workspace = demoWorkspace('intake-ui-test'),
      next = vi.fn(),
      closed = vi.fn(),
      changed = vi.fn()
    workspace.profile.firstQuestion = 'Q-NEW-ORDER'
    workspace.onboarding = {
      ...workspace.onboarding,
      completed: false,
      step: 3,
    }
    render(
      <Onboarding
        workspace={workspace}
        onChange={changed}
        onClose={closed}
        onFirstDecision={next}
      />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Evaluate a new order' }),
    )
    expect(next).toHaveBeenCalledWith('Q-NEW-ORDER')
    expect(closed).not.toHaveBeenCalled()
    expect(changed.mock.lastCall?.[0].stock).toEqual(workspace.stock)
  })
})
