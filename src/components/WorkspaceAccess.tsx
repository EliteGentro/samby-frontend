import { useEffect, useState, type FormEvent } from 'react'
import { ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import type { Workspace } from '../domain/workspace'
import {
  platformRequest,
  type WorkspaceRole,
  type WorkspaceSummary,
} from '../lib/workspace-api'
import { Modal, Panel } from './workspace-ui'
import { SortableTable } from './SortableTable'

type Member = {
  user_id: string
  email: string
  name: string | null
  role: WorkspaceRole
}
const roles: WorkspaceRole[] = [
  'administrator',
  'owner',
  'finance',
  'inventory',
  'buyer',
  'viewer',
]
const roleDescriptions: Record<WorkspaceRole, string> = {
  administrator: 'Manage all business records, analyses and team access.',
  owner: 'Manage all business records, analyses and team access.',
  finance: 'Maintain financial records and run analyses.',
  inventory: 'Maintain inventory records and run analyses.',
  buyer: 'Maintain suppliers and purchases and run analyses.',
  viewer: 'Read the workspace and saved results.',
}

export function WorkspaceAccess({
  workspace,
  role,
  onSelectWorkspace,
}: {
  workspace: Workspace
  role: WorkspaceRole
  onSelectWorkspace: (id: string) => Promise<void>
}) {
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [options, setOptions] = useState<WorkspaceSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [remove, setRemove] = useState<Member | null>(null)
  const [selectedRole, setSelectedRole] = useState<WorkspaceRole>('viewer')
  const [refresh, setRefresh] = useState(0)
  const canManage = role === 'administrator' || role === 'owner'
  useEffect(() => {
    if (!user) return
    let active = true
    Promise.all([
      platformRequest<WorkspaceSummary[]>('/workspaces'),
      canManage && workspace.mode === 'business'
        ? platformRequest<Member[]>(
            `/workspaces/${workspace.id}/members`,
            {},
            workspace.id,
          )
        : Promise.resolve([]),
    ])
      .then(([workspaces, people]) => {
        if (active) {
          setOptions(workspaces)
          setMembers(people)
          setError(null)
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Unable to load workspace access.',
          )
      })
    return () => {
      active = false
    }
  }, [user, workspace.id, workspace.mode, canManage, refresh])

  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true)
    setError(null)
    try {
      await platformRequest(
        `/workspaces/${workspace.id}/members${path}`,
        { method, body: body ? JSON.stringify(body) : undefined },
        workspace.id,
      )
      setRefresh((value) => value + 1)
      setNotice('Workspace access updated.')
      return true
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'The access change could not be saved.',
      )
      return false
    } finally {
      setBusy(false)
    }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    if (
      await mutate('', 'POST', {
        email: String(values.get('email')).trim(),
        role: selectedRole,
      })
    )
      form.reset()
  }

  return (
    <Panel
      title="Workspace access"
      subtitle="Team permissions are checked by the server for each request."
    >
      <div className="panel-body stack">
        <div className="access-summary">
          <ShieldCheck size={21} />
          <div>
            <strong>{role[0].toUpperCase() + role.slice(1)}</strong>
            <p className="small muted">{roleDescriptions[role]}</p>
          </div>
        </div>
        {!user ? (
          <p className="notice">
            This workspace is saved with a private device key. Create an account
            above to retain access across devices and manage your team.
          </p>
        ) : (
          <>
            {options.filter((option) => option.mode === 'business').length >
              1 && (
              <label className="field">
                Business workspace
                <SelectField
                  value={workspace.id}
                  disabled={busy}
                  onChange={(event) =>
                    void onSelectWorkspace(event.target.value)
                  }
                >
                  {options
                    .filter((option) => option.mode === 'business')
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name || 'Unnamed business'} · {option.role}
                      </option>
                    ))}
                </SelectField>
              </label>
            )}
            {workspace.mode === 'demo' ? (
              <p className="notice">
                The demonstration workspace has its own device access. Switch to
                your business workspace to manage your team.
              </p>
            ) : (
              <>
                {members.length > 0 && (
                  <div className="table-wrap">
                    <SortableTable
                      className="data-table"
                      defaultOpen
                      tableLabel="Workspace members"
                    >
                      <thead>
                        <tr>
                          <th scope="col">Member</th>
                          <th scope="col">Role</th>
                          <th scope="col">Access</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member) => (
                          <tr key={member.user_id}>
                            <td>
                              <strong>{member.name || member.email}</strong>
                              {member.name && (
                                <small className="muted">{member.email}</small>
                              )}
                              {member.user_id === user.id && (
                                <span className="tag">You</span>
                              )}
                            </td>
                            <td>
                              {canManage ? (
                                <SelectField
                                  aria-label={`Role for ${member.email}`}
                                  value={member.role}
                                  disabled={busy}
                                  onChange={(event) =>
                                    void mutate(`/${member.user_id}`, 'PATCH', {
                                      role: event.target.value,
                                    })
                                  }
                                >
                                  {roles.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </SelectField>
                              ) : (
                                member.role
                              )}
                            </td>
                            <td>
                              {canManage && member.user_id !== user.id && (
                                <button
                                  className="button secondary"
                                  disabled={busy}
                                  onClick={() => setRemove(member)}
                                >
                                  Remove access
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </SortableTable>
                  </div>
                )}
                {canManage && (
                  <form
                    onSubmit={(event) => void addMember(event)}
                    className="stack"
                  >
                    <h3>
                      <Users size={17} /> Add a team member
                    </h3>
                    <p className="small muted">
                      Enter the email of an existing SAMBY account. This grants
                      access immediately and does not send an email.
                    </p>
                    <div className="access-form">
                      <label className="field">
                        Account email
                        <input
                          name="email"
                          type="email"
                          autoComplete="off"
                          required
                          disabled={busy}
                        />
                      </label>
                      <label className="field">
                        Role
                        <SelectField
                          value={selectedRole}
                          onChange={(event) =>
                            setSelectedRole(event.target.value as WorkspaceRole)
                          }
                          disabled={busy}
                        >
                          {roles.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </SelectField>
                      </label>
                      <button className="button" type="submit" disabled={busy}>
                        {busy ? 'Saving…' : 'Grant access'}
                      </button>
                    </div>
                    <p className="small muted">
                      {roleDescriptions[selectedRole]}
                    </p>
                  </form>
                )}
              </>
            )}
          </>
        )}
        {error && (
          <div role="alert" className="notice danger">
            {error}{' '}
            <button
              className="text-button"
              onClick={() => setRefresh((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        )}
        {notice && (
          <p role="status" className="small">
            {notice}
          </p>
        )}
      </div>
      <Modal
        open={remove !== null}
        onClose={() => setRemove(null)}
        title="Remove workspace access?"
        description={`${remove?.email ?? 'This member'} will lose access to this workspace. Their account and saved business history will remain.`}
      >
        <div className="button-row">
          <button className="button secondary" onClick={() => setRemove(null)}>
            Cancel
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              if (remove && (await mutate(`/${remove.user_id}`, 'DELETE')))
                setRemove(null)
            }}
          >
            Remove access
          </button>
        </div>
      </Modal>
    </Panel>
  )
}
import { SelectField } from './ui/select-field'
