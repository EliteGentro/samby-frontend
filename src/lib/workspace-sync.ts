import type { Workspace } from '../domain/workspace'
import {
  createWorkspaceKey,
  PlatformError,
  platformRequest,
  type WorkspaceEnvelope,
  type WorkspaceRole,
} from './workspace-api'

export type SyncState = {
  workspace: Workspace
  phase: 'loading' | 'saved' | 'saving' | 'offline' | 'conflict'
  role: WorkspaceRole
  error: string | null
  ready: boolean
}

type Draft = { workspace: Workspace; baseRevision: number | null }

export class WorkspaceSync {
  private state: SyncState
  private revision: number | null = null
  private pending: Workspace | null = null
  private running: Promise<void> | null = null
  private listeners = new Set<() => void>()
  private initialDraft: Draft | null = null

  constructor(workspace: Workspace) {
    this.state = {
      workspace,
      phase: 'loading',
      role: 'administrator',
      error: null,
      ready: false,
    }
    try {
      const value = localStorage.getItem(`samby.draft.${workspace.id}`)
      if (value) {
        const draft = JSON.parse(value) as Draft
        if (
          draft.workspace.id === workspace.id &&
          draft.workspace.mode === workspace.mode
        ) {
          this.initialDraft = draft
          this.state.workspace = draft.workspace
        }
      }
    } catch {
      this.initialDraft = null
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  snapshot = () => this.state

  private publish(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch }
    try {
      sessionStorage.setItem(
        `samby.workspace.${this.state.workspace.mode}`,
        JSON.stringify(this.state.workspace),
      )
      localStorage.setItem(
        `samby.workspace-id.${this.state.workspace.mode}`,
        this.state.workspace.id,
      )
    } catch {
      this.state = {
        ...this.state,
        error:
          'Device storage is full. Export your records before closing this page.',
      }
    }
    this.listeners.forEach((listener) => listener())
  }

  private keepDraft(workspace: Workspace) {
    try {
      localStorage.setItem(
        `samby.draft.${workspace.id}`,
        JSON.stringify({
          workspace,
          baseRevision: this.revision,
        } satisfies Draft),
      )
    } catch {
      this.publish({
        error:
          'Device storage is full. Export your unsaved records before closing this page.',
      })
    }
  }

  update = (workspace: Workspace) => {
    if (workspace.id !== this.state.workspace.id)
      throw new Error('A save cannot change workspace identity.')
    if (this.state.role === 'viewer') {
      this.publish({
        error: 'Your role can view this workspace but cannot change records.',
      })
      return
    }
    this.pending = workspace
    this.keepDraft(workspace)
    this.publish({
      workspace,
      phase: this.state.phase === 'conflict' ? 'conflict' : 'saving',
    })
    if (this.state.phase !== 'conflict') void this.flush()
  }

  connect = (): Promise<void> => {
    if (this.running) return this.running
    if (this.state.ready) return this.flush()
    this.running = this.open().finally(() => {
      this.running = null
    })
    return this.running
  }

  private async open() {
    const current = this.state.workspace
    try {
      createWorkspaceKey(current.id)
      let envelope: WorkspaceEnvelope
      try {
        envelope = await platformRequest<WorkspaceEnvelope>(
          `/workspaces/${current.id}`,
          {},
          current.id,
        )
      } catch (error) {
        if (!(error instanceof PlatformError) || error.status !== 404)
          throw error
        envelope = await platformRequest<WorkspaceEnvelope>(
          '/workspaces/guest',
          {
            method: 'POST',
            body: JSON.stringify({ workspace: current }),
          },
          current.id,
        )
      }
      this.revision = envelope.revision
      if (
        this.initialDraft &&
        this.initialDraft.baseRevision !== null &&
        this.initialDraft.baseRevision !== envelope.revision
      ) {
        this.pending = this.initialDraft.workspace
        this.initialDraft = null
        this.publish({
          ready: true,
          role: envelope.role,
          phase: 'conflict',
          error:
            'This workspace changed on another device. Export your draft before loading the saved version.',
        })
        return
      }
      this.pending ??= this.initialDraft?.workspace ?? null
      this.initialDraft = null
      this.publish({
        ready: true,
        workspace: this.pending ?? envelope.workspace,
        role: envelope.role,
        phase: this.pending ? 'saving' : 'saved',
        error: null,
      })
      await this.drain()
    } catch (error) {
      this.fail(error)
    }
  }

  private fail(error: unknown) {
    this.publish({
      phase:
        error instanceof PlatformError && error.status === 409
          ? 'conflict'
          : 'offline',
      error:
        error instanceof Error
          ? error.message
          : 'Unable to save this workspace. Your draft remains on this device.',
    })
  }

  private async drain(): Promise<void> {
    if (!this.pending || this.revision === null) return
    const next = this.pending
    this.pending = null
    try {
      const saved = await platformRequest<WorkspaceEnvelope>(
        `/workspaces/${next.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            workspace: next,
            expected_revision: this.revision,
          }),
        },
        next.id,
      )
      this.revision = saved.revision
      if (this.pending) this.keepDraft(this.pending)
      else localStorage.removeItem(`samby.draft.${next.id}`)
      this.publish({
        workspace: this.pending ?? saved.workspace,
        role: saved.role,
        phase: this.pending ? 'saving' : 'saved',
        error: null,
      })
    } catch (error) {
      this.pending ??= next
      this.keepDraft(this.pending)
      this.fail(error)
      return
    }
    // Each save must use the revision returned by its predecessor.
    return this.drain()
  }

  flush = (): Promise<void> => {
    if (this.running) return this.running
    if (this.state.phase === 'conflict') return Promise.resolve()
    if (this.revision === null) return this.connect()
    this.running = this.drain().finally(() => {
      this.running = null
    })
    return this.running
  }

  retry = async () => {
    if (this.state.phase === 'conflict') return
    this.publish({ phase: 'saving', error: null })
    if (this.revision === null) await this.connect()
    else await this.flush()
  }

  reload = async () => {
    try {
      const envelope = await platformRequest<WorkspaceEnvelope>(
        `/workspaces/${this.state.workspace.id}`,
        {},
        this.state.workspace.id,
      )
      this.pending = null
      this.initialDraft = null
      this.revision = envelope.revision
      localStorage.removeItem(`samby.draft.${envelope.workspace.id}`)
      this.publish({
        ready: true,
        workspace: envelope.workspace,
        role: envelope.role,
        phase: 'saved',
        error: null,
      })
    } catch (error) {
      this.fail(error)
    }
  }
}
