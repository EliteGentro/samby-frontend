import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { emptyWorkspace, type Sale } from '../../domain/workspace'
import { Home } from './Home'

afterEach(cleanup)

const historicalSale: Sale = {
  id: 'historical-sale',
  date: '2024-01-03',
  productId: null,
  quantity: null,
  amount: 120,
  unit: '',
  currency: 'MXN',
  locationId: null,
  sourceId: 'confirmed-source',
  kind: 'sale',
  amountBasis: 'net',
}

test('one historical sale opens a dated result while financial records keep their current scope', () => {
  const workspace = emptyWorkspace('historical-home', 'demo')
  workspace.sales = [historicalSale]
  workspace.cash = {
    amount: 200,
    date: '2026-09-12',
    phase: 'opening',
    reserve: null,
  }
  workspace.finance = [
    {
      id: 'current-receivable',
      kind: 'receivable',
      name: 'Current invoice',
      counterparty: 'Customer',
      amount: 80,
      paidAmount: 0,
      currency: 'MXN',
      dueDate: '2026-09-10',
      expectedDate: '2026-09-13',
      category: 'collections',
      linkedRecordId: null,
      cashIncluded: false,
    },
  ]
  render(
    <Home
      workspace={workspace}
      onChange={() => {}}
      onNavigate={() => {}}
      onIntake={() => {}}
    />,
  )

  expect(
    screen.getByText(
      'Recorded sales history covers 2024-01-03 to 2024-01-03. Inventory and financial records retain their own dates.',
    ),
  ).toBeInTheDocument()
  expect(
    screen.getByText('1 record · recorded history · 2024-01-03 to 2024-01-03'),
  ).toBeInTheDocument()
  expect(
    screen.queryByText('No observations in this period'),
  ).not.toBeInTheDocument()
  const table = screen.getByRole('table', { hidden: true })
  expect(within(table).getByText('2024-01-03')).toBeInTheDocument()
  expect(within(table).getByText('120')).toBeInTheDocument()
  expect(within(table).getAllByRole('row', { hidden: true })).toHaveLength(2)
  expect(screen.getByText('1 overdue collection')).toBeInTheDocument()
  expect(screen.getByText('Current invoice')).toBeInTheDocument()
  expect(screen.getByText('Opening snapshot · Sep 12')).toBeInTheDocument()
  expect(
    screen.getByText(/Current financial records remain distinct/),
  ).toBeInTheDocument()
  expect(screen.getByText(/Data cutoff 2026-09-12/)).toBeInTheDocument()
})

test('recent observations keep the last 30 days scope and exclude older sales', () => {
  const workspace = emptyWorkspace('recent-home', 'demo')
  workspace.sales = [
    historicalSale,
    { ...historicalSale, id: 'recent-sale', date: '2026-09-10', amount: 75 },
  ]
  render(
    <Home
      workspace={workspace}
      onChange={() => {}}
      onNavigate={() => {}}
      onIntake={() => {}}
    />,
  )

  expect(screen.getByText('1 record · last 30 days')).toBeInTheDocument()
  expect(
    screen.getByText(
      'Recorded monetary sales · MXN · 2026-08-14 to 2026-09-12',
    ),
  ).toBeInTheDocument()
  expect(screen.queryByText(/Recorded sales history covers/)).toBeNull()
  const table = screen.getByRole('table', { hidden: true })
  expect(within(table).getByText('2026-09-10')).toBeInTheDocument()
  expect(within(table).getByText('75')).toBeInTheDocument()
  expect(within(table).queryByText('2024-01-03')).not.toBeInTheDocument()
  expect(within(table).getAllByRole('row', { hidden: true })).toHaveLength(2)
})
