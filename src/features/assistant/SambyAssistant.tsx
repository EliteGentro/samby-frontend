import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  BookOpenText,
  ChevronDown,
  MessageCircleMore,
  Minimize2,
  Plus,
  Send,
  Sparkles,
} from 'lucide-react'
import { Modal } from '../../components/workspace-ui'
import type { Page, Workspace } from '../../domain/workspace'
import {
  createAssistantSession,
  getAssistantSession,
  listAssistantSessions,
  sendAssistantMessage,
  type AssistantMessage,
  type AssistantSession,
} from '../../lib/assistant-api'

const PAGE_GUIDANCE: Record<
  Page,
  { intro: string; prompts: string[] }
> = {
  home: {
    intro: 'Get oriented around your workspace and decide what deserves attention first.',
    prompts: ['What should I look at first?', 'Which information is still missing?'],
  },
  inventory: {
    intro: 'Understand stock, availability, purchasing, and the evidence behind inventory metrics.',
    prompts: ['Summarize my inventory position', 'Which products need attention?'],
  },
  dashboards: {
    intro: 'Interpret the metrics on this dashboard without losing their scope or assumptions.',
    prompts: ['Explain the key metrics', 'What changed in my business?'],
  },
  analysis: {
    intro: 'Choose the right forecast or simulation and understand what its inputs mean.',
    prompts: ['Which analysis should I run?', 'Explain the required assumptions'],
  },
  finance: {
    intro: 'Make sense of cash, receivables, obligations, and dated financial records.',
    prompts: ['Summarize my financial position', 'What payments are coming up?'],
  },
  data: {
    intro: 'See which data unlocks each capability and how records are reviewed before use.',
    prompts: ['What data should I add next?', 'Explain standardization'],
  },
  settings: {
    intro: 'Understand workspace access, preferences, and how saved information is protected.',
    prompts: ['Explain workspace roles', 'How is my workspace saved?'],
  },
}

function messageParagraphs(message: AssistantMessage) {
  return message.content.split(/\n{2,}/).filter(Boolean)
}

export function SambyAssistant({
  workspace,
  page,
  pageName,
  open,
  onOpenChange,
  ready,
}: {
  workspace: Workspace
  page: Page
  pageName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  ready: boolean
}) {
  const [sessions, setSessions] = useState<AssistantSession[]>([])
  const [active, setActive] = useState<AssistantSession | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryState, setSummaryState] = useState<
    'offer' | 'loading' | 'result'
  >('offer')
  const [summaryMessage, setSummaryMessage] = useState<AssistantMessage | null>(
    null,
  )
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true)
        setError('')
      }
    })
    listAssistantSessions(workspace.id)
      .then(async (items) => {
        if (cancelled) return
        setSessions(items)
        if (items[0]) {
          const detail = await getAssistantSession(workspace.id, items[0].id)
          if (!cancelled) setActive(detail)
        } else {
          setActive(null)
        }
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Your saved conversations could not be opened.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [workspace.id, ready])

  useEffect(() => {
    const key = `samby.guide-summary.${workspace.id}.${page}`
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setSummaryMessage(null)
      setSummaryState('offer')
      setSummaryOpen(localStorage.getItem(key) !== 'seen')
    })
    return () => {
      cancelled = true
    }
  }, [workspace.id, page])

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [active?.messages?.length, open])

  function markSummarySeen() {
    localStorage.setItem(
      `samby.guide-summary.${workspace.id}.${page}`,
      'seen',
    )
  }

  async function newSession(title = 'New conversation') {
    setError('')
    const created = await createAssistantSession(workspace.id, page, title)
    setActive(created)
    setSessions((current) => [
      created,
      ...current.filter((item) => item.id !== created.id),
    ])
    return created
  }

  async function selectSession(sessionId: string) {
    setLoading(true)
    setError('')
    try {
      setActive(await getAssistantSession(workspace.id, sessionId))
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'That conversation could not be opened.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function ask(content: string, session?: AssistantSession) {
    const target = session ?? active ?? (await newSession())
    const temporary: AssistantMessage = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content,
      page,
      sources: [],
      created_at: new Date().toISOString(),
    }
    setActive({
      ...target,
      messages: [...(target.messages ?? []), temporary],
    })
    setSending(true)
    setError('')
    try {
      const updated = await sendAssistantMessage(
        workspace.id,
        target.id,
        page,
        content,
      )
      setActive(updated)
      setSessions((current) => [
        updated,
        ...current.filter((item) => item.id !== updated.id),
      ])
      return updated.messages?.at(-1) ?? null
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Samby Guide could not answer right now.',
      )
      return null
    } finally {
      setSending(false)
    }
  }

  async function requestSummary() {
    markSummarySeen()
    if (!ready) {
      setError('Samby is still connecting to this workspace. Try again in a moment.')
      return
    }
    setSummaryState('loading')
    setError('')
    try {
      const session = await newSession(`${pageName} guide`)
      const response = await ask(
        `Give me a short orientation for the ${pageName} page. Explain what I am looking at, summarize the most useful current workspace facts, and tell me the best next step.`,
        session,
      )
      if (response) {
        setSummaryMessage(response)
        setSummaryState('result')
      } else {
        setSummaryState('offer')
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'The page summary could not be created.',
      )
      setSummaryState('offer')
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || sending) return
    setDraft('')
    await ask(content)
  }

  const messages = active?.messages ?? []
  return (
    <>
      <Modal
        open={summaryOpen}
        onClose={() => {
          markSummarySeen()
          setSummaryOpen(false)
        }}
        title={summaryState === 'result' ? `${pageName}, at a glance` : `Welcome to ${pageName}`}
        description={
          summaryState === 'result'
            ? 'Based on this workspace and the records currently available.'
            : PAGE_GUIDANCE[page].intro
        }
      >
        {summaryState === 'offer' && (
          <div className="assistant-summary-offer">
            <span className="assistant-orb" aria-hidden="true">
              <Sparkles size={24} />
            </span>
            <div>
              <h3>Would you like a quick summary?</h3>
              <p>
                Samby Guide can explain this page using your current workspace.
                Numbers are calculated from saved records, and missing values stay
                clearly marked.
              </p>
            </div>
            {error && <p className="assistant-error" role="alert">{error}</p>}
            <div className="assistant-summary-actions">
              <button
                className="button primary"
                onClick={() => void requestSummary()}
                disabled={!ready}
              >
                <Sparkles size={15} />
                Summarize this page
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  markSummarySeen()
                  setSummaryOpen(false)
                }}
              >
                Not now
              </button>
            </div>
          </div>
        )}
        {summaryState === 'loading' && (
          <div className="assistant-summary-loading" role="status">
            <span className="assistant-orb thinking" aria-hidden="true">
              <Sparkles size={24} />
            </span>
            <div>
              <h3>Reading your {pageName.toLowerCase()} context…</h3>
              <p>Checking the relevant records and calculating the useful metrics.</p>
            </div>
          </div>
        )}
        {summaryState === 'result' && summaryMessage && (
          <div className="assistant-summary-result">
            <div className="assistant-answer-copy">
              {messageParagraphs(summaryMessage).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            {summaryMessage.sources.length > 0 && (
              <div className="assistant-sources">
                <span>Grounded in</span>
                {summaryMessage.sources.map((source) => (
                  <span className="assistant-source" key={source.id}>
                    {source.title}
                  </span>
                ))}
              </div>
            )}
            <div className="assistant-summary-actions">
              <button
                className="button primary"
                onClick={() => {
                  setSummaryOpen(false)
                  onOpenChange(true)
                }}
              >
                Keep Samby Guide open
              </button>
              <button
                className="button secondary"
                onClick={() => setSummaryOpen(false)}
              >
                Continue working
              </button>
            </div>
          </div>
        )}
      </Modal>

      {open && (
        <aside className="assistant-panel" aria-label="Samby Guide">
          <header className="assistant-panel-header">
            <div className="assistant-title">
              <span className="assistant-orb small" aria-hidden="true">
                <Sparkles size={17} />
              </span>
              <span>
                <strong>Samby Guide</strong>
                <small>Here with {pageName.toLowerCase()} context</small>
              </span>
            </div>
            <button
              className="icon-button"
              aria-label="Minimize Samby Guide"
              onClick={() => onOpenChange(false)}
            >
              <Minimize2 size={17} />
            </button>
          </header>

          <div className="assistant-session-bar">
            <label>
              <span className="sr-only">Conversation</span>
              <select
                value={active?.id ?? ''}
                onChange={(event) => void selectSession(event.target.value)}
                disabled={sessions.length === 0 || loading}
              >
                {sessions.length === 0 && <option value="">New conversation</option>}
                {sessions.map((session) => (
                  <option value={session.id} key={session.id}>
                    {session.title}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </label>
            <button
              className="icon-button"
              aria-label="Start a new conversation"
              onClick={() => void newSession()}
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="assistant-thread">
            {loading && <p className="assistant-status" role="status">Opening your conversations…</p>}
            {!loading && messages.length === 0 && (
              <div className="assistant-empty">
                <span className="assistant-orb" aria-hidden="true">
                  <MessageCircleMore size={23} />
                </span>
                <h2>What can I help you understand?</h2>
                <p>{PAGE_GUIDANCE[page].intro}</p>
                <div className="assistant-prompts">
                  {PAGE_GUIDANCE[page].prompts.map((prompt) => (
                    <button key={prompt} onClick={() => void ask(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => (
              <article
                key={message.id}
                className={`assistant-message ${message.role}`}
              >
                <span className="assistant-message-label">
                  {message.role === 'assistant' ? 'Samby Guide' : 'You'}
                </span>
                <div className="assistant-answer-copy">
                  {messageParagraphs(message).map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
                {message.role === 'assistant' && message.sources.length > 0 && (
                  <div className="assistant-sources compact">
                    <BookOpenText size={13} />
                    {message.sources.map((source) => (
                      <span className="assistant-source" key={source.id}>
                        {source.title}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
            {sending && (
              <p className="assistant-status" role="status">
                <span className="assistant-typing"><i /><i /><i /></span>
                Checking your workspace…
              </p>
            )}
            {error && <p className="assistant-error" role="alert">{error}</p>}
            <div ref={endRef} />
          </div>

          <form className="assistant-composer" onSubmit={submit}>
            <label htmlFor="assistant-question" className="sr-only">
              Ask Samby Guide
            </label>
            <textarea
              id="assistant-question"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder={`Ask about ${pageName.toLowerCase()}…`}
              rows={2}
              maxLength={4000}
            />
            <button
              className="assistant-send"
              aria-label="Send question"
              disabled={!draft.trim() || sending}
            >
              <Send size={17} />
            </button>
            <small>Uses this workspace. Enter to send, Shift+Enter for a new line.</small>
          </form>
        </aside>
      )}
    </>
  )
}
