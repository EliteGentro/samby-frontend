import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { demoWorkspace } from '../../domain/workspace'
import { BehavioralCollectionMatrix } from './BehavioralCollectionMatrix'

afterEach(cleanup)

describe('BehavioralCollectionMatrix component', () => {
  it('renders the behavioral matrix with metrics and customer rows', () => {
    const workspace = demoWorkspace('matrix-test')
    render(<BehavioralCollectionMatrix workspace={workspace} />)

    expect(
      screen.getByRole('heading', {
        name: 'Behavioral Cash Collection Matrix',
      }),
    ).toBeInTheDocument()

    expect(screen.getByText('Total active receivable')).toBeInTheDocument()
    expect(screen.getByText('Empirical actual terms (P50)')).toBeInTheDocument()
    expect(
      screen.getByText("Liquidity gap vs 'Net 30'"),
    ).toBeInTheDocument()

    // Customers from demo data
    expect(
      screen.getAllByText('Comercial Atlas').length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Grupo Rivera').length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getAllByText('Ferretería Central').length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('activates ASEM stress toggle (+76 days) and reveals the PyME risk banner', () => {
    const workspace = demoWorkspace('matrix-asem')
    render(<BehavioralCollectionMatrix workspace={workspace} />)

    const toggleBtn = screen.getByRole('button', {
      name: /Activate ASEM Stress \(\+76d\)/i,
    })
    expect(toggleBtn).toBeInTheDocument()

    // Toggle ON
    fireEvent.click(toggleBtn)

    expect(
      screen.getByText(
        /76-day ASEM effect applied \(SME Stress Simulation\)/i,
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText(/ASEM Stress Active \(\+76d\)/i),
    ).toBeInTheDocument()

    expect(screen.getByText('Terms with ASEM Stress (+76d)')).toBeInTheDocument()

    // Toggle OFF
    fireEvent.click(screen.getByRole('button', { name: /ASEM Stress Active/i }))
    expect(
      screen.queryByText(/76-day ASEM effect applied/i),
    ).not.toBeInTheDocument()
  })

  it('switches between P50, P80 and Naive perspectives', () => {
    const workspace = demoWorkspace('matrix-perspectives')
    render(<BehavioralCollectionMatrix workspace={workspace} />)

    const p80Btn = screen.getByRole('button', {
      name: /Empirical P80 \(Conservative \/ 80% Risk\)/i,
    })
    const naiveBtn = screen.getByRole('button', {
      name: /Naive Assumption \("Net 30" \/ Contractual\)/i,
    })

    fireEvent.click(p80Btn)
    expect(
      screen.getByText(/Empirical P80 Behavior \(Conservative\)/i),
    ).toBeInTheDocument()

    fireEvent.click(naiveBtn)
    expect(screen.getByText(/Naive Net 30 Assumption/i)).toBeInTheDocument()
  })

  it('keeps invoice details collapsed when changing the model and clears stress', () => {
    render(
      <BehavioralCollectionMatrix
        workspace={demoWorkspace('matrix-details')}
      />,
    )
    expect(
      screen.getByRole('columnheader', { name: 'Invoice / Record' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hide invoices' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Activate ASEM Stress (+76d)' }),
    )
    fireEvent.click(screen.getByRole('button', { name: /Empirical P80/ }))

    expect(
      screen.getByRole('button', { name: 'Activate ASEM Stress (+76d)' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(
      screen.getByText('Empirical P80 Behavior (Conservative)'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'Invoice / Record' }),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Show invoice breakdown' }),
    )
    expect(
      screen.getByRole('columnheader', { name: 'Invoice / Record' }),
    ).toBeInTheDocument()
  })

  it('triggers navigation to scenario analysis when clicking Simular en Escenarios', () => {
    const workspace = demoWorkspace('matrix-nav')
    const onNavigate = vi.fn()
    render(
      <BehavioralCollectionMatrix
        workspace={workspace}
        onNavigate={onNavigate}
      />,
    )

    const simBtn = screen.getByRole('button', {
      name: /Simulate in Scenarios/i,
    })
    fireEvent.click(simBtn)

    expect(onNavigate).toHaveBeenCalledWith(
      'analysis',
      expect.stringContaining('question=Q-CUSTOMER-DEBT'),
    )
  })
})
