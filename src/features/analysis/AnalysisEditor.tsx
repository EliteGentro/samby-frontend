import { PolicyInputs, CreditInputs, PaymentTimingInputs } from './PolicyInputs'
import { ConsequencesInputs } from './ConsequencesInputs'
import { FieldRequirement, OptionalHelp } from './FieldRequirement'
import { SelectField } from '../../components/ui/select-field'
import { useWorkspaceAccess } from '../../components/workspace-access-context'
import { useState, type FormEvent } from 'react'
import {
  capabilities,
  categories,
  questions,
  shiftDate,
  type QuestionKey,
  type Workspace,
} from '../../domain/workspace'
import { Modal } from '../../components/workspace-ui'
import { SortableTable } from '../../components/SortableTable'
import {
  ASEM_STRESS_DAYS,
  behavioralCollectionMatrix,
} from '../../domain/behavioral-collection'
import {
  collectionQuestions,
  forecastCreationIssue,
  forecastEngines,
  forecastPresentationMuted,
  newConfig,
  questionDefinition,
  orderQuestions,
  purchaseQuestions,
  validateEditor,
} from './config'
import type {
  AnalysisConfig,
  AnalysisKind,
  AnalysisRun,
  Assumptions,
  Definition,
  OutputFamily,
} from '../../lib/analysis'

export type EditorSeed = {
  kind: AnalysisKind
  question?: QuestionKey
  definition?: Definition
  run?: AnalysisRun
  basis: Workspace
  retryOf?: string
}
export type EditorSubmission = {
  name: string
  kind: AnalysisKind
  config: AnalysisConfig
  snapshot: Workspace
  definitionId?: string
  retryOf?: string
}

type AnalysisEditorProps = {
  seed: EditorSeed
  runs: AnalysisRun[]
  busy: boolean
  error: string | null
  onClose: () => void
  onSubmit: (value: EditorSubmission, execute: boolean) => void
}
type AnalysisEditorView = ReturnType<typeof useAnalysisEditorView>

function editorContext(
  config: AnalysisConfig,
  snapshot: Workspace,
  seed: EditorSeed,
  runs: AnalysisRun[],
) {
  const end =
    config.start_date && config.horizon_days >= 1 && config.horizon_days <= 365
      ? shiftDate(config.start_date, config.horizon_days - 1)
      : ''
  const inventory =
    seed.kind === 'simulation' && config.output_families.includes('inventory')
  const cash =
    seed.kind === 'simulation' && config.output_families.includes('cash')
  const collectionRequired = [
    'Q-CRITICAL-COLLECTION',
    'Q-CUSTOMER-DEBT',
  ].includes(config.question)
  const showCollectionControls =
    collectionRequired || !snapshot.muted.includes('customer-delay')
  const showPriceControls = !snapshot.muted.includes('price')
  const showReserveControl = !snapshot.muted.includes('reserve')
  const mutedAssumptions = [
    ...(inventory && !showPriceControls
      ? [
          `Selling price: ${config.assumptions.price ?? 'recorded product value when known'}`,
          `Unit cost: ${config.assumptions.unit_cost ?? 'recorded product value when known'}`,
        ]
      : []),
    ...(cash && !showReserveControl
      ? [
          `Reserve: ${config.assumptions.reserve ?? snapshot.cash?.reserve ?? 'not supplied'}`,
        ]
      : []),
    ...((cash || config.output_families.includes('debt')) &&
    !showCollectionControls &&
    config.assumptions.collection_delay_days !== undefined
      ? [
          `Collection timing: ${config.assumptions.collection_delay_days} days; ${config.assumptions.collection_id ?? 'all eligible customer collections'}`,
        ]
      : []),
  ]
  const relevantIds = new Set<string>()
  const families = new Set(config.output_families)
  const selectedEngine = forecastEngines.find(
    (engine) => engine.id === config.engine,
  )
  if (seed.kind === 'forecast') {
    relevantIds.add('forecast')
    if (selectedEngine) relevantIds.add(selectedEngine.capabilityId)
  }
  if (inventory)
    ['stock', 'forecast', 'replenishment'].forEach((id) => relevantIds.add(id))
  if (cash) relevantIds.add('liquidity')
  if (collectionRequired) relevantIds.add('customer-delay')
  if (families.has('debt')) relevantIds.add('internal-debt')
  const relevantCapabilities = capabilities.filter((capability) =>
    relevantIds.has(capability.id),
  )
  const mutedIds = new Set(snapshot.muted)
  const forecastBlock =
    seed.kind === 'forecast'
      ? forecastCreationIssue(config.engine, snapshot)
      : null
  const selectedEngineCapability = capabilities.find(
    (item) =>
      item.id ===
      forecastEngines.find((engine) => engine.id === config.engine)
        ?.capabilityId,
  )
  const limitedCapabilities = relevantCapabilities.filter(
    (capability) => mutedIds.has(capability.id) || !capability.check(snapshot),
  )
  const selectedProduct = snapshot.products.find(
    (p) => p.id === config.product_id,
  )
  const selectedPool = snapshot.inventoryPools?.find(
    (pool) => pool.id === config.inventory_pool_id,
  )
  const poolLocations = new Set(selectedPool?.locationIds)
  const stock = snapshot.stock.filter(
    (s) =>
      s.productId === config.product_id &&
      (!config.location_id || s.locationId === config.location_id) &&
      (!selectedPool ||
        Boolean(s.locationId && poolLocations.has(s.locationId))),
  )
  const forecasts = runs.filter(
    (r) =>
      r.kind === 'forecast' &&
      r.status !== 'failed' &&
      r.status !== 'cancelled',
  )
  const baselines = runs.filter(
    (r) => r.kind === seed.kind && r.status === 'succeeded',
  )
  const compatibleScope = (run: AnalysisRun) =>
    run.config.product_id === config.product_id &&
    run.config.location_id === config.location_id &&
    (run.config.inventory_pool_id ?? null) ===
      (config.inventory_pool_id ?? null) &&
    run.provenance.currency === snapshot.profile.currency &&
    run.snapshot.profile.timezone === snapshot.profile.timezone &&
    run.snapshot.products.find((product) => product.id === config.product_id)
      ?.unit ===
      snapshot.products.find((product) => product.id === config.product_id)
        ?.unit
  const compatibleForecast = (run: AnalysisRun) =>
    compatibleScope(run) &&
    run.config.start_date <= config.start_date &&
    shiftDate(run.config.start_date, run.config.horizon_days - 1) >= end
  const compatibleBaseline = (run: AnalysisRun) =>
    compatibleScope(run) &&
    run.config.start_date === config.start_date &&
    run.config.horizon_days === config.horizon_days

  return {
    end,
    inventory,
    cash,
    showCollectionControls,
    showPriceControls,
    showReserveControl,
    mutedAssumptions,
    forecastBlock,
    selectedEngineCapability,
    limitedCapabilities,
    selectedProduct,
    selectedPool,
    stock,
    forecasts,
    baselines,
    compatibleForecast,
    compatibleBaseline,
  }
}

function useAnalysisEditorView({
  seed,
  runs,
  busy,
  error,
  onClose,
  onSubmit,
}: AnalysisEditorProps) {
  const { role, canEdit } = useWorkspaceAccess()
  const prior = seed.definition?.config ?? seed.run?.config
  const [config, setConfig] = useState<AnalysisConfig>(() => {
    const initial = structuredClone(
      prior ?? newConfig(seed.kind, seed.question ?? 'Q-EXPLORE', seed.basis),
    )
    if (!prior && seed.kind === 'forecast')
      initial.engine =
        forecastEngines.find(
          (engine) => !forecastPresentationMuted(engine.id, seed.basis),
        )?.id ?? initial.engine
    if (seed.definition || (seed.run && seed.basis !== seed.run.snapshot)) {
      initial.coverage_reviewed = false
      initial.assumptions.stock_opening_confirmed = false
    }
    if (!prior && seed.kind === 'simulation' && role === 'finance') {
      initial.output_families = ['cash']
      initial.product_id = null
    }
    return initial
  })
  const [snapshot, setSnapshot] = useState(() => structuredClone(seed.basis))
  const [name, setName] = useState(
    seed.definition?.name ??
      (seed.run
        ? `${seed.run.definition_name} · rerun`
        : seed.kind === 'forecast'
          ? 'Demand forecast'
          : questionDefinition(seed.question ?? 'Q-EXPLORE').label),
  )
  const [localError, setLocalError] = useState<string | null>(null)
  const [horizonInput, setHorizonInput] = useState(String(config.horizon_days))
  const {
    end,
    inventory,
    cash,
    showCollectionControls,
    showPriceControls,
    showReserveControl,
    mutedAssumptions,
    forecastBlock,
    selectedEngineCapability,
    limitedCapabilities,
    selectedProduct,
    selectedPool,
    stock,
    forecasts,
    baselines,
    compatibleForecast,
    compatibleBaseline,
  } = editorContext(config, snapshot, seed, runs)
  const patch = (value: Partial<AnalysisConfig>) => {
    if (value.horizon_days !== undefined)
      setHorizonInput(String(value.horizon_days))
    setConfig((previous) => ({ ...previous, ...value }))
    setLocalError(null)
  }
  const assumption = <K extends keyof Assumptions>(
    key: K,
    value: Assumptions[K],
  ) => {
    setConfig((previous) => {
      const assumptions = { ...previous.assumptions }
      if (value === undefined) delete assumptions[key]
      else assumptions[key] = value
      return { ...previous, assumptions }
    })
    setLocalError(null)
  }
  const numericField = (
    key: keyof Assumptions,
    label: string,
    hint: string,
    options: {
      min?: number
      step?: number
      required?: boolean
      optional?: boolean
    } = {},
  ) => (
    <label className="field" key={key}>
      <FieldRequirement required={options.required}>{label}</FieldRequirement>
      <input
        aria-label={label}
        aria-required={options.required || undefined}
        type="number"
        step={options.step ?? 'any'}
        min={options.min}
        value={String(config.assumptions[key] ?? '')}
        onChange={(event) =>
          assumption(
            key,
            event.target.value === '' ? undefined : Number(event.target.value),
          )
        }
      />
      {options.optional ? (
        <OptionalHelp>{hint}</OptionalHelp>
      ) : (
        <span className="muted">{hint}</span>
      )}
    </label>
  )
  const dateField = (
    key:
      | 'order_date'
      | 'receipt_date'
      | 'demand_start_date'
      | 'demand_end_date',
    label: string,
    options: { required?: boolean; hint?: string } = {},
  ) => (
    <label className="field" key={key}>
      <FieldRequirement required={options.required}>{label}</FieldRequirement>
      <input
        aria-label={label}
        aria-required={options.required || undefined}
        type="date"
        value={config.assumptions[key] ?? ''}
        onChange={(event) => assumption(key, event.target.value || undefined)}
      />
      {options.hint && <OptionalHelp>{options.hint}</OptionalHelp>}
    </label>
  )
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEdit('analysis')) {
      setLocalError(
        'This role can inspect saved analytical results but cannot submit changes.',
      )
      return
    }
    if (
      (role === 'finance' &&
        (seed.kind === 'forecast' ||
          config.output_families.includes('inventory'))) ||
      ((role === 'buyer' || role === 'inventory') &&
        config.output_families.some((family) => family !== 'inventory'))
    ) {
      setLocalError('This result family requires a different workspace role.')
      return
    }
    const execute =
      ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)
        ?.value === 'run'
    const problem = execute ? validateEditor(config, seed.kind, snapshot) : null
    if (problem) {
      setLocalError(problem)
      return
    }
    onSubmit(
      {
        name: name.trim(),
        kind: seed.kind,
        config,
        snapshot,
        definitionId: seed.definition?.id,
        retryOf: seed.retryOf,
      },
      execute,
    )
  }
  function changeFamily(family: OutputFamily, checked: boolean) {
    const output_families = checked
      ? [...config.output_families, family]
      : config.output_families.filter((item) => item !== family)
    const cashOnlyExplore =
      config.question === 'Q-EXPLORE' &&
      !output_families.includes('inventory') &&
      output_families.includes('cash')
    const assumptions = { ...config.assumptions }
    if (!output_families.includes('inventory')) {
      for (const key of [
        'daily_demand',
        'order_quantity',
        'order_date',
        'receipt_date',
        'lead_time_days',
        'stock_opening_confirmed',
        'forecast_overlap',
        'demand_multiplier',
        'demand_start_date',
        'demand_end_date',
        'price',
        'unit_cost',
        'purchase_id',
        'backlog_policy',
        'opening_backlog_confirmed',
        'backlog_reservation_overlap',
        'order_policy',
        'reorder_point',
        'safety_stock',
        'service_target',
        'discount_percent',
        'supplier_terms_id',
        'purchase_cash_treatment',
        'purchase_paid_amount',
        'purchase_invoice_date',
        'dispatch_date',
        'supplier_payment_before_dispatch',
      ] as const)
        delete assumptions[key]
    }
    if (!output_families.includes('cash')) {
      delete assumptions.payment_id
      delete assumptions.payment_date
      delete assumptions.payment_change_accepted
      delete assumptions.cash_opening_estimate
      delete assumptions.reserve
      for (const key of [
        'supplier_terms_id',
        'purchase_cash_treatment',
        'purchase_paid_amount',
        'purchase_invoice_date',
        'dispatch_date',
        'supplier_payment_before_dispatch',
      ] as const)
        delete assumptions[key]
    }
    if (
      !output_families.includes('cash') &&
      !output_families.includes('debt')
    ) {
      delete assumptions.collection_delay_days
      delete assumptions.asem_stress
      delete assumptions.collection_id
      for (const key of [
        'customer_terms_id',
        'demand_cash_treatment',
        'invoice_delay_days',
        'customer_order_date',
        'customer_advance_received',
        'new_credit_sales_amount',
        'new_credit_sales_date',
        'unpaid_share',
        'terms_accepted',
        'terms_no_advance_confirmed',
      ] as const)
        delete assumptions[key]
    }
    if (!assumptions.customer_terms_id && !assumptions.supplier_terms_id) {
      delete assumptions.terms_accepted
      delete assumptions.terms_no_advance_confirmed
    }
    patch({
      output_families,
      assumptions,
      coverage_reviewed: false,
      ...(!output_families.includes('inventory')
        ? {
            product_id: null,
            location_id: null,
            inventory_pool_id: null,
            forecast_run_id: null,
          }
        : {}),
      ...(cashOnlyExplore ? { horizon_days: 30 } : {}),
    })
  }
  function changeQuestion(question: QuestionKey) {
    const next = newConfig(seed.kind, question, snapshot)
    setConfig({ ...next, start_date: config.start_date })
    setHorizonInput(String(next.horizon_days))
    setName(questionDefinition(question).label)
    setLocalError(null)
  }

  return {
    name,
    setName,
    seed,
    config,
    changeQuestion,
    patch,
    end,
    snapshot,
    numericField,
    forecastBlock,
    selectedEngineCapability,
    role,
    canEdit,
    changeFamily,
    limitedCapabilities,
    inventory,
    selectedPool,
    stock,
    selectedProduct,
    assumption,
    forecasts,
    compatibleForecast,
    dateField,
    showPriceControls,
    cash,
    showCollectionControls,
    showReserveControl,
    setSnapshot,
    mutedAssumptions,
    baselines,
    compatibleBaseline,
    localError,
    error,
    busy,
    onClose,
    submit,
    horizonInput,
    setHorizonInput,
  }
}

export function AnalysisEditor(props: AnalysisEditorProps) {
  const view = useAnalysisEditorView(props)
  const { onClose, seed, submit } = view
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={
        seed.definition
          ? 'Edit saved definition'
          : seed.run
            ? 'Run again with reviewed inputs'
            : seed.kind === 'forecast'
              ? 'Create a forecast'
              : 'Explore a business question'
      }
      description="Your definition and submitted inputs are saved with each run. Later edits do not change earlier results."
    >
      <form className="stack analysis-form" onSubmit={submit}>
        <p className="requirement-key">
          <span className="required-marker" aria-hidden="true">
            *
          </span>{' '}
          Required to run; the definition name is also required to save.
          Optional fields explain what happens when left blank.
        </p>
        <DefinitionInputs {...view} />
        <ForecastEngineInputs {...view} />
        <ResultFamilyInputs {...view} />
        <ProductScopeInputs {...view} />
        <OpeningInventoryInputs {...view} />
        <DemandInputs {...view} />
        <ProposedPurchaseInputs {...view} />
        <RecordedPurchaseInputs {...view} />
        <TimingAssumptionInputs {...view} />
        <CashCoverageInputs {...view} />
        <OptionalAnalysisInputs {...view} />
        <ComparisonInputs {...view} />
        <EditorActions {...view} />
      </form>
    </Modal>
  )
}

function DefinitionInputs({
  name,
  setName,
  seed,
  config,
  changeQuestion,
  patch,
  end,
  horizonInput,
  setHorizonInput,
}: Pick<
  AnalysisEditorView,
  | 'name'
  | 'setName'
  | 'seed'
  | 'config'
  | 'changeQuestion'
  | 'patch'
  | 'end'
  | 'horizonInput'
  | 'setHorizonInput'
>) {
  return (
    <>
      <div className="form-grid">
        <label className="field">
          <FieldRequirement required>Definition name</FieldRequirement>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={160}
          />
        </label>
        {seed.kind === 'simulation' && (
          <label className="field">
            <FieldRequirement required>Business question</FieldRequirement>
            <SelectField
              aria-label="Business question"
              value={config.question}
              onChange={(event) =>
                changeQuestion(event.target.value as QuestionKey)
              }
            >
              {questions.map((q) => (
                <option key={q.key} value={q.key}>
                  {q.label}
                </option>
              ))}
            </SelectField>
          </label>
        )}
      </div>
      <div className="form-grid">
        <label className="field">
          <FieldRequirement required>Start date</FieldRequirement>
          <input
            type="date"
            value={config.start_date}
            onChange={(event) =>
              patch({
                start_date: event.target.value,
                coverage_reviewed: false,
                assumptions: {
                  ...config.assumptions,
                  stock_opening_confirmed: false,
                },
              })
            }
            required
          />
        </label>
        <label className="field">
          <FieldRequirement required>Horizon in days</FieldRequirement>
          <input
            type="number"
            min={1}
            max={365}
            step={1}
            value={horizonInput}
            onChange={(event) => {
              const raw = event.target.value
              const days = event.target.valueAsNumber
              if (!raw || !Number.isFinite(days)) {
                setHorizonInput(raw)
                return
              }
              patch({ horizon_days: days, coverage_reviewed: false })
            }}
            required
          />
          <span className="muted">
            {horizonInput && end
              ? `${config.start_date} through ${end}, inclusive. Daily resolution.`
              : 'Enter 1 through 365 days.'}
          </span>
        </label>
      </div>
      <div className="form-actions" aria-label="Horizon shortcuts">
        {[7, 30, 60, 90, 180, 365].map((days) => (
          <button
            type="button"
            className="button secondary"
            key={days}
            aria-pressed={config.horizon_days === days}
            onClick={() =>
              patch({ horizon_days: days, coverage_reviewed: false })
            }
          >
            {days} days
          </button>
        ))}
      </div>
    </>
  )
}

function ForecastEngineInputs({
  seed,
  config,
  patch,
  snapshot,
  numericField,
  forecastBlock,
  selectedEngineCapability,
}: Pick<
  AnalysisEditorView,
  | 'seed'
  | 'config'
  | 'patch'
  | 'snapshot'
  | 'numericField'
  | 'forecastBlock'
  | 'selectedEngineCapability'
>) {
  return (
    <>
      {seed.kind === 'forecast' && (
        <div className="form-grid">
          <label className="field">
            <FieldRequirement required>Forecast engine</FieldRequirement>
            <SelectField
              aria-label="Forecast engine"
              value={config.engine}
              onChange={(event) =>
                patch({
                  engine: event.target.value as AnalysisConfig['engine'],
                })
              }
            >
              {forecastEngines.map((engine) => (
                <option
                  value={engine.id}
                  key={engine.id}
                  disabled={Boolean(forecastCreationIssue(engine.id, snapshot))}
                >
                  {engine.name}
                  {forecastCreationIssue(engine.id, snapshot)
                    ? ' · unavailable for new runs'
                    : engine.id === 'lightgbm'
                      ? ' · trained model'
                      : ''}
                </option>
              ))}
            </SelectField>
            <span className="muted">
              All engines process supplied dated quantities. LightGBM and
              CatBoost train real local models with a separate chronological
              evaluation.
            </span>
          </label>
          {config.engine === 'seasonal-naive' &&
            numericField(
              'season_length_days',
              'Season length in days',
              'If left blank, the forecast uses a 7-day season. A complete comparable season is required before the start date.',
              { min: 1, step: 1, optional: true },
            )}
        </div>
      )}
      {forecastBlock && (
        <div className="notice">
          <p>{forecastBlock}</p>
          <a className="text-button" href={`#/${snapshot.mode}/data`}>
            Review capability availability in Add-ons &amp; Data
          </a>
        </div>
      )}
      {seed.kind === 'forecast' &&
        selectedEngineCapability?.lifecycle === 'deprecated' && (
          <p className="notice">
            This engine is deprecated. Review its lifecycle details in Add-ons
            &amp; Data before creating a new run. Previous results keep their
            original engine provenance.
          </p>
        )}
      {seed.kind === 'forecast' &&
        ['lightgbm', 'catboost'].includes(config.engine) && (
          <p className="notice">
            This engine trains on at least 56 consecutive observed daily
            quantities ending the day before the start. It uses lags of 1, 7 and
            14 days, rolling means and known calendar features. A separate
            14-day chronological holdout measures actual error; missing days are
            never filled with zero. No accuracy advantage or calibrated interval
            is assumed.
          </p>
        )}
    </>
  )
}

function ResultFamilyInputs({
  seed,
  config,
  role,
  canEdit,
  changeFamily,
  limitedCapabilities,
  snapshot,
}: Pick<
  AnalysisEditorView,
  | 'seed'
  | 'config'
  | 'role'
  | 'canEdit'
  | 'changeFamily'
  | 'limitedCapabilities'
  | 'snapshot'
>) {
  const outputFamilies = new Set(config.output_families)
  const mutedIds = new Set(snapshot.muted)
  return (
    <>
      {seed.kind === 'simulation' && (
        <fieldset>
          <legend>
            <FieldRequirement required>Result families</FieldRequirement>
          </legend>
          <div className="form-actions">
            {(['inventory', 'cash', 'debt'] as OutputFamily[]).map((family) => (
              <label className="check-label" key={family}>
                <input
                  type="checkbox"
                  checked={outputFamilies.has(family)}
                  disabled={
                    role === 'finance'
                      ? family === 'inventory'
                      : role === 'inventory' || role === 'buyer'
                        ? family !== 'inventory'
                        : !canEdit('analysis')
                  }
                  onChange={(event) =>
                    changeFamily(family, event.target.checked)
                  }
                />
                {family === 'debt'
                  ? 'Receivables and collection timing'
                  : family === 'cash'
                    ? 'Cash and obligations'
                    : 'Inventory and fulfillment'}
              </label>
            ))}
          </div>
          <p className="muted">
            Each family needs its own inputs. A purchasing budget does not
            establish available cash.
          </p>
        </fieldset>
      )}
      {limitedCapabilities.length > 0 && (
        <section className="notice" aria-label="Current data readiness">
          <p>Current capability context</p>
          <ul>
            {limitedCapabilities.map((capability) => (
              <li key={capability.id}>
                {capability.name} ·{' '}
                {mutedIds.has(capability.id)
                  ? 'Muted in ordinary views. This preference does not erase inputs or saved history.'
                  : `Missing current inputs. ${capability.fields}`}
              </li>
            ))}
          </ul>
          <p>
            Explicit assumptions may support a specific result. The server
            checks each requested family. Saved run status and results remain
            accessible.
          </p>
        </section>
      )}
      {config.question === 'Q-EXPLORE' && seed.kind === 'simulation' && (
        <p className="notice">
          Explore supports explicit demand, collection timing and planned
          replenishment assumptions. Proposed supply needs an order quantity and
          a receipt date, or an order date with a lead time.
        </p>
      )}
    </>
  )
}

function ProductScopeInputs({
  inventory,
  seed,
  config,
  patch,
  snapshot,
  selectedPool,
}: Pick<
  AnalysisEditorView,
  'inventory' | 'seed' | 'config' | 'patch' | 'snapshot' | 'selectedPool'
>) {
  return (
    <>
      {(inventory || seed.kind === 'forecast') && (
        <>
          <div className="form-grid">
            <label className="field">
              <FieldRequirement required>Product</FieldRequirement>
              <SelectField
                aria-label="Product"
                value={config.product_id ?? ''}
                onChange={(event) =>
                  patch({
                    product_id: event.target.value || null,
                    forecast_run_id: null,
                    assumptions: {
                      ...config.assumptions,
                      stock_opening_confirmed: false,
                      purchase_id: undefined,
                      price: undefined,
                      unit_cost: undefined,
                      lead_time_days:
                        seed.kind === 'simulation' &&
                        ([
                          'Q-REPLENISH',
                          'Q-SLOW-SUPPLIER',
                          'Q-SUPPLIER-ORDER-STOCKOUT',
                        ].includes(config.question) ||
                          (config.question === 'Q-EXPLORE' &&
                            Number(config.assumptions.order_quantity) > 0))
                          ? (snapshot.products.find(
                              (product) => product.id === event.target.value,
                            )?.leadTimeDays ?? undefined)
                          : undefined,
                    },
                  })
                }
              >
                <option value="">Select a product</option>
                {snapshot.products.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.sku} · {p.name}
                  </option>
                ))}
              </SelectField>
            </label>
            <label className="field">
              Location scope
              <SelectField
                aria-label="Location scope"
                value={
                  config.inventory_pool_id
                    ? `pool:${config.inventory_pool_id}`
                    : config.location_id
                      ? `location:${config.location_id}`
                      : ''
                }
                onChange={(event) => {
                  const [scope, id] = event.target.value.split(':')
                  patch({
                    location_id: scope === 'location' ? id : null,
                    inventory_pool_id: scope === 'pool' ? id : null,
                    forecast_run_id: null,
                    assumptions: {
                      ...config.assumptions,
                      stock_opening_confirmed: false,
                    },
                  })
                }}
              >
                <option value="">
                  All supplied locations · aggregate scope
                </option>
                {snapshot.inventoryPools?.map((pool) => (
                  <option value={`pool:${pool.id}`} key={pool.id}>
                    {pool.name} · confirmed shared pool
                  </option>
                ))}
                {snapshot.locations.map((l) => (
                  <option value={`location:${l.id}`} key={l.id}>
                    {l.name}
                  </option>
                ))}
              </SelectField>
              <span className="muted">
                {selectedPool
                  ? `Confirmed pool includes ${selectedPool.locationIds.length} locations. ${selectedPool.channelNames.length ? `Declared channels include ${selectedPool.channelNames.join(', ')}.` : 'No channel relationship is declared.'} Unallocated supplier receipts cannot be assigned to this restricted pool.`
                  : 'Aggregate scope does not establish a shared-pool relationship. Unknown location contributions remain unassigned.'}
              </span>
              <OptionalHelp>
                If left blank, the run uses all supplied locations as an
                aggregate; it does not assume that stock is shared between them.
              </OptionalHelp>
            </label>
          </div>
          {!snapshot.products.length && (
            <p className="notice">
              Add identifiable products and compatible units in Add-ons &amp;
              Data before requesting product results.
            </p>
          )}
        </>
      )}
    </>
  )
}

function OpeningInventoryInputs({
  inventory,
  config,
  stock,
  snapshot,
  selectedProduct,
  assumption,
}: Pick<
  AnalysisEditorView,
  | 'inventory'
  | 'config'
  | 'stock'
  | 'snapshot'
  | 'selectedProduct'
  | 'assumption'
>) {
  return (
    <>
      {inventory && (
        <fieldset>
          <legend>Inventory opening position</legend>
          <p className="muted">
            Review the supplied quantities before using them as the opening
            position on {config.start_date}. Reservations are deducted only from
            on-hand quantities.
          </p>
          {stock.length ? (
            <div className="table-wrap">
              <SortableTable
                aria-label="Inventory opening position"
                className="data-table opening-position-table"
                defaultOpen
                tableLabel="Inventory opening position"
              >
                <thead>
                  <tr>
                    <th scope="col">Location</th>
                    <th scope="col">Quantity</th>
                    <th scope="col">Quantity basis</th>
                    <th scope="col">Reserved</th>
                    <th scope="col">Recorded as of</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((s) => (
                    <tr key={s.id}>
                      <th scope="row">
                        {snapshot.locations.find((l) => l.id === s.locationId)
                          ?.name ?? 'Unassigned aggregate'}
                      </th>
                      <td>
                        {s.onHand} {selectedProduct?.unit}
                      </td>
                      <td>
                        {s.quantityBasis === 'available'
                          ? 'Available'
                          : 'On hand'}
                      </td>
                      <td>
                        {s.reserved === null
                          ? 'Unknown'
                          : `${s.reserved} ${selectedProduct?.unit}`}
                      </td>
                      <td>{s.asOf}</td>
                    </tr>
                  ))}
                </tbody>
              </SortableTable>
            </div>
          ) : (
            <p className="notice">
              No stock position is supplied for this product and scope.
            </p>
          )}
          <label className="check-label">
            <input
              type="checkbox"
              checked={Boolean(config.assumptions.stock_opening_confirmed)}
              onChange={(event) =>
                assumption('stock_opening_confirmed', event.target.checked)
              }
            />
            <span>
              I accept these supplied positions as the opening inventory for
              this scenario date.
              <span className="required-marker" aria-hidden="true">
                {' '}
                *
              </span>
              <span className="sr-only"> (required to run)</span>
            </span>
          </label>
        </fieldset>
      )}
      {inventory && selectedProduct && (
        <section className="notice" aria-label="Recorded purchasing context">
          <strong>Recorded purchasing context</strong>
          <dl className="compact-details-grid">
            <div>
              <dt>Minimum order</dt>
              <dd>
                {selectedProduct.moq == null
                  ? 'Not supplied'
                  : `${selectedProduct.moq} ${selectedProduct.unit}`}
              </dd>
            </div>
            <div>
              <dt>Case pack</dt>
              <dd>
                {selectedProduct.casePack == null
                  ? 'Not supplied'
                  : `${selectedProduct.casePack} ${selectedProduct.unit}`}
              </dd>
            </div>
            <div>
              <dt>Lead time</dt>
              <dd>
                {selectedProduct.leadTimeDays == null
                  ? 'Not supplied'
                  : `${selectedProduct.leadTimeDays} days`}
              </dd>
            </div>
          </dl>
          <p>
            This plan uses your explicit order or selected rule. Safety-stock
            and service targets are evaluated against that plan. Selected
            payment terms connect modeled fulfillment and purchases to Finance
            without changing source records.
          </p>
        </section>
      )}
    </>
  )
}

function DemandInputs({
  inventory,
  config,
  patch,
  forecasts,
  compatibleForecast,
  numericField,
  selectedProduct,
  assumption,
}: Pick<
  AnalysisEditorView,
  | 'inventory'
  | 'config'
  | 'patch'
  | 'forecasts'
  | 'compatibleForecast'
  | 'numericField'
  | 'selectedProduct'
  | 'assumption'
>) {
  return (
    <>
      {inventory && (
        <fieldset>
          <legend>
            <FieldRequirement required={config.question !== 'Q-NEW-ORDER'}>
              Demand basis
            </FieldRequirement>
          </legend>
          <div className="form-grid">
            <label className="field">
              Saved forecast dependency
              <SelectField
                aria-label="Saved forecast dependency"
                value={config.forecast_run_id ?? ''}
                onChange={(event) =>
                  patch({
                    forecast_run_id: event.target.value || null,
                    assumptions: {
                      ...config.assumptions,
                      daily_demand: undefined,
                    },
                  })
                }
              >
                <option value="">
                  Use an explicit demand assumption or declared order
                </option>
                {forecasts.map((run) => (
                  <option
                    key={run.id}
                    value={run.id}
                    disabled={!compatibleForecast(run)}
                  >
                    {run.definition_name} · {run.status.replaceAll('_', ' ')} ·{' '}
                    {run.config.start_date} · {run.id.slice(0, 8)}
                    {compatibleForecast(run)
                      ? ''
                      : ' · incompatible scope, unit or dates'}
                  </option>
                ))}
              </SelectField>
              <span className="muted">
                The exact run stays pinned. Pending forecasts are awaited on the
                server.
              </span>
              <OptionalHelp>
                If left blank, accepted daily demand is used. For a new-order
                question with no daily demand, the declared order is the only
                demand in the scenario.
              </OptionalHelp>
            </label>
            {!config.forecast_run_id &&
              numericField(
                'daily_demand',
                'Accepted daily demand',
                `If left blank, select a saved forecast instead. For a new-order question, leaving both blank makes the declared order the only demand. Values use ${selectedProduct?.unit ?? 'units'} per day.`,
                {
                  min: 0,
                  required: config.question !== 'Q-NEW-ORDER',
                  optional: config.question === 'Q-NEW-ORDER',
                },
              )}
          </div>
          {(config.forecast_run_id ||
            config.assumptions.daily_demand !== undefined) &&
            config.question === 'Q-NEW-ORDER' && (
              <label className="field">
                <FieldRequirement required>
                  Relationship between the new order and baseline demand
                </FieldRequirement>
                <SelectField
                  aria-label="Relationship between the new order and baseline demand"
                  value={config.assumptions.forecast_overlap ?? ''}
                  onChange={(event) =>
                    assumption(
                      'forecast_overlap',
                      event.target.value as Assumptions['forecast_overlap'],
                    )
                  }
                >
                  <option value="">Choose the economic relationship</option>
                  <option value="replacement">
                    The declared order replaces baseline demand
                  </option>
                  <option value="incremental">
                    The declared order is additional demand
                  </option>
                </SelectField>
              </label>
            )}
        </fieldset>
      )}
    </>
  )
}

function ProposedPurchaseInputs({
  seed,
  config,
  inventory,
  numericField,
  selectedProduct,
  dateField,
  showPriceControls,
}: Pick<
  AnalysisEditorView,
  | 'seed'
  | 'config'
  | 'inventory'
  | 'numericField'
  | 'selectedProduct'
  | 'dateField'
  | 'showPriceControls'
>) {
  return (
    <>
      {seed.kind === 'simulation' &&
        orderQuestions.includes(config.question) &&
        inventory && (
          <fieldset>
            <legend>
              {config.question === 'Q-NEW-ORDER'
                ? 'Declared customer order'
                : 'Proposed purchasing changes'}
            </legend>
            <div className="form-grid">
              <ProposedOrderQuantity
                config={config}
                numericField={numericField}
                selectedProduct={selectedProduct}
              />
              {config.assumptions.order_policy !== 'reorder' &&
                dateField(
                  'order_date',
                  config.question === 'Q-NEW-ORDER'
                    ? 'Requested fulfillment date'
                    : 'Proposed supplier order date',
                  config.question === 'Q-NEW-ORDER'
                    ? { required: true }
                    : {
                        hint: 'If left blank, provide a receipt date; no purchase-order event is added.',
                      },
                )}
              {config.question !== 'Q-NEW-ORDER' &&
                config.assumptions.order_policy !== 'reorder' &&
                dateField('receipt_date', 'Proposed receipt date', {
                  hint: 'If left blank, receipt timing is calculated from the order date and supplier lead time. In Explore, no purchase is modeled when its quantity is also blank.',
                })}
              {config.question !== 'Q-NEW-ORDER' &&
                numericField(
                  'lead_time_days',
                  'Supplier lead time in days',
                  'For explicit purchases, counted from the order date. For a reorder rule, counted from each modeled daily closing order. For an explicit purchase, it may be left blank when a receipt date is supplied.',
                  {
                    min: 0,
                    step: 1,
                    required: config.assumptions.order_policy === 'reorder',
                    optional: config.assumptions.order_policy !== 'reorder',
                  },
                )}
              {showPriceControls &&
                numericField(
                  'price',
                  'Assumed selling price',
                  'If left blank, the recorded product price is used when known; otherwise sales value and margin remain unknown.',
                  { min: 0, optional: true },
                )}
              {showPriceControls &&
                numericField(
                  'unit_cost',
                  'Assumed unit cost',
                  'If left blank, the recorded product or purchase cost is used when known; otherwise margin remains unknown.',
                  { min: 0, optional: true },
                )}
            </div>
          </fieldset>
        )}
    </>
  )
}

function RecordedPurchaseInputs({
  seed,
  config,
  assumption,
  snapshot,
  numericField,
}: Pick<
  AnalysisEditorView,
  'seed' | 'config' | 'assumption' | 'snapshot' | 'numericField'
>) {
  return (
    <>
      {seed.kind === 'simulation' &&
        purchaseQuestions.includes(config.question) && (
          <fieldset>
            <legend>
              <FieldRequirement required>
                Recorded supplier order
              </FieldRequirement>
            </legend>
            <label className="field">
              <FieldRequirement required>
                Open purchase to change
              </FieldRequirement>
              <SelectField
                aria-label="Open purchase to change"
                value={config.assumptions.purchase_id ?? ''}
                onChange={(event) =>
                  assumption('purchase_id', event.target.value || undefined)
                }
              >
                <option value="">Select an open purchase</option>
                {snapshot.purchases
                  .filter(
                    (p) =>
                      p.productId === config.product_id &&
                      p.receivedQuantity < p.quantity,
                  )
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.id} · {p.quantity - p.receivedQuantity} pending ·
                      receipt {p.promisedDate ?? 'not provided'}
                    </option>
                  ))}
              </SelectField>
            </label>
            {config.question === 'Q-SLOW-SUPPLIER' &&
              numericField(
                'lead_time_days',
                'Assumed total lead time in days',
                'Total calendar days from the recorded order date, not extra delay days.',
                { min: 0, step: 1, required: true },
              )}
            {config.question === 'Q-SUPPLIER-ORDER-STOCKOUT' && (
              <p className="muted">
                At least one quantity or timing field must describe the change.
                Blank fields retain the corresponding recorded purchase values.
              </p>
            )}
            <p className="muted">
              This scenario changes timing assumptions. It does not change an
              agreed supplier term.
            </p>
          </fieldset>
        )}
    </>
  )
}

function TimingAssumptionInputs({
  seed,
  config,
  numericField,
  dateField,
  cash,
  showCollectionControls,
  assumption,
  snapshot,
}: Pick<
  AnalysisEditorView,
  | 'seed'
  | 'config'
  | 'numericField'
  | 'dateField'
  | 'cash'
  | 'showCollectionControls'
  | 'assumption'
  | 'snapshot'
>) {
  return (
    <>
      {seed.kind === 'simulation' && config.question === 'Q-DEMAND-CHANGE' && (
        <fieldset>
          <legend>Demand change assumption</legend>
          <div className="form-grid">
            {numericField(
              'demand_multiplier',
              'Demand multiplier',
              'For example, 1.2 means 20% more demand during the selected dates.',
              { min: 0, required: true },
            )}
            {dateField('demand_start_date', 'Demand change starts', {
              required: true,
            })}
            {dateField('demand_end_date', 'Demand change ends', {
              required: true,
            })}
          </div>
        </fieldset>
      )}
      {seed.kind === 'simulation' &&
        (cash || config.output_families.includes('debt')) &&
        showCollectionControls &&
        collectionQuestions.includes(config.question) && (
          <fieldset>
            <legend>Collection timing assumption</legend>
            <div className="form-grid">
              <label className="field">
                <FieldRequirement
                  required={config.question === 'Q-CRITICAL-COLLECTION'}
                >
                  Collection to change
                </FieldRequirement>
                <SelectField
                  aria-label="Collection to change"
                  value={config.assumptions.collection_id ?? ''}
                  onChange={(event) =>
                    assumption('collection_id', event.target.value || undefined)
                  }
                >
                  <option value="">
                    {config.question === 'Q-CRITICAL-COLLECTION'
                      ? 'Select the critical collection'
                      : 'All eligible customer collections'}
                  </option>
                  {snapshot.finance
                    .filter(
                      (f) =>
                        f.kind === 'receivable' ||
                        f.kind === 'provider_pending',
                    )
                    .map((f) => (
                      <option value={f.id} key={f.id}>
                        {f.name} · {f.expectedDate ?? 'date not provided'}
                      </option>
                    ))}
                </SelectField>
                {config.question !== 'Q-CRITICAL-COLLECTION' && (
                  <OptionalHelp>
                    If left blank, the timing change applies to all eligible
                    customer collections.
                  </OptionalHelp>
                )}
              </label>
              {numericField(
                'collection_delay_days',
                'Collection timing change in days',
                ['Q-CASH-SUFFICIENCY', 'Q-EXPLORE'].includes(config.question)
                  ? 'If left blank, recorded collection dates are unchanged. Positive means later; negative means earlier.'
                  : 'Positive means later. Negative means earlier. Proposed earlier payment needs customer agreement.',
                {
                  step: 1,
                  required: [
                    'Q-CRITICAL-COLLECTION',
                    'Q-CUSTOMER-DEBT',
                  ].includes(config.question),
                  optional: ['Q-CASH-SUFFICIENCY', 'Q-EXPLORE'].includes(
                    config.question,
                  ),
                },
              )}
              <CollectionTimingPresets
                config={config}
                snapshot={snapshot}
                assumption={assumption}
              />
            </div>
          </fieldset>
        )}
    </>
  )
}

function CollectionTimingPresets({
  config,
  snapshot,
  assumption,
}: Pick<AnalysisEditorView, 'config' | 'snapshot' | 'assumption'>) {
  const matrix = behavioralCollectionMatrix(snapshot)
  const selected = snapshot.finance.find(
    (record) => record.id === config.assumptions.collection_id,
  )
  const profile = selected
    ? (matrix.customerProfiles.find(
        (candidate) =>
          candidate.customer.toLowerCase() ===
          selected.counterparty.trim().toLowerCase(),
      ) ?? matrix.portfolioProfile)
    : matrix.portfolioProfile
  const stressed = Boolean(config.assumptions.asem_stress)
  const applyEmpiricalDelay = (days: number) => {
    assumption('collection_delay_days', days)
    assumption('asem_stress', undefined)
  }
  const toggleStress = () => {
    const isStressed = !stressed
    assumption('asem_stress', isStressed ? true : undefined)
    assumption(
      'collection_delay_days',
      profile.p50DelayDays + (isStressed ? ASEM_STRESS_DAYS : 0),
    )
  }
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        marginTop: '0.25rem',
        marginBottom: '0.5rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span className="small muted">Preajustes empíricos:</span>
        <button
          type="button"
          className="button small secondary"
          onClick={() => applyEmpiricalDelay(profile.p50DelayDays)}
        >
          P50 Empírico (
          {profile.p50DelayDays >= 0
            ? `+${profile.p50DelayDays}`
            : profile.p50DelayDays}
          d)
        </button>
        <button
          type="button"
          className="button small secondary"
          onClick={() => applyEmpiricalDelay(profile.p80DelayDays)}
        >
          P80 Empírico (
          {profile.p80DelayDays >= 0
            ? `+${profile.p80DelayDays}`
            : profile.p80DelayDays}
          d)
        </button>
        <button
          type="button"
          className={`button small ${stressed ? 'primary' : 'secondary'}`}
          style={{
            borderColor: '#d97706',
            color: stressed ? '#fff' : '#d97706',
            backgroundColor: stressed ? '#d97706' : undefined,
          }}
          onClick={toggleStress}
        >
          Estrés ASEM (+76d)
        </button>
      </div>
      {stressed && (
        <small className="block amber" style={{ marginTop: '0.35rem' }}>
          Efecto ASEM de 76 días aplicado: Simulación de demora oficial PyME
          (+76 días de retraso).
        </small>
      )}
    </div>
  )
}

function CashCoverageInputs({
  cash,
  snapshot,
  numericField,
  showReserveControl,
  config,
  end,
  setSnapshot,
  patch,
}: Pick<
  AnalysisEditorView,
  | 'cash'
  | 'snapshot'
  | 'numericField'
  | 'showReserveControl'
  | 'config'
  | 'end'
  | 'setSnapshot'
  | 'patch'
>) {
  return (
    <>
      {cash && (
        <fieldset>
          <legend>Opening cash and coverage</legend>
          <p className="muted">
            {snapshot.cash
              ? `Supplied cash is ${snapshot.cash.amount} ${snapshot.profile.currency} at ${snapshot.cash.phase} on ${snapshot.cash.date}.`
              : 'Opening cash is not supplied.'}
          </p>
          <div className="form-grid">
            {numericField(
              'cash_opening_estimate',
              'Explicit opening cash estimate',
              snapshot.cash
                ? 'If left blank, the recorded cash amount and date shown above establish the opening state. Any entered estimate is saved as an assumption.'
                : 'Opening cash is not recorded, so an explicit estimate is required for a cash result.',
              { required: !snapshot.cash, optional: Boolean(snapshot.cash) },
            )}
            {showReserveControl &&
              numericField(
                'reserve',
                'Owner-selected cash reserve',
                'If left blank, no reserve comparison line or reserve-breach result is calculated. This does not change cash-shortfall calculations.',
                { min: 0, optional: true },
              )}
          </div>
          <p className="muted">
            Review each category for {config.start_date} through {end}. Omitted
            categories make the result partial. Confirmed absence is specific to
            this window.
          </p>
          <div className="form-grid">
            {categories.map((category) => (
              <label className="field" key={category}>
                <FieldRequirement required>
                  {category[0].toUpperCase() + category.slice(1)}
                </FieldRequirement>
                <SelectField
                  value={snapshot.coverage[category].state}
                  onChange={(event) => {
                    setSnapshot((previous) => ({
                      ...previous,
                      coverage: {
                        ...previous.coverage,
                        [category]: {
                          state: event.target
                            .value as Workspace['coverage'][typeof category]['state'],
                          startDate: config.start_date,
                          endDate: end,
                        },
                      },
                    }))
                    patch({ coverage_reviewed: false })
                  }}
                >
                  <option value="unknown">Not reviewed</option>
                  <option value="supplied">Supplied records</option>
                  <option value="absent">
                    Confirmed absent in this window
                  </option>
                  <option value="omitted">Omitted from this scenario</option>
                </SelectField>
                <span className="muted">
                  Review covers {snapshot.coverage[category].startDate} to{' '}
                  {snapshot.coverage[category].endDate}.
                </span>
              </label>
            ))}
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={config.coverage_reviewed}
              onChange={(event) =>
                patch({ coverage_reviewed: event.target.checked })
              }
            />
            <span>
              I reviewed these category states and the dates. Omitted
              obligations remain a material limitation.
              <span className="required-marker" aria-hidden="true">
                {' '}
                *
              </span>
              <span className="sr-only"> (required to run)</span>
            </span>
          </label>
        </fieldset>
      )}
    </>
  )
}

function OptionalAnalysisInputs({
  mutedAssumptions,
  inventory,
  config,
  snapshot,
  assumption,
  seed,
  cash,
}: Pick<
  AnalysisEditorView,
  | 'mutedAssumptions'
  | 'inventory'
  | 'config'
  | 'snapshot'
  | 'assumption'
  | 'seed'
  | 'cash'
>) {
  return (
    <>
      {mutedAssumptions.length > 0 && (
        <details className="notice">
          <summary>Retained inputs behind muted optional controls</summary>
          <p>
            Presentation preferences do not erase recorded or saved assumptions.
            Review these retained values before running. Enable the optional
            controls in Add-ons &amp; Data to edit them.
          </p>
          <ul>
            {mutedAssumptions.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        </details>
      )}
      {inventory && (
        <>
          <PolicyInputs
            config={config}
            workspace={snapshot}
            onAssumption={assumption}
          />
          <ConsequencesInputs
            config={config}
            workspace={snapshot}
            onAssumption={assumption}
          />
        </>
      )}
      {seed.kind === 'simulation' && cash && (
        <PaymentTimingInputs
          config={config}
          workspace={snapshot}
          onAssumption={assumption}
        />
      )}
      {seed.kind === 'simulation' &&
        (cash || config.output_families.includes('debt')) && (
          <CreditInputs
            config={config}
            workspace={snapshot}
            onAssumption={assumption}
          />
        )}
    </>
  )
}

function ComparisonInputs({
  config,
  patch,
  baselines,
  compatibleBaseline,
  seed,
}: Pick<
  AnalysisEditorView,
  'config' | 'patch' | 'baselines' | 'compatibleBaseline' | 'seed'
>) {
  return (
    <>
      <label className="field">
        Compare with a saved baseline
        <SelectField
          aria-label="Compare with a saved baseline"
          value={config.baseline_run_id ?? ''}
          onChange={(event) =>
            patch({ baseline_run_id: event.target.value || null })
          }
        >
          <option value="">No comparison · create an initial baseline</option>
          {baselines.map((run) => (
            <option
              key={run.id}
              value={run.id}
              disabled={!compatibleBaseline(run)}
            >
              {run.definition_name} · {run.config.start_date} ·{' '}
              {run.config.horizon_days} days · {run.id.slice(0, 8)}
              {compatibleBaseline(run)
                ? ''
                : ' · incompatible scope, unit or dates'}
            </option>
          ))}
        </SelectField>
        <span className="muted">
          The baseline must have compatible exact dates, cadence, scope,
          currency and metric definitions. For a timing comparison, first save
          an unchanged baseline with a zero-day timing change, then pin that run
          for the alternative.
        </span>
        <OptionalHelp>
          If left blank, the run is saved without a comparison and can become a
          baseline for a later compatible run.
        </OptionalHelp>
      </label>
      {seed.run && (
        <p className="notice">
          This rerun uses{' '}
          {seed.basis === seed.run.snapshot
            ? 'the original saved'
            : 'the current reviewed'}{' '}
          workspace snapshot. A new run ID will link to {seed.run.id}. Earlier
          results stay unchanged.
        </p>
      )}
    </>
  )
}

function EditorActions({
  localError,
  error,
  busy,
  onClose,
  name,
  canEdit,
  forecastBlock,
}: Pick<
  AnalysisEditorView,
  | 'localError'
  | 'error'
  | 'busy'
  | 'onClose'
  | 'name'
  | 'canEdit'
  | 'forecastBlock'
>) {
  return (
    <>
      {(localError || error) && (
        <p className="notice error" role="alert">
          {localError || error}
        </p>
      )}
      <div className="form-actions">
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="button secondary"
          disabled={busy || !name.trim() || !canEdit('analysis')}
          name="intent"
          value="save"
        >
          {busy ? 'Saving…' : 'Save definition'}
        </button>
        {!forecastBlock && (
          <button
            type="submit"
            className="button primary"
            disabled={busy || !name.trim() || !canEdit('analysis')}
            name="intent"
            value="run"
          >
            {busy ? 'Submitting…' : 'Save and run'}
          </button>
        )}
      </div>
    </>
  )
}

function ProposedOrderQuantity({
  config,
  numericField,
  selectedProduct,
}: Pick<AnalysisEditorView, 'config' | 'numericField' | 'selectedProduct'>) {
  return numericField(
    'order_quantity',
    config.question === 'Q-NEW-ORDER'
      ? 'Requested quantity'
      : 'Proposed order quantity',
    config.question === 'Q-EXPLORE'
      ? `If left blank, no proposed purchase is modeled. If supplied, use compatible ${selectedProduct?.unit ?? 'units'}; MOQ and case-pack restrictions apply.`
      : config.question === 'Q-SUPPLIER-ORDER-STOCKOUT'
        ? `If left blank, the recorded purchase quantity is retained and another timing field must describe the change. If supplied, enter the changed total in compatible ${selectedProduct?.unit ?? 'units'}.`
        : `Use compatible ${selectedProduct?.unit ?? 'units'}. MOQ and case-pack restrictions remain in the saved result.`,
    {
      min: 0,
      required: ['Q-NEW-ORDER', 'Q-REPLENISH'].includes(config.question),
      optional: ['Q-EXPLORE', 'Q-SUPPLIER-ORDER-STOCKOUT'].includes(
        config.question,
      ),
    },
  )
}
