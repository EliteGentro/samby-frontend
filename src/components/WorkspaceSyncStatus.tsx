import { useState } from 'react'
import { Check, CloudUpload, LoaderCircle } from 'lucide-react'
import type { WorkspaceSync, SyncState } from '../lib/workspace-sync'
import { downloadWorkspace } from '../lib/workspace-api'
import { Modal } from './workspace-ui'

export function WorkspaceSyncStatus({
  state,
  sync,
}: {
  state: SyncState
  sync: WorkspaceSync
}) {
  const [confirmReload, setConfirmReload] = useState(false)
  if (state.phase === 'saved' && !state.error)
    return (
      <p className="workspace-sync saved" role="status">
        <Check size={15} /> Saved to Samby
      </p>
    )
  if (state.phase === 'loading' || state.phase === 'saving')
    return (
      <p className="workspace-sync" role="status">
        <LoaderCircle size={15} className="sync-spinner" />
        {state.phase === 'loading'
          ? 'Connecting to your workspace…'
          : 'Saving changes…'}
      </p>
    )
  return (
    <>
      <div className="workspace-sync sync-error" role="alert">
        <CloudUpload size={18} />
        <div>
          <strong>
            {state.phase === 'conflict'
              ? 'A newer saved version needs review'
              : 'Changes are not yet saved to Samby'}
          </strong>
          <p>{state.error}</p>
        </div>
        <div className="button-row">
          <button
            className="button secondary"
            onClick={() => downloadWorkspace(state.workspace)}
          >
            Export my draft
          </button>
          {state.phase === 'conflict' ? (
            <button
              className="button secondary"
              onClick={() => setConfirmReload(true)}
            >
              Load saved version
            </button>
          ) : (
            <button className="button" onClick={() => void sync.retry()}>
              Retry connection
            </button>
          )}
        </div>
      </div>
      <Modal
        open={confirmReload}
        onClose={() => setConfirmReload(false)}
        title="Load the saved workspace?"
        description="This replaces your unsaved draft on this device. Export your draft first if you need to keep its changes."
      >
        <div className="button-row">
          <button
            className="button secondary"
            onClick={() => downloadWorkspace(state.workspace)}
          >
            Export my draft
          </button>
          <button
            className="button"
            onClick={() => {
              void sync.reload()
              setConfirmReload(false)
            }}
          >
            Load saved version
          </button>
        </div>
      </Modal>
    </>
  )
}
