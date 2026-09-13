import { SelectField } from '../../components/ui/select-field'
import { SortableTable } from '../../components/SortableTable'
import type { Page } from '../../domain/workspace'
import type { Dispatch, SetStateAction } from 'react'
import { TableHead } from '../../components/workspace-ui'
import { PaymentTermsPanel } from './HistoricalMetrics'
import { FinanceInsights } from './FinanceInsights'
import { FinanceHistory } from './FinanceHistory'
import { PendingFinance } from './PendingFinance'
import { BehavioralCollectionMatrix } from './BehavioralCollectionMatrix'
import { useWorkspaceAccess } from '../../components/workspace-access-context'
import { useState, type FormEvent } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  Plus,
  Wallet,
} from 'lucide-react'
import {
  EmptyState,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  Tabs,
} from '../../components/workspace-ui'
import {
  cutoff,
  dateLabel,
  money,
  outstanding,
  shiftDate,
  type FinancialRecord,
  type Workspace,
} from '../../domain/workspace'
import { financeTotals } from '../../domain/selectors'
import { SavedProjection } from './SavedProjection'
import type { BusinessPageProps } from './Home'

export function Finance({
  workspace: w,
  onChange,
  onIntake,
  onNavigate,
  initialTab,
}: { initialTab?: string } & BusinessPageProps) {
  const { canEdit } = useWorkspaceAccess()
  const editable = canEdit('finance')
  const [tab, setTab] = useState(initialTab ?? 'Overview'),
    [record, setRecord] = useState<FinancialRecord | null>(null)
  const [filter, setFilter] = useState('All records'),
    [search, setSearch] = useState(''),
    [planningDays, setPlanningDays] = useState(30)
  const asOf = cutoff(w),
    totals = financeTotals(w)
  const rows = financialRecordsMatching(w, tab, filter, search, asOf)
  const due = w.finance
    .filter(
      (f) =>
        f.kind !== 'receivable' &&
        f.kind !== 'provider_pending' &&
        f.expectedDate &&
        f.expectedDate >= asOf &&
        f.expectedDate <= shiftDate(asOf, planningDays - 1) &&
        outstanding(f) > 0,
    )
    .sort((a, b) => a.expectedDate!.localeCompare(b.expectedDate!))
  return (
    <>
      <PageHeader
        title="Finance"
        action={
          <button
            className="button primary"
            disabled={!editable}
            onClick={() => onIntake('finance')}
          >
            <Plus size={17} />
            Add financial data
          </button>
        }
      />
      <Tabs
        tabs={[
          'Overview',
          'Liquidity',
          'Internal Debt',
          'External Debt',
          'Financing Debt',
          'Commitments',
        ]}
        value={tab}
        onChange={setTab}
        label="Finance section"
      />
      {totals.issues.map((issue) => (
        <p className="notice warning" key={issue}>
          {issue}
        </p>
      ))}
      <FinanceSectionSummary
        tab={tab}
        w={w}
        totals={totals}
        onNavigate={onNavigate}
        onIntake={onIntake}
        planningDays={planningDays}
        asOf={asOf}
        setPlanningDays={setPlanningDays}
        due={due}
        setRecord={setRecord}
        editable={editable}
        onChange={onChange}
      />
      {tab === 'Internal Debt' && (
        <BehavioralCollectionMatrix workspace={w} onNavigate={onNavigate} />
      )}
      {(tab === 'Internal Debt' || tab === 'External Debt') && (
        <FinanceInsights
          workspace={w}
          kind={tab === 'Internal Debt' ? 'internal' : 'external'}
        />
      )}
      {tab !== 'Commitments' && (
        <FinancialRecordsPanel
          tab={tab}
          search={search}
          setSearch={setSearch}
          filter={filter}
          setFilter={setFilter}
          rows={rows}
          setRecord={setRecord}
          asOf={asOf}
          editable={editable}
          onIntake={onIntake}
        />
      )}
      <PendingFinance workspace={w} onChange={onChange} />
      <FinanceHistory
        workspace={w}
        onChange={onChange}
        kind={
          tab === 'Internal Debt'
            ? 'internal'
            : tab === 'External Debt'
              ? 'external'
              : undefined
        }
      />
      <PaymentTermsPanel workspace={w} onIntake={() => onIntake('finance')} />
      <Modal
        open={record !== null}
        onClose={() => setRecord(null)}
        title={record?.name ?? 'Financial record'}
        description="Review the recorded amount and dates. Saving a record does not execute a payment."
      >
        {record && (
          <FinanceRecordForm
            workspace={w}
            record={record}
            onChange={onChange}
            onClose={() => setRecord(null)}
          />
        )}
      </Modal>
    </>
  )
}

function FinanceRecordForm({
  workspace: w,
  record: f,
  onChange,
  onClose,
}: {
  workspace: Workspace
  record: FinancialRecord
  onChange: (w: Workspace) => void
  onClose: () => void
}) {
  const [error, setError] = useState('')
  const { canEdit } = useWorkspaceAccess()
  const editable = canEdit('finance')
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editable) return
    const d = new FormData(e.currentTarget),
      paid = Number(d.get('paid'))
    if (!Number.isFinite(paid) || paid < 0 || paid > f.amount) {
      setError(
        'The recorded paid amount must be between zero and the original amount.',
      )
      return
    }
    const linkedPending = w.finance
      .filter((r) => r.kind === 'provider_pending' && r.linkedRecordId === f.id)
      .reduce((sum, r) => sum + r.amount, 0)
    if (f.kind === 'receivable' && paid < linkedPending) {
      setError(
        'The paid amount cannot be less than the linked provider collections. Reconcile those records first.',
      )
      return
    }
    const updated = {
      ...f,
      paidAmount: paid,
      dueDate: String(d.get('due')) || null,
      expectedDate: String(d.get('expected')) || null,
    }
    onChange({
      ...w,
      revision: w.revision + 1,
      finance: w.finance.map((r) => (r.id === f.id ? updated : r)),
    })
    onClose()
  }
  return (
    <form className="stack" onSubmit={submit}>
      <div className="detail-grid">
        <div>
          <dt>Counterparty</dt>
          <dd>{f.counterparty || 'Not provided'}</dd>
        </div>
        <div>
          <dt>Original amount</dt>
          <dd>{money(f.amount, f.currency)}</dd>
        </div>
      </div>
      <label className="field">
        Cumulative paid amount
        <input
          name="paid"
          type="number"
          step="0.01"
          min="0"
          max={f.amount}
          defaultValue={f.paidAmount}
          required
          disabled={!editable}
        />
        <small>
          Confirmed payments already applied to this balance. Zero means no
          payment has been recorded.
        </small>
      </label>
      <div className="form-grid">
        <label className="field">
          Due date
          <input
            name="due"
            type="date"
            disabled={!editable}
            defaultValue={f.dueDate ?? ''}
          />
          <small>The contractual deadline, if known.</small>
        </label>
        <label className="field">
          Expected payment or availability date
          <input
            name="expected"
            type="date"
            disabled={!editable}
            defaultValue={f.expectedDate ?? ''}
          />
          <small>An expectation, not a guarantee.</small>
        </label>
      </div>
      <p className="notice small">
        This edit preserves the dated cash snapshot and previous analytical
        runs. Update available cash separately when you have a new confirmed
        balance.
      </p>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="button primary" disabled={!editable}>
          Confirm record update
        </button>
      </div>
    </form>
  )
}

function FinancialRecordsPanel({
  tab,
  search,
  setSearch,
  filter,
  setFilter,
  rows,
  setRecord,
  asOf,
  editable,
  onIntake,
}: {
  tab: string
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  filter: string
  setFilter: Dispatch<SetStateAction<string>>
  rows: FinancialRecord[]
  setRecord: Dispatch<SetStateAction<FinancialRecord | null>>
  asOf: string
  editable: boolean
  onIntake: (
    section?: 'sales' | 'inventory' | 'finance' | 'suppliers' | 'profile',
  ) => void
}) {
  return (
    <Panel
      title={
        tab === 'Overview' || tab === 'Liquidity'
          ? 'Financial records'
          : `${tab} records`
      }
      subtitle="Record visibility is independent of whether dates support a timeline"
    >
      <div className="table-toolbar">
        <label className="search-field">
          <input
            aria-label="Search financial records"
            placeholder="Search customer, supplier or record"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <SelectField
          aria-label="Financial record status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {['All records', 'Outstanding', 'Overdue', 'Unscheduled'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </SelectField>
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <SortableTable
            className="data-table"
            defaultOpen
            tableLabel="Financial records"
          >
            <TableHead
              headers={[
                'Record / counterparty',
                'Category',
                'Outstanding',
                'Due date',
                'Expected date',
                'Status',
              ]}
            />
            <tbody>
              {rows.map((f) => (
                <tr key={f.id}>
                  <td>
                    <button
                      className="row-button product-cell"
                      onClick={() => setRecord(f)}
                    >
                      <span
                        className={`product-icon ${f.kind === 'receivable' || f.kind === 'provider_pending' ? 'green' : ''}`}
                      >
                        {f.kind === 'receivable' ||
                        f.kind === 'provider_pending' ? (
                          <ArrowDownLeft size={18} />
                        ) : (
                          <ArrowUpRight size={18} />
                        )}
                      </span>
                      <span>
                        <strong>{f.name}</strong>
                        <small>{f.counterparty || 'Not provided'}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    {f.kind === 'provider_pending'
                      ? 'Provider-pending funds'
                      : f.category}
                  </td>
                  <td className="numeric">
                    {money(outstanding(f), f.currency)}
                  </td>
                  <td>{f.dueDate ?? 'Not provided'}</td>
                  <td>{f.expectedDate ?? 'Unscheduled'}</td>
                  <td>
                    <span
                      className={`badge ${outstanding(f) === 0 ? 'green' : f.dueDate && f.dueDate < asOf ? 'amber' : ''}`}
                    >
                      {outstanding(f) === 0
                        ? 'Paid'
                        : f.kind === 'provider_pending'
                          ? 'Pending availability'
                          : f.dueDate && f.dueDate < asOf
                            ? 'Overdue'
                            : 'Outstanding'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </SortableTable>
        </div>
      ) : (
        <EmptyState
          title="No matching financial records"
          description="Add an identifiable receivable, payable, financing payment or operating obligation. Missing values are not zero."
          action={
            <button
              className="button secondary"
              disabled={!editable}
              onClick={() => onIntake('finance')}
            >
              Add a record
            </button>
          }
          icon={<CalendarDays size={27} />}
        />
      )}
    </Panel>
  )
}

function CommitmentsPanel({
  w,
  editable,
  onChange,
  onIntake,
}: {
  w: Workspace
  editable: boolean
  onChange: (w: Workspace) => void
  onIntake: (
    section?: 'sales' | 'inventory' | 'finance' | 'suppliers' | 'profile',
  ) => void
}) {
  return (
    <Panel
      capability="commitments"
      title="Recurring supplier commitments"
      subtitle="Expected obligations and fulfillment are distinct from payment"
    >
      {w.commitments.length ? (
        <div className="table-wrap">
          <SortableTable
            className="data-table"
            tableLabel="Recurring commitments"
          >
            <TableHead
              headers={[
                'Commitment',
                'Cadence / next date',
                'Expected amount',
                'Fulfillment',
                'Payment',
                'Linked payable',
              ]}
            />
            <tbody>
              {w.commitments.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    <small className="block muted">
                      {w.suppliers.find((s) => s.id === c.supplierId)?.name ??
                        'Supplier not provided'}
                    </small>
                  </td>
                  <td>
                    {c.cadence}
                    <small className="block">
                      {c.nextDate ?? 'Unscheduled'}
                    </small>
                  </td>
                  <td className="numeric">{money(c.amount, c.currency)}</td>
                  <td>
                    <SelectField
                      aria-label={`Fulfillment for ${c.name}`}
                      disabled={!editable}
                      value={c.fulfillment}
                      onChange={(e) =>
                        onChange({
                          ...w,
                          revision: w.revision + 1,
                          commitments: w.commitments.map((x) =>
                            x.id === c.id
                              ? {
                                  ...x,
                                  fulfillment: e.target
                                    .value as typeof c.fulfillment,
                                }
                              : x,
                          ),
                        })
                      }
                    >
                      <option value="unknown">Unknown</option>
                      <option value="fulfilled">Fulfilled</option>
                      <option value="not_fulfilled">Not fulfilled</option>
                    </SelectField>
                  </td>
                  <td>{c.payment}</td>
                  <td>{c.linkedPayableId ?? 'Not linked'}</td>
                </tr>
              ))}
            </tbody>
          </SortableTable>
        </div>
      ) : (
        <EmptyState
          title="No recurring commitments yet"
          description="Add supplier, cadence, expected amount and period. Unknown fulfillment stays unknown."
          action={
            <button
              className="button primary"
              disabled={!editable}
              onClick={() => onIntake('finance')}
            >
              Add commitment
            </button>
          }
        />
      )}
      <p className="notice">
        Linked payables carry the confirmed obligation. Do not add the expected
        commitment again when planning the same payment.
      </p>
    </Panel>
  )
}

function CashPlanningPanel({
  planningDays,
  asOf,
  onNavigate,
  setPlanningDays,
  due,
  setRecord,
  w,
}: {
  planningDays: number
  asOf: string
  onNavigate: (page: Page, query?: string) => void
  setPlanningDays: Dispatch<SetStateAction<number>>
  due: FinancialRecord[]
  setRecord: Dispatch<SetStateAction<FinancialRecord | null>>
  w: Workspace
}) {
  return (
    <Panel
      capability="liquidity"
      title={`Next ${planningDays} days`}
      subtitle={`Scheduled obligations · ${asOf} to ${shiftDate(asOf, planningDays - 1)} · no recalculated cash forecast`}
      action={
        <button
          className="button secondary"
          onClick={() => onNavigate('analysis', 'question=Q-CASH-SUFFICIENCY')}
        >
          Explore cash coverage
          <ArrowUpRight size={16} />
        </button>
      }
    >
      <label className="field">
        Obligation planning horizon
        <SelectField
          value={planningDays}
          onChange={(event) => setPlanningDays(Number(event.target.value))}
        >
          {[7, 30, 60, 90].map((days) => (
            <option key={days} value={days}>
              Next {days} days
            </option>
          ))}
        </SelectField>
      </label>
      {due.length ? (
        <div className="calendar-list">
          {due.map((f) => (
            <button
              key={f.id}
              onClick={() => setRecord(f)}
              className="calendar-row"
            >
              <span className="calendar-date">
                <small>{dateLabel(f.expectedDate!).split(' ')[0]}</small>
                <strong>{f.expectedDate!.slice(8)}</strong>
              </span>
              <span className="calendar-description">
                <strong>{f.name}</strong>
                <small>
                  {f.counterparty} · {f.category}
                </small>
              </span>
              <span className="amount">
                {money(outstanding(f), f.currency)}
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No dated payments in this window"
          description="Unscheduled and later obligations remain in your record list. Add dates to include them in planning."
        />
      )}
      <div className="coverage-strip">
        {Object.entries(w.coverage).map(([category, coverage]) => (
          <span
            key={category}
            className={`badge ${coverage.state === 'supplied' ? 'green' : coverage.state === 'absent' ? '' : 'amber'}`}
          >
            {category} ·{' '}
            {coverage.state === 'absent' ? 'confirmed absent' : coverage.state}
          </span>
        ))}
      </div>
      <p className="panel-footnote">
        Coverage is period-specific. Unknown or omitted categories prevent a
        claim that all business payments are covered.
      </p>
    </Panel>
  )
}

function PurchasingBudgetPanel({
  w,
  onIntake,
}: {
  w: Workspace
  onIntake: (
    section?: 'sales' | 'inventory' | 'finance' | 'suppliers' | 'profile',
  ) => void
}) {
  return (
    <Panel
      capability="budget"
      title="Purchasing budget"
      subtitle="Your spending limit, separate from cash"
    >
      {w.budget ? (
        <>
          <div className="large-amount">
            {money(w.budget.amount, w.profile.currency)}
          </div>
          <p className="muted">
            {w.budget.startDate} to {w.budget.endDate}
          </p>
          <div className="budget-line">
            <span>Recorded purchases in period</span>
            <strong>
              {w.purchases.some(
                (p) =>
                  p.orderDate >= w.budget!.startDate &&
                  p.orderDate <= w.budget!.endDate &&
                  p.amount !== null,
              )
                ? money(
                    w.purchases
                      .filter(
                        (p) =>
                          p.orderDate >= w.budget!.startDate &&
                          p.orderDate <= w.budget!.endDate,
                      )
                      .reduce((s, p) => s + (p.amount ?? 0), 0),
                    w.profile.currency,
                  )
                : 'No recorded purchases'}
            </strong>
          </div>
          <div className="budget-line">
            <span>Budget headroom · gross order commitments</span>
            <strong>
              {w.purchases.some(
                (p) =>
                  p.orderDate >= w.budget!.startDate &&
                  p.orderDate <= w.budget!.endDate &&
                  p.amount === null,
              )
                ? 'Unknown: unpriced purchases'
                : money(
                    w.budget.amount -
                      w.purchases
                        .filter(
                          (p) =>
                            p.orderDate >= w.budget!.startDate &&
                            p.orderDate <= w.budget!.endDate,
                        )
                        .reduce((sum, p) => sum + (p.amount ?? 0), 0),
                    w.profile.currency,
                  )}
            </strong>
          </div>
          <p className="notice small">
            Negative headroom is a budget breach. No listed purchases does not
            confirm a complete commitment register. A purchasing budget is not
            available cash and does not establish payment coverage.
          </p>
        </>
      ) : (
        <EmptyState
          title="No budget supplied"
          description="Record an amount and period to compare proposed or committed purchases with your own limit."
          action={
            <button
              className="button secondary"
              onClick={() => onIntake('finance')}
            >
              Add budget
            </button>
          }
        />
      )}
    </Panel>
  )
}

function FinanceMetrics({
  w,
  totals,
}: {
  w: Workspace
  totals: ReturnType<typeof financeTotals>
}) {
  return (
    <div className="metrics-grid">
      <MetricCard
        capability="liquidity"
        label="Available cash"
        value={money(w.cash?.amount ?? null, w.profile.currency)}
        note={
          w.cash
            ? `${w.cash.phase} · ${w.cash.date}`
            : 'Add a dated cash snapshot'
        }
        icon={<Wallet size={17} />}
        accent
      />
      <MetricCard
        capability="internal-debt"
        label="Internal Debt"
        value={
          w.finance.some(
            (f) => f.kind === 'receivable' || f.kind === 'provider_pending',
          )
            ? money(totals.internal, w.profile.currency)
            : 'Not provided'
        }
        note={`${money(totals.pending, w.profile.currency)} provider-pending funds`}
      />
      <MetricCard
        capability="external-debt"
        label="External Debt"
        value={
          w.finance.some((f) => f.kind === 'payable')
            ? money(totals.external, w.profile.currency)
            : 'Not provided'
        }
        note="Confirmed supplier payables only"
      />
      <MetricCard
        capability="financing"
        label="Known financing payments"
        value={
          w.finance.some((f) => f.kind === 'financing')
            ? money(totals.financing, w.profile.currency)
            : 'Not provided'
        }
        note="Financing Debt · supplied schedule only"
      />
    </div>
  )
}

function financialRecordsMatching(
  w: Workspace,
  tab: string,
  filter: string,
  search: string,
  asOf: string,
) {
  const kind =
    tab === 'Internal Debt'
      ? ['receivable', 'provider_pending']
      : tab === 'External Debt'
        ? ['payable']
        : tab === 'Financing Debt'
          ? ['financing']
          : [
              'receivable',
              'payable',
              'financing',
              'operating',
              'provider_pending',
            ]
  const kinds = new Set(kind)
  const rows = w.finance.filter(
    (f) =>
      kinds.has(f.kind) &&
      `${f.name} ${f.counterparty}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === 'All records' ||
        (filter === 'Outstanding' && outstanding(f) > 0) ||
        (filter === 'Overdue' &&
          f.dueDate !== null &&
          f.dueDate < asOf &&
          outstanding(f) > 0) ||
        (filter === 'Unscheduled' && f.expectedDate === null)),
  )
  return rows
}

function FinanceSectionSummary({
  tab,
  w,
  totals,
  onNavigate,
  onIntake,
  planningDays,
  asOf,
  setPlanningDays,
  due,
  setRecord,
  editable,
  onChange,
}: {
  tab: string
  w: Workspace
  totals: ReturnType<typeof financeTotals>
  onNavigate: (page: Page, query?: string) => void
  onIntake: (
    section?: 'sales' | 'inventory' | 'finance' | 'suppliers' | 'profile',
  ) => void
  planningDays: number
  asOf: string
  setPlanningDays: Dispatch<SetStateAction<number>>
  due: FinancialRecord[]
  setRecord: Dispatch<SetStateAction<FinancialRecord | null>>
  editable: boolean
  onChange: (w: Workspace) => void
}) {
  if (tab === 'Overview' || tab === 'Liquidity')
    return (
      <>
        <FinanceMetrics w={w} totals={totals} />
        <div className="overview-grid">
          <SavedProjection workspace={w} onNavigate={onNavigate} />
          <PurchasingBudgetPanel w={w} onIntake={onIntake} />
        </div>
        <CashPlanningPanel
          planningDays={planningDays}
          asOf={asOf}
          onNavigate={onNavigate}
          setPlanningDays={setPlanningDays}
          due={due}
          setRecord={setRecord}
          w={w}
        />
      </>
    )
  if (tab === 'Commitments')
    return (
      <CommitmentsPanel
        w={w}
        editable={editable}
        onChange={onChange}
        onIntake={onIntake}
      />
    )
  return (
    <div className="debt-intro">
      <span className="debt-icon">
        <CircleDollarSign size={25} />
      </span>
      <div>
        <h2>{tab}</h2>
        <p>
          {tab === 'Internal Debt'
            ? 'Customer receivables and collected funds still pending availability. Linked collection amounts are already deducted from the invoice balance.'
            : tab === 'External Debt'
              ? 'Confirmed amounts owed to suppliers. Expected recurring commitments appear in their own section.'
              : 'Borrowed funds and known repayments. Unrecorded future principal, interest and maturity remain unknown.'}
        </p>
      </div>
    </div>
  )
}
