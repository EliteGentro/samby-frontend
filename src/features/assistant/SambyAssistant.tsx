import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  BookOpenText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  MessageCircleMore,
  Minimize2,
  Plus,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Modal } from '../../components/workspace-ui'
import { BrandLogo } from '../../components/BrandLogo'
import type { Page, Workspace } from '../../domain/workspace'
import {
  createAssistantSession,
  getAssistantSpeech,
  getAssistantSession,
  listAssistantSessions,
  sendAssistantMessage,
  type AssistantMessage,
  type AssistantSession,
} from '../../lib/assistant-api'
import { AssistantMarkdown } from './AssistantMarkdown'

// A page may replace the generic summary offer with a short orientation:
// what the page is for, how it works, and a direct path to Samby Guide.
// Pages that bundle two experiences (Forecast & Simulate) list one section
// per experience; the dialog pages through them.
type GuideSection = { title: string; about: string; steps: string[] }
const PAGE_GUIDANCE: Record<
  Page,
  { intro: string; prompts: string[]; guide?: GuideSection[] }
> = {
  home: {
    intro:
      'Get oriented around your workspace and decide what deserves attention first.',
    prompts: [
      'What should I look at first?',
      'Which information is still missing?',
    ],
  },
  insights: {
    intro:
      'Diagnose business health, examine critical threats to prevent, and explore capital optimizations.',
    prompts: [
      'What is my biggest business threat right now?',
      'How can I improve my Business Health Score?',
      'Where is capital trapped?',
    ],
  },
  inventory: {
    intro:
      'Understand stock, availability, purchasing, and the evidence behind inventory metrics.',
    prompts: [
      'Summarize my inventory position',
      'Which products need attention?',
    ],
  },
  dashboards: {
    intro:
      'Interpret the metrics on this dashboard without losing their scope or assumptions.',
    prompts: ['Explain the key metrics', 'What changed in my business?'],
  },
  analysis: {
    intro:
      'Choose the right forecast or simulation and understand what its inputs mean.',
    prompts: [
      'Which analysis should I run?',
      'Explain the required assumptions',
    ],
    guide: [
      {
        title: 'Forecast',
        about:
          'A forecast estimates future demand from your accepted sales history. Every run keeps an immutable copy of its inputs, so you can leave the page and come back to exactly the same result.',
        steps: [
          'Choose scope, cutoff and horizon. Only dated sales with quantities count. Missing dates are never treated as zero demand.',
          'Pick an engine. Naïve and seasonal naïve need very little history; LightGBM and CatBoost need longer consecutive history and report their own holdout error. Ineligible engines say why.',
          'Save and run. Execution happens in the background. Results, warnings and provenance stay in history even if your data changes later.',
        ],
      },
      {
        title: 'Simulate',
        about:
          'A simulation answers a business question: a new order, replenishment, a critical collection, cash sufficiency. It combines a completed forecast and/or the events you declare with your stock, supplier and cash records, and returns dated results.',
        steps: [
          'Pick a question, or explore freely. Each question lists the inputs it needs. Missing ones are explained, never invented.',
          'Declare assumptions. Orders, delays, price changes, lead times or a cash reserve. A referenced forecast can still be running; the simulation waits for it.',
          'Compare and decide. Results show time series, event traces, limitations and provenance. Samby shows the tradeoffs; the decision stays with you.',
        ],
      },
    ],
  },
  finance: {
    intro:
      'Make sense of cash, receivables, obligations, and dated financial records.',
    prompts: [
      'Summarize my financial position',
      'What payments are coming up?',
    ],
  },
  data: {
    intro:
      'See which data unlocks each capability and how records are reviewed before use.',
    prompts: ['What data should I add next?', 'Explain standardization'],
    guide: [
      {
        title: 'Add-ons & Data',
        about:
          'This is the full catalog of everything Samby can calculate for your business, and what each calculation needs from your records. Nothing here is switched on by hand: a capability unlocks by itself the moment its minimum data exists.',
        steps: [
          'Add records. Sales, stock, suppliers, cash, receivables. Each card lists the minimum fields it needs and links to the right entry or import flow.',
          'Capabilities unlock on their own. A card moves from Not provided to Available with warning to Available as usable data arrives. Presence decides; quality only adds warnings and never locks anything again.',
          'Tune what you see. An unlocked capability gets an On / Muted switch. Muting only hides its cards and optional alerts. Your data, calculations and saved runs stay untouched.',
        ],
      },
    ],
  },
  settings: {
    intro:
      'Understand workspace access, preferences, and how saved information is protected.',
    prompts: ['Explain workspace roles', 'How is my workspace saved?'],
  },
}

const VOICE_MODE_KEY = 'samby.guide.voice-mode'

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
  const [voiceError, setVoiceError] = useState('')
  const [voiceEnabled, setVoiceEnabled] = useState(
    () => localStorage.getItem(VOICE_MODE_KEY) === 'on',
  )
  const [speechState, setSpeechState] = useState<{
    messageId: string
    status: 'loading' | 'playing'
  } | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryState, setSummaryState] = useState<
    'offer' | 'loading' | 'result'
  >('offer')
  const [summaryMessage, setSummaryMessage] = useState<AssistantMessage | null>(
    null,
  )
  const [guidePage, setGuidePage] = useState(0)
  const endRef = useRef<HTMLDivElement>(null)
  const voiceEnabledRef = useRef(voiceEnabled)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef('')
  const speechRequestRef = useRef<AbortController | null>(null)
  const speechCacheRef = useRef(new Map<string, Blob>())

  function stopSpeech() {
    speechRequestRef.current?.abort()
    speechRequestRef.current = null
    audioRef.current?.pause()
    audioRef.current = null
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = ''
    setSpeechState(null)
  }

  async function playMessage(
    message: AssistantMessage,
    sessionId = active?.id ?? '',
  ) {
    stopSpeech()
    setVoiceError('')
    const controller = new AbortController()
    speechRequestRef.current = controller
    setSpeechState({ messageId: message.id, status: 'loading' })
    try {
      let blob = speechCacheRef.current.get(message.id)
      if (!blob) {
        blob = await getAssistantSpeech(
          workspace.id,
          sessionId,
          message.id,
          controller.signal,
        )
        if (speechCacheRef.current.size >= 10) {
          const oldest = speechCacheRef.current.keys().next().value
          if (oldest) speechCacheRef.current.delete(oldest)
        }
        speechCacheRef.current.set(message.id, blob)
      }
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      speechRequestRef.current = null
      audioUrlRef.current = url
      audioRef.current = audio
      audio.addEventListener(
        'ended',
        () => {
          if (audioRef.current !== audio) return
          audioRef.current = null
          URL.revokeObjectURL(url)
          audioUrlRef.current = ''
          setSpeechState(null)
        },
        { once: true },
      )
      audio.addEventListener(
        'error',
        () => {
          if (audioRef.current !== audio) return
          stopSpeech()
          setVoiceError('This answer could not be played. Try listening again.')
        },
        { once: true },
      )
      await audio.play()
      setSpeechState({ messageId: message.id, status: 'playing' })
    } catch (reason) {
      if (controller.signal.aborted) return
      stopSpeech()
      setVoiceError(
        reason instanceof Error
          ? reason.message
          : 'Samby could not create audio for this answer.',
      )
    }
  }

  function toggleVoiceMode() {
    const enabled = !voiceEnabledRef.current
    voiceEnabledRef.current = enabled
    setVoiceEnabled(enabled)
    localStorage.setItem(VOICE_MODE_KEY, enabled ? 'on' : 'off')
    setVoiceError('')
    if (!enabled) stopSpeech()
  }

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
      setGuidePage(0)
    })
    return () => {
      cancelled = true
    }
  }, [workspace.id, page])

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [active?.messages?.length, open])

  useEffect(
    () => () => {
      speechRequestRef.current?.abort()
      audioRef.current?.pause()
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    },
    [],
  )

  function markSummarySeen() {
    localStorage.setItem(`samby.guide-summary.${workspace.id}.${page}`, 'seen')
  }

  async function newSession(title = 'New conversation') {
    stopSpeech()
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
    stopSpeech()
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
      const response = updated.messages?.at(-1) ?? null
      if (response?.role === 'assistant' && voiceEnabledRef.current) {
        void playMessage(response, updated.id)
      }
      return response
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
      setError(
        'Samby is still connecting to this workspace. Try again in a moment.',
      )
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
  const guide = PAGE_GUIDANCE[page].guide
  const section = guide?.[Math.min(guidePage, guide.length - 1)]
  return (
    <>
      <Modal
        open={summaryOpen}
        onClose={() => {
          markSummarySeen()
          setSummaryOpen(false)
        }}
        title={
          summaryState === 'result'
            ? `${pageName}, at a glance`
            : `Welcome to ${pageName}`
        }
        description={
          summaryState === 'result'
            ? 'Based on this workspace and the records currently available.'
            : PAGE_GUIDANCE[page].intro
        }
      >
        {summaryState === 'offer' && guide && section && (
          <div className="assistant-summary-guide">
            {guide.length > 1 && (
              <div className="assistant-guide-pager">
                <span className="assistant-guide-section">
                  {section.title}
                  <span className="muted">
                    {' '}
                    · {guidePage + 1} of {guide.length}
                  </span>
                </span>
                <span className="assistant-guide-pager-buttons">
                  <button
                    className="icon-button"
                    aria-label={
                      guidePage > 0
                        ? `Back to ${guide[guidePage - 1].title}`
                        : 'Previous section'
                    }
                    disabled={guidePage === 0}
                    onClick={() => setGuidePage((current) => current - 1)}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={
                      guidePage < guide.length - 1
                        ? `Next: ${guide[guidePage + 1].title}`
                        : 'Next section'
                    }
                    disabled={guidePage >= guide.length - 1}
                    onClick={() => setGuidePage((current) => current + 1)}
                  >
                    <ChevronRight size={18} />
                  </button>
                </span>
              </div>
            )}
            <div className="assistant-summary-guide-head">
              <span className="assistant-orb" aria-hidden="true">
                <Sparkles size={24} />
              </span>
              <p>{section.about}</p>
            </div>
            <h3>How it works</h3>
            <ol className="assistant-guide-steps" key={section.title}>
              {section.steps.map((step, index) => (
                <li key={index}>
                  <span
                    className="assistant-guide-step-number"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="assistant-guide-more">
              More questions? Samby Guide answers using your current workspace.
            </p>
            {error && (
              <p className="assistant-error" role="alert">
                {error}
              </p>
            )}
            <div className="assistant-summary-actions">
              <button
                className="button primary"
                onClick={() => {
                  markSummarySeen()
                  setSummaryOpen(false)
                  onOpenChange(true)
                }}
                disabled={!ready}
              >
                <MessageCircleMore size={15} />
                Ask Samby
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
        {summaryState === 'offer' && !guide && (
          <div className="assistant-summary-offer">
            <span className="assistant-orb" aria-hidden="true">
              <BrandLogo variant="symbol" decorative />
            </span>
            <div>
              <h3>Would you like a quick summary?</h3>
              <p>
                Samby Guide can explain this page using your current workspace.
                Numbers are calculated from saved records, and missing values
                stay clearly marked.
              </p>
            </div>
            {error && (
              <p className="assistant-error" role="alert">
                {error}
              </p>
            )}
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
              <BrandLogo variant="symbol" decorative />
            </span>
            <div>
              <h3>Reading your {pageName.toLowerCase()} context…</h3>
              <p>
                Checking the relevant records and calculating the useful
                metrics.
              </p>
            </div>
          </div>
        )}
        {summaryState === 'result' && summaryMessage && (
          <div className="assistant-summary-result">
            <div className="assistant-answer-copy">
              <AssistantMarkdown content={summaryMessage.content} />
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
                <BrandLogo variant="symbol" decorative />
              </span>
              <span>
                <strong>Samby Guide</strong>
                <small>Here with {pageName.toLowerCase()} context</small>
              </span>
            </div>
            <div className="assistant-header-actions">
              <button
                type="button"
                className={`assistant-voice-toggle ${voiceEnabled ? 'active' : ''}`}
                aria-label={
                  voiceEnabled ? 'Turn off voice mode' : 'Turn on voice mode'
                }
                aria-pressed={voiceEnabled}
                onClick={toggleVoiceMode}
                title={voiceEnabled ? 'Voice mode is on' : 'Turn on voice mode'}
              >
                {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                <span>Voice</span>
              </button>
              <button
                className="icon-button"
                aria-label="Minimize Samby Guide"
                onClick={() => {
                  stopSpeech()
                  onOpenChange(false)
                }}
              >
                <Minimize2 size={17} />
              </button>
            </div>
          </header>

          <div className="assistant-session-bar">
            <label>
              <span className="sr-only">Conversation</span>
              <select
                value={active?.id ?? ''}
                onChange={(event) => void selectSession(event.target.value)}
                disabled={sessions.length === 0 || loading}
              >
                {sessions.length === 0 && (
                  <option value="">New conversation</option>
                )}
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
            {loading && (
              <p className="assistant-status" role="status">
                Opening your conversations…
              </p>
            )}
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
                <div className="assistant-message-heading">
                  <span className="assistant-message-label">
                    {message.role === 'assistant' ? 'Samby Guide' : 'You'}
                  </span>
                  {message.role === 'assistant' && (
                    <button
                      type="button"
                      className="assistant-listen-button"
                      aria-label={
                        speechState?.messageId === message.id &&
                        speechState.status === 'playing'
                          ? 'Stop listening to this answer'
                          : 'Listen to this answer'
                      }
                      onClick={() => {
                        if (speechState?.messageId === message.id) stopSpeech()
                        else void playMessage(message)
                      }}
                    >
                      {speechState?.messageId === message.id &&
                      speechState.status === 'loading' ? (
                        <LoaderCircle className="assistant-spin" size={14} />
                      ) : speechState?.messageId === message.id ? (
                        <VolumeX size={14} />
                      ) : (
                        <Volume2 size={14} />
                      )}
                    </button>
                  )}
                </div>
                <div className="assistant-answer-copy">
                  <AssistantMarkdown content={message.content} />
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
                <span className="assistant-typing">
                  <i />
                  <i />
                  <i />
                </span>
                Checking your workspace…
              </p>
            )}
            {error && (
              <p className="assistant-error" role="alert">
                {error}
              </p>
            )}
            {voiceError && (
              <p className="assistant-error" role="alert">
                {voiceError}
              </p>
            )}
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
            <small>
              Uses this workspace. Enter to send, Shift+Enter for a new line.
            </small>
          </form>
        </aside>
      )}
    </>
  )
}
