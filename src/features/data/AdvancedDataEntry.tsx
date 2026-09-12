import { useWorkspaceAccess } from '../../components/workspace-access-context'
import { useState, type FormEvent } from 'react'
import {
  cutoff,
  type Workspace,
  type InventorySnapshot,
  type ServiceObservation,
  type InventoryLayer,
  type PaymentTerms,
} from '../../domain/workspace'
import { stableId } from './intake'
export type AdvancedDataKind = 'history' | 'service' | 'aging' | 'terms'
const titles = {
  history: 'Inventory history',
  service: 'Observed service',
  aging: 'Receipt age layers',
  terms: 'Payment terms',
}
const arrays = {
  history: 'inventoryHistory',
  service: 'serviceObservations',
  aging: 'inventoryLayers',
  terms: 'paymentTerms',
} as const
const read = (f: FormData, key: string) => String(f.get(key) ?? '').trim()
const value = (f: FormData, key: string, required = false): number | null => {
  const s = read(f, key)
  if (!s) {
    if (required) throw new Error(`Provide ${key}; zero is valid.`)
    return null
  }
  const n = Number(s)
  if (
    !Number.isFinite(n) ||
    (n < 0 && !['advanceDays', 'lostUnitMargin'].includes(key))
  )
    throw new Error(
      `${key} must be a usable ${key === 'advanceDays' ? '' : 'nonnegative '}number.`,
    )
  return n
}
export function AdvancedDataEntry({
  workspace: w,
  onChange,
  onClose,
  kind,
}: {
  workspace: Workspace
  onChange: (w: Workspace) => void
  onClose: () => void
  kind: AdvancedDataKind
}) {
  const { canEdit } = useWorkspaceAccess(),
    editable =
      kind === 'terms'
        ? canEdit('finance') || canEdit('suppliers')
        : canEdit('inventory')
  const [productId, setProductId] = useState(w.products[0]?.id ?? ''),
    [error, setError] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [saved, setSaved] = useState(false)
  const [pending, setPending] = useState<{
    next: Workspace
    details: string[]
  } | null>(null)
  const product = w.products.find((p) => p.id === productId),
    records = w[arrays[kind]] ?? []
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setConfirmed(false)
    try {
      const f = new FormData(event.currentTarget),
        locationId = read(f, 'location') || null,
        date = read(f, 'date'),
        reference = read(f, 'reference')
      if (kind !== 'terms' && (!product || !date || date > cutoff(w)))
        throw new Error(
          'Choose an existing product and a current or historical date.',
        )
      const sourceId = `src-${stableId(JSON.stringify([kind, ...f.entries()]))}`,
        id = `${kind}-${sourceId}`
      if (records.some((r) => r.id === id))
        throw new Error('This exact record has already been confirmed.')
      const next: Workspace = {
        ...w,
        revision: w.revision + 1,
        sources: [
          ...w.sources,
          {
            id: sourceId,
            name: `${titles[kind]} · ${reference || date || 'owner entry'}`,
            type: 'manual',
            rowCount: 1,
            excludedCount: 0,
            importedAt: new Date().toISOString(),
          },
        ],
      }
      const details = [
        `Source reference · ${reference || 'Manual owner observation'}`,
        `Currency · ${w.profile.currency}`,
      ]
      if (kind !== 'terms')
        details.push(
          `${product!.name} · ${product!.id} · ${product!.unit}`,
          `${w.locations.find((l) => l.id === locationId)?.name ?? 'Aggregate business scope'} · as of ${date}`,
        )
      if (kind === 'history') {
        const method = read(f, 'method') as InventorySnapshot['method'],
          throughDate =
            method === 'daily-observed' ? date : read(f, 'throughDate'),
          quantity = value(f, 'quantity', true)!,
          unitCost = value(f, 'unitCost')
        if (!throughDate || throughDate < date || throughDate > cutoff(w))
          throw new Error(
            'The interval must end on or after its start, within observed history.',
          )
        if (
          (w.inventoryHistory ?? []).some(
            (s) =>
              s.productId === productId &&
              s.locationId === locationId &&
              s.asOf <= throughDate &&
              s.throughDate >= date,
          )
        )
          throw new Error(
            'An existing observation overlaps this product/location interval. Review removal of the superseded record before replacement.',
          )
        const record: InventorySnapshot = {
          id,
          sourceId,
          productId,
          locationId,
          asOf: date,
          throughDate,
          method,
          quantity,
          unit: product!.unit,
          unitCost,
          currency: w.profile.currency,
        }
        next.inventoryHistory = [...(w.inventoryHistory ?? []), record]
        details.push(
          `${quantity} ${product!.unit} physical on-hand · ${unitCost ?? 'Unknown'} ${w.profile.currency} per unit`,
          `${date} through ${throughDate} · ${method === 'daily-observed' ? 'observed daily closing state' : 'explicit constant-value estimate, not observed daily stock'}`,
          'Complete period cost coverage is required for each included product/location. Missing dates are not interpolated.',
        )
      } else if (kind === 'service') {
        const requested = value(f, 'requested'),
          fulfilled = value(f, 'fulfilled'),
          availableQuantity = value(f, 'availableQuantity'),
          inStockMinutes = value(f, 'inStockMinutes'),
          observedMinutes = value(f, 'observedMinutes'),
          phase = read(f, 'phase') as ServiceObservation['phase']
        if (
          (requested === null) !== (fulfilled === null) ||
          (requested !== null && fulfilled! > requested)
        )
          throw new Error(
            'Supply requested and fulfilled units together; fulfilled cannot exceed requested.',
          )
        if (
          (inStockMinutes === null) !== (observedMinutes === null) ||
          (inStockMinutes !== null &&
            (observedMinutes! <= 0 || inStockMinutes > observedMinutes!))
        )
          throw new Error(
            'Duration needs a positive observed interval and in-stock minutes within it.',
          )
        if (
          requested === null &&
          availableQuantity === null &&
          observedMinutes === null
        )
          throw new Error(
            'Provide requested/fulfilled units, an observed available quantity, or measured duration.',
          )
        if (
          availableQuantity !== null &&
          (w.serviceObservations ?? []).some(
            (s) =>
              s.productId === productId &&
              s.locationId === locationId &&
              s.date === date &&
              s.phase === phase &&
              s.availableQuantity !== null,
          )
        )
          throw new Error(
            'Keep one availability observation per product/location/date/phase. Enter additional demand without repeating availability.',
          )
        const unmetDisposition = read(
            f,
            'unmetDisposition',
          ) as ServiceObservation['unmetDisposition'],
          backlogRemaining = value(f, 'backlogRemaining'),
          backlogAsOf = read(f, 'backlogAsOf') || null,
          lostUnitMargin = value(f, 'lostUnitMargin'),
          lostMarginBasis = read(f, 'lostMarginBasis'),
          orderReference = read(f, 'orderReference'),
          deliveredDate = read(f, 'deliveredDate') || null
        if (unmetDisposition !== 'unknown' && !orderReference)
          throw new Error(
            'Classified unmet demand needs a stable customer order/line reference.',
          )
        if (
          orderReference &&
          (w.serviceObservations ?? []).some(
            (s) =>
              s.productId === productId &&
              s.date === date &&
              s.orderReference === orderReference,
          )
        )
          throw new Error(
            'This product/order reference already has an initial-deadline observation. Review removal before correcting it; later fulfillment must not duplicate initial demand.',
          )
        if (
          unmetDisposition !== 'unknown' &&
          (requested === null || fulfilled === null)
        )
          throw new Error(
            'Classifying unmet demand requires requested and initially fulfilled quantities.',
          )
        if (
          unmetDisposition === 'backordered' &&
          (backlogRemaining === null ||
            !backlogAsOf ||
            backlogAsOf < date ||
            backlogAsOf > cutoff(w) ||
            backlogRemaining > requested! - fulfilled!)
        )
          throw new Error(
            'Backlog needs a remaining quantity no greater than initial unmet demand, and a known as-of date on or after the requested deadline.',
          )
        if (
          unmetDisposition !== 'backordered' &&
          (backlogRemaining !== null || backlogAsOf)
        )
          throw new Error(
            'Remaining backlog and its observation date apply only to explicitly backordered demand.',
          )
        if (
          lostUnitMargin !== null &&
          (unmetDisposition !== 'lost' || !lostMarginBasis)
        )
          throw new Error(
            'Lost-margin estimation needs lost classification and an explicit compatible per-unit margin basis.',
          )
        if (deliveredDate && (!orderReference || deliveredDate > cutoff(w)))
          throw new Error(
            'Actual delivery timing needs an order reference and a current or historical delivery date.',
          )
        const record: ServiceObservation = {
          id,
          sourceId,
          productId,
          locationId,
          date,
          unit: product!.unit,
          requested,
          fulfilled,
          availableQuantity,
          phase,
          deadline: 'initial-request',
          inStockMinutes,
          observedMinutes,
          unmetDisposition,
          backlogRemaining,
          backlogAsOf,
          lostUnitMargin,
          lostMarginBasis,
          orderReference,
          deliveredDate,
        }
        next.serviceObservations = [...(w.serviceObservations ?? []), record]
        details.push(
          `Unmet-demand disposition · ${unmetDisposition}. Lost and backordered quantities are disjoint.`,
          `Remaining backorder · ${backlogRemaining ?? 'Unknown'} ${product!.unit} as of ${backlogAsOf ?? 'Unknown'}; initial requested deadline ${date}.`,
          `Estimated lost unit margin · ${lostUnitMargin ?? 'Unknown'} ${w.profile.currency} per ${product!.unit} · ${lostMarginBasis || 'No estimate basis'}`,
          `Customer order · ${orderReference || 'Unknown'} · requested deadline ${date} · actual delivery ${deliveredDate ?? 'Unknown'}. Timing does not establish full delivery.`,
        )
        details.push(
          `Initial requested deadline · ${requested ?? 'Unknown'} requested / ${fulfilled ?? 'Unknown'} fulfilled. Later backlog fulfillment does not revise initial fill.`,
          `${phase} available quantity · ${availableQuantity ?? 'Unknown'}`,
          `Measured in-stock minutes · ${inStockMinutes ?? 'Unknown'} of ${observedMinutes ?? 'Unknown'}. Duration remains distinct from daily state counts.`,
        )
      } else if (kind === 'aging') {
        const receiptDate = read(f, 'receiptDate'),
          remainingQuantity = value(f, 'remainingQuantity', true)!
        if (!receiptDate || receiptDate > date)
          throw new Error(
            'Receipt date must be known and no later than the as-of date.',
          )
        const positions = w.stock.filter(
            (s) =>
              s.productId === productId &&
              s.locationId === locationId &&
              s.asOf === date &&
              s.quantityBasis !== 'available',
          ),
          prior = (w.inventoryLayers ?? [])
            .filter(
              (s) =>
                s.productId === productId &&
                s.locationId === locationId &&
                s.asOf === date,
            )
            .reduce((sum, s) => sum + s.remainingQuantity, 0)
        if (
          positions.length !== 1 ||
          prior + remainingQuantity > positions[0].onHand
        )
          throw new Error(
            'Layers require one matching physical-stock snapshot and cannot exceed its on-hand quantity.',
          )
        const record: InventoryLayer = {
          id,
          sourceId,
          productId,
          locationId,
          receiptDate,
          asOf: date,
          remainingQuantity,
          unit: product!.unit,
        }
        next.inventoryLayers = [...(w.inventoryLayers ?? []), record]
        details.push(
          `${remainingQuantity} ${product!.unit} remaining from receipt ${receiptDate}`,
          `${positions[0].onHand - prior - remainingQuantity} ${product!.unit} remain without receipt-age assignment. No FIFO age is inferred.`,
        )
      } else {
        const days = value(f, 'days', true)!,
          advancePercent = value(f, 'advancePercent'),
          advanceDays = value(f, 'advanceDays'),
          party = read(f, 'party') as PaymentTerms['party'],
          supplierId = read(f, 'supplierId') || null,
          counterparty =
            party === 'supplier'
              ? (w.suppliers.find((s) => s.id === supplierId)?.name ?? '')
              : read(f, 'counterparty')
        if (!Number.isInteger(days) || !counterparty)
          throw new Error(
            'Name the counterparty and supply whole calendar payment days.',
          )
        if (
          (advancePercent === null) !== (advanceDays === null) ||
          (advancePercent !== null &&
            (advancePercent > 100 || !Number.isInteger(advanceDays)))
        )
          throw new Error(
            'Provide both advance percentage (0–100) and whole event-relative days, or leave both unknown.',
          )
        const record: PaymentTerms = {
          id,
          sourceId,
          party,
          supplierId: party === 'supplier' ? supplierId : null,
          counterparty,
          days,
          startEvent: read(f, 'startEvent') as PaymentTerms['startEvent'],
          status: read(f, 'status') as PaymentTerms['status'],
          reference,
          ...(advancePercent !== null
            ? { advancePercent, advanceDays: advanceDays! }
            : {}),
        }
        next.paymentTerms = [...(w.paymentTerms ?? []), record]
        details.push(
          `${party} · ${counterparty} · ${record.status}`,
          `Balance due ${days} calendar days from ${record.startEvent}`,
          advancePercent === null
            ? 'Advance unknown.'
            : `${advancePercent}% advance at ${advanceDays} days from the same event; negative means before.`,
          'Saving terms does not change existing payment dates. Proposed terms need hypothetical consent when selected in a scenario.',
        )
      }
      setPending({ next, details })
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Review the supplied information.',
      )
    }
  }
  const input = (
    name: string,
    label: string,
    type = 'text',
    required = false,
  ) => (
    <label className="field" key={name}>
      {label}
      <input
        name={name}
        type={type}
        required={required}
        inputMode={
          type === 'text' &&
          ![
            'reference',
            'counterparty',
            'lostMarginBasis',
            'orderReference',
          ].includes(name)
            ? 'decimal'
            : undefined
        }
      />
    </label>
  )
  return (
    <div className="stack">
      <h2>{titles[kind]}</h2>
      <p className="muted">
        Record original observations with their scope. Review before applying.
        Blank is unknown; zero is a confirmed value.
      </p>
      {saved && (
        <p className="notice" role="status">
          Confirmed record applied. Current metrics now use it.
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {pending ? (
        <>
          <ul className="dependency-list">
            {pending.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm the original values, scope and stated interpretation.
          </label>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setPending(null)}
            >
              Back to values
            </button>
            <button
              className="button primary"
              disabled={!confirmed || !editable}
              onClick={() => {
                onChange(pending.next)
                setPending(null)
                setSaved(true)
                setConfirmed(false)
              }}
            >
              Confirm & apply record
            </button>
          </div>
        </>
      ) : (
        <form className="stack" onSubmit={submit}>
          <div className="form-grid">
            {kind !== 'terms' && (
              <>
                <label className="field">
                  Product
                  <select
                    name="productId"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    required
                  >
                    <option value="">Choose product</option>
                    {w.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.unit}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Location
                  <select name="location">
                    <option value="">Aggregate business scope</option>
                    {w.locations.map((l) => (
                      <option value={l.id} key={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
                {input('date', 'Observation / as-of date', 'date', true)}
              </>
            )}
            {kind === 'history' && (
              <>
                <label className="field">
                  Observation method
                  <select name="method">
                    <option value="daily-observed">
                      Observed daily closing quantity
                    </option>
                    <option value="constant-estimate">
                      Explicit constant-value interval estimate
                    </option>
                  </select>
                </label>
                {input(
                  'throughDate',
                  'Through date (interval estimates only)',
                  'date',
                )}
                {input(
                  'quantity',
                  `Physical quantity · ${product?.unit ?? 'product unit'}`,
                  'text',
                  true,
                )}
                {input(
                  'unitCost',
                  `Historical cost per unit · ${w.profile.currency}`,
                )}
              </>
            )}
            {kind === 'service' && (
              <>
                {input('requested', 'Initially requested units')}
                {input('fulfilled', 'Fulfilled at initial requested deadline')}
                {input('availableQuantity', 'Observed available quantity')}
                <label className="field">
                  Observation phase
                  <select name="phase">
                    <option value="closing">Daily closing</option>
                    <option value="opening">Daily opening</option>
                  </select>
                </label>
                {input('inStockMinutes', 'Measured in-stock minutes')}
                {input('observedMinutes', 'Total observed minutes')}
                <label className="field">
                  Unmet demand disposition
                  <select name="unmetDisposition">
                    <option value="unknown">Unknown / unclassified</option>
                    <option value="lost">Recorded abandoned / lost</option>
                    <option value="backordered">Carried as a backorder</option>
                  </select>
                </label>
                {input('backlogRemaining', 'Backorder units still pending')}
                {input('backlogAsOf', 'Backorder observation date', 'date')}
                {input(
                  'lostUnitMargin',
                  `Explicit lost unit margin estimate · ${w.profile.currency}`,
                )}
                {input('lostMarginBasis', 'Lost margin cost / price basis')}
                {input('orderReference', 'Customer order reference')}
                {input(
                  'deliveredDate',
                  'Actual customer delivery date',
                  'date',
                )}
              </>
            )}
            {kind === 'aging' && (
              <>
                {input('receiptDate', 'Original receipt date', 'date', true)}
                {input(
                  'remainingQuantity',
                  'Remaining units from this receipt',
                  'text',
                  true,
                )}
              </>
            )}
            {kind === 'terms' && (
              <>
                <label className="field">
                  Party
                  <select name="party">
                    <option value="supplier">Supplier</option>
                    <option value="customer">Customer</option>
                  </select>
                </label>
                <label className="field">
                  Supplier
                  <select name="supplierId">
                    <option value="">Choose for supplier terms</option>
                    {w.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                {input('counterparty', 'Customer name')}
                {input(
                  'days',
                  'Payment days from starting event',
                  'text',
                  true,
                )}
                <label className="field">
                  Starting event
                  <select name="startEvent">
                    {[
                      'invoice-date',
                      'order-date',
                      'receipt-date',
                      'delivery-date',
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Term status
                  <select name="status">
                    <option value="agreed">Agreed / recorded</option>
                    <option value="proposed">
                      Proposed / under negotiation
                    </option>
                  </select>
                </label>
                {input('advancePercent', 'Advance percentage (optional)')}
                {input(
                  'advanceDays',
                  'Advance days from same event (negative for before)',
                )}
              </>
            )}
            {input('reference', 'Original source / document reference')}
          </div>
          <div className="form-actions">
            <button
              className="button secondary"
              type="button"
              onClick={onClose}
            >
              Back to data intake
            </button>
            <button className="button primary" disabled={!editable}>
              Review {titles[kind].toLowerCase()}
            </button>
          </div>
        </form>
      )}
      {records.length > 0 && (
        <details>
          <summary>
            {records.length} existing {titles[kind].toLowerCase()} records
          </summary>
          {records.slice(-30).map((record) => (
            <div className="settings-row" key={record.id}>
              <div>
                <strong>{record.id}</strong>
                <p className="small muted">
                  {'asOf' in record
                    ? record.asOf
                    : 'date' in record
                      ? record.date
                      : `${record.counterparty}: ${record.days} days from ${record.startEvent}`}{' '}
                  · {record.sourceId}
                </p>
              </div>
              <button
                className="text-button"
                disabled={!editable}
                onClick={() => {
                  setConfirmed(false)
                  setPending({
                    next: {
                      ...w,
                      revision: w.revision + 1,
                      [arrays[kind]]: records.filter((r) => r.id !== record.id),
                    },
                    details: [
                      `Remove current record ${record.id}.`,
                      'Original source metadata and saved run snapshots remain unchanged. Current metrics use the remaining records.',
                    ],
                  })
                }}
              >
                Review removal
              </button>
            </div>
          ))}
        </details>
      )}
    </div>
  )
}
