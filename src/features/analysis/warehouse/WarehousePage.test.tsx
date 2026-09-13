import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import WarehousePage from './WarehousePage'
import { runFixture } from './test-fixtures'

vi.mock('./WarehouseView', () => ({ default: ({ run, initialDate }: { run: { definition_name: string }; initialDate: string }) => <p>{run.definition_name} on {initialDate}</p> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); history.replaceState(null, '', '/') })

test('standalone reload reads the same authenticated saved-run endpoint without submitting a run', async () => {
  const run = runFixture()
  localStorage.setItem('samby.workspace-key.warehouse-test', 'test-workspace-key')
  history.replaceState(null, '', '/warehouse.html#workspace=warehouse-test&run=warehouse-run&mode=demo&date=2026-09-14')
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(run), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  render(<WarehousePage />)
  expect(await screen.findByText('Warehouse fixture on 2026-09-14')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledOnce()
  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toMatch(/\/runs\/warehouse-run$/)
  expect(options.method).toBe('GET')
  expect(options.headers.get('X-Workspace-ID')).toBe('warehouse-test')
  expect(options.headers.get('X-Workspace-Key')).toBe('test-workspace-key')
})

test('missing launch IDs never fetch and access failures retain a path to saved results', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Access denied' }), { status: 403 }))
  vi.stubGlobal('fetch', fetchMock)
  const view = render(<WarehousePage />)
  expect(screen.getByRole('alert')).toHaveTextContent('Open the warehouse from a completed simulation')
  expect(fetchMock).not.toHaveBeenCalled()
  view.unmount()
  history.replaceState(null, '', '/warehouse.html#workspace=warehouse-test&run=warehouse-run&mode=demo')
  render(<WarehousePage />)
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Access denied'))
  expect(screen.getByRole('link', { name: 'Back to saved results' })).toHaveAttribute('href', '/#/demo/analysis?run=warehouse-run')
})
