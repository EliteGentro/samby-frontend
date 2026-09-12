import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { demoWorkspace, type Workspace } from '../../domain/workspace'
import { FinanceHistory } from './FinanceHistory'

afterEach(cleanup)

test('recorded historical payments require review and preserve cash and cumulative-paid balances', () => {
  const workspace = demoWorkspace('history')
  const invoice = workspace.finance.find(
    (record) => record.kind === 'receivable',
  )!
  invoice.amount = 200
  invoice.paidAmount = 100
  const changed = vi.fn()
  render(
    <FinanceHistory
      workspace={workspace}
      onChange={changed}
      kind="internal"
      start="2026-09-01"
      end="2026-09-12"
    />,
  )
  expect(
    screen.queryByRole('combobox', { name: 'Historical reporting window' }),
  ).not.toBeInTheDocument()
  fireEvent.click(
    screen.getByRole('button', { name: 'Record historical payment' }),
  )
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Linked financial record' }),
    { target: { value: invoice.id } },
  )
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Payment or allocation reference' }),
    { target: { value: 'BANK-123' } },
  )
  fireEvent.change(screen.getByLabelText('Actual event date'), {
    target: { value: '2026-09-03' },
  })
  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'Observed amount' }),
    { target: { value: '75' } },
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Review historical event' }),
  )
  expect(changed).not.toHaveBeenCalled()
  expect(
    screen.getByRole('button', { name: 'Confirm historical event' }),
  ).toBeDisabled()
  fireEvent.click(
    screen.getByRole('checkbox', {
      name: 'I verified this historical event against its source',
    }),
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm historical event' }),
  )
  const saved = changed.mock.calls[0][0] as Workspace
  expect(saved.financeEvents).toHaveLength(1)
  expect(saved.financeEvents![0]).toMatchObject({
    recordId: invoice.id,
    paymentReference: 'BANK-123',
    date: '2026-09-03',
    amount: 75,
  })
  expect(
    saved.sources.find(
      (source) => source.id === saved.financeEvents![0].sourceId,
    )?.type,
  ).toBe('manual')
  expect(saved.cash).toEqual(workspace.cash)
  expect(saved.finance).toEqual(workspace.finance)
})
