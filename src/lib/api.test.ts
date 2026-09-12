import { afterEach, expect, test, vi } from 'vitest'
import { streamSse } from './api'

afterEach(() => vi.restoreAllMocks())

test('parses fragmented SSE frames from an authenticated fetch stream', async () => {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: content\ndata: {"text":'))
      controller.enqueue(encoder.encode('"hello"}\n\nevent: done\ndata: {}\n\n'))
      controller.close()
    },
  })
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
  )
  const events: unknown[] = []

  await streamSse('/events/stream', 'jwt', (event) => events.push(event))

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/events/stream'),
    expect.objectContaining({ headers: expect.any(Headers) }),
  )
  const headers = fetchMock.mock.calls[0][1]?.headers as Headers
  expect(headers.get('Authorization')).toBe('Bearer jwt')
  expect(events).toEqual([
    { event: 'content', data: { text: 'hello' }, id: undefined },
    { event: 'done', data: {}, id: undefined },
  ])
})
