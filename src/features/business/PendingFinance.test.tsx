import { useState } from 'react'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { WorkspaceAccessContext } from '../../components/workspace-access-context'
import { demoWorkspace, type Workspace } from '../../domain/workspace'
import { PendingFinance } from './PendingFinance'

afterEach(cleanup)

function confirmRecord() {
  fireEvent.click(screen.getByRole('button', { name: 'Review record' }))
  expect(
    screen.getByRole('button', { name: 'Confirm and save record' }),
  ).toBeDisabled()
  fireEvent.click(
    screen.getByRole('checkbox', { name: /I reviewed these exact values/ }),
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm and save record' }),
  )
}

test('name-only capture preserves unknown amounts, requires review, and later promotes the same ID and source', () => {
  const initial = demoWorkspace('pending')
  initial.coverage.collections.state = 'absent'
  const changed = vi.fn()
  function Harness() {
    const [workspace, setWorkspace] = useState(initial)
    return (
      <PendingFinance
        workspace={workspace}
        onChange={(next) => {
          changed(next)
          setWorkspace(next)
        }}
      />
    )
  }
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Add incomplete record' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Name or reference' }), {
    target: { value: 'Invoice waiting for amount' },
  })
  expect(changed).not.toHaveBeenCalled()
  confirmRecord()
  const captured = changed.mock.calls[0][0] as Workspace
  const pending = captured.pendingFinance![0]
  expect(pending.amount).toBeNull()
  expect(pending.paidAmount).toBeNull()
  expect(pending.counterparty).toBe('')
  expect(captured.finance).toEqual(initial.finance)
  expect(captured.cash).toEqual(initial.cash)
  expect(captured.coverage.collections.state).toBe('unknown')
  expect(
    captured.sources.find((source) => source.id === pending.sourceId)?.type,
  ).toBe('manual')
  fireEvent.click(
    screen.getByRole('button', { name: 'Complete Invoice waiting for amount' }),
  )
  fireEvent.change(
    screen.getByRole('spinbutton', {
      name: 'Original amount · blank means unknown',
    }),
    { target: { value: '125' } },
  )
  fireEvent.change(
    screen.getByRole('spinbutton', {
      name: 'Cumulative paid amount · blank means unknown',
    }),
    { target: { value: '0' } },
  )
  confirmRecord()
  const completed = changed.mock.calls[1][0] as Workspace
  expect(completed.pendingFinance).toEqual([])
  expect(
    completed.finance.find((record) => record.id === pending.id),
  ).toMatchObject({
    id: pending.id,
    sourceId: pending.sourceId,
    amount: 125,
    paidAmount: 0,
    dueDate: null,
    expectedDate: null,
    cashIncluded: false,
  })
  expect(completed.sources).toEqual(captured.sources)
  expect(completed.cash).toEqual(initial.cash)
})

test('explicit zero is retained while the other amount stays unknown and edits invalidate review', () => {
  const changed = vi.fn()
  render(
    <PendingFinance workspace={demoWorkspace('pending')} onChange={changed} />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Add incomplete record' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Name or reference' }), {
    target: { value: 'Paid amount unresolved' },
  })
  fireEvent.change(
    screen.getByRole('spinbutton', {
      name: 'Original amount · blank means unknown',
    }),
    { target: { value: '0' } },
  )
  fireEvent.click(screen.getByRole('button', { name: 'Review record' }))
  fireEvent.click(
    screen.getByRole('checkbox', { name: /I reviewed these exact values/ }),
  )
  fireEvent.change(screen.getByRole('textbox', { name: /Counterparty/ }), {
    target: { value: 'Supplier B' },
  })
  expect(
    screen.queryByRole('button', { name: 'Confirm and save record' }),
  ).not.toBeInTheDocument()
  confirmRecord()
  expect(changed.mock.calls[0][0].pendingFinance[0]).toMatchObject({
    amount: 0,
    paidAmount: null,
    counterparty: 'Supplier B',
  })
})

test('paid greater than original is rejected and a viewer can only inspect', () => {
  const changed = vi.fn()
  const workspace = demoWorkspace('pending')
  workspace.pendingFinance = [
    {
      id: 'pending-1',
      sourceId: 'manual-1',
      kind: 'payable',
      name: 'Supplier bill',
      counterparty: '',
      currency: 'MXN',
      amount: null,
      paidAmount: null,
      dueDate: null,
      expectedDate: null,
    },
  ]
  const { rerender } = render(
    <PendingFinance workspace={workspace} onChange={changed} />,
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Complete Supplier bill' }),
  )
  fireEvent.change(
    screen.getByRole('spinbutton', {
      name: 'Original amount · blank means unknown',
    }),
    { target: { value: '10' } },
  )
  fireEvent.change(
    screen.getByRole('spinbutton', {
      name: 'Cumulative paid amount · blank means unknown',
    }),
    { target: { value: '20' } },
  )
  fireEvent.click(screen.getByRole('button', { name: 'Review record' }))
  expect(screen.getByRole('alert')).toHaveTextContent('cannot exceed')
  expect(changed).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  rerender(
    <WorkspaceAccessContext.Provider value="viewer">
      <PendingFinance workspace={workspace} onChange={changed} />
    </WorkspaceAccessContext.Provider>,
  )
  expect(
    screen.getByRole('button', { name: 'Add incomplete record' }),
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Complete Supplier bill' }),
  ).toBeDisabled()
  expect(
    within(screen.getByRole('table')).getAllByText('Not provided').length,
  ).toBeGreaterThan(0)
})
