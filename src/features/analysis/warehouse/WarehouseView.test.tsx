import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import WarehouseView from './WarehouseView'
import { runFixture } from './test-fixtures'

const renderer = vi.hoisted(() => ({ update: vi.fn(), dispose: vi.fn(), enter: vi.fn(), release: vi.fn(), move: vi.fn(), resetCamera: vi.fn(), focusWall: vi.fn() }))
vi.mock('./warehouse-renderer', () => ({ createWarehouse: vi.fn(() => renderer) }))
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers() })

test('game opens at the launch date, replays, steps, changes speed and pauses on blur', () => {
  vi.useFakeTimers()
  const run = runFixture()
  render(<WarehouseView run={run} initialDate="2026-09-14" />)
  expect(renderer.update).toHaveBeenLastCalledWith(expect.objectContaining({ date: '2026-09-14', playing: false }))
  fireEvent.click(screen.getByRole('button', { name: 'Replay from start' }))
  expect(renderer.update).toHaveBeenLastCalledWith(expect.objectContaining({ date: '2026-09-12', playing: true }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Playback speed' }), { target: { value: '2' } })
  act(() => vi.advanceTimersByTime(400))
  expect(renderer.update).toHaveBeenLastCalledWith(expect.objectContaining({ date: '2026-09-14', playing: false }))
  fireEvent.click(screen.getByRole('button', { name: 'Previous date' }))
  fireEvent.click(screen.getByRole('button', { name: 'Play playback' }))
  fireEvent(window, new Event('blur'))
  expect(renderer.update).toHaveBeenLastCalledWith(expect.objectContaining({ playing: false }))
})

test('single-day simulations remain walkable with disabled time navigation and release on unmount', () => {
  const run = runFixture(); run.result.series = run.result.series.slice(0, 1)
  const { unmount } = render(<WarehouseView run={run} />)
  expect(screen.getByRole('slider', { name: 'Playback date' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Enter mouse look' }))
  expect(renderer.enter).toHaveBeenCalledOnce()
  unmount()
  expect(renderer.dispose).toHaveBeenCalledOnce()
})
