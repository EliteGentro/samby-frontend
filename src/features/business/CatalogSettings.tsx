import { removeSourceRecords, sourceRecordCounts } from '../../domain/sources'
import { useWorkspaceAccess } from '../../components/workspace-access-context'
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import {
  Bell,
  Check,
  ChevronRight,
  Database,
  GitBranch,
  Layers,
  LockKeyhole,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  WandSparkles,
} from 'lucide-react'
import { DisclosureCard } from '../../components/ui/disclosure-card'
import {
  EmptyState,
  Modal,
  PageHeader,
  Panel,
} from '../../components/workspace-ui'
import {
  capabilities,
  catalogCapabilities,
  capabilityWarnings,
  canActivateCapability,
  emptyWorkspace,
  isCapabilityMuted,
  presentationKey,
  readiness,
  scopedCapabilityWorkspace,
  type Capability,
  type CapabilityScope,
} from '../../domain/workspace'
import { Standardization } from './Inventory'
import type { BusinessPageProps } from './Home'

export function Catalog({
  workspace: w,
  onChange,
  onIntake,
  onNavigate,
}: BusinessPageProps) {
  const { canEdit } = useWorkspaceAccess(),
    editable = canEdit('settings')
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('All capabilities')
  const [scope, setScope] = useState<CapabilityScope>({})
  const [selected, setSelected] = useState<Capability | null>(null),
    [mute, setMute] = useState<Capability | null>(null),
    [standardize, setStandardize] = useState(false)
  const invalidPeriod = Boolean(
    scope.startDate && scope.endDate && scope.startDate > scope.endDate,
  )
  const scoped = scopedCapabilityWorkspace(w, scope)
  const ready = (c: Capability) =>
    !invalidPeriod &&
    c.support !== 'unavailable' &&
    c.lifecycle !== 'retired' &&
    c.check(scoped, scope)
  const cards = catalogCapabilities.filter(
    (c) =>
      `${c.name} ${c.question} ${c.fields}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === 'All capabilities' ||
        (filter === 'Ready to use' && ready(c)) ||
        (filter === 'Needs data' && !ready(c) && !c.support) ||
        (filter === 'Muted' && isCapabilityMuted(c, w)) ||
        (filter === 'Unavailable or demo only' && c.support) ||
        (filter === 'Lifecycle' && c.lifecycle !== 'active')),
  )
  const readinessTone = (state: string) =>
    state === 'Available'
      ? 'green'
      : state === 'Available with warning'
        ? 'amber'
        : 'neutral'
  const patchScope = (key: keyof CapabilityScope, value: string) =>
    setScope((previous) => ({ ...previous, [key]: value || undefined }))
  const names = (ids: string[] = []) =>
    ids.map((id) => capabilities.find((c) => c.id === id)?.name ?? id)
  function openWorkflow(c: Capability) {
    if (c.lifecycle === 'retired') {
      onNavigate('analysis')
      return
    }
    if (c.id === 'standardization') {
      setStandardize(true)
      return
    }
    if (c.owner === 'Forecast & Simulate') {
      onNavigate(
        'analysis',
        c.questionKey ? `question=${c.questionKey}` : undefined,
      )
      return
    }
    if (c.id === 'period-filter') {
      onNavigate('dashboards')
      return
    }
    onIntake(c.entrySection ?? 'sales')
  }
  function toggle(c: Capability) {
    if (!editable || !canActivateCapability(c, scoped, scope) || invalidPeriod)
      return
    if (isCapabilityMuted(c, w))
      onChange({
        ...w,
        revision: w.revision + 1,
        muted: w.muted.filter(
          (id) =>
            id !== presentationKey(c) &&
            id !== c.id &&
            !(c.id.startsWith('forecast-') && id === 'forecast'),
        ),
      })
    else setMute(c)
  }
  const grid = useRef<HTMLDivElement>(null)
  // Every collapsed card adopts the tallest header in the grid, so the closed
  // rows line up without reserving a fixed amount of blank space.
  useLayoutEffect(() => {
    const node = grid.current
    if (!node) return
    const measure = () => {
      node.style.removeProperty('--capability-header')
      const headers = node.querySelectorAll<HTMLElement>('.disclosure-trigger')
      const tallest = Math.max(
        0,
        ...[...headers].map((header) => header.offsetHeight),
      )
      if (tallest) node.style.setProperty('--capability-header', `${tallest}px`)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  })
  const source = w.sources.find((s) => s.id === scope.sourceId)
  return (
    <>
      <PageHeader
        eyebrow="Add-ons & Data"
        title="More context. Better questions."
        description="Review each capability's usable scope, input requirements and presentation preferences."
        action={
          <button className="button primary" onClick={() => onIntake()}>
            <Plus size={17} />
            Add business data
          </button>
        }
      />
      <section className="catalog-summary">
        <span className="summary-icon">
          <Layers size={25} />
        </span>
        <div>
          <h2>
            {catalogCapabilities.filter(ready).length} of{' '}
            {catalogCapabilities.length} capabilities have usable inputs in this
            scope
          </h2>
          <p>
            46 canonical capabilities and SKU Standardization. Scenario
            configuration and saved dependencies receive a separate execution
            check.
          </p>
        </div>
        <span className="badge green">
          <Check size={12} />
          {w.mode === 'demo'
            ? 'Separate demo records'
            : 'Your supplied records'}
        </span>
      </section>
      <Panel
        title="Data scope"
        subtitle="Readiness applies to the selected records, not the whole business by default"
      >
        <div className="panel-body stack">
          <div className="form-grid">
            <label className="field">
              Product
              <SelectField
                aria-label="Catalog product scope"
                value={scope.productId ?? ''}
                onChange={(e) => patchScope('productId', e.target.value)}
              >
                <option value="">All supplied products</option>
                {w.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.sku}
                  </option>
                ))}
              </SelectField>
            </label>
            <label className="field">
              Location
              <SelectField
                aria-label="Catalog location scope"
                value={scope.locationId ?? ''}
                onChange={(e) => patchScope('locationId', e.target.value)}
              >
                <option value="">
                  All supplied locations, including unassigned
                </option>
                {w.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </SelectField>
            </label>
            <label className="field">
              From date
              <input
                type="date"
                aria-label="Catalog start date"
                value={scope.startDate ?? ''}
                onChange={(e) => patchScope('startDate', e.target.value)}
              />
            </label>
            <label className="field">
              Through date
              <input
                type="date"
                aria-label="Catalog end date"
                value={scope.endDate ?? ''}
                onChange={(e) => patchScope('endDate', e.target.value)}
              />
            </label>
            <label className="field">
              Source
              <SelectField
                aria-label="Catalog source scope"
                value={scope.sourceId ?? ''}
                onChange={(e) => patchScope('sourceId', e.target.value)}
              >
                <option value="">All supplied sources</option>
                {w.sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </SelectField>
            </label>
          </div>
          {invalidPeriod ? (
            <p className="notice warning" role="alert">
              The start date must be on or before the end date.
            </p>
          ) : (
            <p className="notice small">
              {scoped.sales.length} of {w.sales.length} accepted sales rows ·{' '}
              {new Set(scoped.sales.map((s) => s.date)).size} observed dates ·{' '}
              {scoped.stock.length} of {w.stock.length} stock positions.{' '}
              {source
                ? `${source.rowCount} accepted and ${source.excludedCount} excluded rows were recorded for this source; current source-linked rows are counted separately above.`
                : 'The counts describe supplied records, not the percentage of all business activity.'}
            </p>
          )}
          <p className="small muted">
            Sales use their transaction dates. Stock uses the latest supplied
            snapshot on or before the through date; its date remains visible and
            no historical balance is reconstructed. Financial records retain
            their current balance; cash eligibility checks the selected forward
            window, or the next 30 days when no window is selected. Purchasing
            budgets always retain their own period.
          </p>
          {(scope.productId || scope.locationId || scope.sourceId) && (
            <p className="notice small">
              {(scope.productId || scope.locationId) &&
                'Business-level cash, debts and commitments have no product or location allocation. They cannot become eligible for this restricted scope. '}{' '}
              {scope.locationId &&
                'Only purchases with an explicit matching receipt location are included.'}{' '}
              {scope.sourceId &&
                'Only records explicitly linked to this source are included. Unattributed records cannot inherit its provenance.'}
            </p>
          )}
          <div>
            <button className="text-button" onClick={() => setScope({})}>
              Reset scope
            </button>
          </div>
        </div>
      </Panel>
      <div className="table-toolbar catalog-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search capabilities"
            placeholder="Find a capability or question"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <SelectField
          aria-label="Capability filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {[
            'All capabilities',
            'Ready to use',
            'Needs data',
            'Muted',
            'Unavailable or demo only',
            'Lifecycle',
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </SelectField>
      </div>
      <div className="capability-grid" ref={grid}>
        {cards.map((c) => {
          const state = invalidPeriod
            ? 'Invalid period'
            : readiness(c, scoped, scope)
          const switchable =
            canActivateCapability(c, scoped, scope) && !invalidPeriod
          const muted = isCapabilityMuted(c, w)
          return (
            <DisclosureCard
              key={c.id}
              className="capability-card"
              title={c.name}
              description={c.question}
              meta={
                <>
                  <span
                    className={`badge ${invalidPeriod ? 'amber' : readinessTone(state)}`}
                  >
                    {state}
                  </span>
                  {switchable && (
                    <span className={`badge ${muted ? 'neutral' : 'blue'}`}>
                      {muted ? 'Muted' : 'On'}
                    </span>
                  )}
                </>
              }
            >
              <div className="capability-detail">
                <dl className="capability-facts">
                  <div>
                    <dt>Minimum fields</dt>
                    <dd>{c.fields}</dd>
                  </div>
                  <div>
                    <dt>Belongs to</dt>
                    <dd>{c.owner}</dd>
                  </div>
                  <div>
                    <dt>Entry methods</dt>
                    <dd>{c.entryMethods?.join(' · ') || 'No direct entry'}</dd>
                  </div>
                  <div>
                    <dt>Better data helps</dt>
                    <dd>{c.warning}</dd>
                  </div>
                  <div>
                    <dt>Lifecycle</dt>
                    <dd>{c.lifecycle}</dd>
                  </div>
                </dl>
                {capabilityWarnings(c, scoped, scope).map((warning) => (
                  <p className="small muted" key={warning}>
                    {warning}
                  </p>
                ))}
                {c.lifecycle !== 'active' && (
                  <p className="notice small">
                    Successor ·{' '}
                    {c.successor ? names([c.successor])[0] : 'Not announced'}.
                    Sunset · {c.sunsetDate ?? 'Not scheduled'}.{' '}
                    {c.lifecycle === 'retired'
                      ? 'New activation is unavailable. Historical results remain accessible.'
                      : 'Existing usage remains visible; review the successor before starting new work.'}
                  </p>
                )}
                <div className="card-bottom">
                  <button
                    className="text-button"
                    onClick={() => setSelected(c)}
                  >
                    <GitBranch size={14} />
                    Dependencies
                  </button>
                  {switchable ? (
                    <div className="inline-actions">
                      <span className="small muted">
                        {muted ? 'Muted' : 'On'}
                      </span>
                      <button
                        className="icon-button"
                        role="switch"
                        disabled={!editable}
                        aria-checked={!muted}
                        aria-label={`${c.name} presentation`}
                        onClick={() => toggle(c)}
                      >
                        <span
                          className={`visual-switch ${muted ? '' : 'on'}`}
                        />
                      </button>
                    </div>
                  ) : (
                    <span className="small muted">
                      {c.lifecycle === 'retired'
                        ? 'Historical access only'
                        : c.displays?.length
                          ? 'Presentation needs usable inputs'
                          : 'No separate optional display'}
                    </span>
                  )}
                </div>
                <button className="text-button" onClick={() => openWorkflow(c)}>
                  {c.lifecycle === 'retired' ? (
                    'Open saved history'
                  ) : c.id === 'standardization' ? (
                    <>
                      <WandSparkles size={14} />
                      Review proposals
                    </>
                  ) : c.owner === 'Forecast & Simulate' ? (
                    'Configure analysis'
                  ) : c.support === 'unavailable' ? (
                    'Review owning module'
                  ) : (
                    'Open data workflow'
                  )}
                  <ChevronRight size={14} />
                </button>
              </div>
            </DisclosureCard>
          )
        })}
      </div>
      {!cards.length && (
        <EmptyState
          title="No capabilities match"
          description="Change the search or filter to see more capabilities."
        />
      )}
      <Panel
        title="Imported and entered sources"
        subtitle="Original interpretation remains separate from accepted business records"
      >
        {w.sources.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Method</th>
                  <th>Accepted records</th>
                  <th>Excluded rows</th>
                  <th>Imported</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {w.sources.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.type}</td>
                    <td>{s.rowCount}</td>
                    <td>{s.excludedCount}</td>
                    <td>{s.importedAt.slice(0, 10)}</td>
                    <td>
                      {s.review ? (
                        <button
                          className="text-button"
                          onClick={() => onIntake('sales')}
                        >
                          Original source review
                          <ChevronRight size={14} />
                        </button>
                      ) : (
                        <span className="muted">
                          {s.type === 'demo'
                            ? 'Separate demonstration dataset'
                            : 'Manual entry confirmation'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No sources have been applied"
            description="Import review and manual entry require confirmation before records appear here."
          />
        )}
        <div className="panel-body">
          <button
            className="button secondary"
            onClick={() => onNavigate('settings')}
          >
            Manage workspace data
          </button>
        </div>
      </Panel>
      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={`${selected?.name ?? 'Capability'} dependencies`}
        description="Requirements, consumers and displays are declared in the same capability registry."
      >
        {selected && (
          <div className="stack">
            <div className="notice">
              <strong>{readiness(selected, scoped, scope)}</strong>
              <p>{selected.fields}</p>
            </div>
            <div>
              <h3>Requires these input capabilities</h3>
              {selected.requires?.length ? (
                <ul className="dependency-list">
                  {names(selected.requires).map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">
                  Direct {selected.owner.toLowerCase()} records; no upstream
                  capability is required.
                </p>
              )}
              <p className="small muted">
                A dependency identifies input information. Muting its display
                does not remove its records or block consumers.
              </p>
            </div>
            <div>
              <h3>Feeds these capabilities</h3>
              {selected.feeds.length ? (
                <ul className="dependency-list">
                  {names(selected.feeds).map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">
                  No downstream capabilities are declared.
                </p>
              )}
            </div>
            <div>
              <h3>Affected optional displays</h3>
              {selected.displays?.length ? (
                <ul className="dependency-list">
                  {selected.displays.map((display) => (
                    <li key={display}>{display}</li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">
                  No separate optional display is implemented. Required question
                  inputs, records and saved results remain accessible.
                </p>
              )}
            </div>
            <p className="small muted">
              Lifecycle · {selected.lifecycle}. Successor ·{' '}
              {selected.successor
                ? names([selected.successor])[0]
                : 'Not announced'}
              . Sunset · {selected.sunsetDate ?? 'Not scheduled'}. Lifecycle
              policy is owner-maintained, separate from your presentation
              preference.
            </p>
            <button
              className="button primary"
              onClick={() => {
                const c = selected
                setSelected(null)
                openWorkflow(c)
              }}
            >
              {selected.lifecycle === 'retired'
                ? 'Open saved history'
                : 'Open the owning workflow'}
            </button>
          </div>
        )}
      </Modal>
      <Modal
        open={mute !== null}
        onClose={() => setMute(null)}
        title={`Mute ${mute?.name ?? 'capability'}?`}
        description="Review the exact displays before changing presentation."
      >
        {mute && (
          <div className="stack">
            <p>These optional displays will be hidden:</p>
            <ul className="dependency-list">
              {mute.displays?.map((display) => (
                <li key={display}>{display}</li>
              ))}
            </ul>
            {catalogCapabilities.filter(
              (c) => presentationKey(c) === presentationKey(mute),
            ).length > 1 && (
              <p className="notice small">
                Shared presentation preference with{' '}
                {catalogCapabilities
                  .filter(
                    (c) =>
                      c.id !== mute.id &&
                      presentationKey(c) === presentationKey(mute),
                  )
                  .map((c) => c.name)
                  .join(', ')}
                . These cards describe different data requirements for the same
                displays.
              </p>
            )}
            <p className="notice">
              Inputs remain usable by{' '}
              {names(mute.feeds).join(', ') || 'existing computations'}. Saved
              runs, historical results, source records, inline assumptions and
              limitations remain accessible.
            </p>
            <div className="form-actions">
              <button
                className="button secondary"
                onClick={() => setMute(null)}
              >
                Keep on
              </button>
              <button
                className="button primary"
                disabled={!editable}
                onClick={() => {
                  if (!editable) return
                  if (mute.lifecycle !== 'retired')
                    onChange({
                      ...w,
                      revision: w.revision + 1,
                      muted: [...new Set([...w.muted, presentationKey(mute)])],
                    })
                  setMute(null)
                }}
              >
                Mute presentation
              </button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={standardize}
        onClose={() => setStandardize(false)}
        title="Review SKU Standardization"
        description="Corrections require your explicit approval before current workspace records change."
        wide
      >
        <Standardization
          workspace={w}
          onChange={onChange}
          onClose={() => setStandardize(false)}
        />
      </Modal>
    </>
  )
}

export function Settings({
  workspace: w,
  onChange,
  onIntake,
  onNavigate,
}: BusinessPageProps) {
  const { canEdit } = useWorkspaceAccess(),
    editable = canEdit('settings')
  const [saved, setSaved] = useState(false),
    [clear, setClear] = useState(false),
    [remove, setRemove] = useState<string | null>(null)
  function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editable) return
    const f = new FormData(e.currentTarget)
    onChange({
      ...w,
      revision: w.revision + 1,
      profile: {
        ...w.profile,
        name: String(f.get('name')).trim(),
        firstQuestion: String(f.get('question')),
        businessType: String(f.get('type')),
      },
    })
    setSaved(true)
  }
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Your workspace, your way."
        description="Business context, presentation preferences and saved workspace controls."
      />
      <div className="settings-grid">
        <Panel
          title="Business profile"
          subtitle="Context used to interpret new records and analytical runs"
        >
          <form className="panel-body stack" onSubmit={saveProfile}>
            <label className="field">
              Business name
              <input
                name="name"
                disabled={!editable}
                required
                defaultValue={w.profile.name}
                placeholder="Your business name"
              />
            </label>
            <div className="form-grid">
              <label className="field">
                Working currency
                <input value={w.profile.currency} readOnly />
                <small>
                  Existing records keep their currency. Change currency during a
                  new empty setup.
                </small>
              </label>
              <label className="field">
                Business type
                <input
                  name="type"
                  disabled={!editable}
                  defaultValue={w.profile.businessType}
                  placeholder="Optional"
                />
              </label>
            </div>
            <label className="field">
              First question
              <SelectField
                name="question"
                disabled={!editable}
                defaultValue={w.profile.firstQuestion}
              >
                <option value="sales">Understand my sales</option>
                <option value="Q-NEW-ORDER">Evaluate a new order</option>
                <option value="Q-REPLENISH">Plan replenishment</option>
                <option value="Q-CRITICAL-COLLECTION">
                  Analyze a critical collection
                </option>
              </SelectField>
              <small>
                This prioritizes intake. It does not unlock capabilities or
                choose an engine.
              </small>
            </label>
            <div className="form-actions">
              {saved && (
                <span role="status" className="small positive">
                  Business profile saved
                </span>
              )}
              <button className="button primary" disabled={!editable}>
                Save profile
              </button>
            </div>
          </form>
        </Panel>
        <div className="stack">
          <Panel title="Your setup" subtitle="Independent milestones">
            <div className="settings-row">
              <div>
                <strong>Initial journey</strong>
                <p>
                  {w.onboarding.completed
                    ? w.onboarding.deferred
                      ? 'Completed with data deferred'
                      : 'Completed'
                    : 'In progress'}
                </p>
              </div>
              <button
                className="text-button"
                disabled={!editable}
                onClick={() => onIntake('profile')}
              >
                Resume
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="settings-row">
              <div>
                <strong>First supported analysis</strong>
                <p>
                  {w.onboarding.firstAnalysisAt ??
                    'Not reached. Deferral is not an analysis.'}
                </p>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <strong>First scenario comparison</strong>
                <p>
                  {w.onboarding.firstComparisonAt ??
                    'Not reached. A completed comparison is a separate milestone.'}
                </p>
              </div>
            </div>
          </Panel>
          <Panel
            title="Workspace permissions"
            subtitle="Current module and action boundaries"
          >
            <div className="panel-body stack">
              <ShieldCheck size={24} className="positive" />
              <p className="small muted">
                Your workspace role controls saved changes. Administrators and
                owners manage all modules and team access. Viewers can inspect
                records and retained results. Role changes and data writes are
                enforced by the workspace service.
              </p>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Major changes</th>
                    <th>Roles permitted to change records</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      'Business profile, sales, Add-ons & Settings',
                      'Import sales; change profile, presentation, notifications and source records',
                      'Owner · Administrator',
                    ],
                    [
                      'Inventory',
                      'Record stock, movements, historical observations and shared pools',
                      'Owner · Administrator · Inventory',
                    ],
                    [
                      'Suppliers & purchasing',
                      'Maintain suppliers, terms and purchase records',
                      'Owner · Administrator · Buyer',
                    ],
                    [
                      'Finance',
                      'Maintain debt, terms, cash, budgets, commitments and category coverage',
                      'Owner · Administrator · Finance',
                    ],
                    [
                      'Forecast & Simulate',
                      'Create and run analytical definitions with retained inputs and results',
                      'Owner · Administrator · Finance · Inventory · Buyer',
                    ],
                    [
                      'Standardization',
                      'Confirm identity-safe corrections and cross-module unit conversions',
                      'Owner · Administrator',
                    ],
                  ].map(([module, actions, roles]) => (
                    <tr key={module}>
                      <td>{module}</td>
                      <td>{actions}</td>
                      <td>{roles}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="panel-footnote">
              Recording purchases, cash events or inventory movements updates
              SAMBY records. It does not execute bank payments or physical
              warehouse actions.
            </p>
          </Panel>
        </div>
      </div>
      <Panel
        title="Notifications and presentation"
        subtitle="Optional alerts never remove inline assumptions, warnings or provenance"
      >
        <div className="settings-row">
          <div>
            <strong>
              <Bell size={14} style={{ display: 'inline', marginRight: 8 }} />
              Optional capability notifications
            </strong>
            <p>Newly usable data, coverage and freshness reminders.</p>
          </div>
          <button
            className="icon-button"
            role="switch"
            disabled={!editable}
            aria-label="Optional notifications"
            aria-checked={w.notifications.enabled}
            onClick={() =>
              onChange({
                ...w,
                revision: w.revision + 1,
                notifications: {
                  ...w.notifications,
                  enabled: !w.notifications.enabled,
                },
              })
            }
          >
            <span
              className={`visual-switch ${w.notifications.enabled ? 'on' : ''}`}
            />
          </button>
        </div>
        <div className="settings-row">
          <div>
            <strong>Minimum severity</strong>
            <p>Only changes optional notifications.</p>
          </div>
          <SelectField
            disabled={!editable}
            aria-label="Notification minimum severity"
            value={w.notifications.severity}
            onChange={(e) =>
              onChange({
                ...w,
                revision: w.revision + 1,
                notifications: {
                  ...w.notifications,
                  severity: e.target.value as typeof w.notifications.severity,
                },
              })
            }
          >
            <option value="all">All updates</option>
            <option value="warning">Warnings and critical</option>
            <option value="critical">Critical only</option>
          </SelectField>
        </div>
        <div className="settings-row">
          <div>
            <strong>Planning cadence</strong>
            <p>When to remind you about older stock snapshots.</p>
          </div>
          <SelectField
            disabled={!editable}
            aria-label="Planning cadence"
            value={w.notifications.cadenceDays ?? 30}
            onChange={(e) =>
              onChange({
                ...w,
                notifications: {
                  ...w.notifications,
                  cadenceDays: Number(e.target.value),
                },
              })
            }
          >
            {[7, 14, 30, 90].map((days) => (
              <option value={days} key={days}>
                {days} days
              </option>
            ))}
          </SelectField>
        </div>
        <div className="settings-row">
          <div>
            <strong>Dismissed and snoozed reminders</strong>
            <p>
              Reset optional reminders without changing any inline limitations.
            </p>
          </div>
          <button
            className="button secondary"
            disabled={!editable}
            onClick={() =>
              onChange({
                ...w,
                notifications: {
                  ...w.notifications,
                  dismissed: [],
                  snoozedUntil: {},
                },
              })
            }
          >
            Restore reminders
          </button>
        </div>
        <div className="settings-row">
          <div>
            <strong>Capability visibility</strong>
            <p>
              {w.muted.length} capabilities muted. Computation dependencies
              remain available.
            </p>
          </div>
          <button className="text-button" onClick={() => onNavigate('data')}>
            Manage
            <ChevronRight size={14} />
          </button>
        </div>
      </Panel>
      <Panel
        title="Workspace data"
        subtitle="Current business records are saved by the workspace service"
      >
        <div className="settings-row">
          <div>
            <strong>
              <Database
                size={14}
                style={{ display: 'inline', marginRight: 8 }}
              />
              Analytical history
            </strong>
            <p>
              Server-stored definitions, snapshots and completed results remain
              separate from these controls.
            </p>
          </div>
          <button
            className="text-button"
            onClick={() => onNavigate('analysis')}
          >
            Open history
            <ChevronRight size={14} />
          </button>
        </div>
        {w.sources
          .filter(
            (s) =>
              s.type !== 'demo' &&
              Object.values(sourceRecordCounts(w, s.id)).some(
                (count) => count > 0,
              ),
          )
          .map((s) => (
            <div className="settings-row" key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <p>
                  {Object.entries(sourceRecordCounts(w, s.id))
                    .filter(([, count]) => count > 0)
                    .map(([kind, count]) => `${count} ${kind}`)
                    .join(' · ')}
                </p>
              </div>
              <button
                className="icon-button"
                disabled={!editable}
                onClick={() => setRemove(s.id)}
                aria-label={`Remove source ${s.name}`}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        <div className="settings-row">
          <div>
            <strong>Clear current business records</strong>
            <p>
              Return this {w.mode} workspace to an empty state. Existing
              analytical history remains readable.
            </p>
          </div>
          <button
            className="button secondary"
            disabled={!editable}
            onClick={() => setClear(true)}
          >
            <Settings2 size={15} />
            Review reset
          </button>
        </div>
      </Panel>
      <p className="page-footnote">
        <span>
          <LockKeyhole
            size={11}
            style={{ display: 'inline', marginRight: 5 }}
          />
          Saved workspace records · no bank payments or physical execution
        </span>
        <span>
          {w.profile.timezone} · {w.profile.currency}
        </span>
      </p>
      <Modal
        open={clear || remove !== null}
        onClose={() => {
          setClear(false)
          setRemove(null)
        }}
        title={
          clear
            ? 'Clear workspace records?'
            : 'Remove this source from current analysis?'
        }
        description="This changes current workspace records. Historical analytical snapshots and results remain unchanged."
      >
        <div className="stack">
          <p className="notice">
            {clear
              ? 'The current profile, records and local intake draft will return to an empty state. The server workspace identity and analytical history are retained.'
              : `The following current source-linked records will be removed: ${
                  remove
                    ? Object.entries(sourceRecordCounts(w, remove))
                        .filter(([, count]) => count > 0)
                        .map(([kind, count]) => `${count} ${kind}`)
                        .join(', ')
                    : ''
                }. Product identities and unrelated records remain. Historical snapshots and results are unchanged; current capability readiness is recalculated.`}
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => {
                setClear(false)
                setRemove(null)
              }}
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={!editable}
              onClick={() => {
                if (!editable) return
                if (clear) {
                  onChange(emptyWorkspace(w.id, w.mode))
                  for (let i = sessionStorage.length - 1; i >= 0; i--) {
                    const key = sessionStorage.key(i)
                    if (key?.includes(w.id) && key.includes('intake'))
                      sessionStorage.removeItem(key)
                  }
                } else onChange(removeSourceRecords(w, remove!))
                setClear(false)
                setRemove(null)
              }}
            >
              {clear ? 'Clear current records' : 'Remove source'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
import { SelectField } from '../../components/ui/select-field'
