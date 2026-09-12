import { createContext, useContext } from 'react'
import type { WorkspaceRole } from '../lib/workspace-api'

export type AccessModule =
  | 'inventory'
  | 'finance'
  | 'suppliers'
  | 'sales'
  | 'settings'
  | 'analysis'
export function canEditModule(
  role: WorkspaceRole,
  module: AccessModule,
): boolean {
  if (role === 'administrator' || role === 'owner') return true
  if (module === 'analysis') return role !== 'viewer'
  if (role === 'finance') return module === 'finance'
  if (role === 'inventory') return module === 'inventory'
  if (role === 'buyer') return module === 'suppliers'
  return false
}
export const WorkspaceAccessContext =
  createContext<WorkspaceRole>('administrator')
export function useWorkspaceAccess() {
  const role = useContext(WorkspaceAccessContext)
  return {
    role,
    canEdit: (module: AccessModule) => canEditModule(role, module),
  }
}
