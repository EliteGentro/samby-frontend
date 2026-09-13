import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { buildSceneData, floorZones, numeric, valueLabel, type SavedSimulation } from './scene-data'
import { createWarehouse } from './warehouse-renderer'
import { useGamePlayback } from './use-game-playback'
import { savedResultsUrl } from './game-url'
import type { GameAction, WalkState } from './walk-controller'
import './warehouse.css'

export default function WarehouseView({ run, initialDate }: { run: SavedSimulation; initialDate?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const game = useRef<HTMLDivElement>(null)
  const renderer = useRef<ReturnType<typeof createWarehouse> | null>(null)
  const [status, setStatus] = useState('Loading warehouse…')
  const [walk, setWalk] = useState<WalkState>({ locked: false, hint: 'Drag the scene to look · WASD to walk' })
  const [page, setPage] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const playback = useGamePlayback(run.result.series, initialDate)
  const data = useMemo(() => buildSceneData(run), [run])
  const pageCount = Math.max(1, Math.ceil(data.charts.length / 2))
  const charts = useMemo(() => data.charts.slice(page * 2, page * 2 + 2), [data, page])
  const date = playback.date ?? run.result.start_date
  const zones = useMemo(() => floorZones(charts), [charts])
  const events = run.result.events.filter(event => event.date === date)
  const onAction = useEffectEvent((action: GameAction) => {
    if (action === 'play') playback.toggle()
    if (action === 'pause') playback.pause()
    if (action === 'previous') playback.select(playback.index - 1)
    if (action === 'next') playback.select(playback.index + 1)
    if (action === 'walls') setPage(value => (value + 1) % pageCount)
  })
  useEffect(() => {
    if (!host.current) return
    let controller: ReturnType<typeof createWarehouse>
    let disposed = false
    try {
      controller = createWarehouse(host.current, run, setStatus, { onWalkState: setWalk, onAction: action => onAction(action) })
      renderer.current = controller
    } catch {
      queueMicrotask(() => { if (!disposed) setStatus('3D is unavailable in this browser. Return to saved results to view the charts.') })
      return () => { disposed = true }
    }
    return () => { disposed = true; controller.dispose(); renderer.current = null }
  }, [run])
  useEffect(() => { renderer.current?.update({ date, charts, playing: playback.playing }) }, [date, charts, playback.playing])
  useEffect(() => {
    const changed = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await game.current?.requestFullscreen()
    } catch { setWalk({ locked: false, hint: 'Fullscreen is unavailable. You can still walk and control time in this tab.' }) }
  }
  const movementButton = (key: string, label: string, symbol: string) => (
    <button key={key} type="button" aria-label={label} title={label}
      onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); renderer.current?.move(key, true) }}
      onPointerUp={() => renderer.current?.move(key, false)}
      onPointerCancel={() => renderer.current?.move(key, false)}
      onLostPointerCapture={() => renderer.current?.move(key, false)}
      onKeyDown={event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); renderer.current?.move(key, true) } }}
      onKeyUp={() => renderer.current?.move(key, false)}
      onBlur={() => renderer.current?.move(key, false)}>{symbol}</button>
  )
  return (
    <div ref={game} className="warehouse-game">
      <div ref={host} className="warehouse-canvas" />
      <div className="warehouse-crosshair" aria-hidden="true">+</div>
      <header className="warehouse-header">
        <div><p className="warehouse-eyebrow">SAMBY / WAREHOUSE</p><h1>{run.definition_name}</h1><span className="warehouse-mode">{run.provenance.mode === 'demo' ? 'Demonstration data' : 'Saved simulation'}</span></div>
        <nav aria-label="Warehouse navigation">
          <button type="button" onClick={() => renderer.current?.resetCamera()}>Entrance</button>
          {document.fullscreenEnabled && <button type="button" onClick={toggleFullscreen}>{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</button>}
          <a href={savedResultsUrl(run.snapshot.mode, run.id)}>Saved results ↗</a>
        </nav>
      </header>
      <aside className="warehouse-menu">
        <details>
          <summary>Charts & controls</summary>
          <div className="warehouse-menu-content">
            <p><strong>WASD</strong> walk · <strong>Shift</strong> run<br />Mouse or arrows to look · <strong>Esc</strong> release<br /><strong>Space</strong> play/pause · <strong>[ ]</strong> step dates<br /><strong>E</strong> change wall charts · <strong>R</strong> entrance</p>
            <div className="warehouse-wall-picker" role="group" aria-label="Warehouse wall charts">
              {Array.from({ length: pageCount }, (_, index) => <button key={index} type="button" aria-pressed={page === index} onClick={() => setPage(index)}>{data.charts.slice(index * 2, index * 2 + 2).map(chart => chart.title).join(' / ') || 'No supplied charts'}</button>)}
            </div>
            <div className="warehouse-wall-focus">
              {charts.map((chart, index) => <button key={chart.id} type="button" onClick={() => renderer.current?.focusWall(index)}>Go to {index === 0 ? 'left' : 'right'} wall</button>)}
            </div>
            <details className="warehouse-values">
              <summary>Exact values & model scales</summary>
              <dl>{zones.map(zone => <div key={zone.key}><dt>{zone.label}</dt><dd>{valueLabel(numeric(zone.points.find(point => point.date === date), zone.key), zone.unit)}<small>One {zone.model}: up to {valueLabel(zone.capacity, zone.unit)}</small></dd></div>)}</dl>
              <p>Piles use separate fixed scales, rounded up to eight models. Negative values show deficits or decreases. People represent events, not headcount. Truck travel illustrates saved receipt dates.</p>
            </details>
          </div>
        </details>
      </aside>
      <div className="warehouse-walk-hint">
        <span>{walk.hint}</span>
        {!walk.locked && <button type="button" onClick={() => renderer.current?.enter()}>Enter mouse look</button>}
      </div>
      <div className="warehouse-movement" role="group" aria-label="Movement controls">
        {movementButton('ArrowLeft', 'Turn left', '↶')}
        {movementButton('KeyW', 'Move forward', '↑')}
        {movementButton('ArrowRight', 'Turn right', '↷')}
        {movementButton('KeyA', 'Move left', '←')}
        {movementButton('KeyS', 'Move backward', '↓')}
        {movementButton('KeyD', 'Move right', '→')}
      </div>
      <footer className="warehouse-time">
        <div className="warehouse-time-heading">
          <div><strong>{date}</strong><span>Day {playback.dates.length ? playback.index + 1 : 0} / {playback.dates.length}</span></div>
          <p className="warehouse-events" title={events.map(event => event.label).join(' · ')}>{events.length ? `${events[0].label}${events.length > 1 ? ` +${events.length - 1} events` : ''}` : 'No dated events'}</p>
          <p className="warehouse-status" role="status">{status}</p>
        </div>
        <div className="warehouse-time-controls" role="group" aria-label="Warehouse time controls">
          <button type="button" aria-label="Previous date" disabled={!playback.index} onClick={() => playback.select(playback.index - 1)}>‹</button>
          <button type="button" className="warehouse-play" disabled={playback.dates.length < 2} aria-label={playback.playing ? 'Pause playback' : playback.index >= playback.last ? 'Replay from start' : 'Play playback'} onClick={playback.toggle}>{playback.playing ? 'Pause' : playback.index >= playback.last ? 'Replay' : 'Play'}</button>
          <button type="button" aria-label="Next date" disabled={playback.index >= playback.last} onClick={() => playback.select(playback.index + 1)}>›</button>
          <input aria-label="Playback date" type="range" min={0} max={playback.last} value={playback.index} disabled={playback.dates.length < 2} aria-valuetext={`${date}, day ${playback.index + 1} of ${playback.dates.length}`} onChange={event => playback.select(Number(event.target.value))} />
          <label className="warehouse-speed">Speed<select aria-label="Playback speed" value={playback.speed} onChange={event => playback.setSpeed(Number(event.target.value))}>{[0.5, 1, 2].map(speed => <option key={speed} value={speed}>{speed}×</option>)}</select></label>
        </div>
      </footer>
    </div>
  )
}
