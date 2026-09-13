import { useWorkspaceAccess } from '../../components/workspace-access-context'
import { TableHead } from '../../components/workspace-ui'
import { SortableTable } from '../../components/SortableTable'
import { ForecastEvaluation } from './ForecastEvaluation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Archive,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react'
import {
  DataChart,
  MetricCard,
  PageHeader,
  Panel,
} from '../../components/workspace-ui'
import { dateLabel, money, number, questions, shiftDate } from '../../domain/workspace'
import {
  isPending,
  statusLabel,
  type AnalysisRun,
  type DailyPoint,
} from '../../lib/analysis'

const dated = (value: string | null) =>
  value ? new Date(value).toLocaleString() : 'Not yet'
const seriesLabels: Record<string, string> = {
  inventory: 'Available inventory',
  on_hand: 'Physical on-hand inventory',
  inventory_position: 'Inventory position',
  fulfilled: 'New demand fulfilled immediately',
  sale_fulfilled: 'Current-period sales demand fulfilled',
  backorders: 'Closing backorders',
  lost_units: 'New lost units',
  backlog_fulfilled: 'Prior backorders fulfilled',
  planned_payable: 'Modeled supplier obligations',
  demand: 'Demand',
  unmet_demand: 'Unmet demand',
  purchase: 'Supplier receipts',
  cash: 'End-of-day cash',
  inflow: 'Cash inflows',
  outflow: 'Cash outflows',
  receivable: 'Customer receivables',
  inventory_delta: 'Inventory change',
  cash_delta: 'Cash change',
  receivable_delta: 'Receivable change',
  demand_delta: 'Demand change',
  provider_pending: 'Collected funds pending availability',
  zero: 'Zero-cash boundary',
  baseline_cash: 'Baseline cash',
  reserve: 'Owner-selected reserve',
  overdue: 'Overdue balance',
  payable: 'Confirmed supplier payables',
  financing_debt: 'Financing debt',
  customer_concentration: 'Largest customer share',
  cash_hold: 'Hold cash outlook (current state)',
  cash_liquidate: 'Liquidated cash balance (simulated)',
  daily_liquidation_revenue: 'Daily liquidation cash freed',
  cumulative_freed: 'Cumulative capital freed',
  cumulative_supplier_paid: 'Cumulative supplier payments',
  cumulative_collected: 'Cumulative customer collections',
  payroll_reserve: 'Payroll reserve requirement',
  available_after_payroll: 'Cash available after payroll reserve',
  cash_banking: 'Effective banking cash balance',
  phantom_liquidity: 'Weekend/holiday phantom liquidity',
  spiral_cash: 'Cash trajectory under supplier freeze',
  revenue_loss: 'Daily revenue lost to stockout',
  cash_disputed: 'Cash balance with disputed holds',
}
const metricValue = (value: number | null, unit: string) =>
  value === null
    ? 'Not supported'
    : `${number(value)}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}`

const playbackSeriesKeys = new Set([
  'inventory',
  'on_hand',
  'inventory_position',
  'fulfilled',
  'sale_fulfilled',
  'backorders',
  'lost_units',
  'backlog_fulfilled',
  'planned_payable',
  'demand',
  'unmet_demand',
  'purchase',
  'cash',
  'inflow',
  'outflow',
  'receivable',
  'provider_pending',
  'zero',
  'reserve',
  'overdue',
  'payable',
  'financing_debt',
  'customer_concentration',
  'cash_hold',
  'cash_liquidate',
  'daily_liquidation_revenue',
  'cumulative_freed',
  'cumulative_supplier_paid',
  'cumulative_collected',
  'payroll_reserve',
  'available_after_payroll',
  'cash_banking',
  'phantom_liquidity',
  'spiral_cash',
  'revenue_loss',
  'cash_disputed',
])

const changingSeries = (points: DailyPoint[]) =>
  [...playbackSeriesKeys].some((key) => {
    const values = points
      .map((point) => point[key])
      .filter((value): value is number => typeof value === 'number')
    return values.length > 1 && values.some((value) => value !== values[0])
  })

const changingComparison = (points: DailyPoint[]) => {
  const keys = new Set(
    points.flatMap((point) =>
      Object.keys(point).filter((key) => key !== 'date'),
    ),
  )
  return [...keys].some((key) => {
    const values = points
      .map((point) => point[key])
      .filter((value): value is number => typeof value === 'number')
    return values.length > 1 && values.some((value) => value !== values[0])
  })
}

function SavedChart({
  points,
  keys,
  title,
  unit,
  subtitle,
  activeDate,
}: {
  points: DailyPoint[]
  keys: string[]
  title: string
  unit: string
  subtitle: string
  activeDate?: string
}) {
  const present = keys.filter((key) =>
    points.some((point) => typeof point[key] === 'number'),
  )
  if (!present.length) return null
  return (
    <Panel title={title} subtitle={subtitle}>
      <DataChart
        data={points}
        series={present.map((key) => ({
          key,
          label: seriesLabels[key] ?? key,
        }))}
        label={title}
        unit={unit}
        height={270}
        activeDate={activeDate}
      />
    </Panel>
  )
}

function downloadRun(run: AnalysisRun) {
  const blob = new Blob([JSON.stringify(run, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `samby-${run.kind}-${run.id}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

type RunResultsProps = {
  run: AnalysisRun
  busy: boolean
  onBack: () => void
  onCancel: () => void
  onArchive: () => void
  onRerun: (basis: 'original' | 'current') => void
  onOpenRun: (id: string) => void
}
type RunResultsView = ReturnType<typeof useRunResultsView>

function useRunResultsView({
  run,
  busy,
  onBack,
  onCancel,
  onArchive,
  onRerun,
  onOpenRun,
}: RunResultsProps) {
  const { role, canEdit } = useWorkspaceAccess()
  const canManage =
    canEdit('analysis') &&
    (role !== 'finance' ||
      (run.kind === 'simulation' &&
        !run.config.output_families.includes('inventory'))) &&
    (!['inventory', 'buyer'].includes(role) ||
      run.kind === 'forecast' ||
      run.config.output_families.every((family) => family === 'inventory'))
  const question = questions.find((q) => q.key === run.config.question)
  const currency = run.provenance.currency
  const unit =
    run.snapshot.products.find((p) => p.id === run.config.product_id)?.unit ??
    'units'
  const result = run.status === 'succeeded' ? run.result : null
  const warnings = [
    ...new Set([...(run.warnings ?? []), ...(result?.warnings ?? [])]),
  ]
  const error = typeof run.error === 'string' ? run.error : run.error?.message
  const playbackDates = useMemo(
    () =>
      result
        ? [
            ...new Set(
              result.series
                .map((point) => point.date)
                .filter((date): date is string => Boolean(date)),
            ),
          ].sort((a, b) => a.localeCompare(b))
        : [],
    [result],
  )
  const playbackAvailable = useMemo(() => {
    if (!result || playbackDates.length < 2) return false
    const hasNumericForecastSeries = result.series.some((point) =>
      [...playbackSeriesKeys].some((key) => typeof point[key] === 'number'),
    )
    if (run.kind === 'forecast') return hasNumericForecastSeries
    const timeline = new Set(playbackDates)
    return (
      changingSeries(result.series) ||
      changingComparison(result.comparison?.series ?? []) ||
      result.events.some((event) => timeline.has(event.date))
    )
  }, [playbackDates, result, run.kind])
  const [playbackIndex, setPlaybackIndex] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 2>(1)
  const [playing, setPlaying] = useState(false)
  const lastPlaybackIndex = Math.max(0, playbackDates.length - 1)
  const activeDate = playbackAvailable
    ? playbackDates[Math.min(playbackIndex, lastPlaybackIndex)]
    : undefined
  const currentEvents =
    result?.events.filter((event) => event.date === activeDate) ?? []

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) setPlaying(false)
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () =>
      document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  useEffect(() => {
    if (!playbackAvailable || !playing) return
    if (playbackIndex >= lastPlaybackIndex) return
    const normalDelay = Math.min(
      800,
      Math.max(50, 15_000 / Math.max(1, lastPlaybackIndex)),
    )
    const timer = window.setTimeout(() => {
      const nextIndex = Math.min(playbackIndex + 1, lastPlaybackIndex)
      setPlaybackIndex(nextIndex)
      if (nextIndex >= lastPlaybackIndex) setPlaying(false)
    }, Math.max(25, normalDelay / playbackSpeed))
    return () => window.clearTimeout(timer)
  }, [
    lastPlaybackIndex,
    playbackAvailable,
    playbackIndex,
    playbackSpeed,
    playing,
  ])

  function togglePlayback() {
    if (playing) {
      setPlaying(false)
      return
    }
    if (playbackIndex >= lastPlaybackIndex) setPlaybackIndex(0)
    setPlaying(true)
  }

  function selectPlaybackIndex(index: number) {
    setPlaying(false)
    setPlaybackIndex(Math.max(0, Math.min(index, lastPlaybackIndex)))
  }

  return {
    onBack,
    run,
    question,
    result,
    busy,
    canManage,
    onArchive,
    warnings,
    onOpenRun,
    onCancel,
    error,
    unit,
    currency,
    onRerun,
    playbackAvailable,
    playbackDates,
    playbackIndex,
    playbackSpeed,
    setPlaybackSpeed,
    playing,
    lastPlaybackIndex,
    activeDate,
    currentEvents,
    togglePlayback,
    selectPlaybackIndex,
  }
}

export function RunResults(props: RunResultsProps) {
  return <RunResultsContent key={props.run.id} {...props} />
}

function RunResultsContent(props: RunResultsProps) {
  const view = useRunResultsView(props)
  return (
    <div
      className={`stack analysis-results ${view.playbackAvailable ? 'has-playback' : ''}`}
    >
      <RunHeader {...view} />
      <RunStatus {...view} />
      <CompletedRunResults {...view} />
      <PlaybackDock {...view} />
      <RunProvenance {...view} />
      <RunAgain {...view} />
    </div>
  )
}

function RunHeader({
  onBack,
  run,
  question,
  result,
  busy,
  canManage,
  onArchive,
  warnings,
}: Pick<
  RunResultsView,
  | 'onBack'
  | 'run'
  | 'question'
  | 'result'
  | 'busy'
  | 'canManage'
  | 'onArchive'
  | 'warnings'
>) {
  return (
    <>
      <div className="form-actions">
        <button className="button secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to {run.kind === 'forecast' ? 'forecasts' : 'simulations'}
        </button>
        <span
          className={`badge ${run.status === 'succeeded' ? 'positive' : run.status === 'failed' ? 'negative' : ''}`}
        >
          {statusLabel[run.status]}
        </span>
        <span className="badge">
          {run.provenance.mode === 'demo'
            ? 'Demonstration data'
            : 'Computed from submitted data'}
        </span>
        {run.archived && <span className="badge">Archived</span>}
      </div>
      <PageHeader
        eyebrow={run.kind === 'forecast' ? 'Saved forecast' : question?.label}
        title={run.definition_name}
        description={`${run.config.start_date} through ${result?.end_date ?? shiftDate(run.config.start_date, run.config.horizon_days - 1)} · ${run.config.horizon_days} inclusive daily steps`}
        action={
          <>
            <button
              className="button secondary"
              disabled={busy || !canManage}
              onClick={onArchive}
            >
              <Archive size={16} />
              {run.archived ? 'Restore to history' : 'Archive'}
            </button>
            <button
              className="button secondary"
              onClick={() => downloadRun(run)}
            >
              <Download size={16} />
              Export saved record
            </button>
          </>
        }
      />
      <p className="muted">
        Run {run.id}. Saved {dated(run.created_at)}. These results use the
        submitted snapshot, regardless of current workspace data or visibility
        preferences.
      </p>
      {run.provenance.mode === 'demo' && (
        <p className="notice">
          This run uses the separate demonstration environment.
          {
            ' Values and evaluations describe synthetic demonstration records, not your business.'
          }
        </p>
      )}
      {warnings.length > 0 && (
        <section className="notice" aria-label="Material limitations">
          <h2>Read with these limitations</h2>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function RunStatus({
  run,
  onOpenRun,
  busy,
  canManage,
  onCancel,
  error,
}: Pick<
  RunResultsView,
  'run' | 'onOpenRun' | 'busy' | 'canManage' | 'onCancel' | 'error'
>) {
  return (
    <>
      {isPending(run) && (
        <Panel
          title={statusLabel[run.status]}
          subtitle="The analysis service owns this job. You can leave this page or close the browser."
        >
          <p role="status">
            <Clock3 size={18} aria-hidden="true" />{' '}
            {run.phase?.replaceAll('_', ' ') ||
              'Waiting for the next server update'}
          </p>
          <p className="muted">
            Last server update {dated(run.updated_at)}. Attempt {run.attempt}.
          </p>
          {run.config.forecast_run_id && (
            <button
              className="button secondary"
              onClick={() => onOpenRun(run.config.forecast_run_id!)}
            >
              Open pinned forecast {run.config.forecast_run_id.slice(0, 8)}
            </button>
          )}
          <div className="form-actions">
            <button
              className="button secondary"
              disabled={busy || !canManage}
              onClick={onCancel}
            >
              Cancel this run
            </button>
          </div>
        </Panel>
      )}
      {run.status === 'failed' && (
        <Panel
          title="This run could not complete"
          subtitle="Its inputs and failure remain in history."
        >
          <p role="alert" className="notice error">
            {error ||
              'The engine could not complete this analysis. Review its saved inputs and try again.'}
          </p>
          {run.config.forecast_run_id && (
            <button
              className="button secondary"
              onClick={() => onOpenRun(run.config.forecast_run_id!)}
            >
              Inspect pinned forecast
            </button>
          )}
        </Panel>
      )}
      {run.status === 'cancelled' && (
        <Panel
          title="Run cancelled"
          subtitle="No final numerical result was published."
        >
          <p>
            The saved definition and submitted inputs remain available. A retry
            creates a separate run.
          </p>
        </Panel>
      )}
    </>
  )
}

function CompletedRunResults({
  result,
  run,
  unit,
  currency,
  onOpenRun,
  playbackAvailable,
  playbackDates,
  playbackIndex,
  playbackSpeed,
  setPlaybackSpeed,
  activeDate,
  currentEvents,
}: Pick<
  RunResultsView,
  | 'result'
  | 'run'
  | 'unit'
  | 'currency'
  | 'onOpenRun'
  | 'playbackAvailable'
  | 'playbackDates'
  | 'playbackIndex'
  | 'playbackSpeed'
  | 'setPlaybackSpeed'
  | 'activeDate'
  | 'currentEvents'
>) {
  return (
    <>
      {result && (
        <>
          {playbackAvailable && activeDate && (
            <Panel
              className="analysis-playback-panel"
              title="Explore this result through time"
              subtitle="Playback moves through the saved daily result. It does not recalculate the run."
              action={
                <div
                  className="playback-speed-controls"
                  role="group"
                  aria-label="Playback speed"
                >
                  {([0.5, 1, 2] as const).map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      className="playback-speed-button"
                      aria-pressed={playbackSpeed === speed}
                      onClick={() => setPlaybackSpeed(speed)}
                    >
                      {speed}×
                    </button>
                  ))}
                </div>
              }
            >
              <div className="playback-overview">
                <div className="playback-current-day">
                  <span>Currently viewing</span>
                  <strong>{dateLabel(activeDate)}</strong>
                  <small>
                    Day {playbackIndex + 1} of {playbackDates.length}
                  </small>
                </div>
                <div className="playback-current-events">
                  <span>Events on this date</span>
                  {currentEvents.length ? (
                    <ul>
                      {currentEvents.map((event) => (
                        <li key={event.id}>
                          <strong>{event.label}</strong>
                          <small>{event.type.replaceAll('_', ' ')}</small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No dated events occur on this day.</p>
                  )}
                </div>
              </div>
            </Panel>
          )}
          {run.kind === 'forecast' && !result.forecast_diagnostics && (
            <p className="notice">
              This prototype publishes the configured dated demand series. No
              backtest error, bias or uncertainty interval is claimed unless the
              engine supplies that artifact.
            </p>
          )}
          {playbackAvailable && (
            <p className="muted playback-scope-note">
              Summary cards describe the full completed run. The playback
              controls inspect its dated values and events.
            </p>
          )}
          <div className="metrics-grid">
            {result.metrics.map((metric) => (
              <MetricCard
                key={metric.key}
                label={metric.label}
                value={metricValue(metric.value, metric.unit)}
                note={`Saved ${result.start_date} to ${result.end_date} · ${result.grain}`}
              />
            ))}
          </div>
          {result.explanations.length > 0 && (
            <Panel
              title="What happened"
              subtitle="These explanations reference the saved numerical result."
            >
              <ul>
                {[...new Set(result.explanations)].map((explanation) => (
                  <li key={explanation}>{explanation}</li>
                ))}
              </ul>
            </Panel>
          )}
          {run.kind === 'forecast' && result.forecast_diagnostics && (
            <ForecastEvaluation
              diagnostics={result.forecast_diagnostics}
              history={result.history ?? []}
              unit={unit}
            />
          )}
          <SavedChart
            points={result.series}
            keys={['inventory', 'on_hand', 'inventory_position']}
            title="Available inventory through time"
            subtitle={`Opening assumptions and dated movements are fixed to this run. ${result.start_date} to ${result.end_date}.`}
            unit={unit}
            activeDate={activeDate}
          />
          <SavedChart
            points={result.series}
            keys={['demand', 'fulfilled', 'sale_fulfilled', 'purchase']}
            title={
              run.kind === 'forecast'
                ? 'Dated demand forecast'
                : 'Demand and supplier receipts'
            }
            subtitle={
              run.kind === 'forecast'
                ? `Engine ${run.provenance.engine}, version ${run.provenance.engine_version}.`
                : 'Demand and supply retain their own dates and quantities.'
            }
            unit={unit}
            activeDate={activeDate}
          />
          <SavedChart
            points={result.series}
            keys={[
              'unmet_demand',
              'backorders',
              'lost_units',
              'backlog_fulfilled',
            ]}
            title="Unmet demand"
            subtitle="Unmet units are distinct from days with zero available stock."
            unit={unit}
            activeDate={activeDate}
          />
          <SavedChart
            points={result.series}
            keys={['cash', 'zero', 'reserve']}
            title="Cash balance through time"
            subtitle="End-of-day cash. A negative balance is a cash gap. The daily model does not establish intraday payment order."
            unit={currency}
            activeDate={activeDate}
          />
          <SavedChart
            points={result.series}
            keys={['inflow', 'outflow']}
            title="Recorded inflows and outflows"
            subtitle="Linked economic events are retained in the submitted input basis."
            unit={currency}
            activeDate={activeDate}
          />
          <SavedChart
            points={result.series}
            keys={['receivable', 'provider_pending', 'overdue']}
            title="Customer balances through time"
            subtitle="Uncollected balances stay outstanding beyond the horizon. No default probability is inferred."
            unit={currency}
            activeDate={activeDate}
          />
          <SavedChart
            points={result.series}
            keys={['payable', 'planned_payable', 'financing_debt']}
            title="Supplier and financing balances"
            subtitle="Confirmed External Debt and Financing Debt are separate balances. Purchase proposals do not create a confirmed payable."
            unit={currency}
            activeDate={activeDate}
          />
          <SavedChart
            points={result.series}
            keys={['customer_concentration']}
            title="Customer concentration"
            subtitle="Largest customer share of the applicable saved balance. This percentage is separate from monetary balances."
            unit="%"
            activeDate={activeDate}
          />
          <SavedChart
            points={result.series}
            keys={['cash_hold', 'cash_liquidate']}
            title="Hold vs. Liquidation cash outlook"
            subtitle="Current state (holding dead stock and carrying costs) compared to tactical liquidation."
            unit={currency}
            activeDate={activeDate}
          />
          <SavedChart
            points={result.series}
            keys={['cumulative_freed', 'daily_liquidation_revenue']}
            title="Capital freed through liquidation"
            subtitle="Daily cash recovered and cumulative capital released."
            unit={currency}
            activeDate={activeDate}
          />
          <SavedChart
            points={result.series}
            keys={['cumulative_supplier_paid', 'cumulative_collected']}
            title="Cumulative cash commitments vs. collections"
            subtitle="Timing gap between upfront supplier advances and customer collection."
            unit={currency}
            activeDate={activeDate}
          />
          <SavedChart
            points={result.series}
            keys={['payroll_reserve', 'available_after_payroll']}
            title="Cash position vs. payroll cliff"
            subtitle="End-of-day cash relative to mandatory payroll reserves."
            unit={currency}
            activeDate={activeDate}
          />
          <SavedChart
            points={result.series}
            keys={['cash_banking', 'phantom_liquidity']}
            title="Banking clearing & weekend lag"
            subtitle="Stated book cash vs. effective banking liquidity after clearing cutoffs."
            unit={currency}
            activeDate={activeDate}
          />
          <SavedChart
            points={result.series}
            keys={['spiral_cash', 'revenue_loss']}
            title="Cash trajectory under supplier delivery freeze"
            subtitle="Baseline cash compared to revenue lost from star-product stockouts."
            unit={currency}
            activeDate={activeDate}
          />
          <SavedChart
            points={result.series}
            keys={['cash_disputed']}
            title="Cash with payment dispute holds"
            subtitle="Impact of frozen disputed receivables on operating liquidity."
            unit={currency}
            activeDate={activeDate}
          />
          {result.candidates && result.candidates.length > 0 && (
            <Panel
              title="Identified dead stock candidates"
              subtitle={`SKUs exceeding DIO threshold of ${run.config.assumptions.dio_threshold ?? 120} days eligible for tactical liquidation.`}
            >
              <div className="table-wrap">
                <SortableTable
                  className="data-table"
                  tableLabel="Dead stock candidates"
                >
                  <TableHead
                    headers={[
                      'Product',
                      'On hand',
                      'Unit cost',
                      'Locked capital',
                      'DIO',
                      'Estimated liquidation revenue',
                    ]}
                  />
                  <tbody>
                    {result.candidates.map((c) => (
                      <tr key={c.product_id}>
                        <td>
                          <strong>{c.product_name}</strong>
                        </td>
                        <td>
                          {number(c.on_hand)} {c.unit}
                        </td>
                        <td>{money(c.unit_cost, currency)}</td>
                        <td>{money(c.locked_capital, currency)}</td>
                        <td>
                          {c.dio === null
                            ? 'No sales (∞)'
                            : `${number(c.dio)} days`}
                        </td>
                        <td>
                          {c.sale_revenue !== undefined
                            ? money(c.sale_revenue, currency)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </SortableTable>
              </div>
            </Panel>
          )}
          {result.comparison && (
            <>
              <Panel
                title="Comparison with the pinned baseline"
                subtitle="Signed differences describe the selected alternative. They do not rank an option as best."
                action={
                  <button
                    className="button secondary"
                    onClick={() =>
                      onOpenRun(result.comparison!.baseline_run_id)
                    }
                  >
                    Open baseline
                  </button>
                }
              >
                <p className="muted">
                  Baseline {result.comparison.baseline_run_id}.
                </p>
                <div className="table-wrap">
                  <SortableTable
                    className="data-table"
                    tableLabel="Baseline comparison metrics"
                  >
                    <TableHead
                      headers={[
                        'Measure',
                        'Baseline',
                        'Alternative',
                        'Absolute change',
                        'Percentage change',
                      ]}
                    />
                    <tbody>
                      {result.comparison.metrics.map((metric) => (
                        <tr key={metric.key}>
                          <td>{metric.label}</td>
                          <td>
                            {metricValue(
                              metric.baseline,
                              metric.unit === 'percentage points'
                                ? '%'
                                : metric.unit,
                            )}
                          </td>
                          <td>
                            {metricValue(
                              metric.alternative,
                              metric.unit === 'percentage points'
                                ? '%'
                                : metric.unit,
                            )}
                          </td>
                          <td>{metricValue(metric.delta, metric.unit)}</td>
                          <td>
                            {metric.percentage_change === null
                              ? 'Not applicable'
                              : `${number(metric.percentage_change)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </SortableTable>
                </div>
              </Panel>
              <SavedChart
                points={result.comparison.series}
                keys={['inventory_delta', 'demand_delta']}
                title="Inventory and demand differences"
                subtitle="Saved alternative minus the pinned baseline on matching dates."
                unit={unit}
                activeDate={activeDate}
              />
              <SavedChart
                points={result.comparison.series}
                keys={['cash_delta', 'receivable_delta']}
                title="Cash and receivable differences"
                subtitle="Saved alternative minus the pinned baseline on matching dates."
                unit={currency}
                activeDate={activeDate}
              />
            </>
          )}
          <Panel
            title="Dated event trace"
            subtitle="Receipts, demand, collections and payments link back to the saved source references."
          >
            {result.events.length ? (
              <div className="table-wrap">
                <SortableTable
                  className="data-table"
                  tableLabel="Dated event trace"
                >
                  <TableHead
                    headers={[
                      'Date',
                      'Event',
                      'Quantity',
                      'Amount',
                      'Source reference',
                    ]}
                  />
                  <tbody>
                    {result.events.map((event) => (
                      <tr
                        key={event.id}
                        className={
                          event.date === activeDate
                            ? 'playback-active-event'
                            : undefined
                        }
                        aria-current={
                          event.date === activeDate ? 'date' : undefined
                        }
                      >
                        <td>{event.date}</td>
                        <td>
                          {event.label}
                          <span className="muted">
                            {' '}
                            · {event.type.replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td>
                          {typeof event.quantity === 'number'
                            ? `${number(event.quantity)} ${unit}`
                            : 'Not applicable'}
                        </td>
                        <td>
                          {typeof event.amount === 'number'
                            ? `${number(event.amount)} ${currency}`
                            : 'Not applicable'}
                        </td>
                        <td>{event.source_id ?? 'Scenario assumption'}</td>
                      </tr>
                    ))}
                  </tbody>
                </SortableTable>
              </div>
            ) : (
              <p>No dated events were recorded for this result.</p>
            )}
          </Panel>
          <Panel
            title="Recorded assumptions"
            subtitle="Proposed commercial terms require agreement. A scenario does not edit orders or payment contracts."
          >
            {result.assumptions.length ? (
              <ul>
                {[...new Set(result.assumptions)].map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            ) : (
              <p>No additional scenario assumptions were supplied.</p>
            )}
          </Panel>
          <RunSceneManifest run={run} result={result} />
        </>
      )}
    </>
  )
}

function PlaybackDock({
  run,
  playbackAvailable,
  playbackDates,
  playbackIndex,
  playing,
  lastPlaybackIndex,
  activeDate,
  togglePlayback,
  selectPlaybackIndex,
}: Pick<
  RunResultsView,
  | 'run'
  | 'playbackAvailable'
  | 'playbackDates'
  | 'playbackIndex'
  | 'playing'
  | 'lastPlaybackIndex'
  | 'activeDate'
  | 'togglePlayback'
  | 'selectPlaybackIndex'
>) {
  if (!playbackAvailable || !activeDate) return null
  return (
    <section
      className="analysis-playback-dock"
      aria-label="Result playback controls"
    >
      <div className="analysis-playback-dock-inner">
        <div className="playback-transport">
          <button
            type="button"
            className="playback-transport-button"
            aria-label="Previous date"
            disabled={playbackIndex === 0}
            onClick={() => selectPlaybackIndex(playbackIndex - 1)}
          >
            <ChevronLeft size={19} />
          </button>
          <button
            type="button"
            className="playback-transport-button primary"
            aria-label={
              playing
                ? 'Pause playback'
                : playbackIndex >= lastPlaybackIndex
                  ? 'Replay from start'
                  : 'Play playback'
            }
            onClick={togglePlayback}
          >
            {playing ? (
              <Pause size={18} fill="currentColor" />
            ) : playbackIndex >= lastPlaybackIndex ? (
              <RotateCcw size={18} />
            ) : (
              <Play size={18} fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            className="playback-transport-button"
            aria-label="Next date"
            disabled={playbackIndex >= lastPlaybackIndex}
            onClick={() => selectPlaybackIndex(playbackIndex + 1)}
          >
            <ChevronRight size={19} />
          </button>
        </div>
        <div className="playback-scrubber">
          <label className="sr-only" htmlFor={`playback-${run.id}`}>
            Playback date
          </label>
          <input
            id={`playback-${run.id}`}
            type="range"
            min={0}
            max={lastPlaybackIndex}
            step={1}
            value={playbackIndex}
            aria-valuetext={`${dateLabel(activeDate)}, day ${playbackIndex + 1} of ${playbackDates.length}`}
            onChange={(event) =>
              selectPlaybackIndex(Number(event.currentTarget.value))
            }
          />
        </div>
        <div className="playback-position">
          <strong>{dateLabel(activeDate)}</strong>
          <span>
            Day {playbackIndex + 1} of {playbackDates.length}
          </span>
        </div>
      </div>
    </section>
  )
}

function RunProvenance({
  run,
  currency,
  onOpenRun,
}: Pick<RunResultsView, 'run' | 'currency' | 'onOpenRun'>) {
  return (
    <>
      <Panel
        title="Execution record"
        subtitle="This provenance is retained with the run."
      >
        <dl className="details-grid">
          <div>
            <dt>Engine</dt>
            <dd>
              {run.provenance.engine} · {run.provenance.engine_version}
            </dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{currency}</dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>
              {typeof run.provenance.scope === 'string'
                ? run.provenance.scope
                : JSON.stringify(run.provenance.scope)}
            </dd>
          </div>
          <div>
            <dt>Input snapshot</dt>
            <dd>{dated(run.provenance.snapshot_at)}</dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>{dated(run.started_at)}</dd>
          </div>
          <div>
            <dt>Completed</dt>
            <dd>{dated(run.completed_at)}</dd>
          </div>
          <div>
            <dt>Definition</dt>
            <dd>{run.definition_id}</dd>
          </div>
          <div>
            <dt>Previous run</dt>
            <dd>
              {run.retry_of_run_id ? (
                <button
                  className="text-button"
                  onClick={() => onOpenRun(run.retry_of_run_id!)}
                >
                  {run.retry_of_run_id}
                </button>
              ) : (
                'Initial execution'
              )}
            </dd>
          </div>
        </dl>
        <details>
          <summary>Inspect submitted inputs and configuration</summary>
          <pre className="analysis-json">
            {JSON.stringify(
              { config: run.config, snapshot: run.snapshot },
              null,
              2,
            )}
          </pre>
        </details>
      </Panel>
    </>
  )
}

function RunAgain({
  run,
  busy,
  canManage,
  onRerun,
}: Pick<RunResultsView, 'run' | 'busy' | 'canManage' | 'onRerun'>) {
  return (
    <>
      {!isPending(run) && (
        <Panel
          title="Test another version"
          subtitle="Review the basis explicitly. Every submission creates a new immutable run."
        >
          <div className="form-actions">
            <button
              className="button secondary"
              disabled={busy || !canManage}
              onClick={() => onRerun('original')}
            >
              <RotateCcw size={16} />
              Rerun original snapshot
            </button>
            <button
              className="button primary"
              disabled={busy || !canManage}
              onClick={() => onRerun('current')}
            >
              Review current data and rerun
            </button>
          </div>
        </Panel>
      )}
    </>
  )
}

function RunSceneManifest({
  run,
  result,
}: {
  run: AnalysisRun
  result: NonNullable<RunResultsView['result']>
}) {
  return (
    <>
      {run.kind === 'simulation' && (
        <Panel
          title="Future scene data"
          subtitle="The 2D result above is complete. A 3D renderer is deferred."
        >
          {result.scene_manifest.scene_manifest_supported ? (
            <>
              <p>
                A saved focused-question manifest references this run's existing
                events and metric series. It does not recalculate outcomes.
              </p>
              <p className="muted">
                Allowed assets ·{' '}
                {result.scene_manifest.allowed_asset_ids.join(', ')}
              </p>
              <details>
                <summary>Inspect saved scene manifest</summary>
                {result.scene_manifest.asset_metadata && (
                  <ul>
                    {result.scene_manifest.asset_metadata.map((asset) => (
                      <li key={asset.asset_id}>
                        <strong>{asset.label}</strong> · {asset.description}
                      </li>
                    ))}
                  </ul>
                )}
                <pre className="analysis-json">
                  {JSON.stringify(result.scene_manifest, null, 2)}
                </pre>
              </details>
            </>
          ) : (
            <p>
              Explore outcomes has no scene manifest in this version. No assets
              or renderer are required to reopen its full result.
            </p>
          )}
        </Panel>
      )}
    </>
  )
}
