import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import {
  demoWorkspace,
  emptyWorkspace,
  type Workspace,
} from '../../domain/workspace'
import { Onboarding, type DataSection } from './Onboarding'
import { WorkspaceAccessContext } from '../../components/workspace-access-context'

beforeEach(() => sessionStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Harness({
  initialSection,
  onChange = () => {},
  onClose = () => {},
  seed,
  onFirstDecision,
  onViewResult,
}: {
  initialSection?: DataSection
  onChange?: (workspace: Workspace) => void
  onClose?: () => void
  seed?: Workspace
  onFirstDecision?: (
    question: import('../../domain/workspace').QuestionKey,
  ) => void
  onViewResult?: (page: import('../../domain/workspace').Page) => void
}) {
  const [workspace, setWorkspace] = useState(() => {
    if (seed) return seed
    const workspace = emptyWorkspace('intake-ui-test')
    workspace.profile.name = 'Test business'
    return workspace
  })
  return (
    <Onboarding
      workspace={workspace}
      onChange={(next) => {
        setWorkspace(next)
        onChange(next)
      }}
      onClose={onClose}
      initialSection={initialSection}
      onFirstDecision={onFirstDecision}
      onViewResult={onViewResult}
    />
  )
}

describe('onboarding confirmation boundaries', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Continue for now' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Evaluate a new order scenario' }),
    )
    expect(next).toHaveBeenCalledWith('Q-NEW-ORDER')
    expect(closed).not.toHaveBeenCalled()
    expect(changed.mock.lastCall?.[0].stock).toEqual(workspace.stock)
  })
})

describe('guided onboarding continuity', () => {
  it.each(['sales', 'inventory', 'finance', 'suppliers'] as const)(
    'collects minimal profile before a fresh %s shortcut',
    (section) => {
      const changed = vi.fn()
      render(
        <Harness
          seed={emptyWorkspace('fresh-shortcut')}
          initialSection={section}
          onChange={changed}
        />,
      )
      expect(screen.getByLabelText('Business name')).toBeVisible()
      fireEvent.change(screen.getByLabelText('Business name'), {
        target: { value: 'Corner shop' },
      })
      fireEvent.change(
        screen.getByLabelText('What would you like to understand first?'),
        { target: { value: '' } },
      )
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
      expect(screen.queryByLabelText('Business name')).not.toBeInTheDocument()
      const names = {
        sales: 'Sales',
        inventory: 'Inventory & costs',
        finance: 'Finance & collections',
        suppliers: 'Purchasing & suppliers',
      }
      expect(
        within(
          screen.getByRole('group', { name: 'Information type' }),
        ).getByRole('button', { name: names[section] }),
      ).toHaveAttribute('aria-pressed', 'true')
      expect(changed.mock.lastCall?.[0].profile).toMatchObject({
        name: 'Corner shop',
        currency: 'MXN',
        firstQuestion: '',
      })
    },
  )

  it('changes and retains the question while keeping separate draft inputs', () => {
    const changed = vi.fn()
    const view = render(<Harness initialSection="sales" onChange={changed} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Enter sales manually' }),
    )
    fireEvent.change(screen.getByLabelText('Amount row 1'), {
      target: { value: '415' },
    })
    fireEvent.change(
      screen.getByLabelText('What would you like to understand first?'),
      { target: { value: 'Q-CRITICAL-COLLECTION' } },
    )
    fireEvent.change(screen.getByLabelText('Record / invoice name'), {
      target: { value: 'COL-41' },
    })
    fireEvent.change(
      screen.getByLabelText('What would you like to understand first?'),
      { target: { value: 'sales' } },
    )
    expect(screen.getByLabelText('Amount row 1')).toHaveValue('415')
    fireEvent.change(
      screen.getByLabelText('What would you like to understand first?'),
      { target: { value: 'Q-CRITICAL-COLLECTION' } },
    )
    expect(screen.getByLabelText('Record / invoice name')).toHaveValue('COL-41')
    const workspace = changed.mock.lastCall?.[0] as Workspace
    expect(workspace.profile.firstQuestion).toBe('Q-CRITICAL-COLLECTION')
    expect(workspace.sales).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Save draft & close' }))
    view.unmount()
    render(<Harness seed={workspace} />)
    expect(
      screen.getByLabelText('What would you like to understand first?'),
    ).toHaveValue('Q-CRITICAL-COLLECTION')
    expect(screen.getByLabelText('Record / invoice name')).toHaveValue('COL-41')
  })

  it('retains sales, pool and cash drafts when a stock form is confirmed and finished', () => {
    const changed = vi.fn()
    const view = render(<Harness initialSection="sales" onChange={changed} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Enter sales manually' }),
    )
    fireEvent.change(screen.getByLabelText('Amount row 1'), {
      target: { value: '80' },
    })
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Finance & collections',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Available cash' }))
    fireEvent.change(screen.getByLabelText('Available cash · MXN'), {
      target: { value: '900' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Inventory & costs' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Shared inventory pool' }),
    )
    fireEvent.change(screen.getByLabelText('Pool name'), {
      target: { value: 'Unfinished pool' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Stock & costs' }))
    fireEvent.change(screen.getByLabelText(/SKU or product reference/), {
      target: { value: 'STOCK-1' },
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
    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent(
      'Review',
    )
    fireEvent.click(
      screen.getByLabelText('I confirm these values and their stated meaning.'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & apply' }))
    fireEvent.click(screen.getByRole('button', { name: 'View my analysis' }))
    const workspace = changed.mock.lastCall?.[0] as Workspace
    view.unmount()
    render(<Harness seed={workspace} />)
    expect(screen.getByLabelText(/SKU or product reference/)).toHaveValue('')
    fireEvent.click(
      screen.getByRole('button', { name: 'Shared inventory pool' }),
    )
    expect(screen.getByLabelText('Pool name')).toHaveValue('Unfinished pool')
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Finance & collections',
      }),
    )
    expect(screen.getByLabelText('Available cash · MXN')).toHaveValue('900')
    fireEvent.click(screen.getByRole('button', { name: 'Sales' }))
    expect(screen.getByLabelText('Amount row 1')).toHaveValue('80')
    expect(workspace.cash).toBeNull()
    expect(workspace.sales).toEqual([])
    expect(workspace.inventoryPools ?? []).toEqual([])
    expect(workspace.onboarding.firstAnalysisAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(workspace.onboarding.firstComparisonAt).toBeNull()
  })

  it('keeps unfinished manual sales after deferring and finishing without an analysis', () => {
    const changed = vi.fn()
    const view = render(<Harness initialSection="sales" onChange={changed} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Enter sales manually' }),
    )
    fireEvent.change(screen.getByLabelText('Reference row 1'), {
      target: { value: 'UNREVIEWED-5' },
    })
    fireEvent.change(screen.getByLabelText('Amount row 1'), {
      target: { value: '67' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue for now' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue for now' }))
    const workspace = changed.mock.lastCall?.[0] as Workspace
    expect(workspace.onboarding).toMatchObject({
      completed: true,
      deferred: true,
      firstAnalysisAt: null,
      firstComparisonAt: null,
    })
    view.unmount()
    render(<Harness seed={workspace} />)
    expect(screen.getByLabelText('Reference row 1')).toHaveValue('UNREVIEWED-5')
    expect(screen.getByLabelText('Amount row 1')).toHaveValue('67')
  })

  it('does not turn product and supplier configuration into a first analysis', () => {
    const workspace = emptyWorkspace('configuration-only')
    workspace.profile.name = 'Configured business'
    workspace.products = demoWorkspace('configuration-products').products.slice(
      0,
      1,
    )
    workspace.suppliers = demoWorkspace(
      'configuration-suppliers',
    ).suppliers.slice(0, 1)
    const changed = vi.fn()
    render(
      <Harness
        seed={workspace}
        initialSection="suppliers"
        onChange={changed}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue for now' }))
    expect(
      screen.getByText(/No supported analysis is available yet/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'View my analysis' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue for now' }))
    expect(changed.mock.lastCall?.[0].onboarding).toMatchObject({
      completed: true,
      firstAnalysisAt: null,
      firstComparisonAt: null,
    })
  })

  it('preserves prior analysis and comparison milestones through deferral', () => {
    const workspace = emptyWorkspace('past-milestones')
    workspace.profile.name = 'Returning business'
    workspace.onboarding.firstAnalysisAt = '2026-01-01T10:00:00.000Z'
    workspace.onboarding.firstComparisonAt = '2026-01-02T10:00:00.000Z'
    const changed = vi.fn()
    render(
      <Harness seed={workspace} initialSection="sales" onChange={changed} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue for now' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue for now' }))
    expect(changed.mock.lastCall?.[0].onboarding).toMatchObject({
      firstAnalysisAt: '2026-01-01T10:00:00.000Z',
      firstComparisonAt: '2026-01-02T10:00:00.000Z',
    })
  })

  it('starts a future order as a scenario without recording sales or comparison', () => {
    const changed = vi.fn(),
      next = vi.fn()
    render(
      <Harness
        seed={emptyWorkspace('order-scenario')}
        onChange={changed}
        onFirstDecision={next}
      />,
    )
    fireEvent.change(screen.getByLabelText('Business name'), {
      target: { value: 'Order business' },
    })
    fireEvent.change(
      screen.getByLabelText('What would you like to understand first?'),
      { target: { value: 'Q-NEW-ORDER' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(
      screen.getByLabelText(/SKU or product reference/),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Evaluate a new order scenario' }),
    )
    expect(next).toHaveBeenCalledWith('Q-NEW-ORDER')
    expect(changed.mock.lastCall?.[0].sales).toEqual([])
    expect(changed.mock.lastCall?.[0].onboarding.firstComparisonAt).toBeNull()
  })

  it.each([
    '{not json',
    JSON.stringify({
      manual: [null],
      profile: {},
      interpretation: {},
      step: 99,
    }),
  ])('recovers from an invalid persisted intake draft', (stored) => {
    sessionStorage.setItem('samby-intake-intake-ui-test', stored)
    render(<Harness initialSection="finance" />)
    expect(screen.getByLabelText('Record / invoice name')).toHaveValue('')
    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent(
      'Add information',
    )
  })

  it('summarizes only usable review rows and retains original references', () => {
    render(<Harness initialSection="sales" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Enter sales manually' }),
    )
    fireEvent.change(screen.getByLabelText('Date row 1'), {
      target: { value: '2025-02-03' },
    })
    fireEvent.change(screen.getByLabelText('Amount row 1'), {
      target: { value: '72' },
    })
    fireEvent.change(screen.getByLabelText('Reference row 1'), {
      target: { value: 'INV-72' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
    fireEvent.change(screen.getByLabelText('Amount row 2'), {
      target: { value: '99' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review these sales' }))
    fireEvent.change(screen.getByLabelText(/Amount definition/), {
      target: { value: 'Net excluding tax' },
    })
    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent(
      'Review',
    )
    const scope = screen.getByRole('region', { name: 'Sales review scope' })
    expect(scope).toHaveTextContent('2025-02-03 through 2025-02-03')
    expect(scope).toHaveTextContent('1 aggregate sales rows')
    expect(scope).toHaveTextContent(
      '1 pending and 0 excluded rows contribute no totals or date coverage',
    )
    expect(scope).toHaveTextContent('No usable product quantities')
  })
})

it('opens intake when the persisted review step has no surviving draft payload', () => {
  const workspace = emptyWorkspace('lost-review')
  workspace.profile.name = 'Existing business'
  workspace.onboarding.step = 2
  render(<Harness seed={workspace} />)
  expect(screen.getByLabelText('Choose your sales file')).toBeInTheDocument()
  expect(document.querySelector('[aria-current="step"]')).toHaveTextContent(
    'Add information',
  )
})

it('does not change a profile through the question selector without settings permission', () => {
  const changed = vi.fn()
  render(
    <WorkspaceAccessContext.Provider value="inventory">
      <Harness initialSection="inventory" onChange={changed} />
    </WorkspaceAccessContext.Provider>,
  )
  const question = screen.getByLabelText(
    'What would you like to understand first?',
  )
  expect(question).toBeDisabled()
  fireEvent.change(question, { target: { value: 'Q-NEW-ORDER' } })
  expect(changed).not.toHaveBeenCalled()
})

it('keeps unfinished profile currency edits separate from a saved first question', () => {
  const workspace = demoWorkspace('unsaved-profile')
  const changed = vi.fn()
  const profileView = render(
    <Harness seed={workspace} initialSection="profile" />,
  )
  fireEvent.change(screen.getByLabelText(/Working currency/), {
    target: { value: 'USD' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save for later' }))
  profileView.unmount()
  const salesView = render(
    <Harness seed={workspace} initialSection="sales" onChange={changed} />,
  )
  fireEvent.change(
    screen.getByLabelText('What would you like to understand first?'),
    { target: { value: 'Q-CRITICAL-COLLECTION' } },
  )
  const saved = changed.mock.lastCall?.[0] as Workspace
  expect(saved.profile).toMatchObject({
    currency: 'MXN',
    firstQuestion: 'Q-CRITICAL-COLLECTION',
  })
  expect(saved.sales).toEqual(workspace.sales)
  salesView.unmount()
  render(<Harness seed={saved} initialSection="profile" />)
  expect(screen.getByLabelText(/Working currency/)).toHaveValue('USD')
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Existing monetary records use the current working currency',
  )
})

it('respects hidden results and offers their existing Add-ons visibility controls', () => {
  const workspace = demoWorkspace('muted-results')
  workspace.stock = []
  workspace.inventoryHistory = []
  workspace.finance = []
  workspace.cash = null
  workspace.muted = ['sales']
  workspace.onboarding.firstAnalysisAt = null
  const changed = vi.fn(),
    navigate = vi.fn()
  render(
    <Harness
      seed={workspace}
      initialSection="sales"
      onChange={changed}
      onViewResult={navigate}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Continue for now' }))
  expect(
    screen.getByText(
      /Supported results are hidden by your Add-ons preferences/,
    ),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'View my analysis' }),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Review Add-ons' }))
  expect(navigate).toHaveBeenCalledWith('data')
  expect(changed.mock.lastCall?.[0].muted).toEqual(['sales'])
  expect(changed.mock.lastCall?.[0].onboarding.firstAnalysisAt).toBeNull()
})

it('continues a partly confirmed manual entry without duplicating accepted sales', () => {
  const changed = vi.fn()
  render(<Harness initialSection="sales" onChange={changed} />)
  fireEvent.click(screen.getByRole('button', { name: 'Enter sales manually' }))
  fireEvent.change(screen.getByLabelText('Date row 1'), {
    target: { value: '2025-02-03' },
  })
  fireEvent.change(screen.getByLabelText('Amount row 1'), {
    target: { value: '72' },
  })
  fireEvent.change(screen.getByLabelText('Reference row 1'), {
    target: { value: 'ACCEPTED-72' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Add row' }))
  fireEvent.change(screen.getByLabelText('Amount row 2'), {
    target: { value: '99' },
  })
  fireEvent.change(screen.getByLabelText('Reference row 2'), {
    target: { value: 'PENDING-99' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Review these sales' }))
  fireEvent.change(screen.getByLabelText(/Amount definition/), {
    target: { value: 'Net excluding tax' },
  })
  fireEvent.click(screen.getByLabelText(/I confirm these mappings/))
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm & apply 1 rows' }),
  )
  expect(changed.mock.lastCall?.[0].sales).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Add more information' }))
  expect(screen.getByLabelText('Reference row 1')).toHaveValue('PENDING-99')
  expect(screen.queryByLabelText('Amount row 2')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Date row 1'), {
    target: { value: '2025-02-04' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Review these sales' }))
  fireEvent.click(screen.getByLabelText(/I confirm these mappings/))
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm & apply 1 rows' }),
  )
  const workspace = changed.mock.lastCall?.[0] as Workspace
  expect(
    workspace.sales.map((sale) => ({
      amount: sale.amount,
      reference: sale.sourceReference,
    })),
  ).toEqual([
    { amount: 72, reference: 'ACCEPTED-72' },
    { amount: 99, reference: 'PENDING-99' },
  ])
  expect(workspace.sources[0].review?.rows).toHaveLength(2)
  expect(workspace.sources[0].review?.acceptedRowIndexes).toEqual([0])
})
