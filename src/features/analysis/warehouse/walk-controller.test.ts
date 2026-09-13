import { afterEach, expect, test, vi } from 'vitest'
import { PerspectiveCamera } from 'three'
import { createWalkController } from './walk-controller'

let dispose: (() => void) | undefined
afterEach(() => { dispose?.(); dispose = undefined; document.body.replaceChildren(); vi.useRealTimers() })
function setup() {
  vi.useFakeTimers()
  const camera = new PerspectiveCamera()
  const canvas = document.createElement('canvas'); document.body.append(canvas)
  const onAction = vi.fn(), onWalkState = vi.fn(), render = vi.fn()
  const controller = createWalkController(camera, canvas, render, { onAction, onWalkState })
  dispose = controller.dispose
  canvas.focus()
  return { camera, canvas, controller, onAction, onWalkState, render }
}

test('walking is grounded, stops after blur and does not consume keys in time controls', () => {
  const { camera, canvas } = setup()
  canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
  vi.advanceTimersByTime(120)
  expect(camera.position.z).toBeLessThan(10)
  expect(camera.position.y).toBe(1.7)
  window.dispatchEvent(new Event('blur'))
  const stopped = camera.position.z
  vi.advanceTimersByTime(120)
  expect(camera.position.z).toBe(stopped)
  const input = document.createElement('input'); document.body.append(input); input.focus()
  input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
  vi.advanceTimersByTime(120)
  expect(camera.position.z).toBe(stopped)
})

test('time shortcuts trigger once and Escape clears movement', () => {
  const { canvas, onAction, camera } = setup()
  canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))
  canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, repeat: true }))
  expect(onAction).toHaveBeenCalledExactlyOnceWith('play')
  canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
  const stopped = camera.position.z
  canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
  vi.advanceTimersByTime(120)
  expect(camera.position.z).toBe(stopped)
  expect(onAction).toHaveBeenLastCalledWith('pause')
})

test('held on-screen movement stops on release and disposal removes listeners', () => {
  const { controller, camera, canvas, onAction } = setup()
  controller.move('KeyW', true); vi.advanceTimersByTime(100); controller.move('KeyW', false)
  vi.advanceTimersByTime(30)
  const stopped = camera.position.z
  vi.advanceTimersByTime(100)
  expect(camera.position.z).toBe(stopped)
  controller.dispose(); dispose = undefined
  canvas.focus(); canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))
  expect(onAction).not.toHaveBeenCalled()
})
