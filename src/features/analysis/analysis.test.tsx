import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import {
  capabilities,
  demoWorkspace,
  emptyWorkspace,
} from '../../domain/workspace'
import {
  acknowledgeSubmission,
  createAnalysisClient,
  pendingSubmission,
  submissionStorageWarning,
  type AnalysisRun,
} from '../../lib/analysis'
import { AnalysisEditor } from './AnalysisEditor'
import { AnalysisPage } from './AnalysisPage'
import { forecastCreationIssue, newConfig, validateEditor } from './config'
import { RunResults } from './RunResults'
import { WorkspaceAccessContext } from '../../components/workspace-access-context'
import { DataChart } from '../../components/workspace-ui'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  sessionStorage.clear()
})

test('a cash-only critical collection preserves explicit coverage and inclusive dates without inventory inputs', async () => {
  const onSubmit = vi.fn()
  render(
    <AnalysisEditor
      seed={{
        kind: 'simulation',
        question: 'Q-CRITICAL-COLLECTION',
        basis: demoWorkspace('demo-namespace'),
      }}
      runs={[]}
      busy={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  )
  expect(screen.queryByLabelText('Product')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Collection to change'), {
    target: { value: 'inv-1024' },
  })
  fireEvent.change(screen.getByLabelText(/Collection timing change in days/), {
    target: { value: '7' },
  })
  fireEvent.click(screen.getByLabelText(/I reviewed these category states/))
  fireEvent.click(screen.getByRole('button', { name: 'Save and run' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
  const [submission, execute] = onSubmit.mock.calls[0]
  expect(execute).toBe(true)
  expect(submission.config).toMatchObject({
    question: 'Q-CRITICAL-COLLECTION',
    product_id: null,
    start_date: '2026-09-12',
    horizon_days: 30,
    output_families: ['cash'],
    coverage_reviewed: true,
    assumptions: { collection_id: 'inv-1024', collection_delay_days: 7 },
  })
  expect(
    screen.getByText(
      '2026-09-12 through 2026-10-11, inclusive. Daily resolution.',
    ),
  ).toBeInTheDocument()
  expect(submission.snapshot.coverage.taxes.state).toBe('omitted')
})

test('inventory submission asks for explicit opening confirmation rather than silently accepting stock', async () => {
  const onSubmit = vi.fn()
  render(
    <AnalysisEditor
      seed={{
        kind: 'simulation',
        question: 'Q-NEW-ORDER',
        basis: demoWorkspace('demo-namespace'),
      }}
      runs={[]}
      busy={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  )
  const openingTable = screen.getByRole('table', {
    name: 'Inventory opening position',
  })
  expect(openingTable).toBeInTheDocument()
  expect(
    screen.getByRole('columnheader', { name: 'Quantity basis' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('columnheader', { name: 'Recorded as of' }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save and run' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Review and confirm the inventory opening position',
  )
  expect(onSubmit).not.toHaveBeenCalled()
})

test('analysis forms identify required inputs and explain blank optional fields', () => {
  render(
    <AnalysisEditor
      seed={{
        kind: 'simulation',
        question: 'Q-NEW-ORDER',
        basis: demoWorkspace('requirement-guidance'),
      }}
      runs={[]}
      busy={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />,
  )

  expect(screen.getByText(/Required to run/)).toBeInTheDocument()
  expect(
    screen.getByText('Product', { exact: true }).closest('.field-requirement'),
  ).toHaveTextContent('*')
  expect(
    screen
      .getByText('Requested quantity', { exact: true })
      .closest('.field-requirement'),
  ).toHaveTextContent('*')
  expect(
    screen.getByText(/If left blank, the run uses all supplied locations/),
  ).toBeInTheDocument()
  expect(
    screen.getByText(/leaving both blank makes the declared order the only demand/),
  ).toBeInTheDocument()
})

test('cash-only exploration defaults to thirty days and removes hidden inventory assumptions', async () => {
  const onSubmit = vi.fn()
  render(
    <AnalysisEditor
      seed={{
        kind: 'simulation',
        question: 'Q-EXPLORE',
        basis: demoWorkspace('demo-namespace'),
      }}
      runs={[]}
      busy={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  )
  fireEvent.change(screen.getByLabelText(/Accepted daily demand/), {
    target: { value: '8' },
  })
  fireEvent.change(screen.getByLabelText(/Proposed order quantity/), {
    target: { value: '24' },
  })
  fireEvent.click(screen.getByLabelText('Cash and obligations'))
  fireEvent.click(screen.getByLabelText('Inventory and fulfillment'))
  expect(screen.getByLabelText(/Horizon in days/)).toHaveValue(30)
  expect(
    screen.queryByLabelText(/Accepted daily demand/),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save definition' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
  expect(onSubmit.mock.calls[0][0].config).toMatchObject({
    output_families: ['cash'],
    horizon_days: 30,
    product_id: null,
    forecast_run_id: null,
    assumptions: {},
  })
})

test('reviewing current data requires fresh coverage consent even when the prior snapshot was accepted', () => {
  const prior = savedRun()
  prior.config.coverage_reviewed = true
  render(
    <AnalysisEditor
      seed={{
        kind: 'simulation',
        run: prior,
        basis: structuredClone(prior.snapshot),
        retryOf: prior.id,
      }}
      runs={[]}
      busy={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />,
  )
  expect(
    screen.getByLabelText(/I reviewed these category states/),
  ).not.toBeChecked()
})

test('the year shortcut states its inclusive last day and muted data remains an explicit context', () => {
  const workspace = demoWorkspace('demo-namespace')
  workspace.muted = ['forecast']
  render(
    <AnalysisEditor
      seed={{ kind: 'forecast', basis: workspace }}
      runs={[]}
      busy={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '365 days' }))
  expect(
    screen.getByText(
      '2026-09-12 through 2027-09-11, inclusive. Daily resolution.',
    ),
  ).toBeInTheDocument()
  expect(screen.getByText(/Muted in ordinary views/)).toBeInTheDocument()
})

test('muting does not change computational eligibility, while retired engines reject new creation', () => {
  const workspace = demoWorkspace('demo-namespace')
  workspace.muted = ['forecast-advanced']
  expect(forecastCreationIssue('naive', workspace)).toBeNull()
  expect(forecastCreationIssue('lightgbm', workspace)).toBeNull()
  expect(
    validateEditor(
      { ...newConfig('forecast', 'Q-EXPLORE', workspace), engine: 'lightgbm' },
      'forecast',
      workspace,
    ),
  ).toBeNull()
  const engine = capabilities.find(
    (capability) => capability.id === 'forecast-seasonal',
  )!
  const originalLifecycle = engine.lifecycle
  try {
    engine.lifecycle = 'retired'
    expect(forecastCreationIssue('seasonal-naive', workspace)).toContain(
      'retired for new runs',
    )
  } finally {
    engine.lifecycle = originalLifecycle
  }
})

test('an explicitly selected shared pool records its identity and shows only its declared location contributions', () => {
  const workspace = demoWorkspace('demo-namespace')
  workspace.inventoryPools = [
    {
      id: 'pool-mty',
      name: 'Monterrey channels',
      locationIds: ['loc-mty'],
      channelNames: ['Retail counter'],
    },
  ]
  render(
    <AnalysisEditor
      seed={{ kind: 'simulation', question: 'Q-NEW-ORDER', basis: workspace }}
      runs={[]}
      busy={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />,
  )
  fireEvent.change(screen.getByLabelText(/Location scope/), {
    target: { value: 'pool:pool-mty' },
  })
  expect(
    screen.getByText(/Confirmed pool includes 1 locations/),
  ).toBeInTheDocument()
  expect(
    screen.getByText(/Declared channels include Retail counter/),
  ).toBeInTheDocument()
  expect(
    within(
      screen.getByRole('table', { name: 'Inventory opening position' }),
    ).queryByText('Saltillo branch', { exact: true }),
  ).not.toBeInTheDocument()
})

test('a pending execution never exposes final charts and offers server cancellation', () => {
  const onCancel = vi.fn()
  const run = savedRun()
  const pending: AnalysisRun = {
    ...run,
    status: 'waiting_for_dependency',
    phase: 'waiting_for_forecast',
    result: null,
    completed_at: null,
    config: { ...run.config, forecast_run_id: 'forecast-fixed-1' },
  }
  render(
    <RunResults
      run={pending}
      busy={false}
      onBack={vi.fn()}
      onCancel={onCancel}
      onArchive={vi.fn()}
      onRerun={vi.fn()}
      onOpenRun={vi.fn()}
    />,
  )
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('waiting for forecast')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel this run' }))
  expect(onCancel).toHaveBeenCalledOnce()
})

test('historical numerical results reopen when the current ordinary workspace is empty', async () => {
  const run = savedRun()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    return Response.json(
      url.includes('/definitions')
        ? []
        : url.endsWith('/saved-run-1')
          ? run
          : [run],
    )
  })
  const current = emptyWorkspace('business-namespace')
  current.muted = ['forecast', 'liquidity']
  current.onboarding.firstAnalysisAt = '2026-09-12'
  render(
    <AnalysisPage
      workspace={current}
      onChange={vi.fn()}
      initialRunId="saved-run-1"
      onOpenRun={vi.fn()}
    />,
  )
  expect(
    await screen.findByRole('heading', { name: 'Cash balance through time' }),
  ).toBeInTheDocument()
  expect(screen.getByText('125,500 MXN')).toBeInTheDocument()
  expect(
    screen.getByText(/No assets or renderer are required/),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Rerun original snapshot' }),
  ).toBeInTheDocument()
})

test('uncertain submissions retain a key until acceptance and a later rerun gets a new identity', () => {
  const first = pendingSubmission('business-1', 'definition-v1-snapshot-a')
  expect(pendingSubmission('business-1', 'definition-v1-snapshot-a')).toBe(
    first,
  )
  expect(pendingSubmission('demo-1', 'definition-v1-snapshot-a')).not.toBe(
    first,
  )
  acknowledgeSubmission('business-1')
  expect(pendingSubmission('business-1', 'definition-v1-snapshot-a')).not.toBe(
    first,
  )
})

test('analytical transport sends workspace isolation and retains explicit retry identity', async () => {
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(Response.json({ id: 'new-run' }, { status: 202 }))
  localStorage.setItem(
    'samby.workspace-key.business-namespace',
    'private-test-key',
  )
  localStorage.setItem('samby.access-token', 'test-account-token')
  const client = createAnalysisClient('business-namespace')
  const snapshot = emptyWorkspace('business-namespace')
  await client.startRun(
    'definition-1',
    snapshot,
    'request-identity',
    'earlier-run',
  )
  const [, options] = fetch.mock.calls[0]
  const headers = new Headers(options?.headers)
  expect(headers.get('Content-Type')).toBe('application/json')
  expect(headers.get('X-Workspace-ID')).toBe('business-namespace')
  expect(headers.get('X-Workspace-Key')).toBe('private-test-key')
  expect(headers.get('Authorization')).toBe('Bearer test-account-token')
  localStorage.removeItem('samby.workspace-key.business-namespace')
  localStorage.removeItem('samby.access-token')
  expect(JSON.parse(options?.body as string)).toEqual({
    snapshot,
    idempotency_key: 'request-identity',
    retry_of_run_id: 'earlier-run',
  })
})

test('validation failures from the service show their actionable field message', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json(
      { detail: [{ msg: 'Select a compatible currency before running.' }] },
      { status: 422 },
    ),
  )
  await expect(
    createAnalysisClient('business-namespace').listRuns(),
  ).rejects.toThrow('Select a compatible currency before running.')
})

test('exploration without a proposed purchase never inserts supplier timing, including after changing product', async () => {
  const onSubmit = vi.fn(),
    workspace = demoWorkspace('explore-no-purchase')
  expect(
    newConfig('simulation', 'Q-EXPLORE', workspace).assumptions.lead_time_days,
  ).toBeUndefined()
  render(
    <AnalysisEditor
      seed={{ kind: 'simulation', question: 'Q-EXPLORE', basis: workspace }}
      runs={[]}
      busy={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  )
  fireEvent.change(screen.getByLabelText('Product'), {
    target: { value: 'p-2' },
  })
  fireEvent.change(screen.getByLabelText('Accepted daily demand'), {
    target: { value: '5' },
  })
  fireEvent.click(screen.getByLabelText(/I accept these supplied positions/))
  fireEvent.click(screen.getByRole('button', { name: 'Save and run' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
  expect(
    onSubmit.mock.calls[0][0].config.assumptions.lead_time_days,
  ).toBeUndefined()
  expect(
    onSubmit.mock.calls[0][0].config.assumptions.order_quantity,
  ).toBeUndefined()
})

test('muted forecast suggestions disappear while saved execution remains available', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json([]))
  const workspace = demoWorkspace('muted-forecast-page')
  workspace.muted = ['forecast']
  render(
    <AnalysisPage
      workspace={workspace}
      onChange={vi.fn()}
      onOpenRun={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Forecasts' }))
  expect(
    await screen.findByText(/Muted engine suggestions are hidden/),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'New forecast' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByText('LightGBM / CatBoost', { exact: true }),
  ).not.toBeInTheDocument()
  cleanup()
  const onSubmit = vi.fn()
  render(
    <AnalysisEditor
      seed={{ kind: 'forecast', basis: workspace }}
      runs={[]}
      busy={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save and run' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
})

test('muted optional controls retain saved assumptions but focused collection inputs stay available', () => {
  const workspace = demoWorkspace('muted-controls')
  workspace.muted = ['price', 'reserve', 'customer-delay']
  render(
    <AnalysisEditor
      seed={{ kind: 'simulation', question: 'Q-EXPLORE', basis: workspace }}
      runs={[]}
      busy={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByLabelText('Cash and obligations'))
  expect(
    screen.queryByLabelText('Assumed selling price'),
  ).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Assumed unit cost')).not.toBeInTheDocument()
  expect(
    screen.queryByLabelText('Owner-selected cash reserve'),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByLabelText('Collection timing change in days'),
  ).not.toBeInTheDocument()
  expect(
    screen.getByText('Retained inputs behind muted optional controls'),
  ).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Business question'), {
    target: { value: 'Q-CRITICAL-COLLECTION' },
  })
  expect(
    screen.getByLabelText('Collection timing change in days'),
  ).toBeInTheDocument()
})

test('unavailable browser storage retains one request identity in memory and acknowledges it explicitly', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  const id = pendingSubmission('unavailable-storage', 'config')
  expect(pendingSubmission('unavailable-storage', 'config')).toBe(id)
  expect(submissionStorageWarning('unavailable-storage')).toContain(
    'retained for this page only',
  )
  acknowledgeSubmission('unavailable-storage')
  expect(pendingSubmission('unavailable-storage', 'config')).not.toBe(id)
})

test('playback appears only for completed timelines with meaningful dated content', () => {
  const props = {
    busy: false,
    onBack: vi.fn(),
    onCancel: vi.fn(),
    onArchive: vi.fn(),
    onRerun: vi.fn(),
    onOpenRun: vi.fn(),
  }
  const view = render(
    <RunResults run={playbackRun('forecast', [10, 10, 10])} {...props} />,
  )
  expect(
    screen.getByRole('region', { name: 'Result playback controls' }),
  ).toBeInTheDocument()

  view.rerender(
    <RunResults run={playbackRun('simulation', [10, 10, 10])} {...props} />,
  )
  expect(
    screen.queryByRole('region', { name: 'Result playback controls' }),
  ).not.toBeInTheDocument()

  view.rerender(
    <RunResults
      run={playbackRun('simulation', [10, 10, 10], true)}
      {...props}
    />,
  )
  expect(
    screen.getByRole('region', { name: 'Result playback controls' }),
  ).toBeInTheDocument()

  view.rerender(
    <RunResults run={playbackRun('simulation', [10])} {...props} />,
  )
  expect(
    screen.queryByRole('region', { name: 'Result playback controls' }),
  ).not.toBeInTheDocument()
})

test('playback synchronizes its active date, speed, events and replay state', () => {
  vi.useFakeTimers()
  const { container } = render(
    <RunResults
      run={playbackRun('simulation', [10, 20, 30], true)}
      busy={false}
      onBack={vi.fn()}
      onCancel={vi.fn()}
      onArchive={vi.fn()}
      onRerun={vi.fn()}
      onOpenRun={vi.fn()}
    />,
  )
  const slider = screen.getByRole('slider', { name: 'Playback date' })
  expect(slider).toHaveValue('0')
  expect(screen.getByRole('button', { name: '1×' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(container.querySelector('.chart-wrap')).toHaveAttribute(
    'data-active-date',
    '2026-09-12',
  )

  fireEvent.click(screen.getByRole('button', { name: 'Next date' }))
  expect(slider).toHaveValue('1')
  expect(screen.getAllByText('Collection arrives').length).toBeGreaterThan(0)
  expect(container.querySelector('tr[aria-current="date"]')).toHaveTextContent(
    'Collection arrives',
  )

  fireEvent.click(screen.getByRole('button', { name: '2×' }))
  fireEvent.change(slider, { target: { value: '0' } })
  fireEvent.click(screen.getByRole('button', { name: 'Play playback' }))
  act(() => vi.advanceTimersByTime(400))
  expect(slider).toHaveValue('1')
  act(() => vi.advanceTimersByTime(400))
  expect(slider).toHaveValue('2')
  act(() => vi.runOnlyPendingTimers())
  expect(
    screen.getByRole('button', { name: 'Replay from start' }),
  ).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Replay from start' }))
  expect(slider).toHaveValue('0')
  expect(
    screen.getByRole('button', { name: 'Pause playback' }),
  ).toBeInTheDocument()
  fireEvent.change(slider, { target: { value: '1' } })
  expect(
    screen.getByRole('button', { name: 'Play playback' }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Play playback' }))
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(
    screen.getByRole('button', { name: 'Play playback' }),
  ).toBeInTheDocument()
  hidden.mockRestore()
})

test('a controlled chart playhead restores its playback date after hover', () => {
  const { container } = render(
    <DataChart
      data={[
        { date: '2026-09-12', demand: 10 },
        { date: '2026-09-13', demand: 20 },
      ]}
      series={[{ key: 'demand', label: 'Demand' }]}
      label="Demand playback"
      activeDate="2026-09-12"
    />,
  )
  expect(container.querySelector('.chart-readout')).toHaveTextContent('Sep 12')
  const hitTargets = container.querySelectorAll('rect[fill="transparent"]')
  fireEvent.mouseEnter(hitTargets[1])
  expect(container.querySelector('.chart-readout')).toHaveTextContent('Sep 13')
  fireEvent.mouseLeave(container.querySelector('svg')!)
  expect(container.querySelector('.chart-readout')).toHaveTextContent('Sep 12')
})

function playbackRun(
  kind: 'forecast' | 'simulation',
  values: number[],
  withEvent = false,
): AnalysisRun {
  const run = savedRun()
  const dates = values.map(
    (_, index) => `2026-09-${String(12 + index).padStart(2, '0')}`,
  )
  run.kind = kind
  run.config.horizon_days = values.length
  run.result.start_date = dates[0]
  run.result.end_date = dates[dates.length - 1]
  run.result.series = dates.map((date, index) => ({
    date,
    [kind === 'forecast' ? 'demand' : 'cash']: values[index],
  }))
  run.result.events = withEvent
    ? [
        {
          id: 'event-1',
          date: dates[Math.min(1, dates.length - 1)],
          type: 'customer_collection',
          label: 'Collection arrives',
          amount: 100,
        },
      ]
    : []
  return run
}

function savedRun(): Extract<AnalysisRun, { status: 'succeeded' }> {
  const snapshot = demoWorkspace('business-namespace')
  snapshot.mode = 'business'
  const config = newConfig('simulation', 'Q-EXPLORE', snapshot)
  config.output_families = ['cash']
  config.horizon_days = 1
  return {
    id: 'saved-run-1',
    definition_id: 'definition-1',
    definition_name: 'Original saved cash scenario',
    kind: 'simulation',
    status: 'succeeded',
    phase: 'complete',
    archived: false,
    created_at: '2026-09-12T12:00:00Z',
    updated_at: '2026-09-12T12:00:02Z',
    started_at: '2026-09-12T12:00:01Z',
    completed_at: '2026-09-12T12:00:02Z',
    config,
    snapshot,
    warnings: [],
    error: null,
    retry_of_run_id: null,
    attempt: 1,
    provenance: {
      mode: 'computed',
      engine: 'daily-deterministic',
      engine_version: '1',
      currency: 'MXN',
      snapshot_at: '2026-09-12T12:00:00Z',
      scope: 'Saved business scope',
    },
    result: {
      start_date: '2026-09-12',
      end_date: '2026-09-12',
      grain: 'daily',
      metrics: [
        {
          key: 'ending_cash',
          label: 'Closing cash',
          value: 125500,
          unit: 'MXN',
        },
      ],
      series: [{ date: '2026-09-12', cash: 125500, inflow: 0, outflow: 0 }],
      events: [],
      warnings: [],
      assumptions: [],
      explanations: [],
      comparison: null,
      scene_manifest: {
        contract_version: '1',
        scene_manifest_supported: false,
        run_id: 'saved-run-1',
        question_key: 'Q-EXPLORE',
        start_date: '2026-09-12',
        end_date: '2026-09-12',
        grain: 'daily',
        allowed_asset_ids: [],
        entities: [],
        events: [],
        series: [],
      },
    },
  }
}

test('real advanced engines are selectable for business data with documented history prerequisites', () => {
  const workspace = demoWorkspace('real-forecast-business')
  workspace.mode = 'business'
  render(
    <AnalysisEditor
      seed={{ kind: 'forecast', basis: workspace }}
      runs={[]}
      busy={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />,
  )
  fireEvent.change(screen.getByLabelText('Forecast engine'), {
    target: { value: 'catboost' },
  })
  expect(screen.getByLabelText('Forecast engine')).toHaveValue('catboost')
  expect(
    screen.getByText(/at least 56 consecutive observed daily quantities/),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save and run' })).toBeEnabled()
  expect(
    screen.queryByText(/training is not implemented/),
  ).not.toBeInTheDocument()
})

test('an owner-selected reorder rule clears conflicting single-purchase dates', () => {
  const workspace = demoWorkspace('rule-ui')
  render(
    <AnalysisEditor
      seed={{ kind: 'simulation', question: 'Q-REPLENISH', basis: workspace }}
      runs={[]}
      busy={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />,
  )
  fireEvent.change(screen.getByLabelText('Proposed receipt date'), {
    target: { value: '2026-09-20' },
  })
  fireEvent.change(screen.getByLabelText('Purchasing plan'), {
    target: { value: 'reorder' },
  })
  expect(
    screen.queryByLabelText('Proposed receipt date'),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByLabelText('Proposed supplier order date'),
  ).not.toBeInTheDocument()
  expect(
    screen.getByLabelText('Reorder point in product units'),
  ).toBeInTheDocument()
})

test('new credit sales can submit debt-only with terms and an explicit unpaid share', async () => {
  const workspace = demoWorkspace('credit-ui'),
    onSubmit = vi.fn()
  workspace.paymentTerms = [
    {
      id: 'terms-customer',
      party: 'customer',
      counterparty: 'Customer',
      supplierId: null,
      days: 7,
      startEvent: 'invoice-date',
      status: 'agreed',
      reference: 'Net7',
      sourceId: 'terms-source',
      advancePercent: 0,
      advanceDays: 0,
    },
  ]
  render(
    <AnalysisEditor
      seed={{
        kind: 'simulation',
        question: 'Q-CUSTOMER-DEBT',
        basis: workspace,
      }}
      runs={[]}
      busy={false}
      error={null}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  )
  fireEvent.change(screen.getByLabelText('Collection timing change in days'), {
    target: { value: '0' },
  })
  fireEvent.change(screen.getByLabelText('Additional credit sales amount'), {
    target: { value: '500' },
  })
  fireEvent.change(screen.getByLabelText('Additional credit sales date'), {
    target: { value: '2026-09-12' },
  })
  fireEvent.change(screen.getByLabelText('Customer collection terms'), {
    target: { value: 'terms-customer' },
  })
  fireEvent.change(
    screen.getByLabelText('Invoice delay after the credit sale in days'),
    { target: { value: '0' } },
  )
  fireEvent.change(screen.getByLabelText('Share left unpaid, from 0 to 1'), {
    target: { value: '0.2' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save and run' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
  expect(onSubmit.mock.calls[0][0].config.assumptions).toMatchObject({
    new_credit_sales_amount: 500,
    unpaid_share: 0.2,
    customer_terms_id: 'terms-customer',
    demand_cash_treatment: 'incremental',
  })
})

test('viewer cannot submit an analytical edit and inventory roles cannot add cash outputs', () => {
  const workspace = demoWorkspace('role-ui')
  render(
    <WorkspaceAccessContext.Provider value="viewer">
      <AnalysisEditor
        seed={{ kind: 'forecast', basis: workspace }}
        runs={[]}
        busy={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    </WorkspaceAccessContext.Provider>,
  )
  expect(screen.getByRole('button', { name: 'Save and run' })).toBeDisabled()
  cleanup()
  render(
    <WorkspaceAccessContext.Provider value="inventory">
      <AnalysisEditor
        seed={{ kind: 'simulation', question: 'Q-REPLENISH', basis: workspace }}
        runs={[]}
        busy={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    </WorkspaceAccessContext.Provider>,
  )
  expect(screen.getByLabelText('Cash and obligations')).toBeDisabled()
})
