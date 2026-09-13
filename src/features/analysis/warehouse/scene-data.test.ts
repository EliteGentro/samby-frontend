import { describe, expect, test } from 'vitest'
import { runFixture } from './test-fixtures'
import { questions } from '../../../domain/workspace'
import { buildSceneData, deliveryPosition, floorZones, numeric, peopleAtDate, pileCount } from './scene-data'

describe('warehouse saved-data adapter', () => {
  test.each(questions)('$key has relevant charts even without a legacy manifest', ({ key }) => {
    const run = runFixture(); run.config.question = key
    const data = buildSceneData(run)
    expect(data.charts.length).toBeGreaterThan(0)
    const zones = floorZones(data.charts.slice(0, 2))
    expect(zones.length).toBeGreaterThan(0)
    if (['Q-CUSTOMER-DEBT', 'Q-CRITICAL-COLLECTION', 'Q-CASH-SUFFICIENCY'].includes(key)) {
      expect(zones.every(zone => zone.model === 'money')).toBe(true)
    }
  })
  test('uses only numeric saved measures and does not mutate results', () => {
    const run = runFixture(), before = JSON.stringify(run)
    const data = buildSceneData(run)
    expect(data.charts[0].points[0].date).toBe('2026-09-12')
    expect(data.charts.flatMap(chart => chart.keys)).not.toContain('on_hand')
    expect(JSON.stringify(run)).toBe(before)
    expect(numeric({ date: '2026-09-12', cash: null }, 'cash')).toBeNull()
    expect(numeric({ date: '2026-09-12', cash: Infinity }, 'cash')).toBeNull()
  })
  test('keeps missing, zero and negative values distinct while bounding model counts', () => {
    const zones = floorZones(buildSceneData(runFixture()).charts.slice(0, 2))
    expect(new Set(zones.map(zone => zone.key)).size).toBe(zones.length)
    expect(zones.find(zone => zone.key === 'cash')?.model).toBe('money')
    expect(pileCount(null, 1)).toBe(0)
    expect(pileCount(0, 1)).toBe(0)
    expect(pileCount(-20, 2.5)).toBe(8)
    expect(pileCount(1_000_000, 1)).toBe(8)
  })
  test('keeps comparisons separate and preserves negative deltas', () => {
    const run = runFixture()
    run.result.comparison = { baseline_run_id: 'baseline', metrics: [], series: [{ date: '2026-09-12', cash_delta: -30 }] }
    const chart = buildSceneData(run).charts.find(chart => chart.id === 'cash-comparison')!
    expect(chart.points[0].cash_delta).toBe(-30)
    expect(floorZones([chart])[0].model).toBe('money')
  })
  test('delivery position is deterministic when stepping backward or replaying', () => {
    const receipt = runFixture().result.events[0]
    expect(deliveryPosition(receipt, '2026-09-08').visible).toBe(false)
    expect(deliveryPosition(receipt, '2026-09-09').x).toBe(10)
    expect(deliveryPosition(receipt, '2026-09-14')).toEqual({ visible: true, x: 0, arrived: true })
    expect(deliveryPosition(receipt, '2026-09-16').visible).toBe(false)
    expect(deliveryPosition(receipt, '2026-09-12').x).toBe(4)
  })
  test('only shows people for dated customer or payroll events', () => {
    const run = runFixture()
    run.result.events.push({ id: 'payroll', date: '2026-09-12', type: 'payroll_payment', label: 'Staff wages', source_id: 'payroll-123' })
    expect(peopleAtDate(run, '2026-09-12')).toEqual([{ id: 'payroll', label: 'Payroll group', detail: 'payroll-123' }])
    expect(peopleAtDate(run, '2026-09-14')).toEqual([])
  })
})
