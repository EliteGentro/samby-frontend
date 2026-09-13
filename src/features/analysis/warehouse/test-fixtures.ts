import { newConfig } from '../config'
import { demoWorkspace } from '../../../domain/workspace'
import type { SavedSimulation } from './scene-data'

export function runFixture(): SavedSimulation {
  const snapshot = demoWorkspace('warehouse-test')
  return {
    definition_id: 'definition', definition_name: 'Warehouse fixture', phase: 'complete', created_at: '2026-09-12T00:00:00Z', updated_at: '2026-09-12T00:00:00Z', started_at: null, completed_at: null, archived: false, retry_of_run_id: null, attempt: 1, warnings: [], error: null,
    id: 'warehouse-run', kind: 'simulation', status: 'succeeded', snapshot,
    config: newConfig('simulation', 'Q-EXPLORE', snapshot),
    provenance: { currency: 'MXN', mode: 'demo', engine: 'fixture', engine_version: '1', snapshot_at: '2026-09-12T00:00:00Z', scope: 'all' },
    result: {
      start_date: '2026-09-12', end_date: '2026-09-14', grain: 'daily', metrics: [], explanations: [], assumptions: [], warnings: [],
      series: [
        { date: '2026-09-14', inventory: 80, demand: 10, purchase: 50, unmet_demand: 0, cash: -20, inflow: 0, outflow: 40, receivable: 50, payable: 30 },
        { date: '2026-09-12', inventory: 100, demand: 5, purchase: 0, unmet_demand: 0, cash: 20, inflow: 0, outflow: 0, receivable: 60, payable: 30 },
      ],
      events: [{ id: 'receipt-1', date: '2026-09-14', type: 'receipt', label: 'Supplier arrival', quantity: 50 }],
      comparison: null, scene_manifest: { scene_manifest_supported: false, contract_version: '1', run_id: 'warehouse-run', question_key: 'Q-EXPLORE', start_date: '2026-09-12', end_date: '2026-09-14', grain: 'daily', allowed_asset_ids: [], entities: [], events: [], series: [] },
    },
  }
}

