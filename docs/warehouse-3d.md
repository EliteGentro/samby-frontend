# Simulation warehouse game

Every completed simulation exposes **Open 3D warehouse**, a normal link with `target="_blank"` and `rel="noopener noreferrer"`. It opens the standalone `warehouse.html` Vite entry at the selected result date. The original result tab stays available.

The URL fragment carries workspace ID, run ID, mode and initial date; it contains no authentication credentials or serialized business records. On load or refresh, the game calls the existing authenticated `createAnalysisClient(workspaceId).getRun(runId)` endpoint. It never submits or recomputes a run. Missing IDs, denied access and incomplete runs show an error with a path back to the result page. Legacy completed runs and Explore outcomes do not need a supported scene manifest.

## Controls

- WASD: walk; Shift: run. Walking stays at eye level inside the room and slides around display piles.
- Mouse or arrow keys: look around. **Enter mouse look** requests pointer lock; drag-to-look and the on-screen movement pad work without it.
- Escape: release movement/mouse controls. R or **Entrance** returns to the entrance.
- Space: play/pause. Brackets: previous/next saved date. E: next wall-chart pair.
- The bottom bar offers previous/next, play/pause/replay, scrubbing and 0.5×/1×/2× speeds. Time starts paused at the launch date and runs independently from the original result tab. Tab blur or hiding pauses playback and clears movement.
- **Charts & controls** selects wall displays, offers shortcuts to the walls, and shows exact current values and model scales. **Fullscreen** is available where supported.

Keyboard game shortcuts only apply while the canvas has focus or owns pointer lock. They do not intercept inputs, selects or buttons in the time controls. Pointer/key listeners, animation frames, pointer lock, GPU resources and decoded image bitmaps are released on unmount.

## Modules

- `game-url.ts`, `WarehousePage.tsx`, `main.tsx`: launch URL, authenticated saved-run loading and standalone entry.
- `WarehouseView.tsx`, `use-game-playback.ts`: game HUD, accessible movement/time controls and local timeline state.
- `walk-controller.ts`, `player-motion.ts`: scoped keyboard, mouse and touch input; grounded, bounded, normalized movement and pile collisions.
- `scene-data.ts`: question-specific chart order, numeric measures, stable pile scales, dated people and deterministic receipt positions. Add metrics to `chartDefinitions` / `metricLabels` and question defaults to `questionCharts`.
- `warehouse-renderer.ts`: shared warehouse, GLB normalization, object placement and GPU lifecycle.
- `wall-chart.ts`: two reusable in-world chart textures, with missing-data gaps, negative values and a shared date marker.

## Data representations and limits

Boxes represent inventory quantities and flows; money represents balances and cash flows. Every zone has its measure identifier and exact dated value. Piles are capped at eight objects and scaled against their own peak magnitude across the run; counts are rounded up and must not be compared across different measures. Negative piles are labeled as deficits or decreases. Missing values are distinct from zero.

People represent dated customer or payroll events, never inferred headcount. Trucks illustrate saved receipt dates, approaching for the preceding five days and leaving the following day; their motion does not claim actual routes or supplier lead times. At most three nearby receipts and two people are drawn. The original event trace retains all events.

The supplied `public/3dmodels/{box,money,person,truck,road}.glb` remain unchanged. The road is a sampler; its `Material.002` asphalt tile is repeated along the supplier lane. Its original download is approximately 8 MB and happens only for runs containing receipts. Unused road materials are released after extracting the tile.

Three.js loads only in the game page. Shared geometry/materials, a 1.5 pixel-ratio cap and no shadows or postprocessing keep the scene modest. Camera frames run only during input; truck transitions run only during playback and respect reduced motion. Stationary, paused scenes do not have a continuous render loop. Failed assets retain labeled zones, and unavailable/lost WebGL directs users back to saved results.

## Verification

`npx vitest run src/features/analysis/warehouse src/features/analysis/analysis.test.tsx`

Coverage includes all nine questions, standalone GET/auth headers, missing IDs/access denial, launch date/new-tab attributes, playback/speed/replay, single-day results, collisions, normalized movement, blur/Escape cleanup, input focus and listener disposal. Build verification includes both HTML entries. Browser checks exercise the full-screen game using a saved demo simulation with inventory, cash and a dated supplier receipt.
