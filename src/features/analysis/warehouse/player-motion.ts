export type Obstacle = { x: number; z: number; halfWidth: number; halfDepth: number }
export type PlayerPosition = { x: number; z: number }
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n))

export function canStand(position: PlayerPosition, obstacles: Obstacle[]) {
  return !obstacles.some(box => Math.abs(position.x - box.x) < box.halfWidth + 0.3 && Math.abs(position.z - box.z) < box.halfDepth + 0.3)
}

/** Grounded movement, normalized diagonals and axis sliding around display piles. */
export function stepPlayer(position: PlayerPosition, yaw: number, forward: number, strafe: number, seconds: number, sprint: boolean, obstacles: Obstacle[]): PlayerPosition {
  const length = Math.max(1, Math.hypot(forward, strafe))
  const distance = (sprint ? 7 : 4) * Math.min(seconds, 0.05) / length
  const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * distance
  const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * distance
  const next = { ...position }
  const x = clamp(position.x + dx, -13.3, 13.3)
  if (canStand({ x, z: next.z }, obstacles)) next.x = x
  const z = clamp(position.z + dz, -10.2, 10.3)
  if (canStand({ x: next.x, z }, obstacles)) next.z = z
  return next
}
