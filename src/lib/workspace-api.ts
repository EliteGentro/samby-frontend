import type { Workspace } from '../domain/workspace'

export const PLATFORM_URL =
  import.meta.env.VITE_ANALYSIS_URL || 'http://127.0.0.1:8001/api/prototype'
export const ACCOUNT_TOKEN_KEY = 'samby.access-token'
export type WorkspaceRole =
  | 'administrator'
  | 'owner'
  | 'finance'
  | 'inventory'
  | 'buyer'
  | 'viewer'
export type WorkspaceEnvelope = {
  workspace: Workspace
  revision: number
  role: WorkspaceRole
}
export type WorkspaceSummary = {
  id: string
  name: string
  mode: Workspace['mode']
  revision: number
  role: WorkspaceRole
}

export class PlatformError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function workspaceHeaders(workspaceId: string): Headers {
  const headers = new Headers({ 'X-Workspace-ID': workspaceId })
  const token = localStorage.getItem(ACCOUNT_TOKEN_KEY)
  const key = localStorage.getItem(`samby.workspace-key.${workspaceId}`)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (key) headers.set('X-Workspace-Key', key)
  return headers
}

export function createWorkspaceKey(workspaceId: string) {
  const storageKey = `samby.workspace-key.${workspaceId}`
  if (!localStorage.getItem(storageKey)) {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    localStorage.setItem(
      storageKey,
      Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''),
    )
  }
}

export async function platformRequest<T>(
  path: string,
  init: RequestInit = {},
  workspaceId?: string,
): Promise<T> {
  const headers = workspaceId ? workspaceHeaders(workspaceId) : new Headers()
  const token = localStorage.getItem(ACCOUNT_TOKEN_KEY)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  new Headers(init.headers).forEach((value, key) => headers.set(key, value))
  if (init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch(`${PLATFORM_URL}${path}`, { ...init, headers })
  } catch {
    throw new PlatformError(
      0,
      'Cannot reach Samby. Your unsaved changes are kept on this device. Retry when the service is available.',
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
        : `Request failed (${response.status}).`,
    )
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>)
}

export function downloadWorkspace(workspace: Workspace) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(workspace, null, 2)], {
      type: 'application/json',
    }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `samby-${workspace.mode}-${workspace.id}.json`
  link.click()
  URL.revokeObjectURL(url)
}
