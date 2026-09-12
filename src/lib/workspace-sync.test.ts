import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { emptyWorkspace } from '../domain/workspace'
import { WorkspaceSync } from './workspace-sync'
import { ACCOUNT_TOKEN_KEY, workspaceHeaders } from './workspace-api'

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

test('new workspaces are privately registered and current records load from the server in a fresh session', async () => {
  const workspace = emptyWorkspace('business-one')
  let saved = {
    ...workspace,
    profile: { ...workspace.profile, name: 'Durable business' },
  }
  const fetch = vi
    .fn()
    .mockImplementationOnce(() => json({ detail: 'Not found' }, 404))
    .mockImplementationOnce((_url, init) => {
      expect(new Headers(init.headers).get('X-Workspace-Key')).toMatch(
        /^[0-9a-f]{64}$/,
      )
      return json({ workspace, revision: 0, role: 'administrator' })
    })
    .mockImplementationOnce((_url, init) => {
      const body = JSON.parse(init.body)
      expect(body.expected_revision).toBe(0)
      saved = { ...body.workspace, revision: 1 }
      return json({ workspace: saved, revision: 1, role: 'administrator' })
    })
    .mockImplementationOnce(() =>
      json({ workspace: saved, revision: 1, role: 'administrator' }),
    )
  vi.stubGlobal('fetch', fetch)
  const first = new WorkspaceSync(workspace)
  await first.connect()
  first.update(saved)
  await first.flush()
  expect(first.snapshot().phase).toBe('saved')
  sessionStorage.clear()
  const reopened = new WorkspaceSync(workspace)
  await reopened.connect()
  expect(reopened.snapshot().workspace.profile.name).toBe('Durable business')
  expect(reopened.snapshot().workspace.revision).toBe(1)
  expect(localStorage.getItem('samby.draft.business-one')).toBeNull()
})

test('overlapping edits save in revision order and keep the most recent edit', async () => {
  const workspace = emptyWorkspace('serial')
  let release!: (response: Response) => void
  const fetch = vi
    .fn()
    .mockImplementationOnce(() =>
      json({ workspace, revision: 4, role: 'owner' }),
    )
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve
        }),
    )
    .mockImplementationOnce((_url, init) => {
      const body = JSON.parse(init.body)
      expect(body.expected_revision).toBe(5)
      expect(body.workspace.profile.name).toBe('Second edit')
      return json({
        workspace: { ...body.workspace, revision: 6 },
        revision: 6,
        role: 'owner',
      })
    })
  vi.stubGlobal('fetch', fetch)
  const sync = new WorkspaceSync(workspace)
  await sync.connect()
  const first = {
    ...workspace,
    profile: { ...workspace.profile, name: 'First edit' },
  }
  sync.update(first)
  sync.update({
    ...workspace,
    profile: { ...workspace.profile, name: 'Second edit' },
  })
  release(
    new Response(
      JSON.stringify({
        workspace: { ...first, revision: 5 },
        revision: 5,
        role: 'owner',
      }),
    ),
  )
  await sync.flush()
  expect(sync.snapshot().workspace.profile.name).toBe('Second edit')
  expect(sync.snapshot().phase).toBe('saved')
  expect(fetch).toHaveBeenCalledTimes(3)
})

test('revision conflicts preserve the local draft and never silently overwrite server records', async () => {
  const workspace = emptyWorkspace('conflicting')
  const fetch = vi
    .fn()
    .mockImplementationOnce(() =>
      json({ workspace, revision: 2, role: 'owner' }),
    )
    .mockImplementationOnce(() =>
      json({ detail: 'A newer version exists.' }, 409),
    )
  vi.stubGlobal('fetch', fetch)
  const sync = new WorkspaceSync(workspace)
  await sync.connect()
  sync.update({
    ...workspace,
    profile: { ...workspace.profile, name: 'My unsaved edit' },
  })
  await sync.flush()
  expect(sync.snapshot().phase).toBe('conflict')
  expect(
    JSON.parse(localStorage.getItem('samby.draft.conflicting')!).workspace
      .profile.name,
  ).toBe('My unsaved edit')
  await sync.retry()
  expect(fetch).toHaveBeenCalledTimes(2)
  await sync.connect()
  await sync.flush()
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(sync.snapshot().phase).toBe('conflict')
  expect(sync.snapshot().workspace.profile.name).toBe('My unsaved edit')
})

test('offline edits survive a reload and do not overwrite a newer remote revision', async () => {
  const workspace = emptyWorkspace('offline')
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementationOnce(() =>
        json({ workspace, revision: 3, role: 'owner' }),
      )
      .mockRejectedValue(new TypeError('offline')),
  )
  const sync = new WorkspaceSync(workspace)
  await sync.connect()
  sync.update({
    ...workspace,
    profile: { ...workspace.profile, name: 'Offline edit' },
  })
  await sync.flush()
  expect(sync.snapshot().phase).toBe('offline')
  vi.stubGlobal(
    'fetch',
    vi.fn(() => json({ workspace, revision: 4, role: 'owner' })),
  )
  const restored = new WorkspaceSync(workspace)
  await restored.connect()
  expect(restored.snapshot().phase).toBe('conflict')
  expect(restored.snapshot().workspace.profile.name).toBe('Offline edit')
})

test('viewer edits are rejected locally and account credentials are included separately from workspace identity', async () => {
  const workspace = emptyWorkspace('viewer')
  const fetch = vi.fn(() => json({ workspace, revision: 0, role: 'viewer' }))
  vi.stubGlobal('fetch', fetch)
  const sync = new WorkspaceSync(workspace)
  await sync.connect()
  sync.update({
    ...workspace,
    profile: { ...workspace.profile, name: 'Unauthorized edit' },
  })
  expect(sync.snapshot().workspace.profile.name).toBe(workspace.profile.name)
  expect(fetch).toHaveBeenCalledTimes(1)
  localStorage.setItem(ACCOUNT_TOKEN_KEY, 'account-secret')
  expect(workspaceHeaders('viewer').get('Authorization')).toBe(
    'Bearer account-secret',
  )
  expect(workspaceHeaders('viewer').get('X-Workspace-ID')).toBe('viewer')
})
