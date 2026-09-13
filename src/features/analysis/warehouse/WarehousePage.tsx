import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { createAnalysisClient } from '../../../lib/analysis'
import type { SavedSimulation } from './scene-data'
import { savedResultsUrl } from './game-url'

const WarehouseView = lazy(() => import('./WarehouseView'))

class GameBoundary extends Component<{ children: ReactNode; resultsUrl: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <main className="warehouse-message"><h1>The warehouse could not open</h1><p>Your saved simulation is still available.</p><button onClick={() => location.reload()}>Retry</button><a href={this.props.resultsUrl}>Back to saved results</a></main> : this.props.children
  }
}

function WarehouseSession({ hash }: { hash: string }) {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const workspaceId = params.get('workspace') ?? ''
  const runId = params.get('run') ?? ''
  const initialDate = params.get('date') ?? undefined
  const resultsUrl = savedResultsUrl(params.get('mode') ?? '', runId)
  const [run, setRun] = useState<SavedSimulation | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!workspaceId || !runId) return
    let cancelled = false
    createAnalysisClient(workspaceId).getRun(runId).then(saved => {
      if (cancelled) return
      if (saved.kind !== 'simulation' || saved.status !== 'succeeded') {
        setError('Open a completed simulation to enter its warehouse.')
        return
      }
      document.title = `${saved.definition_name} · SAMBY Warehouse`
      setRun(saved)
    }).catch(reason => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'The saved simulation could not be loaded.')
    })
    return () => { cancelled = true }
  }, [workspaceId, runId, attempt])
  if (!workspaceId || !runId || error) return (
    <main className="warehouse-message">
      <p className="warehouse-eyebrow">SAMBY / WAREHOUSE</p>
      <h1>Unable to open this warehouse</h1>
      <p role="alert">{error || 'Open the warehouse from a completed simulation so its saved run can be loaded.'}</p>
      {workspaceId && runId && <button onClick={() => { setError(''); setAttempt(value => value + 1) }}>Retry</button>}
      <a href={resultsUrl}>Back to saved results</a>
    </main>
  )
  return <GameBoundary resultsUrl={resultsUrl}>
    {run ? <Suspense fallback={<main className="warehouse-message" role="status">Loading the warehouse…</main>}><WarehouseView run={run} initialDate={initialDate} /></Suspense> : <main className="warehouse-message" role="status">Loading your saved simulation…</main>}
  </GameBoundary>
}

export default function WarehousePage() {
  const [hash, setHash] = useState(() => location.hash)
  useEffect(() => {
    const changed = () => setHash(location.hash)
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  return <WarehouseSession key={hash} hash={hash} />
}
