import { expect, test } from 'vitest'
import { canStand, stepPlayer } from './player-motion'

test('movement follows facing direction and diagonals do not travel faster', () => {
  const origin = { x: 0, z: 0 }
  const forward = stepPlayer(origin, 0, 1, 0, 0.05, false, [])
  const diagonal = stepPlayer(origin, 0, 1, 1, 0.05, false, [])
  expect(forward.z).toBeLessThan(0)
  expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(Math.hypot(forward.x, forward.z))
  expect(stepPlayer(origin, Math.PI / 2, 1, 0, 0.05, false, []).x).toBeLessThan(0)
})

test('players stay inside walls and slide along display piles without tunneling', () => {
  const obstacles = [{ x: 0, z: 0, halfWidth: 2.4, halfDepth: 0.65 }]
  const next = stepPlayer({ x: 0, z: 1 }, 0, 1, 1, 5, true, obstacles)
  expect(canStand(next, obstacles)).toBe(true)
  expect(next.x).toBeGreaterThan(0)
  expect(next.z).toBe(1)
  const edge = stepPlayer({ x: 13.3, z: -10.2 }, 0, 1, 1, 5, true, [])
  expect(edge).toEqual({ x: 13.3, z: -10.2 })
})
