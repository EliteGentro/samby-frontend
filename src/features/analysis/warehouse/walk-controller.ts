import { Euler, PerspectiveCamera } from 'three'
import { canStand, stepPlayer, type Obstacle } from './player-motion'

export type GameAction = 'play' | 'previous' | 'next' | 'walls' | 'pause'
export type WalkState = { locked: boolean; hint: string }
export type WalkCallbacks = { onWalkState: (state: WalkState) => void; onAction: (action: GameAction) => void }

/** Input owns a frame loop only while walking or turning. Scene playback stays separate. */
export function createWalkController(camera: PerspectiveCamera, canvas: HTMLCanvasElement, render: () => void, callbacks: WalkCallbacks) {
  const keys = new Set<string>()
  const touchKeys = new Set<string>()
  let yaw = 0, pitch = 0.12, frame = 0, previousTime = 0
  let disposed = false, dragging: number | null = null, lastX = 0, lastY = 0
  let obstacles: Obstacle[] = []
  const euler = new Euler(0, 0, 0, 'YXZ')
  const applyLook = () => { euler.set(pitch, yaw, 0); camera.quaternion.setFromEuler(euler); render() }
  const isLocked = () => document.pointerLockElement === canvas
  const focused = () => document.activeElement === canvas || isLocked()
  const stop = () => { keys.clear(); touchKeys.clear(); dragging = null; cancelAnimationFrame(frame); frame = 0; previousTime = 0 }
  const release = () => { stop(); if (isLocked()) document.exitPointerLock(); canvas.blur() }
  const reset = () => { stop(); camera.position.set(0, 1.7, 10); yaw = 0; pitch = 0.12; applyLook() }
  const tick = (time: number) => {
    frame = 0
    if (disposed || document.hidden) { stop(); return }
    const seconds = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 1 / 60
    previousTime = time
    const down = (key: string) => Number(keys.has(key) || touchKeys.has(key))
    const forward = down('KeyW') - down('KeyS'), strafe = down('KeyD') - down('KeyA')
    yaw += (down('ArrowLeft') - down('ArrowRight')) * seconds * 1.7
    pitch = Math.max(-1.1, Math.min(1.1, pitch + (down('ArrowUp') - down('ArrowDown')) * seconds * 1.3))
    const next = stepPlayer(camera.position, yaw, forward, strafe, seconds, keys.has('ShiftLeft') || keys.has('ShiftRight'), obstacles)
    camera.position.set(next.x, 1.7, next.z)
    applyLook()
    if (keys.size || touchKeys.size) frame = requestAnimationFrame(tick)
    else previousTime = 0
  }
  const start = () => { if (!frame && !disposed && !document.hidden) tick(performance.now()) }
  const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight'])
  const keyDown = (event: KeyboardEvent) => {
    if (!focused()) return
    if (event.code === 'Escape') { release(); callbacks.onAction('pause'); return }
    if (movementKeys.has(event.code)) { event.preventDefault(); keys.add(event.code); start(); return }
    const actions: Record<string, GameAction> = { Space: 'play', BracketLeft: 'previous', BracketRight: 'next', KeyE: 'walls' }
    if (actions[event.code]) { event.preventDefault(); if (!event.repeat) callbacks.onAction(actions[event.code]) }
    if (event.code === 'KeyR' && !event.repeat) reset()
  }
  const keyUp = (event: KeyboardEvent) => { keys.delete(event.code) }
  const lockedChange = () => {
    if (!isLocked()) stop()
    if (!disposed) callbacks.onWalkState({ locked: isLocked(), hint: isLocked() ? 'Mouse to look · WASD to walk · Esc for controls' : 'Click the scene to walk · Drag to look' })
  }
  const lockError = () => { if (!disposed) callbacks.onWalkState({ locked: false, hint: 'Drag to look · WASD to walk, or use the movement buttons' }) }
  const enter = () => {
    canvas.focus({ preventScroll: true })
    if (!canvas.requestPointerLock) { lockError(); return }
    try { Promise.resolve(canvas.requestPointerLock()).then(() => { if (disposed && isLocked()) document.exitPointerLock() }).catch(() => { if (!disposed) lockError() }) } catch { lockError() }
  }
  const look = (dx: number, dy: number) => {
    yaw -= dx * 0.0028
    pitch = Math.max(-1.1, Math.min(1.1, pitch - dy * 0.0028))
    applyLook()
  }
  const mouseMove = (event: MouseEvent) => { if (isLocked()) look(event.movementX, event.movementY) }
  const pointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || isLocked()) return
    canvas.focus({ preventScroll: true })
    dragging = event.pointerId; lastX = event.clientX; lastY = event.clientY
    canvas.setPointerCapture(event.pointerId)
  }
  const pointerMove = (event: PointerEvent) => {
    if (dragging !== event.pointerId || isLocked()) return
    look(event.clientX - lastX, event.clientY - lastY)
    lastX = event.clientX; lastY = event.clientY
  }
  const pointerUp = () => { dragging = null }
  const blur = () => { stop(); callbacks.onAction('pause') }
  const hidden = () => { if (document.hidden) { release(); callbacks.onAction('pause') } }
  const focusOut = () => { if (!isLocked()) stop() }
  canvas.tabIndex = 0
  canvas.setAttribute('role', 'region')
  canvas.setAttribute('aria-label', 'Walkable 3D warehouse. WASD to move, arrow keys to look, Space to play or pause time, Escape to release controls.')
  window.addEventListener('keydown', keyDown)
  window.addEventListener('keyup', keyUp)
  window.addEventListener('blur', blur)
  document.addEventListener('visibilitychange', hidden)
  document.addEventListener('pointerlockchange', lockedChange)
  document.addEventListener('pointerlockerror', lockError)
  document.addEventListener('mousemove', mouseMove)
  canvas.addEventListener('pointerdown', pointerDown)
  canvas.addEventListener('pointermove', pointerMove)
  canvas.addEventListener('pointerup', pointerUp)
  canvas.addEventListener('pointercancel', pointerUp)
  canvas.addEventListener('lostpointercapture', pointerUp)
  canvas.addEventListener('blur', focusOut)
  reset()
  return {
    enter, reset, release, stop,
    move: (key: string, pressed: boolean) => { if (pressed) { touchKeys.add(key); start() } else touchKeys.delete(key) },
    focusWall: (index: number) => {
      stop(); camera.position.set(index === 0 ? -6.7 : 6.7, 1.7, -6.1); yaw = 0; pitch = 0.52; applyLook()
    },
    setObstacles: (next: Obstacle[]) => { obstacles = next; if (!canStand(camera.position, obstacles)) reset() },
    dispose: () => {
      disposed = true; release()
      window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', hidden); document.removeEventListener('pointerlockchange', lockedChange)
      document.removeEventListener('pointerlockerror', lockError); document.removeEventListener('mousemove', mouseMove)
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerUp)
      canvas.removeEventListener('lostpointercapture', pointerUp); canvas.removeEventListener('blur', focusOut)
    },
  }
}
