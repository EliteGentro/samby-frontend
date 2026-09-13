import { BACKEND_URL } from './config'

export type SseEvent = {
  event: string
  data: unknown
  id?: string
}

async function responseError(response: Response): Promise<Error> {
  try {
    const payload = (await response.json()) as { detail?: string }
    return new Error(
      payload.detail ?? `API request failed (${response.status})`,
    )
  } catch {
    return new Error(`API request failed (${response.status})`)
  }
}

export async function publicApiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${BACKEND_URL}${path}`, { ...init, headers })
  if (!response.ok) throw await responseError(response)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function apiFetch<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  if (init.body) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${BACKEND_URL}${path}`, { ...init, headers })
  if (!response.ok) throw await responseError(response)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function decodeEvent(frame: string): SseEvent | null {
  let event = 'message'
  let id: string | undefined
  const data: string[] = []
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    if (line.startsWith('id:')) id = line.slice(3).trim()
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
  }
  if (!data.length) return null
  const raw = data.join('\n')
  try {
    return { event, id, data: JSON.parse(raw) }
  } catch {
    return { event, id, data: raw }
  }
}

/**
 * Stream authenticated SSE over fetch. Native EventSource cannot set a bearer
 * header, and putting a JWT in the URL would leak it into logs and history.
 */
export async function streamSse(
  path: string,
  accessToken: string,
  onEvent: (event: SseEvent) => void,
  init: RequestInit = {},
): Promise<void> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  headers.set('Accept', 'text/event-stream')
  if (init.body) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${BACKEND_URL}${path}`, { ...init, headers })
  if (!response.ok || !response.body) {
    throw new Error(`SSE request failed (${response.status})`)
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    buffer += value ?? ''
    const frames = buffer.split(/\r?\n\r?\n/)
    buffer = frames.pop() ?? ''
    frames.forEach((frame) => {
      const event = decodeEvent(frame)
      if (event) onEvent(event)
    })
    if (done) break
  }
  if (buffer) {
    const event = decodeEvent(buffer)
    if (event) onEvent(event)
  }
}
