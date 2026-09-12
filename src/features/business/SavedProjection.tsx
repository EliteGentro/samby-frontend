import { useEffect, useState } from 'react'
import { ArrowUpRight, RefreshCw } from 'lucide-react'
import { DataChart, EmptyState, Panel } from '../../components/workspace-ui'
import type { Page, Workspace } from '../../domain/workspace'
import { listRuns, type Run } from '../../lib/analysis'

export function SavedProjection({
  workspace: w,
  onNavigate,
}: {
  workspace: Workspace
  onNavigate: (page: Page, query?: string) => void
}) {
  const [runs, setRuns] = useState<Run[]>([]),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState(
    () => sessionStorage.getItem(`samby.projection.${w.id}`) ?? '',
  )
  useEffect(() => {
    let active = true
    listRuns(w.id)
      .then((items) => {
        if (active) {
          setRuns(
            items.filter(
              (r) =>
                r.kind === 'simulation' &&
                r.status === 'succeeded' &&
                r.result?.series.some((s) => typeof s.cash === 'number'),
            ),
          )
          setError('')
        }
      })
      .catch(() => {
        if (active)
          setError(
            'The analytical service is unavailable. Saved results remain on the server.',
          )
      })
    return () => {
      active = false
    }
  }, [w.id, retry])
  const run = runs.find((r) => r.id === selected)
  return (
    <Panel
      capability="liquidity"
      title="Cash outlook"
      subtitle="An explicitly selected saved simulation"
      action={
        run ? (
          <button
            className="text-button"
            onClick={() => onNavigate('analysis', `run=${run.id}`)}
          >
            Full result
            <ArrowUpRight size={15} />
          </button>
        ) : undefined
      }
    >
      {runs.length > 0 && (
        <div className="panel-body">
          <label className="field">
            Saved financial projection
            <SelectField
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value)
                sessionStorage.setItem(
                  `samby.projection.${w.id}`,
                  e.target.value,
                )
              }}
            >
              <option value="">Choose a completed run</option>
              {runs.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.definition_name} · {r.result?.start_date} ·{' '}
                  {r.id.slice(0, 8)}
                </option>
              ))}
            </SelectField>
            <small>
              Select the exact run you want to summarize. New runs do not
              silently replace it.
            </small>
          </label>
        </div>
      )}
      {run?.result ? (
        <>
          <DataChart
            data={run.result.series}
            series={[{ key: 'cash', label: 'Saved end-of-day cash' }]}
            label="Saved daily cash projection"
            unit={run.provenance.currency}
          />
          <p className="notice small">
            {run.provenance.mode === 'demo'
              ? 'Demo result'
              : 'Computed from submitted inputs'}{' '}
            · {run.result.start_date} to {run.result.end_date} · Run{' '}
            {run.id.slice(0, 8)}. {run.result.warnings.join(' ')}
          </p>
        </>
      ) : (
        <EmptyState
          title={
            error
              ? 'Saved results are temporarily unavailable'
              : selected
                ? 'The selected run is unavailable'
                : 'Put a decision on the timeline'
          }
          description={
            error ||
            'Run a cash scenario, then select its saved result here. Forecasts and current facts stay in their own views.'
          }
          action={
            error ? (
              <button
                className="button secondary"
                onClick={() => setRetry(retry + 1)}
              >
                <RefreshCw size={15} />
                Retry connection
              </button>
            ) : (
              <button
                className="button secondary"
                onClick={() =>
                  onNavigate('analysis', 'question=Q-CASH-SUFFICIENCY')
                }
              >
                Create a cash scenario
                <ArrowUpRight size={15} />
              </button>
            )
          }
        />
      )}
    </Panel>
  )
}
import { SelectField } from '../../components/ui/select-field'
