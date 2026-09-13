import { afterEach, expect, test, vi } from 'vitest'
import { createAssistantSession, getAssistantSpeech } from './assistant-api'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

test('requests assistant speech with workspace authorization and returns audio', async () => {
  localStorage.setItem('samby.workspace-key.workspace-1', 'private-workspace-key')
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(new Blob(['audio'], { type: 'audio/mpeg' }), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    }),
  )

  const audio = await getAssistantSpeech('workspace-1', 'session/1', 'message/1')

  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain(
    '/workspaces/workspace-1/assistant/sessions/session%2F1/messages/message%2F1/speech',
  )
  expect(init?.method).toBe('POST')
  expect((init?.headers as Headers).get('X-Workspace-Key')).toBe(
    'private-workspace-key',
  )
  expect(audio.type).toBe('audio/mpeg')
})

test('creates an assistant conversation inside the authorized workspace', async () => {
  localStorage.setItem('samby.workspace-key.workspace-1', 'private-workspace-key')
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        id: 'session-1',
        title: 'Inventory guide',
        page: 'inventory',
        created_at: '2026-09-12T00:00:00Z',
        updated_at: '2026-09-12T00:00:00Z',
        messages: [],
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    ),
  )

  await createAssistantSession('workspace-1', 'inventory', 'Inventory guide')

  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain('/workspaces/workspace-1/assistant/sessions')
  expect(init?.method).toBe('POST')
  expect((init?.headers as Headers).get('X-Workspace-Key')).toBe(
    'private-workspace-key',
  )
  expect(JSON.parse(String(init?.body))).toEqual({
    page: 'inventory',
    title: 'Inventory guide',
  })
})
