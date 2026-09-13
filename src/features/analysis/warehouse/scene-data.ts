import type { AnalysisEvent, AnalysisRun, DailyPoint } from '../../../lib/analysis'
import type { QuestionKey } from '../../../domain/workspace'

export type SavedSimulation = Extract<AnalysisRun, { status: 'succeeded' }>
export type ModelId = 'box' | 'money' | 'person' | 'truck' | 'road'
export const colors = ['#30b99a', '#e4ae54', '#77a6ef', '#ec8091', '#b59aec', '#76c4d0']
export const metricLabels: Record<string, string> = {
  inventory: 'Available inventory', on_hand: 'Physical on-hand', inventory_position: 'Inventory position',
  demand: 'Demand', fulfilled: 'New demand fulfilled', sale_fulfilled: 'Sales fulfilled', purchase: 'Supplier receipts',
  unmet_demand: 'Unmet demand', backorders: 'Closing backorders', lost_units: 'Lost units', backlog_fulfilled: 'Backlog fulfilled',
  cash: 'Closing cash', zero: 'Zero-cash boundary', reserve: 'Selected reserve', inflow: 'Cash inflows', outflow: 'Cash outflows',
  receivable: 'Customer receivables', provider_pending: 'Provider pending', overdue: 'Overdue balance',
  payable: 'Supplier payables', planned_payable: 'Modeled supplier obligations', financing_debt: 'Financing debt',
  customer_concentration: 'Largest customer share', inventory_delta: 'Inventory change', demand_delta: 'Demand change',
  cash_delta: 'Cash change', receivable_delta: 'Receivable change',
}
export const chartDefinitions = [
  { id: 'inventory', title: 'Inventory through time', keys: ['inventory', 'on_hand', 'inventory_position'], unit: 'stock' },
  { id: 'demand', title: 'Demand & supplier receipts', keys: ['demand', 'fulfilled', 'sale_fulfilled', 'purchase'], unit: 'stock' },
  { id: 'unmet', title: 'Unmet demand', keys: ['unmet_demand', 'backorders', 'lost_units', 'backlog_fulfilled'], unit: 'stock' },
  { id: 'cash', title: 'Cash balance', keys: ['cash', 'zero', 'reserve'], unit: 'cash' },
  { id: 'flows', title: 'Inflows & outflows', keys: ['inflow', 'outflow'], unit: 'cash' },
  { id: 'customers', title: 'Customer balances', keys: ['receivable', 'provider_pending', 'overdue'], unit: 'cash' },
  { id: 'suppliers', title: 'Supplier & financing balances', keys: ['payable', 'planned_payable', 'financing_debt'], unit: 'cash' },
  { id: 'concentration', title: 'Customer concentration', keys: ['customer_concentration'], unit: '%' },
  { id: 'stock-comparison', title: 'Inventory & demand vs baseline', keys: ['inventory_delta', 'demand_delta'], unit: 'stock', comparison: true },
  { id: 'cash-comparison', title: 'Cash & receivables vs baseline', keys: ['cash_delta', 'receivable_delta'], unit: 'cash', comparison: true },
]
// Each question opens the same shell with its own relevant wall displays and floor zones.
export const questionCharts: Record<QuestionKey, string[]> = {
  'Q-NEW-ORDER': ['inventory', 'cash', 'demand'],
  'Q-REPLENISH': ['inventory', 'demand', 'unmet'],
  'Q-CRITICAL-COLLECTION': ['customers', 'cash', 'flows'],
  'Q-CASH-SUFFICIENCY': ['cash', 'suppliers', 'flows'],
  'Q-DEMAND-CHANGE': ['demand', 'unmet', 'inventory'],
  'Q-SLOW-SUPPLIER': ['inventory', 'unmet', 'demand'],
  'Q-CUSTOMER-DEBT': ['customers', 'flows', 'cash'],
  'Q-SUPPLIER-ORDER-STOCKOUT': ['demand', 'inventory', 'unmet'],
  'Q-EXPLORE': ['inventory', 'cash', 'customers'],
  'Q-POISON-APPLE': ['cash', 'flows', 'suppliers'],
  'Q-DEAD-STOCK': ['cash', 'inventory', 'flows'],
  'Q-TREASURY-STRESS': ['cash', 'flows', 'suppliers'],
}
export type WallChart = { id: string; title: string; keys: string[]; unit: string; points: DailyPoint[] }
export type FloorZone = { key: string; label: string; model: 'box' | 'money'; unit: string; points: DailyPoint[]; capacity: number; color: string }
export const numeric = (point: DailyPoint | undefined, key: string): number | null => {
  const value = point?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
export const valueLabel = (value: number | null, unit: string) => value === null ? 'Not supplied' : `${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)} ${unit}`
export function buildSceneData(run: SavedSimulation) {
  const unit = run.snapshot.products.find(p => p.id === run.config.product_id)?.unit ?? 'units'
  const preferred = questionCharts[run.config.question] ?? ['inventory', 'cash', 'demand']
  const charts: WallChart[] = chartDefinitions.flatMap(def => {
    const points = [...(def.comparison ? run.result.comparison?.series ?? [] : run.result.series)].sort((a, b) => a.date.localeCompare(b.date))
    const keys = def.keys.filter(key => points.some(point => numeric(point, key) !== null))
    return keys.length ? [{ id: def.id, title: def.title, keys, points, unit: def.unit === 'stock' ? unit : def.unit === 'cash' ? run.provenance.currency : '%' }] : []
  }).sort((a, b) => {
    const rank = (id: string) => preferred.includes(id) ? preferred.indexOf(id) : preferred.length
    return rank(a.id) - rank(b.id)
  })
  const receipts = run.result.events.filter(event => event.type === 'receipt').sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  return { charts, receipts, unit }
}
export function floorZones(charts: WallChart[]): FloorZone[] {
  return charts.flatMap(chart => chart.keys.filter(key => key !== 'zero' && chart.unit !== '%').map(key => {
    const stock = chartDefinitions.find(def => def.id === chart.id)?.unit === 'stock'
    const peak = chart.points.reduce((max, point) => Math.max(max, Math.abs(numeric(point, key) ?? 0)), 0)
    return { key, label: metricLabels[key] ?? key, model: stock ? 'box' as const : 'money' as const, unit: chart.unit, points: chart.points, capacity: Math.max(1, peak / 8), color: '' }
  })).slice(0, 6).map((zone, index) => ({ ...zone, color: colors[index % colors.length] }))
}
export function pileCount(value: number | null, capacity: number) {
  return value === null || value === 0 ? 0 : Math.min(8, Math.ceil(Math.abs(value) / capacity))
}
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000
// Positions are a function of the selected date, so pause, replay and scrubbing agree.
export function deliveryPosition(receipt: AnalysisEvent, date: string) {
  const daysUntil = dayNumber(receipt.date) - dayNumber(date)
  return { visible: daysUntil >= -1 && daysUntil <= 5, x: daysUntil >= 0 ? 10 - (5 - daysUntil) * 2 : -8, arrived: daysUntil <= 0 }
}
export function peopleAtDate(run: SavedSimulation, date: string) {
  const events = run.result.events.filter(event => event.date === date)
  return events.filter(event => /payroll|collection|customer_order|demand/.test(event.type) && event.type !== 'unmet_demand').slice(0, 2).map(event => ({
    id: event.id,
    label: /payroll/.test(event.type) ? 'Payroll group' : /collection/.test(event.type) ? 'Customer collection' : 'Customer demand',
    detail: event.source_id ?? event.label,
  }))
}
