import { useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { apiFetch, streamSse, type SseEvent } from '../lib/api'

type Identity = { id: string; email: string; name: string | null; created_at: string }

export function DeveloperPanel() {
  const { accessToken } = useAuth()
  const [output, setOutput] = useState('Choose an example to verify the authenticated path.')
  const [running, setRunning] = useState(false)
  const controller = useRef<AbortController | null>(null)

  function token() {
    if (!accessToken) throw new Error('Your session has expired. Log in again.')
    return accessToken
  }

  async function callRest() {
    setRunning(true)
    try {
      const result = await apiFetch<Identity>('/auth/me', token())
      setOutput(JSON.stringify(result, null, 2))
    } catch (error) {
      setOutput(error instanceof Error ? error.message : 'REST request failed')
    } finally {
      setRunning(false)
    }
  }

  async function startSse() {
    controller.current?.abort()
    controller.current = new AbortController()
    setRunning(true)
    setOutput('Connecting…')
    try {
      await streamSse(
        '/events/stream',
        token(),
        (event: SseEvent) => setOutput(JSON.stringify(event, null, 2)),
        { signal: controller.current.signal },
      )
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setOutput(error instanceof Error ? error.message : 'SSE request failed')
      }
    } finally {
      setRunning(false)
    }
  }

  async function callAi() {
    controller.current?.abort()
    controller.current = new AbortController()
    setRunning(true)
    setOutput('')
    try {
      await streamSse(
        '/ai/chat/stream',
        token(),
        (event) => {
          const chunk = event.data as { text?: string; message?: string }
          if (event.event === 'reasoning' && chunk.text) {
            setOutput((current) => `${current}[thinking] ${chunk.text}`)
          } else if (event.event === 'content' && chunk.text) {
            setOutput((current) => current + chunk.text)
          } else if (event.event === 'error') {
            setOutput(chunk.message ?? 'AI request failed')
          }
        },
        {
          method: 'POST',
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Reply with a short hello.' }],
            options: { max_tokens: 80, reasoning_effort: 'low', show_thinking: false },
          }),
          signal: controller.current.signal,
        },
      )
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setOutput(error instanceof Error ? error.message : 'AI request failed')
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Protected sandbox</p>
          <h2 className="mt-2 text-xl font-semibold">Verify the wiring</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={callRest} disabled={running}>REST identity</ActionButton>
          <ActionButton onClick={startSse} disabled={running}>Open SSE</ActionButton>
          <ActionButton onClick={callAi} disabled={running}>Stream AI</ActionButton>
          {running && (
            <ActionButton onClick={() => controller.current?.abort()}>Stop</ActionButton>
          )}
        </div>
      </div>
      <pre className="mt-5 min-h-36 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950 p-4 text-xs leading-6 text-slate-300">
        {output}
      </pre>
    </section>
  )
}

function ActionButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-40"
      {...props}
    >
      {children}
    </button>
  )
}
