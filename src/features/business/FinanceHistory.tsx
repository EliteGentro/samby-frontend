import { SortableTable } from '../../components/SortableTable'
import { DisclosureCard } from '../../components/ui/disclosure-card'
import { SelectField } from '../../components/ui/select-field'
import type { FinancialRecord } from '../../domain/workspace'
import type { Dispatch, SetStateAction } from 'react'
import { TableHead } from '../../components/workspace-ui'
import { useState, type FormEvent } from 'react'
import { MetricCard, Modal, Panel } from '../../components/workspace-ui'
import { useWorkspaceAccess } from '../../components/workspace-access-context'
import {
  financeEventIssues,
  financeEventKinds,
  financeHistory,
} from '../../domain/finance-history'
import {
  cutoff,
  money,
  shiftDate,
  type FinanceEvent,
  type Workspace,
} from '../../domain/workspace'

type Draft = Omit<FinanceEvent, 'amount'> & { amount: string }

export function FinanceHistory({
  workspace,
  onChange,
  start,
  end,
  kind,
}: {
  workspace: Workspace
  onChange: (workspace: Workspace) => void
  start?: string
  end?: string
  kind?: 'internal' | 'external'
}) {
  const [days, setDays] = useState(30)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [review, setReview] = useState<FinanceEvent | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const { canEdit } = useWorkspaceAccess()
  const editable = canEdit('finance')
  const periodEnd = end ?? cutoff(workspace),
    periodStart = start ?? shiftDate(periodEnd, 1 - days)
  const result = financeHistory(workspace, periodStart, periodEnd, kind)
  const stages = (
    Object.keys(financeEventKinds) as FinanceEvent['kind'][]
  ).filter(
    (stage) =>
      !kind ||
      (kind === 'internal'
        ? stage !== 'supplier_payment'
        : stage === 'supplier_payment'),
  )
  const linked = draft
    ? workspace.finance.find((record) => record.id === draft.recordId)
    : undefined

  function open(event?: FinanceEvent) {
    setDraft(
      event
        ? { ...event, amount: String(event.amount) }
        : {
            id: crypto.randomUUID(),
            sourceId: crypto.randomUUID(),
            kind: stages[0],
            recordId: '',
            paymentReference: '',
            date: cutoff(workspace),
            amount: '',
            currency: workspace.profile.currency,
          },
    )
    setReview(null)
    setConfirmed(false)
    setError('')
    setStatus('')
  }

  function patch(update: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...update } : null))
    setReview(null)
    setConfirmed(false)
    setError('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft || !editable) return
    if (!draft.amount.trim()) {
      setError('Provide the observed amount; blank is unknown, not zero.')
      return
    }
    const candidate = {
      ...draft,
      amount: Number(draft.amount),
      paymentReference: draft.paymentReference.trim(),
    }
    const combined = [
      ...(workspace.financeEvents ?? []).filter(
        (item) => item.id !== candidate.id,
      ),
      candidate,
    ]
    const checked = financeEventIssues(workspace, combined)
    const issue = checked.find((item) => item.event.id === candidate.id)?.reason
    const priorValid = new Set(
      financeEventIssues(workspace)
        .filter((item) => !item.reason)
        .map((item) => item.event.id),
    )
    const invalidated = checked.find(
      (item) =>
        item.reason &&
        item.event.id !== candidate.id &&
        priorValid.has(item.event.id),
    )
    if (issue || invalidated) {
      setError(
        issue ??
          `This change would make ${invalidated!.event.paymentReference} inconsistent: ${invalidated!.reason}`,
      )
      return
    }
    setReview(candidate)
    setConfirmed(false)
    setError('')
  }

  function save() {
    if (!review || !confirmed || !editable) return
    onChange({
      ...workspace,
      financeEvents: [
        ...(workspace.financeEvents ?? []).filter(
          (event) => event.id !== review.id,
        ),
        review,
      ],
      sources: workspace.sources.some((source) => source.id === review.sourceId)
        ? workspace.sources
        : [
            ...workspace.sources,
            {
              id: review.sourceId,
              name: `Manual historical payment · ${review.paymentReference}`,
              type: 'manual',
              importedAt: new Date().toISOString(),
              rowCount: 1,
              excludedCount: 0,
            },
          ],
    })
    setStatus(
      `${review.paymentReference} saved as a historical observation. Cash and cumulative paid balances are unchanged.`,
    )
    setDraft(null)
    setReview(null)
  }

  return (
    <>
      <Panel
        title="Recorded collections and payments"
        subtitle={`Historical event dates · ${periodStart} to ${periodEnd} · ${workspace.profile.currency}`}
        action={
          <button
            className="button secondary"
            disabled={!editable}
            onClick={() => open()}
          >
            Record historical payment
          </button>
        }
      >
        {start === undefined && end === undefined && (
          <label className="field">
            Historical reporting window
            <SelectField
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            >
              {[7, 30, 60, 90].map((value) => (
                <option key={value} value={value}>
                  Last {value} days
                </option>
              ))}
            </SelectField>
          </label>
        )}
        <div className="metrics-grid">
          {kind !== 'external' && (
            <>
              <MetricCard
                capability="internal-debt"
                label="Customer collections recorded"
                value={money(result.collections, workspace.profile.currency)}
                note="Actual dated customer-payment observations in this period"
              />
              <MetricCard
                capability="internal-debt"
                label="Provider funds made available"
                value={money(result.available, workspace.profile.currency)}
                note="Later availability stage; never added to collections as new money"
              />
            </>
          )}
          {kind !== 'internal' && (
            <MetricCard
              capability="external-debt"
              label="Supplier payments recorded"
              value={money(result.payments, workspace.profile.currency)}
              note="Actual dated payments linked to supplier payables"
            />
          )}
        </div>
        <p className="notice">
          These subtotals cover supplied dated observations. Missing
          observations do not establish zero collections or payments. Cumulative
          paid amounts and current outstanding balances do not establish
          historical event dates. Recording an observation never changes cash or
          creates a future payment.
        </p>
        {status && (
          <p className="notice" role="status">
            {status}
          </p>
        )}
        {result.warnings.map((warning) => (
          <p key={warning} className="notice warning">
            {warning}
          </p>
        ))}
        {result.rows.length > 0 && (
          <FinanceEventTable
            result={result}
            workspace={workspace}
            editable={editable}
            open={open}
          />
        )}
        <FinanceEventDialog
          draft={draft}
          setDraft={setDraft}
          submit={submit}
          patch={patch}
          stages={stages}
          workspace={workspace}
          linked={linked}
          error={error}
          review={review}
          confirmed={confirmed}
          setConfirmed={setConfirmed}
          editable={editable}
          save={save}
        />
      </Panel>
      <FinanceReconciliation result={result} editable={editable} open={open} />
    </>
  )
}

function FinanceEventDialog({
  draft,
  setDraft,
  submit,
  patch,
  stages,
  workspace,
  linked,
  error,
  review,
  confirmed,
  setConfirmed,
  editable,
  save,
}: {
  draft: Draft | null
  setDraft: Dispatch<SetStateAction<Draft | null>>
  submit: (event: FormEvent) => void
  patch: (update: Partial<Draft>) => void
  stages: (
    | 'customer_collection'
    | 'provider_availability'
    | 'supplier_payment'
  )[]
  workspace: Workspace
  linked: FinancialRecord | undefined
  error: string
  review: FinanceEvent | null
  confirmed: boolean
  setConfirmed: Dispatch<SetStateAction<boolean>>
  editable: boolean
  save: () => void
}) {
  return (
    <Modal
      open={draft !== null}
      onClose={() => setDraft(null)}
      title="Record an observed payment stage"
      description="Use an actual dated source and a confirmed financial record. This is a historical observation, not a payment instruction."
    >
      {draft && (
        <form className="stack" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              Observed stage
              <SelectField
                value={draft.kind}
                onChange={(event) =>
                  patch({
                    kind: event.target.value as FinanceEvent['kind'],
                    recordId: '',
                  })
                }
              >
                {stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {financeEventKinds[stage].label}
                  </option>
                ))}
              </SelectField>
            </label>
            <label className="field">
              Linked financial record
              <SelectField
                required
                value={draft.recordId}
                onChange={(event) => patch({ recordId: event.target.value })}
              >
                <option value="">Choose a confirmed record</option>
                {workspace.finance
                  .filter(
                    (record) =>
                      record.kind === financeEventKinds[draft.kind].recordKind,
                  )
                  .map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.name} · {record.counterparty || record.id}
                    </option>
                  ))}
              </SelectField>
            </label>
            <label className="field">
              Payment or allocation reference
              <input
                required
                value={draft.paymentReference}
                onChange={(event) =>
                  patch({ paymentReference: event.target.value })
                }
              />
            </label>
            <label className="field">
              Actual event date
              <input
                required
                type="date"
                max={cutoff(workspace)}
                value={draft.date}
                onChange={(event) => patch({ date: event.target.value })}
              />
            </label>
            <label className="field">
              Observed amount
              <input
                required
                type="number"
                min="0"
                step="any"
                value={draft.amount}
                onChange={(event) => patch({ amount: event.target.value })}
              />
            </label>
            <label className="field">
              Currency
              <input
                required
                maxLength={3}
                value={draft.currency}
                onChange={(event) =>
                  patch({ currency: event.target.value.toUpperCase() })
                }
              />
            </label>
          </div>
          <p className="panel-footnote">
            Use a unique reference per stage; split payments require distinct
            allocation references. The same reference may link a customer
            collection to its later provider availability. Those stages remain
            separate.{' '}
            {linked
              ? `This record has ${money(linked.paidAmount, linked.currency)} cumulatively paid${linked.kind === 'provider_pending' ? ' / made available' : ''}. Historical events cannot exceed that recorded total.`
              : 'Select a record with an already confirmed cumulative paid amount.'}
          </p>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {review && (
            <section
              className="notice"
              aria-label="Historical payment confirmation"
            >
              <h3>Confirm observed values</h3>
              <p>
                {financeEventKinds[review.kind].label} ·{' '}
                {review.paymentReference} · {review.date} ·{' '}
                {money(review.amount, review.currency)} · {review.recordId}.
              </p>
              <p>
                Current cash, cumulative paid amounts and saved analytical
                results remain unchanged.
              </p>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                I verified this historical event against its source
              </label>
            </section>
          )}
          <div className="form-actions">
            <button
              className="button secondary"
              type="button"
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
            {review ? (
              <button
                className="button primary"
                type="button"
                disabled={!confirmed || !editable}
                onClick={save}
              >
                Confirm historical event
              </button>
            ) : (
              <button
                className="button primary"
                type="submit"
                disabled={!editable}
              >
                Review historical event
              </button>
            )}
          </div>
        </form>
      )}
    </Modal>
  )
}

function FinanceEventTable({
  result,
  workspace,
  editable,
  open,
}: {
  result: ReturnType<typeof financeHistory>
  workspace: Workspace
  editable: boolean
  open: (event?: FinanceEvent) => void
}) {
  return (
    <div className="table-wrap">
      <SortableTable className="data-table">
        <TableHead
          headers={[
            'Observed date',
            'Payment stage / reference',
            'Linked record',
            'Amount',
            'Source',
            'Review',
          ]}
        />
        <tbody>
          {result.rows.map(({ event, record }) => (
            <tr key={event.id}>
              <th scope="row">{event.date}</th>
              <td>
                {financeEventKinds[event.kind].label}
                <small className="block muted">{event.paymentReference}</small>
              </td>
              <td>
                {record?.name}
                <small className="block muted">
                  {record?.counterparty || 'Counterparty not provided'} ·{' '}
                  {event.recordId}
                </small>
              </td>
              <td>{money(event.amount, event.currency)}</td>
              <td>
                {workspace.sources.find(
                  (source) => source.id === event.sourceId,
                )?.name ?? event.sourceId}
              </td>
              <td>
                <button
                  className="text-button"
                  disabled={!editable}
                  onClick={() => open(event)}
                  aria-label={`Edit historical ${event.paymentReference}`}
                >
                  Review event
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </SortableTable>
    </div>
  )
}

function FinanceReconciliation({
  result,
  editable,
  open,
}: {
  result: ReturnType<typeof financeHistory>
  editable: boolean
  open: (event?: FinanceEvent) => void
}) {
  if (!result.excluded.length) return null
  return (
    <DisclosureCard
      title="Historical observations requiring reconciliation"
      description={`${result.excluded.length} ${result.excluded.length === 1 ? 'observation needs' : 'observations need'} review before inclusion`}
    >
      <div className="grid gap-3">
        {result.excluded.map(({ event, reason }) => (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
            key={event.id}
          >
            <p className="text-xs leading-5 text-muted-foreground">
              <strong className="text-foreground">
                {event.paymentReference || event.id}
              </strong>{' '}
              · {reason}
            </p>
            <button
              className="text-button"
              disabled={!editable}
              onClick={() => open(event)}
            >
              Review {event.paymentReference || event.id}
            </button>
          </div>
        ))}
      </div>
    </DisclosureCard>
  )
}
