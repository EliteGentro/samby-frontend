import { useState, type FormEvent } from 'react'
import { Modal, Panel } from '../../components/workspace-ui'
import { useWorkspaceAccess } from '../../components/workspace-access-context'
import {
  money,
  type PendingFinanceRecord,
  type Workspace,
} from '../../domain/workspace'

type Draft = Omit<PendingFinanceRecord, 'amount' | 'paidAmount'> & {
  amount: string
  paidAmount: string
}

function optionalAmount(value: string, label: string): number | null {
  if (!value.trim()) return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error(
      `${label} must be a nonnegative amount or left blank when unknown.`,
    )
  return amount
}

function reviewedRecord(draft: Draft): PendingFinanceRecord {
  const amount = optionalAmount(draft.amount, 'Original amount')
  const paidAmount = optionalAmount(draft.paidAmount, 'Cumulative paid amount')
  if (!draft.name.trim())
    throw new Error(
      'Provide a name or reference so this record can be identified.',
    )
  if (!/^[A-Z]{3}$/.test(draft.currency))
    throw new Error('Provide a three-letter uppercase currency code.')
  if (amount !== null && paidAmount !== null && paidAmount > amount)
    throw new Error('Cumulative paid amount cannot exceed the original amount.')
  for (const date of [draft.dueDate, draft.expectedDate]) {
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) ||
        new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date)
    )
      throw new Error(
        'Provide valid calendar dates or leave missing dates blank.',
      )
  }
  return {
    ...draft,
    name: draft.name.trim(),
    counterparty: draft.counterparty.trim(),
    amount,
    paidAmount,
  }
}

export function PendingFinance({
  workspace,
  onChange,
}: {
  workspace: Workspace
  onChange: (workspace: Workspace) => void
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [review, setReview] = useState<PendingFinanceRecord | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const { canEdit } = useWorkspaceAccess()
  const editable = canEdit('finance')
  const pending = workspace.pendingFinance ?? []

  function edit(record?: PendingFinanceRecord) {
    setDraft(
      record
        ? {
            ...record,
            amount: record.amount?.toString() ?? '',
            paidAmount: record.paidAmount?.toString() ?? '',
          }
        : {
            id: crypto.randomUUID(),
            sourceId: crypto.randomUUID(),
            kind: 'receivable',
            name: '',
            counterparty: '',
            currency: workspace.profile.currency,
            amount: '',
            paidAmount: '',
            dueDate: null,
            expectedDate: null,
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
    try {
      setReview(reviewedRecord(draft))
      setConfirmed(false)
      setError('')
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Review this record before saving.',
      )
    }
  }

  function save() {
    if (!review || !confirmed || !editable) return
    if (workspace.finance.some((record) => record.id === review.id)) {
      setError(
        'This record is already in the financial register. Reload the workspace before editing it again.',
      )
      return
    }
    const complete = review.amount !== null && review.paidAmount !== null
    const category = review.kind === 'receivable' ? 'collections' : 'suppliers'
    const coverage = workspace.coverage[category]
    const next: Workspace = {
      ...workspace,
      pendingFinance: [
        ...pending.filter((record) => record.id !== review.id),
        ...(complete ? [] : [review]),
      ],
      finance: complete
        ? [
            ...workspace.finance,
            {
              ...review,
              amount: review.amount!,
              paidAmount: review.paidAmount!,
              category,
              linkedRecordId: null,
              cashIncluded: false,
            },
          ]
        : workspace.finance,
      sources: workspace.sources.some((source) => source.id === review.sourceId)
        ? workspace.sources
        : [
            ...workspace.sources,
            {
              id: review.sourceId,
              name: `Manual financial record · ${review.name}`,
              type: 'manual',
              importedAt: new Date().toISOString(),
              rowCount: 1,
              excludedCount: 0,
            },
          ],
      coverage: ['absent', 'omitted'].includes(coverage.state)
        ? {
            ...workspace.coverage,
            [category]: { ...coverage, state: 'unknown' },
          }
        : workspace.coverage,
    }
    onChange(next)
    setDraft(null)
    setReview(null)
    setStatus(
      complete
        ? `${review.name} is now in the financial register with the same record ID.`
        : `${review.name} saved with its missing amounts unchanged. It is excluded from numerical balances.`,
    )
  }

  return (
    <Panel
      title="Financial records to complete"
      subtitle="Retain identified receivables and payables while their amounts are being confirmed"
      action={
        <button
          className="button secondary"
          disabled={!editable}
          onClick={() => edit()}
        >
          Add incomplete record
        </button>
      }
    >
      <p className="notice">
        {pending.length
          ? `${pending.length} incomplete records. Missing amounts remain unknown and are excluded from debt totals, collection timelines and numerical cash projections. Their presence makes the financial scope incomplete.`
          : 'No incomplete records saved. You can retain an identified receivable or payable now and confirm its missing amounts later.'}
      </p>
      {!editable && (
        <p className="muted">
          Your role can inspect these records. A finance member or workspace
          administrator can edit them.
        </p>
      )}
      {status && (
        <p className="notice" role="status">
          {status}
        </p>
      )}
      {pending.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Record</th>
                <th scope="col">Type / counterparty</th>
                <th scope="col">Original amount</th>
                <th scope="col">Cumulative paid</th>
                <th scope="col">Dates / source</th>
                <th scope="col">Review</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((record) => (
                <tr key={record.id}>
                  <th scope="row">
                    {record.name}
                    <small className="block muted">{record.id}</small>
                  </th>
                  <td>
                    {record.kind}
                    <small className="block muted">
                      {record.counterparty || 'Counterparty not provided'}
                    </small>
                  </td>
                  <td>
                    {money(record.amount, record.currency)}
                    <small className="block muted">{record.currency}</small>
                  </td>
                  <td>{money(record.paidAmount, record.currency)}</td>
                  <td>
                    Due: {record.dueDate ?? 'Not provided'}
                    <small className="block muted">
                      Expected: {record.expectedDate ?? 'Not provided'}
                    </small>
                    <small className="block muted">
                      {workspace.sources.find(
                        (source) => source.id === record.sourceId,
                      )?.name ?? record.sourceId}
                    </small>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      disabled={!editable}
                      onClick={() => edit(record)}
                      aria-label={`Complete ${record.name}`}
                    >
                      Edit and complete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title="Review an incomplete financial record"
        description="A name or reference is enough to retain a record. Leave unknown amounts blank; enter zero only when it is confirmed."
      >
        {draft && (
          <form onSubmit={submit} className="stack">
            <div className="form-grid">
              <label className="field">
                Record type
                <SelectField
                  value={draft.kind}
                  onChange={(event) =>
                    patch({
                      kind: event.target.value as PendingFinanceRecord['kind'],
                    })
                  }
                >
                  <option value="receivable">Customer receivable</option>
                  <option value="payable">Supplier payable</option>
                </SelectField>
              </label>
              <label className="field">
                Name or reference
                <input
                  required
                  value={draft.name}
                  onChange={(event) => patch({ name: event.target.value })}
                />
              </label>
              <label className="field">
                Counterparty · optional
                <input
                  value={draft.counterparty}
                  onChange={(event) =>
                    patch({ counterparty: event.target.value })
                  }
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
              <label className="field">
                Original amount · blank means unknown
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={draft.amount}
                  onChange={(event) => patch({ amount: event.target.value })}
                />
              </label>
              <label className="field">
                Cumulative paid amount · blank means unknown
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={draft.paidAmount}
                  onChange={(event) =>
                    patch({ paidAmount: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Contractual due date · optional
                <input
                  type="date"
                  value={draft.dueDate ?? ''}
                  onChange={(event) =>
                    patch({ dueDate: event.target.value || null })
                  }
                />
              </label>
              <label className="field">
                Expected collection or payment date · optional
                <input
                  type="date"
                  value={draft.expectedDate ?? ''}
                  onChange={(event) =>
                    patch({ expectedDate: event.target.value || null })
                  }
                />
              </label>
            </div>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            {review && (
              <section
                className="notice"
                aria-label="Financial record confirmation"
              >
                <h3>Confirm this record</h3>
                <p>
                  {review.name} · {review.kind} · {review.currency}. Original:{' '}
                  {money(review.amount, review.currency)}. Cumulative paid:{' '}
                  {money(review.paidAmount, review.currency)}.
                </p>
                <p>
                  {review.amount !== null && review.paidAmount !== null
                    ? 'Both amounts are known. Confirmation moves this record to the financial register with the same ID. Missing dates remain missing; saving does not change cash on hand.'
                    : 'This record remains incomplete and excluded from numerical balances. Missing fields remain unknown.'}
                </p>
                <p>
                  Due: {review.dueDate ?? 'Not provided'} · expected:{' '}
                  {review.expectedDate ?? 'Not provided'} · counterparty:{' '}
                  {review.counterparty || 'Not provided'}.
                </p>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  I reviewed these exact values and their missing fields
                </label>
              </section>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setDraft(null)}
              >
                Cancel
              </button>
              {review ? (
                <button
                  type="button"
                  className="button primary"
                  disabled={!confirmed || !editable}
                  onClick={save}
                >
                  Confirm and save record
                </button>
              ) : (
                <button
                  className="button primary"
                  type="submit"
                  disabled={!editable}
                >
                  Review record
                </button>
              )}
            </div>
          </form>
        )}
      </Modal>
    </Panel>
  )
}
import { SelectField } from '../../components/ui/select-field'
