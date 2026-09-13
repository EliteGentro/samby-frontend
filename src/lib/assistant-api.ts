import type { Page } from '../domain/workspace'
import { platformRequest } from './workspace-api'

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
