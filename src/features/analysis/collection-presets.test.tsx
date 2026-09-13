import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { demoWorkspace } from '../../domain/workspace'
import { AnalysisEditor } from './AnalysisEditor'
import { newConfig, validateEditor } from './config'

afterEach(cleanup)

test('collection presets use the selected customer history and preserve stress in the submitted scenario', () => {
  const workspace = demoWorkspace('collection-presets')
  const onSubmit = vi.fn()
  render(
    <AnalysisEditor
      seed={{
        kind: 'simulation',
        question: 'Q-CRITICAL-COLLECTION',
        basis: workspace,
      }}
      runs={[]}
      busy={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  )
  expect(
    screen.getByRole('button', { name: 'Empirical P50 (+10d)' }),
  ).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Collection to change'), {
    target: { value: 'inv-1024' },
  })
  const delay = screen.getByLabelText('Collection timing change in days')
  const p50 = screen.getByRole('button', { name: 'Empirical P50 (+11d)' })
  const p80 = screen.getByRole('button', { name: 'Empirical P80 (+12d)' })
  const stress = screen.getByRole('button', { name: 'ASEM Stress (+76d)' })
  fireEvent.click(p80)
  expect(delay).toHaveValue(12)
  fireEvent.click(stress)
  expect(delay).toHaveValue(87)
  expect(
    screen.getByText(/ASEM 76-day effect applied/),
  ).toBeInTheDocument()
  fireEvent.click(stress)
  expect(delay).toHaveValue(11)
  expect(screen.queryByText(/ASEM 76-day effect applied/)).toBeNull()
  fireEvent.click(stress)
  fireEvent.click(p50)
  expect(delay).toHaveValue(11)
  expect(screen.queryByText(/ASEM 76-day effect applied/)).toBeNull()
  fireEvent.click(stress)
  fireEvent.click(p80)
  expect(delay).toHaveValue(12)
  expect(screen.queryByText(/ASEM 76-day effect applied/)).toBeNull()
  fireEvent.click(stress)
  fireEvent.click(screen.getByLabelText(/I reviewed these category states/))
  fireEvent.click(screen.getByRole('button', { name: 'Save and run' }))
  expect(onSubmit).toHaveBeenCalledOnce()
  expect(onSubmit.mock.calls[0][0].config.assumptions).toEqual({
    collection_id: 'inv-1024',
    collection_delay_days: 87,
    asem_stress: true,
  })
  expect(onSubmit.mock.calls[0][1]).toBe(true)
  expect(onSubmit.mock.calls[0][0].snapshot.finance).toEqual(workspace.finance)
})

test('a customer without observed payments falls back to the portfolio preset', () => {
  const workspace = demoWorkspace('unobserved-customer')
  workspace.finance = workspace.finance.map((record) =>
    record.id === 'inv-1024'
      ? { ...record, counterparty: 'Customer without history' }
      : record,
  )
  render(
    <AnalysisEditor
      seed={{
        kind: 'simulation',
        question: 'Q-CRITICAL-COLLECTION',
        basis: workspace,
      }}
      runs={[]}
      busy={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />,
  )
  fireEvent.change(screen.getByLabelText('Collection to change'), {
    target: { value: 'inv-1024' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Empirical P50 (+10d)' }))
  expect(screen.getByLabelText('Collection timing change in days')).toHaveValue(
    10,
  )
})

test('removing cash and debt results removes collection stress from the saved definition', () => {
  const onSubmit = vi.fn()
  render(
    <AnalysisEditor
      seed={{
        kind: 'simulation',
        question: 'Q-EXPLORE',
        basis: demoWorkspace('remove-collection-output'),
      }}
      runs={[]}
      busy={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  )
  fireEvent.click(screen.getByLabelText('Cash and obligations'))
  fireEvent.click(screen.getByRole('button', { name: 'ASEM Stress (+76d)' }))
  fireEvent.click(screen.getByLabelText('Cash and obligations'))
  expect(screen.queryByRole('button', { name: /ASEM Stress/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Save definition' }))
  expect(onSubmit).toHaveBeenCalledOnce()
  expect(onSubmit.mock.calls[0][0].config.assumptions).not.toHaveProperty(
    'asem_stress',
  )
  expect(onSubmit.mock.calls[0][0].config.assumptions).not.toHaveProperty(
    'collection_delay_days',
  )
})

test('ASEM satisfies required timing validation while critical collections still need a record', () => {
  const workspace = demoWorkspace('collection-validation')
  const critical = newConfig('simulation', 'Q-CRITICAL-COLLECTION', workspace)
  critical.coverage_reviewed = true
  critical.assumptions = { asem_stress: true }
  expect(validateEditor(critical, 'simulation', workspace)).toContain(
    'Select the critical collection',
  )
  critical.assumptions.collection_id = 'inv-1024'
  expect(validateEditor(critical, 'simulation', workspace)).toBeNull()
  critical.assumptions.asem_stress = false
  expect(validateEditor(critical, 'simulation', workspace)).toContain(
    'enter its timing change in days',
  )
  const debt = newConfig('simulation', 'Q-CUSTOMER-DEBT', workspace)
  debt.assumptions = { asem_stress: true }
  expect(validateEditor(debt, 'simulation', workspace)).toBeNull()
  debt.assumptions.asem_stress = false
  expect(validateEditor(debt, 'simulation', workspace)).toBe(
    'Enter the customer collection delay to test.',
  )
})
