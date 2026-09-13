import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'

import { demoWorkspace, emptyWorkspace } from '../../domain/workspace'
import { SambyAssistant } from './SambyAssistant'

const api = vi.hoisted(() => ({
  createAssistantSession: vi.fn(),
  getAssistantSession: vi.fn(),
  getAssistantSpeech: vi.fn(),
  listAssistantSessions: vi.fn(),
  sendAssistantMessage: vi.fn(),
}))

vi.mock('../../lib/assistant-api', () => api)

const session = {
  id: 'session-1',
  title: 'New conversation',
  page: 'home' as const,
  created_at: '2026-09-12T00:00:00Z',
  updated_at: '2026-09-12T00:00:00Z',
  messages: [],
}

class FakeAudio {
  pause = vi.fn()
  play = vi.fn().mockResolvedValue(undefined)
  addEventListener = vi.fn()
}

beforeEach(() => {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
  localStorage.clear()
  localStorage.setItem('samby.guide-summary.voice-test.home', 'seen')
  api.listAssistantSessions.mockResolvedValue([session])
  api.getAssistantSession.mockResolvedValue(session)
  api.getAssistantSpeech.mockResolvedValue(
    new Blob(['audio'], { type: 'audio/mpeg' }),
  )
  api.sendAssistantMessage.mockResolvedValue({
    ...session,
    messages: [
      {
        id: 'user-1',
        role: 'user',
        content: 'What should I look at first?',
        page: 'home',
        sources: [],
        created_at: '2026-09-12T00:00:01Z',
      },
      {
        id: 'answer-1',
        role: 'assistant',
        content: 'Start with your missing inventory records.',
        page: 'home',
        sources: [],
        created_at: '2026-09-12T00:00:02Z',
      },
    ],
  })
  vi.stubGlobal('Audio', FakeAudio)
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:samby-voice')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('voice mode persists and automatically plays a new Samby answer', async () => {
  render(
    <SambyAssistant
      workspace={emptyWorkspace('voice-test')}
      page="home"
      pageName="Home"
      open
      onOpenChange={vi.fn()}
      ready
    />,
  )

  fireEvent.click(
    await screen.findByRole('button', { name: 'Turn on voice mode' }),
  )
  expect(localStorage.getItem('samby.guide.voice-mode')).toBe('on')
  fireEvent.click(
    screen.getByRole('button', { name: 'What should I look at first?' }),
  )

  await waitFor(() =>
    expect(api.getAssistantSpeech).toHaveBeenCalledWith(
      'voice-test',
      'session-1',
      'answer-1',
      expect.any(AbortSignal),
    ),
  )
  expect(
    await screen.findByText('Start with your missing inventory records.'),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Stop listening to this answer' }),
  ).toBeInTheDocument()
})

const mountGuide = (page: 'analysis' | 'data' | 'finance') => {
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
    const onOpenChange = mountGuide('analysis')
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Forecast')
    expect(dialog).toHaveTextContent('1 of 2')
    expect(dialog).toHaveTextContent('Choose scope, cutoff and horizon')
    fireEvent.click(screen.getByRole('button', { name: 'Next: Simulate' }))
    expect(dialog).toHaveTextContent('Simulate')
    expect(dialog).toHaveTextContent('Pick a question, or explore freely')
    expect(screen.getByRole('button', { name: 'Next section' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Samby' }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(
      localStorage.getItem('samby.guide-summary.guide-test.analysis'),
    ).toBe('seen')
  })

  it('shows a single unpaged section for Add-ons and the summary offer elsewhere', async () => {
    mountGuide('data')
    const catalog = await screen.findByRole('dialog')
    expect(catalog).toHaveTextContent('full catalog of everything Samby')
    expect(catalog).not.toHaveTextContent('1 of')
    cleanup()
    mountGuide('finance')
    expect(
      await screen.findByText('Would you like a quick summary?'),
    ).toBeInTheDocument()
  })
})
