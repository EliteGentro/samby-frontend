import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createWalkController, type WalkCallbacks } from './walk-controller'
import type { Obstacle } from './player-motion'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { canvasSurface, drawWallChart } from './wall-chart'
import { buildSceneData, deliveryPosition, floorZones, numeric, peopleAtDate, pileCount, valueLabel, type ModelId, type SavedSimulation, type WallChart } from './scene-data'

type Disposable = { dispose: () => void }
export type WarehouseFrame = { date: string; charts: WallChart[]; playing: boolean }
export function createWarehouse(host: HTMLDivElement, run: SavedSimulation, onStatus: (message: string) => void, callbacks: WalkCallbacks) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.setClearColor('#e8eeec')
  renderer.domElement.setAttribute('aria-label', '3D warehouse with saved simulation values and wall charts')
  renderer.domElement.setAttribute('role', 'img')
  host.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(68, 1, 0.08, 120)
  const resources = new Set<Disposable>()
  const temporary = new Set<Disposable>()
  const own = <T extends Disposable>(item: T, transient = false): T => { (transient ? temporary : resources).add(item); return item }
  let disposed = false, visible = true, contextUnavailable = false, raf = 0
  const render = () => { if (!disposed && !contextUnavailable && visible && !document.hidden) renderer.render(scene, camera) }
  const walk = createWalkController(camera, renderer.domElement, render, callbacks)
  const resize = () => {
    const { width, height } = host.getBoundingClientRect()
    if (!width || !height) return
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix(); render()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  const intersectionObserver = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting
    if (!visible) { cancelAnimationFrame(raf); walk.stop() }
    else render()
  })
  intersectionObserver.observe(host)
  const visibilityChanged = () => { if (document.hidden) cancelAnimationFrame(raf); else render() }
  document.addEventListener('visibilitychange', visibilityChanged)
  const contextLost = (event: Event) => { event.preventDefault(); contextUnavailable = true; cancelAnimationFrame(raf); walk.release(); callbacks.onAction('pause'); onStatus('3D graphics were interrupted. Reload this tab to retry, or return to the saved results.') }
  renderer.domElement.addEventListener('webglcontextlost', contextLost)

  const cube = own(new THREE.BoxGeometry(1, 1, 1))
  function block(parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], color: string, transient = false) {
    const material = own(new THREE.MeshLambertMaterial({ color }), transient)
    const mesh = new THREE.Mesh(cube, material)
    mesh.scale.set(...size); mesh.position.set(...position); parent.add(mesh)
    return mesh
  }
  scene.add(new THREE.HemisphereLight('#f3fbff', '#75867d', 2.4))
  const light = new THREE.DirectionalLight('#fff5e4', 2.1)
  light.position.set(6, 15, 10); scene.add(light)
  block(scene, [28, 0.3, 23], [0, -0.2, 0], '#c4cec7')
  block(scene, [28, 0.2, 23], [0, 8.1, 0], '#e4ebe6')
  for (const x of [-8, 0, 8]) block(scene, [0.55, 0.08, 9], [x, 7.95, -1], '#f8fffc')
  block(scene, [28, 8, 0.3], [0, 3.9, -11.5], '#d6ddda')
  block(scene, [0.3, 8, 23], [-14, 3.9, 0], '#d6ddda')
  // A full room surrounds the player; the entrance faces the supplier lane.
  block(scene, [0.3, 8, 23], [14, 3.9, 0], '#b7c4bf')
  block(scene, [10, 8, 0.3], [-9, 3.9, 11.5], '#d6ddda')
  block(scene, [10, 8, 0.3], [9, 3.9, 11.5], '#d6ddda')
  block(scene, [8, 2.5, 0.3], [0, 6.7, 11.5], '#758e87')
  for (let x = -12; x <= 12; x += 4) block(scene, [0.025, 0.01, 23], [x, -0.04, 0], '#a8b8af')
  for (let z = -10; z <= 10; z += 4) block(scene, [28, 0.01, 0.025], [0, -0.04, z], '#a8b8af')
  for (const x of [-13.6, 0, 13.6]) block(scene, [0.18, 8.1, 0.32], [x, 4, -11.2], '#758e87')
  block(scene, [28, 0.22, 0.36], [0, 8, -11.2], '#758e87')
  const boards = [-6.7, 6.7].map(x => {
    block(scene, [12.5, 6.4, 0.22], [x, 4.5, -11.12], '#263d44')
    const surface = canvasSurface(1024, 576)
    own(surface.texture)
    const material = own(new THREE.MeshBasicMaterial({ map: surface.texture }))
    const mesh = new THREE.Mesh(own(new THREE.PlaneGeometry(12.1, 6.0)), material)
    mesh.position.set(x, 4.5, -10.98); scene.add(mesh)
    return surface
  })
  const dynamic = new THREE.Group(); scene.add(dynamic)
  const models = new Map<ModelId, THREE.Group>()
  const pending = new Set<ModelId>(), failed = new Set<ModelId>()
  const { receipts, unit } = buildSceneData(run)
  let frame: WarehouseFrame | null = null
  function modelResources(root: THREE.Object3D) {
    const items = new Set<Disposable>()
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      items.add(object.geometry)
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        items.add(material)
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) items.add(value)
      }
      if (object instanceof THREE.SkinnedMesh) items.add(object.skeleton)
    })
    return items
  }
  function release(item: Disposable) {
    item.dispose()
    if (item instanceof THREE.Texture && typeof ImageBitmap !== 'undefined' && item.image instanceof ImageBitmap) item.image.close()
  }
  const status = () => {
    if (contextUnavailable) return
    onStatus(failed.size ? `Could not load ${[...failed].join(', ')} models. Their labeled zones and saved values are still available.` : pending.size ? 'Loading warehouse models…' : 'Warehouse ready')
  }
  function requestModel(id: ModelId) {
    if (models.has(id) || pending.has(id) || failed.has(id)) return
    pending.add(id); status()
    new GLTFLoader().load(`${import.meta.env.BASE_URL}3dmodels/${id}.glb`, gltf => {
      if (disposed) { modelResources(gltf.scene).forEach(release); return }
      // Center and ground models with different authoring origins and units.
      gltf.scene.updateMatrixWorld(true)
      let root: THREE.Object3D = gltf.scene
      if (id === 'road') {
        // road.glb is a sampler of seven surfaces. Reuse its marked asphalt tile.
        gltf.scene.traverse(object => {
          if (object instanceof THREE.Mesh && !Array.isArray(object.material) && object.material.name === 'Material.002') {
            const tile = object.clone()
            tile.applyMatrix4(object.matrixWorld)
            root = new THREE.Group().add(tile)
          }
        })
      }
      const retained = modelResources(root)
      modelResources(gltf.scene).forEach(item => {
        if (retained.has(item)) own(item)
        else release(item)
      })
      root.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(root)
      const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3())
      const target = id === 'person' ? 1.9 : id === 'truck' ? 3.8 : id === 'road' ? 6 : 1.1
      const scale = target / Math.max(size.x, size.y, size.z, 0.001)
      root.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z))
      const normalized = new THREE.Group(); normalized.add(root); normalized.scale.setScalar(scale); normalized.userData.stackHeight = size.y * scale
      // Align the marked road tile with the supplier lane.
      if (id === 'road') {
        if (size.z > size.x) normalized.rotation.y = Math.PI / 2
        normalized.scale.y = Math.min(scale, 0.08 / Math.max(size.y, 0.001))
      }
      models.set(id, normalized); pending.delete(id); status()
      if (frame) update(frame)
    }, undefined, () => {
      if (disposed) return
      pending.delete(id); failed.add(id); status(); render()
    })
  }
  function place(id: ModelId, parent: THREE.Object3D, position: [number, number, number]) {
    const template = models.get(id)
    if (!template) { requestModel(id); return null }
    const object = clone(template)
    // SkeletonUtils creates private skeletons; keep their disposal scoped to this frame.
    object.traverse(child => { if (child instanceof THREE.SkinnedMesh) own(child.skeleton, true) })
    object.position.set(...position); parent.add(object); return object
  }
  function label(parent: THREE.Object3D, lines: string[], position: [number, number, number], color = '#c5e5dc', width = 4.2) {
    const surface = canvasSurface(640, 192), ctx = surface.context
    ctx.fillStyle = '#183039'; ctx.fillRect(0, 0, 640, 192)
    ctx.fillStyle = color; ctx.fillRect(0, 0, 640, 7)
    lines.forEach((text, i) => {
      ctx.fillStyle = i === 1 ? '#ffffff' : color
      ctx.font = `${i === 1 ? '600 32' : '24'}px sans-serif`
      ctx.fillText(text, 18, 45 + i * 56, 604)
    })
    surface.texture.needsUpdate = true; own(surface.texture, true)
    const sprite = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: surface.texture, depthTest: true }), true))
    sprite.scale.set(width, width * 0.3, 1); sprite.position.set(...position); parent.add(sprite)
  }
  let lastTrucks = new Map<string, number>()
  function update(next: WarehouseFrame) {
    if (disposed || contextUnavailable) return
    frame = next
    cancelAnimationFrame(raf)
    dynamic.clear(); temporary.forEach(item => item.dispose()); temporary.clear()
    boards.forEach((surface, index) => drawWallChart(surface, next.charts[index], next.date))
    const zones = floorZones(next.charts)
    const obstacles: Obstacle[] = []
    zones.forEach((zone, index) => {
      const x = (index % 3 - 1) * 8, z = Math.floor(index / 3) * 5 - 5
      const group = new THREE.Group(); group.position.set(x, 0, z); dynamic.add(group)
      block(group, [6.4, 0.12, 3.6], [0, 0.03, 0], zone.color, true)
      const value = numeric(zone.points.find(point => point.date === next.date), zone.key)
      const count = pileCount(value, zone.capacity)
      if (count) obstacles.push({ x, z, halfWidth: 2.4, halfDepth: 0.65 })
      for (let i = 0; i < count; i++) place(zone.model, group, [(i % 4 - 1.5) * 1.15, 0.11 + Math.floor(i / 4) * (models.get(zone.model)?.userData.stackHeight ?? 1.1), 0])
      const sign = value !== null && value < 0 ? '− ' : ''
      label(group, [`${sign}${zone.key.toUpperCase()}`, valueLabel(value, zone.unit), `${zone.label}${sign ? ' · negative' : ''}`], [0, 2.7, 0.4], value !== null && value < 0 ? '#ff9caa' : zone.color, 5.5)
    })
    walk.setObstacles(obstacles)
    const truckMoves: { object: THREE.Object3D; from: number; to: number }[] = []
    const currentTrucks = new Map<string, number>()
    if (receipts.length) {
      block(dynamic, [26, 0.04, 3.8], [0, 0.01, 7.5], '#536569', true)
      for (const x of [-9, -3, 3, 9]) place('road', dynamic, [x, 0.05, 7.5])
      const activeReceipts = receipts.filter(receipt => deliveryPosition(receipt, next.date).visible).slice(0, 3)
      activeReceipts.forEach((receipt, index) => {
        const state = deliveryPosition(receipt, next.date)
        const group = new THREE.Group(); group.position.set(state.x, 0.14, 6.5 + index); dynamic.add(group)
        const truck = place('truck', group, [0, 0, 0])
        if (truck) truck.rotation.y = -Math.PI / 2
        const purchase = run.snapshot.purchases.find(p => p.id === receipt.source_id)
        const supplier = run.snapshot.suppliers.find(s => s.id === purchase?.supplierId)
        label(group, [supplier?.name ?? 'Supplier receipt', valueLabel(receipt.quantity ?? null, unit), `${receipt.source_id ?? receipt.id} · ${receipt.date}`], [0, 2.7 + index * 0.8, 0], '#e4ae54', 4.6)
        currentTrucks.set(receipt.id, state.x)
        const from = lastTrucks.get(receipt.id) ?? state.x
        if (next.playing && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && from !== state.x) {
          group.position.x = from; truckMoves.push({ object: group, from, to: state.x })
        }
      })
      if (!activeReceipts.length) label(dynamic, ['SUPPLIER LANE', 'No nearby dated receipts', `${receipts.length} receipts in saved trace`], [0, 1.3, 7.5], '#e4ae54', 5)
    }
    lastTrucks = currentTrucks
    peopleAtDate(run, next.date).forEach((person, index) => {
      place('person', dynamic, [-10 + index * 7, 0.05, 3.5])
      label(dynamic, [person.label, person.detail, 'Represents an event, not headcount'], [-10 + index * 7, 2.9, 3.5], '#a9c3e9', 4.8)
    })
    render()
    if (truckMoves.length && visible && !document.hidden) {
      const start = performance.now()
      const animate = (time: number) => {
        if (disposed || !visible || document.hidden) return
        const t = Math.min(1, (time - start) / 180)
        truckMoves.forEach(({ object, from, to }) => { object.position.x = from + (to - from) * t })
        render()
        if (t < 1) raf = requestAnimationFrame(animate)
      }
      raf = requestAnimationFrame(animate)
    }
    status()
  }
  resize(); walk.reset()
  return {
    update,
    enter: walk.enter,
    release: walk.release,
    move: walk.move,
    resetCamera: walk.reset,
    focusWall: walk.focusWall,
    dispose: () => {
      disposed = true; cancelAnimationFrame(raf)
      resizeObserver.disconnect(); intersectionObserver.disconnect(); walk.dispose()
      document.removeEventListener('visibilitychange', visibilityChanged)
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      temporary.forEach(release); resources.forEach(release)
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove()
    },
  }
}
