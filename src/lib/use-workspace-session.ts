import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  demoWorkspace,
  emptyWorkspace,
  type Mode,
  type Workspace,
} from '../domain/workspace'
import { WorkspaceSync } from './workspace-sync'
import {
  ACCOUNT_TOKEN_KEY,
  platformRequest,
  type WorkspaceEnvelope,
  type WorkspaceSummary,
} from './workspace-api'

function loadWorkspace(mode: Mode) {
  const idKey = `samby.workspace-id.${mode}`
  let id = localStorage.getItem(idKey)
  if (
    mode === 'business' &&
    id &&
    localStorage.getItem(`samby.owner.${id}`) &&
    !localStorage.getItem(ACCOUNT_TOKEN_KEY)
  ) {
    id = null
    sessionStorage.removeItem('samby.workspace.business')
  }
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(idKey, id)
  }
  try {
    const raw = sessionStorage.getItem(`samby.workspace.${mode}`)
    if (raw) {
      const value = JSON.parse(raw) as Workspace
      if (
        value.version === 1 &&
        value.id === id &&
        value.mode === mode &&
        [
          'products',
          'sales',
          'stock',
          'suppliers',
          'purchases',
          'finance',
          'commitments',
          'movements',
          'sources',
          'muted',
          'standardization',
        ].every((key) => Array.isArray(value[key as keyof Workspace])) &&
        value.profile &&
        value.notifications &&
        value.coverage &&
        value.onboarding
      )
        return value
    }
  } catch {
    sessionStorage.removeItem(`samby.workspace.${mode}`)
  }
  return mode === 'demo' ? demoWorkspace(id) : emptyWorkspace(id)
}

async function restoreAccountWorkspace(store: WorkspaceSync) {
  if (!store.snapshot().ready) await store.connect()
  await store.flush()
  if (store.snapshot().phase !== 'saved') {
    throw new Error(
      'Your account is signed in, but this device has an unsaved workspace draft. Resolve the save or export the draft, then reload to finish opening your account workspace.',
    )
  }
  const options = await platformRequest<WorkspaceSummary[]>('/workspaces')
  const current = store.snapshot().workspace
  const matching = options.find((option) => option.id === current.id)
  const existing =
    matching ?? options.find((option) => option.mode === 'business')
  let saved: WorkspaceEnvelope
  if (existing) {
    saved = await platformRequest<WorkspaceEnvelope>(
      `/workspaces/${existing.id}`,
      {},
      existing.id,
    )
  } else {
    saved = await platformRequest<WorkspaceEnvelope>(
      `/workspaces/${current.id}/claim`,
      { method: 'POST' },
      current.id,
    )
    localStorage.removeItem(`samby.workspace-key.${current.id}`)
  }
  return saved
}

export function useWorkspaceSession() {
  const [toast, setToast] = useState('')
  const auth = useAuth()
  const previousUser = useRef<string | null>(null)
  const [stores, setStores] = useState(() => ({
    business: new WorkspaceSync(loadWorkspace('business')),
    demo: new WorkspaceSync(loadWorkspace('demo')),
  }))
  const business = useSyncExternalStore(
    stores.business.subscribe,
    stores.business.snapshot,
  )
  const demo = useSyncExternalStore(stores.demo.subscribe, stores.demo.snapshot)
  const workspaces = { business: business.workspace, demo: demo.workspace }
  useEffect(() => {
    void stores.business.connect()
    void stores.demo.connect()
    const reconnect = () => {
      void stores.business.retry()
      void stores.demo.retry()
    }
    const protectDraft = (event: BeforeUnloadEvent) => {
      if (
        [stores.business, stores.demo].some((store) =>
          ['saving', 'conflict'].includes(store.snapshot().phase),
        )
      )
        event.preventDefault()
    }
    window.addEventListener('online', reconnect)
    window.addEventListener('beforeunload', protectDraft)
    return () => {
      window.removeEventListener('online', reconnect)
      window.removeEventListener('beforeunload', protectDraft)
    }
  }, [stores])
  useEffect(() => {
    if (auth.isLoading) return
    let cancelled = false
    if (!auth.user) {
      if (previousUser.current) {
        previousUser.current = null
        const workspace = emptyWorkspace(crypto.randomUUID())
        localStorage.setItem('samby.workspace-id.business', workspace.id)
        sessionStorage.removeItem('samby.workspace.business')
        const business = new WorkspaceSync(workspace)
        queueMicrotask(() => {
          if (cancelled) return
          setStores((current) => ({
            ...current,
            business,
          }))
        })
      }
      return () => {
        cancelled = true
      }
    }
    if (previousUser.current === auth.user.id) return
    const userId = auth.user.id
    async function restoreAccount() {
      try {
        const saved = await restoreAccountWorkspace(stores.business)
        if (cancelled) return
        previousUser.current = userId
        localStorage.setItem(`samby.owner.${saved.workspace.id}`, userId)
        localStorage.setItem('samby.workspace-id.business', saved.workspace.id)
        const business = new WorkspaceSync(saved.workspace)
        setStores((currentStores) => ({
          ...currentStores,
          business,
        }))
      } catch (error) {
        if (!cancelled)
          setToast(
            error instanceof Error
              ? error.message
              : 'Your account workspace could not be opened.',
          )
      }
    }
    void restoreAccount()
    return () => {
      cancelled = true
    }
  }, [auth.isLoading, auth.user, stores.business, setToast])
  const update = useCallback(
    (next: Workspace) => stores[next.mode].update(next),
    [stores],
  )
  async function selectWorkspace(id: string) {
    await stores.business.flush()
    if (stores.business.snapshot().phase !== 'saved') {
      setToast('Save or export your current draft before changing workspaces.')
      return
    }
    try {
      const saved = await platformRequest<WorkspaceEnvelope>(
        `/workspaces/${id}`,
        {},
        id,
      )
      if (auth.user) localStorage.setItem(`samby.owner.${id}`, auth.user.id)
      const business = new WorkspaceSync(saved.workspace)
      setStores((current) => ({
        ...current,
        business,
      }))
      location.hash = '/business/settings'
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : 'Cannot open this workspace.',
      )
    }
  }
  return {
    stores,
    business,
    demo,
    workspaces,
    update,
    selectWorkspace,
    toast,
    setToast,
  }
}
