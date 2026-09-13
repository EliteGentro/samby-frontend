import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { Catalog, Settings } from './CatalogSettings'
import { demoWorkspace } from '../../domain/workspace'

afterEach(cleanup)
const props = () => ({
  workspace: demoWorkspace('catalog-test'),
  onChange: vi.fn(),
  onIntake: vi.fn(),
  onNavigate: vi.fn(),
})

describe('catalog scope and presentation review', () => {
  it('shows exact affected displays and preserves input records when muting', () => {
    const p = props()
    render(<Catalog {...p} />)
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search capabilities' }),
      { target: { value: 'Inventory value' } },
    )
    expect(
      screen.queryByRole('switch', { name: 'Inventory value presentation' }),
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Review Inventory value' }),
    )
    fireEvent.click(
      screen.getByRole('switch', { name: 'Inventory value presentation' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Mute Inventory value?' })
    expect(
      within(dialog).getByText(
        'Home, Inventory and Inventory dashboard: inventory-at-cost indicators',
      ),
    ).toBeInTheDocument()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Mute presentation' }),
    )
    const next = p.onChange.mock.lastCall?.[0]
    expect(next.muted).toContain('inventory-value')
    expect(next.stock).toEqual(p.workspace.stock)
    expect(next.sales).toEqual(p.workspace.sales)
  })

  it('shows the registry fields in the dependency view and jumps from a prerequisite to its intake', () => {
    const p = props()
    render(<Catalog {...p} />)
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search capabilities' }),
      { target: { value: 'Replenishment timing' } },
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Review Replenishment timing and quantity',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Dependencies' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Replenishment timing and quantity dependencies',
    })
    expect(within(dialog).getByText('replenishment')).toBeInTheDocument()
    expect(within(dialog).getByText(/On at first unlock/)).toBeInTheDocument()
    expect(within(dialog).getByText('Warning conditions')).toBeInTheDocument()
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Open Current stock visibility data',
      }),
    )
    expect(p.onIntake).toHaveBeenCalledWith('inventory')
    expect(
      screen.queryByRole('dialog', {
        name: 'Replenishment timing and quantity dependencies',
      }),
    ).not.toBeInTheDocument()
  })

  it('uses attributed historical valuation and exposes enforced role boundaries', () => {
    const p = props()
    render(<Catalog {...p} />)
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Catalog source scope' }),
      { target: { value: 'demo-v04' } },
    )
    expect(
      screen.getByText(
        /Only records explicitly linked to this source are included/,
      ),
    ).toBeInTheDocument()
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search capabilities' }),
      { target: { value: 'Inventory value' } },
    )
    fireEvent.click(screen.getByRole('button', { name: /Inventory value/ }))
    expect(
      screen.queryByRole('switch', { name: 'Inventory value presentation' }),
    ).toBeInTheDocument()
    cleanup()
    render(<Settings {...p} />)
    expect(
      screen.getByRole('columnheader', { name: 'Major changes' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Maintain debt, terms, cash, budgets, commitments and category coverage',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('switch', { name: 'Optional notifications' }),
    ).toBeInTheDocument()
  })
})
