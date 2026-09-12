import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { demoWorkspace } from '../../domain/workspace'
import { FinanceInsights } from './FinanceInsights'

afterEach(cleanup)

test('forward-window controls change exact expected dates without changing current balances', () => {
  const workspace = demoWorkspace('insights')
  workspace.finance = [
    {
      ...workspace.finance.find((record) => record.kind === 'receivable')!,
      id: 'future-invoice',
      amount: 80,
      paidAmount: 0,
      expectedDate: '2026-10-20',
      dueDate: null,
      cashIncluded: false,
    },
  ]
  render(<FinanceInsights workspace={workspace} kind="internal" />)
  const timeline = screen.getByRole('region', {
    name: 'Expected collection timeline',
  })
  expect(
    within(timeline).getByText(/2026-09-12 to 2026-10-11/),
  ).toBeInTheDocument()
  expect(
    within(timeline).queryByRole('rowheader', { name: '2026-10-20' }),
  ).not.toBeInTheDocument()
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Expected timeline horizon' }),
    { target: { value: '60' } },
  )
  expect(
    within(timeline).getByText(/2026-09-12 to 2026-11-10/),
  ).toBeInTheDocument()
  expect(
    within(timeline).getByRole('rowheader', { name: '2026-10-20' }),
  ).toBeInTheDocument()
  expect(
    screen.getByText(/Current supplied balances · 2026-09-12/),
  ).toBeInTheDocument()
})

test('parent-supplied windows remain exact and have no local horizon override', () => {
  render(
    <FinanceInsights
      workspace={demoWorkspace('insights')}
      kind="external"
      start="2026-09-01"
      end="2026-09-30"
    />,
  )
  expect(
    screen.queryByRole('combobox', { name: 'Expected timeline horizon' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByText(/Expected dates · 2026-09-01 to 2026-09-30/),
  ).toBeInTheDocument()
})
