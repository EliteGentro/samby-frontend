import type { Page } from '../domain/workspace'
import {
  PLATFORM_URL,
  PlatformError,
  platformRequest,
  workspaceHeaders,
} from './workspace-api'

export type AssistantSource = { id: string; title: string }

export type AssistantMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  page: Page
  sources: AssistantSource[]
  created_at: string
}

export type AssistantSession = {
  id: string
  title: string
  page: Page
  created_at: string
  updated_at: string
  messages?: AssistantMessage[]
}

const base = (workspaceId: string) =>
  `/workspaces/${encodeURIComponent(workspaceId)}/assistant`

export function listAssistantSessions(workspaceId: string) {
  return platformRequest<AssistantSession[]>(
    `${base(workspaceId)}/sessions`,
    {},
    workspaceId,
  )
}

export function getAssistantSession(workspaceId: string, sessionId: string) {
  return platformRequest<AssistantSession>(
    `${base(workspaceId)}/sessions/${encodeURIComponent(sessionId)}`,
    {},
    workspaceId,
  )
}

export function createAssistantSession(
  workspaceId: string,
  page: Page,
  title = 'New conversation',
) {
  return platformRequest<AssistantSession>(
    `${base(workspaceId)}/sessions`,
    { method: 'POST', body: JSON.stringify({ page, title }) },
    workspaceId,
  )
}

export function sendAssistantMessage(
  workspaceId: string,
  sessionId: string,
  page: Page,
  content: string,
) {
  return platformRequest<AssistantSession>(
    `${base(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/messages`,
    { method: 'POST', body: JSON.stringify({ page, content }) },
    workspaceId,
  )
}

export async function getAssistantSpeech(
  workspaceId: string,
  sessionId: string,
  messageId: string,
  signal?: AbortSignal,
) {
  const path = `${base(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}/speech`
  let response: Response
  try {
    response = await fetch(`${PLATFORM_URL}${path}`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new PlatformError(
      0,
      'Cannot reach Samby voice right now. Try listening again in a moment.',
    )
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const detail =
      body && typeof body === 'object' && 'detail' in body ? body.detail : null
    throw new PlatformError(
      response.status,
      typeof detail === 'string'
        ? detail
        : `Voice request failed (${response.status}).`,
    )
  }
  return response.blob()
}
