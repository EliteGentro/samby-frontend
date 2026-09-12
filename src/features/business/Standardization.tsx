import { SelectField } from '../../components/ui/select-field'
import type { Dispatch, SetStateAction } from 'react'
import type { Product } from '../../domain/workspace'
import { TableHead } from '../../components/workspace-ui'
import { useState } from 'react'
import { useWorkspaceAccess } from '../../components/workspace-access-context'
import {
  affectedStandardizationRecords,
  applyStandardization,
  originalValue,
  standardizationFields,
  standardizationProposals,
  type StandardizationField,
  type StandardizationProposal,
} from '../../domain/standardization'
import type { Workspace } from '../../domain/workspace'
export function Standardization({
  workspace: w,
  onChange,
  onClose,
}: {
  workspace: Workspace
  onChange: (w: Workspace) => void
  onClose: () => void
}) {
  const [proposals, setProposals] = useState(() => standardizationProposals(w)),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState(''),
    [applied, setApplied] = useState(0)
  const [productId, setProductId] = useState(w.products[0]?.id ?? ''),
    [field, setField] = useState<StandardizationField>('name')
  const { role } = useWorkspaceAccess(),
    editable = role === 'owner' || role === 'administrator'
  const chosen = proposals.filter((p) => p.selected && !p.rejected)
  function patch(id: string, update: Partial<StandardizationProposal>) {
    setProposals((rows) =>
      rows.map((p) => (p.id === id ? { ...p, ...update } : p)),
    )
    setConfirm(false)
    setError('')
  }
  function apply() {
    try {
      const next = applyStandardization(w, proposals)
      if (!confirm) {
        setConfirm(true)
        return
      }
      if (!editable)
        throw new Error(
          'Your role can review these proposals but cannot apply inventory corrections.',
        )
      onChange(next)
      setApplied(chosen.length)
      setProposals((rows) =>
        rows.filter((p) => !chosen.some((c) => c.id === p.id)),
      )
      setConfirm(false)
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Review the selected values.',
      )
    }
  }
  return (
    <div className="stack">
      <p className="notice">
        {confirm
          ? `Confirm exactly ${chosen.length} selected changes below. IDs remain stable; original import cells and immutable run snapshots are retained.`
          : 'Suggestions identify possible inconsistencies. Review the original value, affected records and proposed correction. Similar names never authorize a product merge.'}
      </p>
      {applied > 0 && (
        <p className="notice" role="status">
          Applied {applied} confirmed corrections to current workspace records.
          Readiness has been recalculated; historical run snapshots are
          unchanged.
        </p>
      )}
      {!editable && (
        <p className="notice">
          Your role can review, but cannot apply inventory changes.
        </p>
      )}
      <SpecificCorrection
        productId={productId}
        setProductId={setProductId}
        w={w}
        field={field}
        setField={setField}
        proposals={proposals}
        setError={setError}
        setProposals={setProposals}
        setConfirm={setConfirm}
      />
      {proposals.length ? (
        <>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={proposals
                .filter((p) => !p.rejected)
                .every((p) => p.selected)}
              onChange={(e) => {
                setProposals((rows) =>
                  rows.map((p) => ({
                    ...p,
                    selected: e.target.checked && !p.rejected,
                  })),
                )
                setConfirm(false)
              }}
            />
            Select all non-rejected suggestions
          </label>
          <div className="table-wrap">
            <table className="data-table">
              <TableHead
                headers={[
                  'Approve',
                  'Product / field',
                  'Original',
                  'Proposed correction',
                  'Reason and affected records',
                  'Decision',
                ]}
              />
              <tbody>
                {proposals.map((p) => {
                  const affected = affectedStandardizationRecords(w, p),
                    product = w.products.find(
                      (product) => product.id === p.productId,
                    )
                  return (
                    <StandardizationRow
                      key={p.id}
                      p={p}
                      patch={patch}
                      product={product}
                      affected={affected}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="notice">
          No pending automatic corrections. You can create a specific reviewed
          correction above.
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="button secondary" onClick={onClose}>
          {applied ? 'Done' : 'Skip for now'}
        </button>
        <button
          className="button primary"
          disabled={!chosen.length || !editable}
          onClick={apply}
        >
          {confirm ? 'Confirm application' : `Review ${chosen.length} changes`}
        </button>
      </div>
      {!!w.standardization.length && (
        <details>
          <summary>Approved correction audit</summary>
          {w.standardization.map((a) => (
            <p className="small" key={a.id}>
              {a.date} · {a.productId} · {a.field ?? 'sku'}:{' '}
              {a.oldValue ?? a.oldSku} → {a.newValue ?? a.newSku}
              {a.conversionFactor
                ? ` · conversion ×${a.conversionFactor}`
                : ''}{' '}
              · {a.affectedRecordIds?.length ?? 'recorded'} affected records
            </p>
          ))}
        </details>
      )}
    </div>
  )
}

function StandardizationRow({
  p,
  patch,
  product,
  affected,
}: {
  p: StandardizationProposal
  patch: (id: string, update: Partial<StandardizationProposal>) => void
  product: Product | undefined
  affected: ReturnType<typeof affectedStandardizationRecords>
}) {
  return (
    <tr>
      <td>
        <input
          aria-label={`Approve ${p.oldValue || p.field}`}
          type="checkbox"
          disabled={p.rejected}
          checked={p.selected && !p.rejected}
          onChange={(e) => patch(p.id, { selected: e.target.checked })}
        />
      </td>
      <td>
        {product?.name}
        <small className="block muted">
          {p.productId} · {p.field}
        </small>
      </td>
      <td>{p.oldValue || 'Unknown'}</td>
      <td>
        <input
          aria-label={`Proposed ${p.field} for ${p.oldValue || p.productId}`}
          value={p.value}
          disabled={p.rejected}
          onChange={(e) => patch(p.id, { value: e.target.value })}
        />
        {p.field === 'unit' && (
          <div className="stack">
            <label className="field">
              New units per 1 old unit
              <input
                inputMode="decimal"
                value={p.factor ?? ''}
                onChange={(e) => {
                  const value = e.target.value.trim()
                  const factor = value ? Number(value) : undefined
                  patch(p.id, {
                    factor:
                      factor !== undefined && Number.isFinite(factor)
                        ? factor
                        : undefined,
                  })
                }}
              />
            </label>
            <label className="field">
              Conversion source / basis
              <input
                value={p.basis ?? ''}
                onChange={(e) => patch(p.id, { basis: e.target.value })}
              />
            </label>
            <small>
              1 {p.oldValue} = {p.factor ?? 'unknown'} {p.value}. Linked
              quantities multiply by this factor; unit cost/price divide. Total
              monetary amounts are unchanged.
            </small>
          </div>
        )}
      </td>
      <td>
        {p.reason}
        <small className="block muted">
          {affected.products.length} product identities ·{' '}
          {affected.records.length} linked records · sources{' '}
          {affected.sourceIds.join(', ') || 'manual records'}
        </small>
        <details>
          <summary>Inspect affected values</summary>
          {affected.records.map((record) => (
            <p className="small" key={record.id}>
              {record.id}
              {'quantity' in record
                ? ` · quantity ${record.quantity ?? 'Unknown'}`
                : 'onHand' in record
                  ? ` · on hand ${record.onHand} · reserved ${record.reserved ?? 'Unknown'}`
                  : 'remainingQuantity' in record
                    ? ` · remaining ${record.remainingQuantity}`
                    : 'requested' in record
                      ? ` · requested ${record.requested ?? 'Unknown'} / fulfilled ${record.fulfilled ?? 'Unknown'}`
                      : ''}
            </p>
          ))}
        </details>
      </td>
      <td>
        <button
          className="text-button"
          onClick={() =>
            patch(p.id, {
              rejected: !p.rejected,
              selected: false,
            })
          }
        >
          {p.rejected ? 'Rejected · restore' : 'Reject suggestion'}
        </button>
      </td>
    </tr>
  )
}

function SpecificCorrection({
  productId,
  setProductId,
  w,
  field,
  setField,
  proposals,
  setError,
  setProposals,
  setConfirm,
}: {
  productId: string
  setProductId: Dispatch<SetStateAction<string>>
  w: Workspace
  field: StandardizationField
  setField: Dispatch<SetStateAction<StandardizationField>>
  proposals: StandardizationProposal[]
  setError: Dispatch<SetStateAction<string>>
  setProposals: Dispatch<SetStateAction<StandardizationProposal[]>>
  setConfirm: Dispatch<SetStateAction<boolean>>
}) {
  return (
    <details>
      <summary>Add a specific correction</summary>
      <div className="form-grid">
        <label className="field">
          Product
          <SelectField
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            {w.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.sku}
              </option>
            ))}
          </SelectField>
        </label>
        <label className="field">
          Field
          <SelectField
            value={field}
            onChange={(e) => setField(e.target.value as StandardizationField)}
          >
            {standardizationFields.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </SelectField>
        </label>
      </div>
      <button
        className="button secondary"
        onClick={() => {
          const product = w.products.find((p) => p.id === productId)
          if (!product) return
          const id = `${productId}-${field}`
          if (proposals.some((p) => p.id === id)) {
            setError(
              'This field already has a proposal. Edit the existing row.',
            )
            return
          }
          const oldValue = originalValue(w, product, field)
          setProposals((rows) => [
            ...rows,
            {
              id,
              productId,
              field,
              oldValue,
              value: oldValue,
              reason:
                'Owner-requested correction; review the original source before approval.',
              selected: false,
              rejected: false,
              ...(field === 'unit' ? { factor: 1, basis: '' } : {}),
            },
          ])
          setConfirm(false)
        }}
      >
        Create review proposal
      </button>
    </details>
  )
}
