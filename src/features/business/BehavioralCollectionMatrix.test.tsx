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

    expect(screen.getByText('Total por cobrar activo')).toBeInTheDocument()
    expect(screen.getByText('Plazo real empírico (P50)')).toBeInTheDocument()
    expect(
      screen.getByText("Desfase de liquidez vs 'Net 30'"),
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
      name: /Activar Estrés ASEM \(\+76d\)/i,
    })
    expect(toggleBtn).toBeInTheDocument()

    // Toggle ON
    fireEvent.click(toggleBtn)

    expect(
      screen.getByText(
        /Efecto ASEM de 76 días aplicado \(Simulación de Estrés PyME\)/i,
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText(/Estrés ASEM Activo \(\+76d\)/i),
    ).toBeInTheDocument()

    expect(screen.getByText('Plazo con Estrés ASEM (+76d)')).toBeInTheDocument()

    // Toggle OFF
    fireEvent.click(screen.getByRole('button', { name: /Estrés ASEM Activo/i }))
    expect(
      screen.queryByText(/Efecto ASEM de 76 días aplicado/i),
    ).not.toBeInTheDocument()
  })

  it('switches between P50, P80 and Naive perspectives', () => {
    const workspace = demoWorkspace('matrix-perspectives')
    render(<BehavioralCollectionMatrix workspace={workspace} />)

    const p80Btn = screen.getByRole('button', {
      name: /P80 Empírico \(Conservador \/ Riesgo 80%\)/i,
    })
    const naiveBtn = screen.getByRole('button', {
      name: /Supuesto Ingenuo \("Net 30" \/ Contractual\)/i,
    })

    fireEvent.click(p80Btn)
    expect(
      screen.getByText(/Comportamiento Empírico P80 \(Conservador\)/i),
    ).toBeInTheDocument()

    fireEvent.click(naiveBtn)
    expect(screen.getByText(/Supuesto Ingenuo Net 30/i)).toBeInTheDocument()
  })

  it('keeps invoice details collapsed when changing the model and clears stress', () => {
    render(
      <BehavioralCollectionMatrix
        workspace={demoWorkspace('matrix-details')}
      />,
    )
    expect(
      screen.getByRole('columnheader', { name: 'Factura / Registro' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar facturas' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Activar Estrés ASEM (+76d)' }),
    )
    fireEvent.click(screen.getByRole('button', { name: /P80 Empírico/ }))

    expect(
      screen.getByRole('button', { name: 'Activar Estrés ASEM (+76d)' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(
      screen.getByText('Comportamiento Empírico P80 (Conservador)'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'Factura / Registro' }),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Mostrar desglose por factura' }),
    )
    expect(
      screen.getByRole('columnheader', { name: 'Factura / Registro' }),
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
      name: /Simular en Escenarios/i,
    })
    fireEvent.click(simBtn)

    expect(onNavigate).toHaveBeenCalledWith(
      'analysis',
      expect.stringContaining('question=Q-CUSTOMER-DEBT'),
    )
  })
})
