import { useWorkspaceAccess } from '../../components/workspace-access-context'
import { ForecastEvaluation } from './ForecastEvaluation'
import { ArrowLeft, Archive, Clock3, Download, RotateCcw } from 'lucide-react'
import {
  DataChart,
  MetricCard,
  PageHeader,
  Panel,
} from '../../components/workspace-ui'
import { number, questions, shiftDate } from '../../domain/workspace'
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
}
const metricValue = (value: number | null, unit: string) =>
  value === null
    ? 'Not supported'
    : `${number(value)}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}`

function SavedChart({
  points,
  keys,
  title,
  unit,
  subtitle,
}: {
  points: DailyPoint[]
  keys: string[]
  title: string
  unit: string
  subtitle: string
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

export function RunResults({
  run,
  busy,
  onBack,
  onCancel,
  onArchive,
  onRerun,
  onOpenRun,
}: {
  run: AnalysisRun
  busy: boolean
  onBack: () => void
  onCancel: () => void
  onArchive: () => void
  onRerun: (basis: 'original' | 'current') => void
  onOpenRun: (id: string) => void
}) {
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
  return (
    <div className="stack analysis-results">
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
            {warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </section>
      )}
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
      {result && (
        <>
          {run.kind === 'forecast' && !result.forecast_diagnostics && (
            <p className="notice">
              This prototype publishes the configured dated demand series. No
              backtest error, bias or uncertainty interval is claimed unless the
              engine supplies that artifact.
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
                {result.explanations.map((explanation, i) => (
                  <li key={i}>{explanation}</li>
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
          />
          <SavedChart
            points={result.series}
            keys={['cash', 'zero', 'reserve']}
            title="Cash balance through time"
            subtitle="End-of-day cash. A negative balance is a cash gap. The daily model does not establish intraday payment order."
            unit={currency}
          />
          <SavedChart
            points={result.series}
            keys={['inflow', 'outflow']}
            title="Recorded inflows and outflows"
            subtitle="Linked economic events are retained in the submitted input basis."
            unit={currency}
          />
          <SavedChart
            points={result.series}
            keys={['receivable', 'provider_pending', 'overdue']}
            title="Customer balances through time"
            subtitle="Uncollected balances stay outstanding beyond the horizon. No default probability is inferred."
            unit={currency}
          />
          <SavedChart
            points={result.series}
            keys={['payable', 'planned_payable', 'financing_debt']}
            title="Supplier and financing balances"
            subtitle="Confirmed External Debt and Financing Debt are separate balances. Purchase proposals do not create a confirmed payable."
            unit={currency}
          />
          <SavedChart
            points={result.series}
            keys={['customer_concentration']}
            title="Customer concentration"
            subtitle="Largest customer share of the applicable saved balance. This percentage is separate from monetary balances."
            unit="%"
          />
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
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Measure</th>
                        <th>Baseline</th>
                        <th>Alternative</th>
                        <th>Absolute change</th>
                        <th>Percentage change</th>
                      </tr>
                    </thead>
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
                  </table>
                </div>
              </Panel>
              <SavedChart
                points={result.comparison.series}
                keys={['inventory_delta', 'demand_delta']}
                title="Inventory and demand differences"
                subtitle="Saved alternative minus the pinned baseline on matching dates."
                unit={unit}
              />
              <SavedChart
                points={result.comparison.series}
                keys={['cash_delta', 'receivable_delta']}
                title="Cash and receivable differences"
                subtitle="Saved alternative minus the pinned baseline on matching dates."
                unit={currency}
              />
            </>
          )}
          <Panel
            title="Dated event trace"
            subtitle="Receipts, demand, collections and payments link back to the saved source references."
          >
            {result.events.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Event</th>
                      <th>Quantity</th>
                      <th>Amount</th>
                      <th>Source reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.events.map((event) => (
                      <tr key={event.id}>
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
                </table>
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
                {result.assumptions.map((assumption, i) => (
                  <li key={i}>{assumption}</li>
                ))}
              </ul>
            ) : (
              <p>No additional scenario assumptions were supplied.</p>
            )}
          </Panel>
          {run.kind === 'simulation' && (
            <Panel
              title="Future scene data"
              subtitle="The 2D result above is complete. A 3D renderer is deferred."
            >
              {result.scene_manifest.scene_manifest_supported ? (
                <>
                  <p>
                    A saved focused-question manifest references this run's
                    existing events and metric series. It does not recalculate
                    outcomes.
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
                  Explore outcomes has no scene manifest in this version. No
                  assets or renderer are required to reopen its full result.
                </p>
              )}
            </Panel>
          )}
        </>
      )}
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
    </div>
  )
}
