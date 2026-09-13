import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SambyAssistant } from './SambyAssistant'
import { demoWorkspace } from '../../domain/workspace'

vi.mock('../../lib/assistant-api', () => ({
  createAssistantSession: vi.fn(),
  getAssistantSession: vi.fn(),
  listAssistantSessions: vi.fn(async () => []),
  sendAssistantMessage: vi.fn(),
}))

afterEach(cleanup)
beforeEach(() => localStorage.clear())

const mount = (page: 'analysis' | 'data' | 'finance') => {
  const onOpenChange = vi.fn()
  render(
    <SambyAssistant
      workspace={demoWorkspace('guide-test')}
      page={page}
      pageName={page}
      open={false}
      onOpenChange={onOpenChange}
      ready
    />,
  )
  return onOpenChange
}

describe('first-visit orientation', () => {
  it('pages from Forecast to Simulate and hands off to Samby Guide', async () => {
    const onOpenChange = mount('analysis')
    expect(await screen.findByText('Forecast')).toBeInTheDocument()
    expect(screen.getByText(/1 of 2/)).toBeInTheDocument()
    expect(
      screen.getByText(/Choose scope, cutoff and horizon/),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next: Simulate' }))
    expect(screen.getByText('Simulate')).toBeInTheDocument()
    expect(
      screen.getByText(/Pick a question, or explore freely/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next section' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Samby' }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(
      localStorage.getItem('samby.guide-summary.guide-test.analysis'),
    ).toBe('seen')
  })

  it('shows a single unpaged section for Add-ons and the summary offer elsewhere', async () => {
    mount('data')
    expect(
      await screen.findByText(/full catalog of everything Samby/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/1 of/)).not.toBeInTheDocument()
    cleanup()
    mount('finance')
    expect(
      await screen.findByText('Would you like a quick summary?'),
    ).toBeInTheDocument()
  })
})
