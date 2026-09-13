import type { AnalysisRun } from '../../../lib/analysis'

export function warehouseUrl(run: AnalysisRun, date?: string) {
  const query = new URLSearchParams({ workspace: run.snapshot.id, run: run.id, mode: run.snapshot.mode })
  if (date) query.set('date', date)
  return `${import.meta.env.BASE_URL}warehouse.html#${query}`
}

export function savedResultsUrl(mode: string, runId: string) {
  return `${import.meta.env.BASE_URL}#/${mode === 'demo' ? 'demo' : 'business'}/analysis?run=${encodeURIComponent(runId)}`
}
