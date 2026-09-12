import {
  capabilities,
  categories,
  cutoff,
  questions,
  shiftDate,
  type QuestionKey,
  type Workspace,
} from '../../domain/workspace'
import type { AnalysisConfig, AnalysisKind, Engine } from '../../lib/analysis'

export const forecastEngines: {
  id: Engine
  capabilityId: string
  name: string
  description: string
}[] = [
  {
    id: 'naive',
    capabilityId: 'forecast-naive',
    name: 'Naïve',
    description:
      'Repeat the last usable comparable daily observation from supplied product quantities.',
  },
  {
    id: 'seasonal-naive',
    capabilityId: 'forecast-seasonal',
    name: 'Seasonal naïve',
    description:
      'Repeat a complete accepted season. Missing dates, units and scope remain eligibility limits.',
  },
  {
    id: 'lightgbm',
    capabilityId: 'forecast-advanced',
    name: 'LightGBM',
    description:
      'Real gradient-boosted regression from demand lags and calendar drivers. Requires 56 consecutive observed days; evaluates an unseen 14-day holdout.',
  },
  {
    id: 'catboost',
    capabilityId: 'forecast-advanced',
    name: 'CatBoost',
    description:
      'Real ordered boosting with the same daily scope, lag/calendar drivers and 14-day holdout. Compare its saved errors with the simple baselines.',
  },
]

export function forecastPresentationMuted(
  engine: Engine,
  workspace: Workspace,
): boolean {
  const id = forecastEngines.find((item) => item.id === engine)!.capabilityId
  return workspace.muted.includes('forecast') || workspace.muted.includes(id)
}

export function forecastCreationIssue(
  engine: Engine,
  workspace: Workspace,
): string | null {
  const id = forecastEngines.find((item) => item.id === engine)!.capabilityId
  const capability = capabilities.find((item) => item.id === id)
  if (!workspace.id)
    return 'Open a registered workspace before creating a forecast.'
  if (capability?.lifecycle === 'retired')
    return 'This forecast engine is retired for new runs. Its existing status, inputs and results remain accessible in history.'
  return null
}

export function newConfig(
  kind: AnalysisKind,
  question: QuestionKey,
  workspace: Workspace,
): AnalysisConfig {
  const chosen = questions.find((q) => q.key === question)!
  const leadTime = workspace.products[0]?.leadTimeDays
  return {
    engine: 'naive',
    question,
    start_date: cutoff(workspace),
    horizon_days: kind === 'forecast' ? 30 : chosen.horizon,
    product_id:
      chosen.family === 'cash' && kind === 'simulation'
        ? null
        : (workspace.products[0]?.id ?? null),
    location_id: null,
    output_families:
      kind === 'forecast'
        ? []
        : [question === 'Q-CUSTOMER-DEBT' ? 'debt' : chosen.family],
    coverage_reviewed: false,
    assumptions:
      kind === 'simulation' &&
      ['Q-REPLENISH', 'Q-SLOW-SUPPLIER', 'Q-SUPPLIER-ORDER-STOCKOUT'].includes(
        question,
      ) &&
      leadTime != null
        ? { lead_time_days: leadTime }
        : {},
    forecast_run_id: null,
    baseline_run_id: null,
  }
}

export const orderQuestions: QuestionKey[] = [
  'Q-NEW-ORDER',
  'Q-REPLENISH',
  'Q-SUPPLIER-ORDER-STOCKOUT',
  'Q-EXPLORE',
]
export const purchaseQuestions: QuestionKey[] = [
  'Q-SLOW-SUPPLIER',
  'Q-SUPPLIER-ORDER-STOCKOUT',
]
export const collectionQuestions: QuestionKey[] = [
  'Q-CRITICAL-COLLECTION',
  'Q-CUSTOMER-DEBT',
  'Q-CASH-SUFFICIENCY',
  'Q-EXPLORE',
]

export function validateEditor(
  config: AnalysisConfig,
  kind: AnalysisKind,
  snapshot: Workspace,
): string | null {
  if (
    !config.start_date ||
    !Number.isInteger(config.horizon_days) ||
    config.horizon_days < 1 ||
    config.horizon_days > 365
  )
    return 'Choose a start date and a whole horizon from 1 to 365 days.'
  if (kind === 'forecast' && !config.product_id)
    return 'Select a product with dated, comparable sales quantities before forecasting.'
  if (kind === 'forecast' && forecastCreationIssue(config.engine, snapshot))
    return forecastCreationIssue(config.engine, snapshot)
  if (kind === 'simulation' && !config.output_families.length)
    return 'Choose at least one result family.'
  if (kind === 'simulation' && config.output_families.includes('inventory')) {
    if (!config.product_id) return 'Choose a product for the inventory result.'
    if (!config.assumptions.stock_opening_confirmed)
      return 'Review and confirm the inventory opening position for this start date.'
    if (
      config.question !== 'Q-NEW-ORDER' &&
      config.assumptions.daily_demand === undefined &&
      !config.forecast_run_id
    )
      return 'Supply an accepted daily demand assumption or select a saved forecast.'
  }
  if (kind === 'simulation' && config.output_families.includes('cash')) {
    if (
      !snapshot.cash &&
      config.assumptions.cash_opening_estimate === undefined
    )
      return 'Supply opening cash in Finance or enter an explicit opening estimate for this run.'
    if (!config.coverage_reviewed)
      return 'Review the operating categories before requesting a cash projection.'
    const end = shiftDate(config.start_date, config.horizon_days - 1)
    if (
      categories.some(
        (c) =>
          snapshot.coverage[c].state === 'unknown' ||
          snapshot.coverage[c].startDate > config.start_date ||
          snapshot.coverage[c].endDate < end,
      )
    )
      return 'Choose coverage for every category across the full analysis window. Omitted categories remain visible as limitations.'
  }
  if (
    kind === 'simulation' &&
    config.question === 'Q-NEW-ORDER' &&
    (!(Number(config.assumptions.order_quantity) > 0) ||
      !config.assumptions.order_date)
  )
    return 'Enter a positive new-order quantity and its requested fulfillment date.'
  if (
    kind === 'simulation' &&
    config.question === 'Q-CRITICAL-COLLECTION' &&
    (!config.assumptions.collection_id ||
      config.assumptions.collection_delay_days === undefined)
  )
    return 'Select the critical collection and enter its timing change in days.'
  if (
    kind === 'simulation' &&
    config.question === 'Q-CUSTOMER-DEBT' &&
    config.assumptions.collection_delay_days === undefined
  )
    return 'Enter the customer collection delay to test.'
  if (
    kind === 'simulation' &&
    purchaseQuestions.includes(config.question) &&
    !config.assumptions.purchase_id
  )
    return 'Select the recorded open supplier purchase to change.'
  if (
    kind === 'simulation' &&
    config.question === 'Q-SLOW-SUPPLIER' &&
    config.assumptions.lead_time_days === undefined
  )
    return 'Enter the assumed total supplier lead time from its recorded order date.'
  if (
    kind === 'simulation' &&
    config.question === 'Q-DEMAND-CHANGE' &&
    (config.assumptions.demand_multiplier === undefined ||
      !config.assumptions.demand_start_date ||
      !config.assumptions.demand_end_date)
  )
    return 'Enter the demand multiplier and the exact dates it applies.'
  if (kind === 'simulation') {
    const a = config.assumptions
    const pool = snapshot.inventoryPools?.find(
      (item) => item.id === config.inventory_pool_id,
    )
    const scopedStock = snapshot.stock.filter(
      (position) =>
        position.productId === config.product_id &&
        (!config.location_id || position.locationId === config.location_id) &&
        (!pool || pool.locationIds.includes(position.locationId ?? '')),
    )
    if (
      config.output_families.includes('inventory') &&
      scopedStock.some((position) => (position.backordered ?? 0) > 0) &&
      (!a.opening_backlog_confirmed || !a.backlog_reservation_overlap)
    )
      return 'Accept the opening backlog and explain its relationship to reserved stock.'
    if (
      a.order_policy === 'reorder' &&
      (a.reorder_point === undefined ||
        !a.order_quantity ||
        a.lead_time_days === undefined)
    )
      return 'Supply a reorder point, fixed positive order quantity and lead time for your selected rule.'
    if (
      a.new_credit_sales_amount !== undefined &&
      (!a.new_credit_sales_date ||
        !a.customer_terms_id ||
        a.demand_cash_treatment !== 'incremental')
    )
      return 'Additional credit sales need an exact date and selected customer terms, declared incremental to existing invoices.'
    if (
      a.unpaid_share !== undefined &&
      (!a.customer_terms_id || a.demand_cash_treatment !== 'incremental')
    )
      return 'An unpaid share needs selected customer terms and new incremental sales.'
    if (a.customer_terms_id && !a.demand_cash_treatment)
      return 'Declare whether modeled demand creates new invoices or is already represented by financial records.'
    if (a.supplier_terms_id && !a.purchase_cash_treatment)
      return 'Declare whether the planned purchase creates new payments or replaces linked records.'
    if (
      a.demand_multiplier !== undefined &&
      (!a.demand_start_date || !a.demand_end_date)
    )
      return 'Give the exact start and end of the demand multiplier.'
    if (
      (a.demand_start_date || a.demand_end_date) &&
      a.demand_multiplier === undefined
    )
      return 'Enter the demand multiplier for this date interval.'
    const selectedTerms =
      snapshot.paymentTerms?.filter(
        (term) =>
          term.id === a.customer_terms_id || term.id === a.supplier_terms_id,
      ) ?? []
    if (
      selectedTerms.some(
        (term) =>
          term.advancePercent === undefined &&
          (term.party === 'supplier'
            ? a.purchase_cash_treatment
            : a.demand_cash_treatment) !== 'already_recorded',
      ) &&
      !a.terms_no_advance_confirmed
    )
      return 'Record the advance percentage or accept no advance as an explicit scenario assumption.'
    if (
      selectedTerms.some((term) => term.status === 'proposed') &&
      !a.terms_accepted
    )
      return 'Accept the proposed payment terms as hypothetical before running.'
  }
  return null
}
