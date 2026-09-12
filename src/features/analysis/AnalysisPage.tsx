import { useWorkspaceAccess } from '../../components/workspace-access-context'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  FlaskConical,
  History,
  Plus,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import {
  EmptyState,
  PageHeader,
  Panel,
  Tabs,
} from '../../components/workspace-ui'
import { SortableTable } from '../../components/SortableTable'
import { questions, shiftDate, type Workspace } from '../../domain/workspace'
import {
  acknowledgeSubmission,
  createAnalysisClient,
  isPending,
  pendingSubmission,
  submissionStorageWarning,
  statusLabel,
  type AnalysisKind,
  type AnalysisRun,
  type Definition,
} from '../../lib/analysis'
import {
  AnalysisEditor,
  type EditorSeed,
  type EditorSubmission,
} from './AnalysisEditor'
import {
  forecastCreationIssue,
  forecastEngines,
  forecastPresentationMuted,
} from './config'
import { RunResults } from './RunResults'
import './analysis.css'

export type AnalysisPageProps = {
  workspace: Workspace
  onChange: (workspace: Workspace) => void
  initialRunId?: string
  initialQuestion?: string
  onOpenRun: (id: string) => void
}
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'The analysis service could not complete this request. Try again.'

export function AnalysisPage({
  workspace,
  onChange,
  initialRunId,
  initialQuestion,
  onOpenRun,
}: AnalysisPageProps) {
  const { role, canEdit } = useWorkspaceAccess()
  const canMutate = canEdit('analysis')
  const client = useMemo(
    () => createAnalysisClient(workspace.id),
    [workspace.id],
  )
  const [kind, setKind] = useState<AnalysisKind>('simulation')
  const [runs, setRuns] = useState<AnalysisRun[]>([])
  const [definitions, setDefinitions] = useState<Definition[]>([])
  const [detail, setDetail] = useState<AnalysisRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [archived, setArchived] = useState(false)
  const [status, setStatus] = useState('all')
  const [engine, setEngine] = useState('all')
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [seed, setSeed] = useState<EditorSeed | null>(() => {
    const question = questions.find((q) => q.key === initialQuestion)
    return question
      ? { kind: 'simulation', question: question.key, basis: workspace }
      : null
  })
  const savedAttempt = useRef<{
    fingerprint: string
    definition: Definition
  } | null>(null)
  const selected = initialRunId
    ? detail?.id === initialRunId
      ? detail
      : runs.find((run) => run.id === initialRunId)
    : null

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    async function load() {
      try {
        const [nextRuns, nextDefinitions, nextDetail] = await Promise.all([
          client.listRuns(),
          client.listDefinitions(),
          initialRunId ? client.getRun(initialRunId) : Promise.resolve(null),
        ])
        if (!active) return
        setRuns(nextRuns)
        setDefinitions(nextDefinitions)
        setDetail(nextDetail)
        setLoadError(null)
        if (nextRuns.some(isPending) || (nextDetail && isPending(nextDetail)))
          timer = setTimeout(load, 2500)
      } catch (error) {
        if (!active) return
        setLoadError(message(error))
        timer = setTimeout(load, 10000)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [client, initialRunId, refresh])

  useEffect(() => {
    if (!selected || selected.status !== 'succeeded') return
    if (
      !workspace.onboarding.firstAnalysisAt ||
      (selected.result.comparison && !workspace.onboarding.firstComparisonAt)
    ) {
      onChange({
        ...workspace,
        onboarding: {
          ...workspace.onboarding,
          firstAnalysisAt:
            workspace.onboarding.firstAnalysisAt ??
            selected.completed_at ??
            selected.updated_at,
          firstComparisonAt:
            workspace.onboarding.firstComparisonAt ??
            (selected.result.comparison
              ? (selected.completed_at ?? selected.updated_at)
              : null),
        },
      })
    }
  }, [selected, workspace, onChange])

  function openEditor(next: EditorSeed) {
    if (!canMutate || (role === 'finance' && next.kind === 'forecast')) return
    setSeed(next)
    setFormError(null)
    setNotice(null)
    savedAttempt.current = null
  }
  function closeEditor() {
    if (!busy) {
      setSeed(null)
      setFormError(null)
      savedAttempt.current = null
    }
  }
  function openRun(id: string) {
    setActionError(null)
    setNotice(null)
    if (!id && selected) setKind(selected.kind)
    onOpenRun(id)
  }

  async function submit(value: EditorSubmission, execute: boolean) {
    if (busy) return
    setBusy(true)
    setFormError(null)
    const fingerprint = JSON.stringify({
      definitionId: value.definitionId,
      name: value.name,
      kind: value.kind,
      config: value.config,
    })
    try {
      let definition =
        savedAttempt.current?.fingerprint === fingerprint
          ? savedAttempt.current.definition
          : null
      if (!definition) {
        definition = value.definitionId
          ? await client.editDefinition(value.definitionId, {
              name: value.name,
              config: value.config,
            })
          : await client.saveDefinition({
              name: value.name,
              kind: value.kind,
              config: value.config,
            })
        savedAttempt.current = { fingerprint, definition }
      }
      setDefinitions((previous) => [
        definition!,
        ...previous.filter((item) => item.id !== definition!.id),
      ])
      if (execute) {
        const requestFingerprint = JSON.stringify({
          definitionId: definition.id,
          version: definition.version,
          snapshot: value.snapshot,
          retryOf: value.retryOf,
        })
        const key = pendingSubmission(workspace.id, requestFingerprint)
        setNotice(submissionStorageWarning(workspace.id))
        const run = await client.startRun(
          definition.id,
          value.snapshot,
          key,
          value.retryOf,
        )
        acknowledgeSubmission(workspace.id)
        setDetail(run)
        setRuns((previous) => [
          run,
          ...previous.filter((item) => item.id !== run.id),
        ])
        setKind(run.kind)
        onOpenRun(run.id)
      } else {
        setNotice(
          `${definition.name} was saved as version ${definition.version}. Existing runs keep their original inputs.`,
        )
        setKind(definition.kind)
      }
      setSeed(null)
      savedAttempt.current = null
      setRefresh((value) => value + 1)
    } catch (error) {
      setFormError(message(error))
    } finally {
      setBusy(false)
    }
  }

  async function runAction(action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    setActionError(null)
    try {
      await action()
      setRefresh((value) => value + 1)
    } catch (error) {
      setActionError(message(error))
    } finally {
      setBusy(false)
    }
  }

  const filteredRuns = runs.filter(
    (run) =>
      run.kind === kind &&
      Boolean(run.archived) === archived &&
      (status === 'all' || run.status === status) &&
      (engine === 'all' || run.config.engine === engine) &&
      (!from || run.config.start_date >= from) &&
      (!to || run.config.start_date <= to) &&
      `${run.definition_name} ${run.id} ${run.config.question} ${run.config.product_id ?? ''}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const visibleForecastEngines = forecastEngines.filter(
    (engine) => !forecastPresentationMuted(engine.id, workspace),
  )
  const filteredDefinitions = definitions.filter(
    (definition) =>
      definition.kind === kind && definition.archived === archived,
  )
  const editor = seed && (
    <AnalysisEditor
      key={`${seed.definition?.id ?? seed.run?.id ?? seed.question ?? seed.kind}-${seed.basis.revision}`}
      seed={seed}
      runs={runs}
      busy={busy}
      error={formError}
      onClose={closeEditor}
      onSubmit={(value, execute) => {
        void submit(value, execute)
      }}
    />
  )

  if (initialRunId)
    return (
      <div className="stack analysis-workspace">
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {(loadError || actionError) && (
          <div className="notice error" role="alert">
            <p>{actionError || loadError}</p>
            <button
              className="button secondary"
              onClick={() => {
                setActionError(null)
                setRefresh((value) => value + 1)
              }}
            >
              Retry
            </button>
          </div>
        )}
        {selected ? (
          <RunResults
            run={selected}
            busy={busy}
            onBack={() => openRun('')}
            onOpenRun={openRun}
            onCancel={() =>
              void runAction(async () =>
                setDetail(await client.cancelRun(selected.id)),
              )
            }
            onArchive={() =>
              void runAction(async () =>
                setDetail(
                  await client.archiveRun(selected.id, !selected.archived),
                ),
              )
            }
            onRerun={(basis) =>
              openEditor({
                kind: selected.kind,
                run: selected,
                basis: basis === 'original' ? selected.snapshot : workspace,
                retryOf: selected.id,
              })
            }
          />
        ) : (
          <>
            <button className="button secondary" onClick={() => openRun('')}>
              Back to saved history
            </button>
            <EmptyState
              title={loading ? 'Opening saved run' : 'Saved run is unavailable'}
              description={
                loading
                  ? 'Retrieving its recorded inputs, status and results.'
                  : 'Check the selected workspace and retry. A missing current data source does not remove saved runs.'
              }
              action={
                <button
                  className="button secondary"
                  onClick={() => setRefresh((value) => value + 1)}
                >
                  Retry retrieval
                </button>
              }
            />
          </>
        )}
        {editor}
      </div>
    )

  return (
    <div className="stack analysis-workspace">
      <PageHeader
        eyebrow="Forecast & Simulate"
        title="Explore what comes next"
        description="Test your assumptions. Compare the consequences. Keep the decision yours."
        action={
          canMutate &&
          (kind === 'simulation' ||
            (role !== 'finance' && visibleForecastEngines.length > 0)) ? (
            <button
              className="button primary"
              onClick={() =>
                openEditor({ kind, basis: workspace, question: 'Q-EXPLORE' })
              }
            >
              <Plus size={18} />
              {kind === 'forecast' ? 'New forecast' : 'New scenario'}
            </button>
          ) : undefined
        }
      />
      <Tabs
        tabs={['Simulations', 'Forecasts']}
        value={kind === 'simulation' ? 'Simulations' : 'Forecasts'}
        onChange={(value) => {
          setKind(value === 'Simulations' ? 'simulation' : 'forecast')
          setStatus('all')
          setEngine('all')
        }}
        label="Analysis history"
      />
      {(loadError || actionError) && (
        <div className="notice error" role="alert">
          <p>{actionError || loadError}</p>
          <button
            className="button secondary"
            onClick={() => {
              setActionError(null)
              setRefresh((value) => value + 1)
            }}
          >
            Retry connection
          </button>
        </div>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {kind === 'simulation' ? (
        <Panel
          title="Start with a question"
          subtitle="Choose one business question or explore several supported result families."
        >
          <div className="question-grid">
            {questions
              .filter(
                (question) =>
                  role !== 'finance' ||
                  question.family === 'cash' ||
                  question.key === 'Q-EXPLORE',
              )
              .map((question) => (
                <button
                  className="question-card"
                  disabled={!canMutate}
                  key={question.key}
                  onClick={() =>
                    openEditor({
                      kind: 'simulation',
                      question: question.key,
                      basis: workspace,
                    })
                  }
                >
                  <span className="question-icon">
                    <FlaskConical size={18} />
                  </span>
                  <strong>{question.label}</strong>
                  <span className="muted">{question.description}</span>
                  <span className="question-footer">
                    {question.horizon} day starting window{' '}
                    <ArrowUpRight size={16} />
                  </span>
                </button>
              ))}
          </div>
        </Panel>
      ) : (
        <Panel
          title="A demand basis you can inspect"
          subtitle="Forecast output stays separate from simulations and ordinary dashboards."
        >
          <div className="question-grid">
            {visibleForecastEngines.map((engine) => (
              <div className="question-card" key={engine.id}>
                {engine.id === 'lightgbm' ? (
                  <FlaskConical size={20} />
                ) : (
                  <TrendingUp size={20} />
                )}
                <strong>{engine.name}</strong>
                <p>{engine.description}</p>
                {forecastCreationIssue(engine.id, workspace) && (
                  <p className="notice">
                    {forecastCreationIssue(engine.id, workspace)}
                  </p>
                )}
              </div>
            ))}
          </div>
          {visibleForecastEngines.length < forecastEngines.length && (
            <p className="notice">
              Muted engine suggestions are hidden. Saved definitions, reruns and
              pinned forecast dependencies remain usable. Manage presentation in
              Add-ons &amp; Data.
            </p>
          )}
        </Panel>
      )}
      <Panel
        title={kind === 'forecast' ? 'Forecast history' : 'Simulation history'}
        subtitle="Every run retains its own inputs, status and final result. History remains available after source data changes."
        action={
          <button
            className="button secondary"
            onClick={() => setRefresh((value) => value + 1)}
            aria-label="Refresh run history"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        }
      >
        <div className="form-grid">
          <label className="field">
            Find a saved run
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, question, product ID or run ID"
            />
          </label>
          <label className="field">
            Status
            <SelectField
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">All statuses</option>
              {Object.entries(statusLabel).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </SelectField>
          </label>
          <label className="field">
            Engine
            <SelectField
              value={engine}
              onChange={(event) => setEngine(event.target.value)}
            >
              <option value="all">All engines</option>
              <option value="naive">Naïve</option>
              <option value="seasonal-naive">Seasonal naïve</option>
              <option value="lightgbm">LightGBM</option>
              <option value="catboost">CatBoost</option>
            </SelectField>
          </label>
          <label className="field">
            Planning start from
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="field">
            Planning start through
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={archived}
            onChange={(event) => setArchived(event.target.checked)}
          />
          Show archived runs and definitions
        </label>
        {loading ? (
          <p role="status">Loading saved history…</p>
        ) : loadError && !runs.length ? (
          <EmptyState
            title="History could not be loaded"
            description="Reconnect to the local analysis service to retrieve saved runs. Current data does not determine historical availability."
          />
        ) : filteredRuns.length ? (
          <div className="table-wrap">
            <SortableTable
              className="data-table"
              defaultOpen
              tableLabel="Saved runs"
            >
              <thead>
                <tr>
                  <th>Saved run</th>
                  <th>Run ID</th>
                  <th>Question or engine</th>
                  <th>Status</th>
                  <th>Planning window</th>
                  <th>Source</th>
                  <th>Last update</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <strong>{run.definition_name}</strong>
                    </td>
                    <td>{run.id.slice(0, 8)}</td>
                    <td>
                      {run.kind === 'forecast'
                        ? run.config.engine
                        : questions.find((q) => q.key === run.config.question)
                            ?.label}
                    </td>
                    <td>
                      <span
                        className={`badge ${run.status === 'succeeded' ? 'positive' : run.status === 'failed' ? 'negative' : ''}`}
                      >
                        {statusLabel[run.status]}
                      </span>
                    </td>
                    <td>
                      {run.config.start_date}
                      <div className="muted">
                        through{' '}
                        {shiftDate(
                          run.config.start_date,
                          run.config.horizon_days - 1,
                        )}
                      </div>
                    </td>
                    <td>
                      {run.provenance.mode === 'demo'
                        ? 'Demo'
                        : 'Submitted data'}
                    </td>
                    <td>{new Date(run.updated_at).toLocaleString()}</td>
                    <td>
                      <button
                        className="button secondary"
                        onClick={() => openRun(run.id)}
                      >
                        {isPending(run) ? 'View status' : 'Open run'}
                        <ArrowUpRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </SortableTable>
          </div>
        ) : (
          <EmptyState
            icon={<History size={26} />}
            title={
              archived
                ? 'No archived runs in this view'
                : 'No saved runs in this view'
            }
            description="Create a definition and submit a run, or change the filters to find a previous analysis."
          />
        )}
      </Panel>
      <Panel
        title={
          kind === 'forecast'
            ? 'Saved forecast definitions'
            : 'Saved scenario definitions'
        }
        subtitle="Edit configuration and submit another version without rewriting earlier runs."
      >
        {filteredDefinitions.length ? (
          <div className="table-wrap">
            <SortableTable
              className="data-table"
              defaultOpen
              tableLabel="Reusable analysis definitions"
            >
              <thead>
                <tr>
                  <th>Definition</th>
                  <th>Version</th>
                  <th>Question or engine</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDefinitions.map((definition) => (
                  <tr key={definition.id}>
                    <td>{definition.name}</td>
                    <td>{definition.version}</td>
                    <td>
                      {definition.kind === 'forecast'
                        ? definition.config.engine
                        : questions.find(
                            (q) => q.key === definition.config.question,
                          )?.label}
                    </td>
                    <td>
                      <div className="form-actions">
                        <button
                          className="button secondary"
                          disabled={!canMutate}
                          onClick={() =>
                            openEditor({
                              kind: definition.kind,
                              definition,
                              basis: workspace,
                            })
                          }
                        >
                          Edit or run
                        </button>
                        <button
                          className="button secondary"
                          disabled={busy || !canMutate}
                          onClick={() =>
                            void runAction(() =>
                              client.editDefinition(definition.id, {
                                archived: !definition.archived,
                              }),
                            )
                          }
                        >
                          {definition.archived ? 'Restore' : 'Archive'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </SortableTable>
          </div>
        ) : (
          <p className="muted">
            No {archived ? 'archived' : 'active'} definitions. Save a
            configuration to return to it later.
          </p>
        )}
      </Panel>
      <p className="muted">
        Current business records and analytical history are saved to SAMBY. Each
        run retains its original submitted snapshot when current records change.
      </p>
      {editor}
    </div>
  )
}
import { SelectField } from '../../components/ui/select-field'
