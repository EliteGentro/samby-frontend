import { workspaceHeaders } from './workspace-api'
import type { QuestionKey, Workspace } from '../domain/workspace'

export type AnalysisKind = 'forecast' | 'simulation'
export type OutputFamily = 'inventory' | 'cash' | 'debt'
export type Engine = 'naive' | 'seasonal-naive' | 'lightgbm' | 'catboost'
export type RunStatus =
  | 'queued'
  | 'waiting_for_dependency'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
export type Assumptions = {
  payment_id?: string
  payment_date?: string
  payment_change_accepted?: boolean
  dispatch_date?: string
  supplier_payment_before_dispatch?: boolean
  daily_demand?: number
  order_quantity?: number
  order_date?: string
  receipt_date?: string
  lead_time_days?: number
  collection_delay_days?: number
  asem_stress?: boolean
  collection_id?: string
  demand_multiplier?: number
  reserve?: number
  price?: number
  unit_cost?: number
  purchase_id?: string
  stock_opening_confirmed?: boolean
  cash_opening_estimate?: number
  forecast_overlap?: 'replacement' | 'incremental'
  demand_start_date?: string
  demand_end_date?: string
  season_length_days?: number
  backlog_policy?: 'lost_sales' | 'carry'
  opening_backlog_confirmed?: boolean
  backlog_reservation_overlap?: 'included' | 'additional'
  supplier_terms_id?: string
  customer_terms_id?: string
  terms_accepted?: boolean
  terms_no_advance_confirmed?: boolean
  demand_cash_treatment?: 'incremental' | 'already_recorded'
  purchase_cash_treatment?:
    | 'incremental'
    | 'replace_linked'
    | 'already_recorded'
  purchase_paid_amount?: number
  purchase_invoice_date?: string
  invoice_delay_days?: number
  customer_order_date?: string
  customer_advance_received?: number
  new_credit_sales_amount?: number
  new_credit_sales_date?: string
  unpaid_share?: number
  order_policy?: 'explicit' | 'reorder'
  reorder_point?: number
  safety_stock?: number
  service_target?: number
  discount_percent?: number
  // Poison Apple (Growth Insolvency)
  poison_order_amount?: number
  poison_margin_pct?: number
  poison_supplier_advance_pct?: number
  poison_supplier_balance_days?: number
  poison_customer_days?: number
  poison_fixed_daily_costs?: number
  // Dead Stock Liberator
  dio_threshold?: number
  liquidation_discount_pct?: number
  liquidation_days?: number
  holding_cost_daily_pct?: number
  // Treasury Edge Cases
  payroll_amount?: number
  payroll_dates?: string[]
  payroll_buffer_days?: number
  banking_cutoff_apply?: boolean
  weekend_shift_apply?: boolean
  paused_supplier_ids?: string[]
  spiral_product_ids?: string[]
  spiral_restock_penalty_days?: number
  disputed_record_ids?: string[]
  dispute_resolution_days?: number
  dispute_recovery_pct?: number
}
export type AnalysisConfig = {
  engine: Engine
  question: QuestionKey
  start_date: string
  horizon_days: number
  product_id: string | null
  location_id: string | null
  inventory_pool_id?: string | null
  output_families: OutputFamily[]
  coverage_reviewed: boolean
  assumptions: Assumptions
  forecast_run_id: string | null
  baseline_run_id: string | null
}
export type Definition = {
  id: string
  name: string
  kind: AnalysisKind
  config: AnalysisConfig
  version: number
  archived: boolean
  created_at: string
  updated_at: string
}
export type Metric = {
  key: string
  label: string
  value: number | null
  unit: string
}
export type DailyPoint = {
  date: string
  [key: string]: string | number | null | undefined
}
export type AnalysisEvent = {
  id: string
  date: string
  type: string
  label: string
  amount?: number
  quantity?: number
  source_id?: string
}
export type SceneManifest = {
  contract_version: string
  scene_manifest_supported: boolean
  run_id: string
  question_key: QuestionKey
  start_date: string
  end_date: string
  grain: string
  allowed_asset_ids: string[]
  entities: { id: string; asset_id: string; source_id: string }[]
  events: { event_id: string; date: string; entity_id: string }[]
  series: { key: string; run_id: string }[]
  asset_metadata?: { asset_id: string; label: string; description: string }[]
}
export type Comparison = {
  baseline_run_id: string
  metrics: {
    key: string
    label: string
    unit: string
    baseline: number | null
    alternative: number | null
    delta: number | null
    percentage_change: number | null
  }[]
  series: DailyPoint[]
}
export type ForecastDiagnostics = {
  stockout_observations?: {
    id: string
    date: string
    phase: string
    location_id: string | null
    source_id?: string | null
  }[]
  contract_version: string
  evaluation_source: string
  engine: string
  library_version: string
  feature_names: string[]
  history_start: string
  history_end: string
  observed_days: number
  consecutive_training_days: number
  training_rows: number
  training_cutoff: string
  temporal_method: string
  formulas: Record<string, string>
  limitations: string[]
  backtest: null | {
    start_date: string
    end_date: string
    training_end: string
    observations: number
    metrics: Record<string, number | null>
    naive_metrics: Record<string, number | null>
    seasonal_naive_metrics: Record<string, number | null> | null
    series: DailyPoint[]
  }
}
export type DeadStockCandidate = {
  product_id: string
  product_name: string
  unit: string
  on_hand: number
  unit_cost: number
  locked_capital: number
  dio: number | null
  daily_demand_rate: number
  sale_revenue?: number
  discount_loss?: number
}
export type AnalysisResult = {
  history?: DailyPoint[]
  forecast_diagnostics?: ForecastDiagnostics
  candidates?: DeadStockCandidate[]
  start_date: string
  end_date: string
  grain: string
  metrics: Metric[]
  series: DailyPoint[]
  events: AnalysisEvent[]
  assumptions: string[]
  warnings: string[]
  explanations: string[]
  comparison: Comparison | null
  scene_manifest: SceneManifest
}
export type Provenance = {
  mode: 'demo' | 'computed'
  engine: string
  engine_version: string
  currency: string
  snapshot_at: string
  scope: string | Record<string, unknown>
}
type RunIdentity = {
  id: string
  definition_id: string
  definition_name: string
  kind: AnalysisKind
  archived?: boolean
  phase: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
  config: AnalysisConfig
  snapshot: Workspace
  warnings: string[]
  retry_of_run_id: string | null
  attempt: number
  provenance: Provenance
}
export type AnalysisRun = RunIdentity &
  (
    | { status: 'succeeded'; result: AnalysisResult; error: null }
    | {
        status: Exclude<RunStatus, 'succeeded'>
        result: null
        error: { category?: string; message: string } | string | null
      }
  )
export type Run = AnalysisRun

export const isPending = (run: AnalysisRun) =>
  ['queued', 'running', 'waiting_for_dependency'].includes(run.status)
export const analysisBaseUrl = (
  import.meta.env.VITE_ANALYSIS_URL || 'http://127.0.0.1:8001/api/prototype'
).replace(/\/$/, '')

export class AnalysisError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'AnalysisError'
    this.status = status
  }
}

function errorMessage(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(errorMessage).join(' ')
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return errorMessage(
      record.message ??
        record.msg ??
        record.detail ??
        'The service could not accept this request.',
    )
  }
  return 'The service could not accept this request.'
}

export function createAnalysisClient(workspaceId: string) {
  async function request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<T> {
    let response: Response
    const headers = workspaceHeaders(workspaceId)
    headers.set('Content-Type', 'application/json')
    try {
      response = await fetch(`${analysisBaseUrl}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15000),
      })
    } catch {
      throw new AnalysisError(
        'The analysis service is unavailable. Check that the local service is running, then retry. Saved work remains on the server.',
      )
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new AnalysisError(
        'The analysis service returned an unreadable response. Retry the request.',
        response.status,
      )
    }
    if (!response.ok)
      throw new AnalysisError(errorMessage(payload), response.status)
    return payload as T
  }
  return {
    listDefinitions: () =>
      request<Definition[]>('/definitions?include_archived=true'),
    saveDefinition: (definition: {
      name: string
      kind: AnalysisKind
      config: AnalysisConfig
    }) => request<Definition>('/definitions', 'POST', definition),
    editDefinition: (
      id: string,
      patch: { name?: string; config?: AnalysisConfig; archived?: boolean },
    ) =>
      request<Definition>(
        `/definitions/${encodeURIComponent(id)}`,
        'PATCH',
        patch,
      ),
    listRuns: () => request<AnalysisRun[]>('/runs?include_archived=true'),
    getRun: (id: string) =>
      request<AnalysisRun>(`/runs/${encodeURIComponent(id)}`),
    startRun: (
      definitionId: string,
      snapshot: Workspace,
      idempotencyKey: string,
      retryOf?: string,
    ) =>
      request<AnalysisRun>(
        `/definitions/${encodeURIComponent(definitionId)}/runs`,
        'POST',
        {
          snapshot,
          idempotency_key: idempotencyKey,
          ...(retryOf ? { retry_of_run_id: retryOf } : {}),
        },
      ),
    cancelRun: (id: string) =>
      request<AnalysisRun>(`/runs/${encodeURIComponent(id)}/cancel`, 'POST'),
    archiveRun: (id: string, archived: boolean) =>
      request<AnalysisRun>(`/runs/${encodeURIComponent(id)}`, 'PATCH', {
        archived,
      }),
  }
}

type PendingSubmission = { fingerprint: string; id: string }
const pendingInMemory = new Map<string, PendingSubmission | null>()
const unavailableSubmissionStorage = new Set<string>()
function browserStorage<T>(
  operation: (storage: Storage) => T,
): { ok: true; value: T } | { ok: false } {
  try {
    return { ok: true, value: operation(sessionStorage) }
  } catch {
    return { ok: false }
  }
}
export function submissionStorageWarning(workspaceId: string): string | null {
  return unavailableSubmissionStorage.has(workspaceId)
    ? 'Browser storage is unavailable. Retry protection is retained for this page only. Accepted runs remain saved on the server.'
    : null
}
export function pendingSubmission(
  workspaceId: string,
  fingerprint: string,
): string {
  const key = `samby-analysis-pending-${workspaceId}`
  if (!pendingInMemory.has(workspaceId)) {
    const loaded = browserStorage(
      (storage) =>
        JSON.parse(storage.getItem(key) || 'null') as PendingSubmission | null,
    )
    if (loaded.ok) pendingInMemory.set(workspaceId, loaded.value)
    else unavailableSubmissionStorage.add(workspaceId)
  }
  const retained = pendingInMemory.get(workspaceId)
  if (retained?.fingerprint === fingerprint) return retained.id
  const submission = { fingerprint, id: crypto.randomUUID() }
  pendingInMemory.set(workspaceId, submission)
  const saved = browserStorage((storage) =>
    storage.setItem(key, JSON.stringify(submission)),
  )
  if (!saved.ok) unavailableSubmissionStorage.add(workspaceId)
  return submission.id
}

export function acknowledgeSubmission(workspaceId: string) {
  pendingInMemory.set(workspaceId, null)
  const removed = browserStorage((storage) =>
    storage.removeItem(`samby-analysis-pending-${workspaceId}`),
  )
  if (!removed.ok) unavailableSubmissionStorage.add(workspaceId)
}

export const listRuns = (workspaceId: string) =>
  createAnalysisClient(workspaceId).listRuns()

export const statusLabel: Record<AnalysisRun['status'], string> = {
  queued: 'Queued',
  waiting_for_dependency: 'Waiting for forecast',
  running: 'Running',
  succeeded: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}
