import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyWorkspace, type FinancialRecord, type Product, type StockPosition } from '../../domain/workspace'
import { QuickInsights } from './QuickInsights'

afterEach(cleanup)

describe('QuickInsights component', () => {
  it('renders an empty state prompt when the workspace has no data', () => {
    const ws = emptyWorkspace('empty-ws', 'business')
    const onIntake = vi.fn()

    render(
      <QuickInsights
        workspace={ws}
        onChange={() => {}}
        onNavigate={() => {}}
        onIntake={onIntake}
      />,
    )

    expect(screen.getByText('No business diagnostics available yet')).toBeInTheDocument()
    const intakeButton = screen.getByRole('button', { name: /Start initial data intake/i })
    fireEvent.click(intakeButton)
    expect(onIntake).toHaveBeenCalled()
  })

  it('renders health score, diagnostic pillars, and threat warnings when data exists', () => {
    const ws = emptyWorkspace('populated-ws', 'business')
    ws.cash = {
      amount: 1500,
      date: '2026-09-12',
      phase: 'end-of-day',
      reserve: 0,
    }

    const payable: FinancialRecord = {
      id: 'pay-1',
      kind: 'payable',
      name: 'Supplier Overdue Invoice',
      counterparty: 'Alpha Suppliers',
      amount: 8000,
      paidAmount: 0,
      currency: 'USD',
      dueDate: '2026-09-01', // overdue
      expectedDate: '2026-09-01',
      category: 'suppliers',
      linkedRecordId: null,
      cashIncluded: false,
    }
    ws.finance = [payable]

    const product: Product = {
      id: 'prod-1',
      sku: 'SKU-01',
      name: 'Key Product',
      category: 'General',
      unit: 'pcs',
      cost: 20,
      price: 60,
      supplierId: null,
      leadTimeDays: 14,
      moq: 1,
      casePack: 1,
      reorderPoint: 20,
      safetyStock: 10,
      serviceTarget: 95,
      targetStock: 50,
    }
    ws.products = [product]

    const stock: StockPosition = {
      id: 'stock-1',
      productId: 'prod-1',
      locationId: null,
      onHand: 120, // excess stock
      reserved: 0,
      asOf: '2026-09-12',
      quantityBasis: 'on-hand',
    }
    ws.stock = [stock]

    const onNavigate = vi.fn()

    render(
      <QuickInsights
        workspace={ws}
        onChange={() => {}}
        onNavigate={onNavigate}
        onIntake={() => {}}
      />,
    )

    // Check title and health score badge
    expect(screen.getByText('Quick Insights')).toBeInTheDocument()
    expect(screen.getByText('Business Health Score')).toBeInTheDocument()

    // Check 4 pillars rendered
    expect(screen.getAllByText('Liquidity & Runway')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Supply Chain & Stock')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Supplier Reliability')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Commercial & Margins')[0]).toBeInTheDocument()

    // Check threat callout is present
    expect(screen.getByText('Critical Condition to Prevent:')).toBeInTheDocument()

    // Check navigation jump
    const simulateButton = screen.getByRole('button', { name: /Simulate Cash Stress/i })
    fireEvent.click(simulateButton)
    expect(onNavigate).toHaveBeenCalledWith('analysis', 'question=Q-CASH-SUFFICIENCY')

    const deadStockButton = screen.getByRole('button', { name: /Explore Dead Stock/i })
    fireEvent.click(deadStockButton)
    expect(onNavigate).toHaveBeenCalledWith('inventory', 'filter=excess')
  })

  it('filters diagnostics by severity tabs', () => {
    const ws = emptyWorkspace('populated-ws', 'business')
    ws.cash = { amount: 500, date: '2026-09-12', phase: 'end-of-day', reserve: 0 }

    const payable: FinancialRecord = {
      id: 'pay-urgent',
      kind: 'payable',
      name: 'Urgent Pay',
      counterparty: 'Big Supply',
      amount: 10000,
      paidAmount: 0,
      currency: 'USD',
      dueDate: '2026-09-18',
      expectedDate: '2026-09-18',
      category: 'suppliers',
      linkedRecordId: null,
      cashIncluded: false,
    }
    ws.finance = [payable]

    render(
      <QuickInsights
        workspace={ws}
        onChange={() => {}}
        onNavigate={() => {}}
        onIntake={() => {}}
      />,
    )

    // Click Critical Threats filter tab
    const criticalTab = screen.getByRole('tab', { name: /Critical Threats/i })
    fireEvent.click(criticalTab)
    expect(criticalTab).toHaveAttribute('aria-selected', 'true')

    // Click Optimizations filter tab
    const optTab = screen.getByRole('tab', { name: /Optimizations/i })
    fireEvent.click(optTab)
    expect(optTab).toHaveAttribute('aria-selected', 'true')
  })

  it('renders the ticked radial health score chart, handles view toggle and breakdown row interactions', () => {
    const ws = emptyWorkspace('populated-ws', 'business')
    ws.cash = { amount: 5000, date: '2026-09-12', phase: 'end-of-day', reserve: 0 }

    const product: Product = {
      id: 'prod-1',
      sku: 'SKU-01',
      name: 'Key Product',
      category: 'General',
      unit: 'pcs',
      cost: 20,
      price: 60,
      supplierId: null,
      leadTimeDays: 14,
      moq: 1,
      casePack: 1,
      reorderPoint: 20,
      safetyStock: 10,
      serviceTarget: 95,
      targetStock: 50,
    }
    const stock: StockPosition = {
      id: 'stock-1',
      productId: 'prod-1',
      locationId: null,
      onHand: 120,
      reserved: 0,
      asOf: '2026-09-12',
      quantityBasis: 'on-hand',
    }
    ws.stock = [stock]

    const { container } = render(
      <QuickInsights
        workspace={ws}
        onChange={() => {}}
        onNavigate={() => {}}
        onIntake={() => {}}
      />,
    )

    // Check SVG dial is rendered with 60 radial ticks
    const svgDial = screen.getByLabelText(/Radial score dial/i)
    expect(svgDial).toBeInTheDocument()
    const ticks = container.querySelectorAll('.ticked-tick')
    expect(ticks.length).toBe(60)

    // Check Pillars and Progress view toggle buttons
    const pillarsToggle = screen.getByRole('button', { name: /^Pillars$/i })
    const progressToggle = screen.getByRole('button', { name: /^Progress$/i })
    expect(pillarsToggle).toHaveClass('active')

    // Switch to progress mode
    fireEvent.click(progressToggle)
    expect(progressToggle).toHaveClass('active')

    // Switch back to pillars mode
    fireEvent.click(pillarsToggle)
    expect(pillarsToggle).toHaveClass('active')

    // Check breakdown list rows exist
    const breakdownList = screen.getByRole('list', { name: /Operational Pillars Breakdown/i })
    const liquidityRow = within(breakdownList).getByRole('button', { name: /Liquidity & Runway/i })
    expect(liquidityRow).toBeInTheDocument()

    // Hovering on row triggers pillar preview in center
    fireEvent.mouseEnter(liquidityRow)
    expect(screen.getAllByText('Liquidity & Runway').length).toBeGreaterThanOrEqual(2)

    // Clicking row activates filter
    fireEvent.click(liquidityRow)
    expect(liquidityRow).toHaveAttribute('aria-pressed', 'true')

    // Clicking again deselects
    fireEvent.click(liquidityRow)
    expect(liquidityRow).toHaveAttribute('aria-pressed', 'false')

    fireEvent.mouseLeave(liquidityRow)
  })
})

