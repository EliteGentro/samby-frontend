import { categories, money, type FinancialRecord } from '../../domain/workspace'
import { type OnboardingViewModel } from './use-onboarding'

export function InventoryPoolForm(props: OnboardingViewModel) {
  const {
    draft,
    inventoryTab,
    poolSubmit,

    captureFields,
    fieldProps,
    workspace,
    fieldKey,
  } = props
  return (
    <>
      {draft.section === 'inventory' && inventoryTab === 'pool' && (
        <form className="stack" onSubmit={poolSubmit} onChange={captureFields}>
          <p>
            A pool records which known locations and sales channels share stock.
            Its total retains the physical contribution of each location. It
            does not create duplicate inventory.
          </p>
          <label className="field">
            Pool name
            <input {...fieldProps('poolName')} required />
          </label>
          <fieldset>
            <legend>Contributing physical locations</legend>
            {workspace.locations.length ? (
              workspace.locations.map((location) => (
                <label className="checkbox-field" key={location.id}>
                  <input
                    type="checkbox"
                    name={`poolLocation-${location.id}`}
                    defaultChecked={
                      draft.fields[fieldKey(`poolLocation-${location.id}`)] ===
                      'on'
                    }
                  />
                  {location.name}
                </label>
              ))
            ) : (
              <p className="notice">
                Add stock with at least one known location first. Aggregate
                stock cannot be split into invented warehouses.
              </p>
            )}
          </fieldset>
          <label className="field">
            Sales channels using this pool{' '}
            <span className="muted">Optional</span>
            <input
              {...fieldProps('poolChannels')}
              placeholder="Separate your channel names with commas"
            />
            <small>
              A channel uses the selected pool. It does not own another copy of
              that stock.
            </small>
          </label>
          {(workspace.inventoryPools ?? []).length > 0 && (
            <div className="panel">
              <h3>Declared pools</h3>
              {workspace.inventoryPools!.map((pool) => (
                <p key={pool.id}>
                  {pool.name} ·{' '}
                  {pool.locationIds
                    .map(
                      (id) =>
                        workspace.locations.find(
                          (location) => location.id === id,
                        )?.name ?? id,
                    )
                    .join(', ')}{' '}
                  · {pool.channelNames.join(', ') || 'No channels supplied'}
                </p>
              ))}
            </div>
          )}
          <div className="form-actions">
            <button
              type="submit"
              className="button primary"
              disabled={!workspace.locations.length}
            >
              Review shared pool
            </button>
          </div>
        </form>
      )}
    </>
  )
}

export function InventoryStockForm(props: OnboardingViewModel) {
  const {
    draft,
    inventoryTab,
    inventorySubmit,

    captureFields,
    fieldProps,
    workspace,
  } = props
  return (
    <>
      {draft.section === 'inventory' && inventoryTab === 'stock' && (
        <form
          className="stack"
          onSubmit={inventorySubmit}
          onChange={captureFields}
        >
          <div className="form-grid">
            <label className="field">
              SKU or product reference
              <input {...fieldProps('sku')} list="intake-skus" />
              <datalist id="intake-skus">
                {workspace.products.map((product) => (
                  <option key={product.id} value={product.sku}>
                    {product.name}
                  </option>
                ))}
              </datalist>
              <small>
                Exact references stay distinct. A missing SKU can receive a
                reviewed internal reference.
              </small>
            </label>
            <label className="field">
              Product name
              <input {...fieldProps('productName')} />
            </label>
            <label className="field">
              Quantity basis
              <select {...fieldProps('quantityBasis', 'on-hand')}>
                <option value="on-hand">On hand · physical stock</option>
                <option value="available">
                  Available · reservations already deducted
                </option>
              </select>
            </label>
            <label className="field">
              Recorded stock quantity
              <input
                {...fieldProps('stockQuantity')}
                required
                inputMode="decimal"
              />
              <small>
                Zero is a confirmed quantity. Negative source values remain
                visible as exceptions.
              </small>
            </label>
            <label className="field">
              Unit
              <input
                {...fieldProps('stockUnit')}
                required
                placeholder="pieces, boxes…"
              />
            </label>
            <label className="field">
              Reserved quantity <span className="muted">Optional</span>
              <input {...fieldProps('reserved')} inputMode="decimal" />
              <small>
                For on-hand stock. Blank means unknown, including whether
                reservations exist.
              </small>
            </label>
            <label className="field">
              Backordered quantity <span className="muted">Optional</span>
              <input {...fieldProps('backordered')} inputMode="decimal" />
              <small>
                Known outstanding customer demand. Blank is unknown. Separate
                from reservations and on-hand stock.
              </small>
            </label>
            <label className="field">
              Stock date
              <input {...fieldProps('stockDate')} type="date" required />
            </label>
            <label className="field">
              Location <span className="muted">Optional</span>
              <input {...fieldProps('stockLocation')} />
              <small>
                Blank means aggregate business scope. No warehouse split is
                inferred.
              </small>
            </label>
            <label className="field">
              Unit cost · {workspace.profile.currency}
              <input {...fieldProps('cost')} inputMode="decimal" />
              <small>
                Cost for one unit above. Blank is unknown. Zero is a confirmed
                cost.
              </small>
            </label>
            <label className="field">
              Unit selling price · {workspace.profile.currency}
              <input {...fieldProps('price')} inputMode="decimal" />
            </label>
            <label className="field">
              Category <span className="muted">Optional</span>
              <input {...fieldProps('category')} />
            </label>
            <label className="field">
              Brand <span className="muted">Optional</span>
              <input {...fieldProps('brand')} />
            </label>
          </div>
          <details className="panel onboarding-advanced">
            <summary>Optional inventory policies</summary>
            <p className="muted">
              Add recorded targets only when you know them. They are not
              required for stock visibility.
            </p>
            <div className="form-grid">
              <label className="field">
                Target inventory quantity{' '}
                <span className="muted">Optional</span>
                <input {...fieldProps('targetStock')} inputMode="decimal" />
                <small>
                  Explicit product-wide physical stock target; used to calculate
                  excess for the full product scope.
                </small>
              </label>
              <label className="field">
                Reorder point <span className="muted">Optional</span>
                <input {...fieldProps('reorderPoint')} inputMode="decimal" />
                <small>
                  Product quantity in the unit above. Applies across supplied
                  locations.
                </small>
              </label>
              <label className="field">
                Safety stock <span className="muted">Optional</span>
                <input {...fieldProps('safetyStock')} inputMode="decimal" />
                <small>
                  Recorded product quantity, not a calculated optimum.
                </small>
              </label>
              <label className="field">
                Service target % <span className="muted">Optional</span>
                <input {...fieldProps('serviceTarget')} inputMode="decimal" />
              </label>
              <label className="field">
                Service target definition
                <select {...fieldProps('serviceTargetBasis')}>
                  <option value="">Unknown · no attainment comparison</option>
                  <option value="initial-unit-fill">
                    Initially fulfilled / requested units
                  </option>
                  <option value="daily-in-stock">
                    Positive daily closing availability observations
                  </option>
                </select>
                <small>
                  Owner-selected target from 0 to 100. No historical service
                  score is implied.
                </small>
              </label>
            </div>
          </details>
          <div className="form-actions">
            <button className="button primary" type="submit">
              Review inventory
            </button>
          </div>
        </form>
      )}
    </>
  )
}

export function SupplierEntryForm(props: OnboardingViewModel) {
  const {
    draft,
    suppliersSubmit,

    captureFields,
    fieldProps,
    workspace,
  } = props
  return (
    <>
      {draft.section === 'suppliers' && (
        <form
          className="stack"
          onSubmit={suppliersSubmit}
          onChange={captureFields}
        >
          <div className="form-grid">
            <label className="field">
              Supplier name
              <input
                {...fieldProps('supplierName')}
                required
                list="intake-suppliers"
              />
              <datalist id="intake-suppliers">
                {workspace.suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.name} />
                ))}
              </datalist>
            </label>
            <label className="field">
              Product <span className="muted">Optional</span>
              <select {...fieldProps('supplierProduct')}>
                <option value="">Add relationship later</option>
                {workspace.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} · {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Quoted lead time · calendar days
              <input {...fieldProps('leadTime')} inputMode="numeric" />
              <small>
                Measured from order placement to receipt. This is a supplied
                term, not historical reliability.
              </small>
            </label>
            <label className="field">
              Unit cost · {workspace.profile.currency}
              <input {...fieldProps('supplierCost')} inputMode="decimal" />
            </label>
            <label className="field">
              Minimum order quantity
              <input {...fieldProps('moq')} inputMode="decimal" />
            </label>
            <label className="field">
              Units per case / pack
              <input {...fieldProps('casePack')} inputMode="decimal" />
            </label>
          </div>
          <h3>
            Open purchase <span className="muted">Optional</span>
          </h3>
          <p className="muted">
            Leave quantity blank to save only supplier terms. These records do
            not create a confirmed payable or imply payment.
          </p>
          <div className="form-grid">
            <label className="field">
              Purchase quantity
              <input {...fieldProps('purchaseQuantity')} inputMode="decimal" />
            </label>
            <label className="field">
              Purchase amount · {workspace.profile.currency}
              <input {...fieldProps('purchaseAmount')} inputMode="decimal" />
            </label>
            <label className="field">
              Purchase amount already paid · {workspace.profile.currency}
              <input
                {...fieldProps('purchasePaidAmount')}
                inputMode="decimal"
              />
              <small>
                For an open purchase, confirm zero if unpaid. An unknown amount
                is not assumed to be zero.
              </small>
            </label>
            <label className="field">
              Receipt location <span className="muted">Optional</span>
              <select {...fieldProps('receiptLocation')}>
                <option value="">Unallocated / unknown</option>
                {workspace.locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
              <small>
                Only explicitly allocated receipts can enter a location or
                shared-pool scenario.
              </small>
            </label>
            <label className="field">
              Order date
              <input {...fieldProps('orderDate')} type="date" />
            </label>
            <label className="field">
              Promised receipt date
              <input {...fieldProps('promisedDate')} type="date" />
            </label>
            <label className="field">
              Receipt status
              <select {...fieldProps('receiptStatus')}>
                <option value="">Confirm receipt status</option>
                <option value="not-received">Confirmed not received</option>
                <option value="received">
                  Recorded receipt (full or partial)
                </option>
              </select>
            </label>
            <label className="field">
              Quantity received on the recorded receipt date
              <input {...fieldProps('receivedQuantity')} inputMode="decimal" />
            </label>
            <label className="field">
              Actual purchase receipt date
              <input {...fieldProps('receivedDate')} type="date" />
              <small>
                One dated receipt observation. Remaining unrecorded partial
                receipts stay unknown. Stock snapshots are entered
                independently.
              </small>
            </label>
            <label className="field">
              Expected payment date
              <input {...fieldProps('paymentDate')} type="date" />
            </label>
          </div>
          <div className="form-actions">
            <button className="button primary" type="submit">
              Review supplier information
            </button>
          </div>
        </form>
      )}
    </>
  )
}

export function FinancialRecordFields(props: OnboardingViewModel) {
  const {
    financeTab,
    recordKind,

    setRecordKind,
    patch,
    draft,
    fieldProps,
    workspace,
    fieldKey,
  } = props
  return (
    <>
      {financeTab === 'record' && (
        <>
          <div className="form-grid">
            <label className="field">
              Record type
              <select
                value={recordKind}
                onChange={(event) => {
                  setRecordKind(event.target.value as FinancialRecord['kind'])
                  patch({
                    fields: {
                      ...draft.fields,
                      $recordKind: event.target.value,
                    },
                  })
                }}
              >
                <option value="receivable">
                  Customer receivable · Internal Debt
                </option>
                <option value="provider_pending">
                  Collected, pending availability · Internal Debt
                </option>
                <option value="payable">
                  Supplier payable · External Debt
                </option>
                <option value="financing">Financing Debt repayment</option>
                <option value="operating">Operating payment</option>
              </select>
            </label>
            <label className="field">
              Record / invoice name
              <input {...fieldProps('recordName')} required />
            </label>
            <label className="field">
              Customer, supplier or counterparty
              <input {...fieldProps('counterparty')} required />
            </label>
            <label className="field">
              Original amount · {workspace.profile.currency}
              <input
                {...fieldProps('financeAmount')}
                required
                inputMode="decimal"
              />
            </label>
            <label className="field">
              Amount already paid / collected · {workspace.profile.currency}
              <input
                {...fieldProps('paidAmount')}
                required
                inputMode="decimal"
              />
              <small>
                Enter a confirmed zero if unpaid. Partial collection reduces
                this record, not sales.
              </small>
            </label>
            <label className="field">
              Due date <span className="muted">Optional</span>
              <input {...fieldProps('dueDate')} type="date" />
            </label>
            <label className="field">
              Expected availability / payment date{' '}
              <span className="muted">Optional</span>
              <input {...fieldProps('expectedDate')} type="date" />
              <small>
                When money is expected to become available or leave. A due date
                is not a guarantee.
              </small>
            </label>
            {recordKind === 'operating' && (
              <label className="field">
                Category
                <select {...fieldProps('recordCategory', 'payroll')}>
                  <option value="payroll">Payroll</option>
                  <option value="rent">Rent</option>
                  <option value="taxes">Taxes</option>
                  <option value="other">Other operating payment</option>
                </select>
              </label>
            )}
            {recordKind === 'payable' && (
              <label className="field">
                Linked purchase order
                <select {...fieldProps('linkedPurchaseId')}>
                  <option value="">No purchase order linked</option>
                  {workspace.purchases.map((purchase) => (
                    <option key={purchase.id} value={purchase.id}>
                      {purchase.id} ·{' '}
                      {workspace.suppliers.find(
                        (supplier) => supplier.id === purchase.supplierId,
                      )?.name ?? 'Supplier unknown'}{' '}
                      · {money(purchase.amount, workspace.profile.currency)}
                    </option>
                  ))}
                </select>
                <small>
                  Link a purchase and its supplier invoice to keep the same
                  payment from being counted twice. Cash execution checks the
                  allocation and paid amounts.
                </small>
              </label>
            )}
            {recordKind === 'provider_pending' && (
              <label className="field">
                Linked customer receivable
                <select {...fieldProps('linkedRecordId')}>
                  <option value="">No existing linked invoice</option>
                  {workspace.finance
                    .filter((record) => record.kind === 'receivable')
                    .map((record) => (
                      <option key={record.id} value={record.id}>
                        {record.name}
                      </option>
                    ))}
                </select>
                <small>
                  Pending funds must already be recorded as collected on the
                  linked invoice.
                </small>
              </label>
            )}
          </div>
          <label className="field checkbox-field">
            <input
              type="checkbox"
              name="cashIncluded"
              defaultChecked={draft.fields[fieldKey('cashIncluded')] === 'on'}
            />
            This amount is already reflected in the supplied cash balance.
          </label>
          <p className="muted">
            Unknown dates remain unscheduled. Borrowing and repayment schedules
            are limited to what you supply.
          </p>
        </>
      )}
    </>
  )
}

export function CashFields(props: OnboardingViewModel) {
  const { financeTab, workspace, fieldProps } = props
  return (
    <>
      {financeTab === 'cash' && (
        <>
          <p>
            Available cash is money the business can use on the stated date.
            Exclude uncollected sales and funds still pending with a provider.
          </p>
          <div className="form-grid">
            <label className="field">
              Available cash · {workspace.profile.currency}
              <input
                {...fieldProps(
                  'financeAmount',
                  workspace.cash?.amount.toString(),
                )}
                required
                inputMode="decimal"
              />
            </label>
            <label className="field">
              Balance date
              <input
                {...fieldProps('cashDate', workspace.cash?.date)}
                type="date"
                required
              />
            </label>
            <label className="field">
              When was this balance measured?
              <select
                {...fieldProps('cashPhase', workspace.cash?.phase ?? 'opening')}
              >
                <option value="opening">
                  Opening · before this day's events
                </option>
                <option value="end-of-day">
                  End of day · after this day's events
                </option>
              </select>
            </label>
            <label className="field">
              Owner-selected cash reserve · {workspace.profile.currency}
              <input
                {...fieldProps('reserve', workspace.cash?.reserve?.toString())}
                inputMode="decimal"
              />
              <small>
                Optional. Blank means no reserve was supplied. It is separate
                from purchasing budget.
              </small>
            </label>
          </div>
        </>
      )}
    </>
  )
}

export function BudgetFields(props: OnboardingViewModel) {
  const { financeTab, workspace, fieldProps } = props
  return (
    <>
      {financeTab === 'budget' && (
        <>
          <p>
            A purchasing budget is the limit you assign to purchase commitments
            in a period. It does not establish cash availability.
          </p>
          <div className="form-grid">
            <label className="field">
              Budget amount · {workspace.profile.currency}
              <input
                {...fieldProps(
                  'financeAmount',
                  workspace.budget?.amount.toString(),
                )}
                required
                inputMode="decimal"
              />
            </label>
            <label className="field">
              Period start
              <input
                {...fieldProps('budgetStart', workspace.budget?.startDate)}
                type="date"
                required
              />
            </label>
            <label className="field">
              Period end
              <input
                {...fieldProps('budgetEnd', workspace.budget?.endDate)}
                type="date"
                required
              />
            </label>
          </div>
          <div className="notice">
            Comparison basis · purchases committed by order date. Payment timing
            is evaluated separately in cash planning.
          </div>
        </>
      )}
    </>
  )
}

export function CommitmentFields(props: OnboardingViewModel) {
  const { financeTab, fieldProps, workspace } = props
  return (
    <>
      {financeTab === 'commitment' && (
        <>
          <p>
            Record an expected supplier period and its cadence. Fulfillment and
            payment are separate. This form does not create a confirmed payable
            or invent a future payment schedule.
          </p>
          <div className="form-grid">
            <label className="field">
              Commitment name
              <input {...fieldProps('commitmentName')} required />
            </label>
            <label className="field">
              Supplier <span className="muted">Optional</span>
              <select {...fieldProps('commitmentSupplier')}>
                <option value="">Unknown / add later</option>
                {workspace.suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Cadence
              <select {...fieldProps('commitmentCadence', 'monthly')}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="field">
              Expected amount · {workspace.profile.currency}
              <input {...fieldProps('commitmentAmount')} inputMode="decimal" />
              <small>Blank means unknown. Zero is a confirmed amount.</small>
            </label>
            <label className="field">
              Next expected period date <span className="muted">Optional</span>
              <input {...fieldProps('commitmentDate')} type="date" />
              <small>
                The next expected supply date. An unknown date remains
                unscheduled.
              </small>
            </label>
            <label className="field">
              Fulfillment status
              <select {...fieldProps('fulfillment', 'unknown')}>
                <option value="unknown">Unknown</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="not_fulfilled">Not fulfilled</option>
              </select>
            </label>
            <label className="field">
              Payment status
              <select {...fieldProps('commitmentPayment', 'unknown')}>
                <option value="unknown">Unknown</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </label>
            <label className="field">
              Linked confirmed supplier payable
              <select {...fieldProps('linkedPayableId')}>
                <option value="">No confirmed payable linked</option>
                {workspace.finance
                  .filter((record) => record.kind === 'payable')
                  .map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.name} · {record.counterparty}
                    </option>
                  ))}
              </select>
              <small>
                Link the realization to keep expected and confirmed obligations
                from being counted twice.
              </small>
            </label>
          </div>
        </>
      )}
    </>
  )
}

export function CoverageFields(props: OnboardingViewModel) {
  const { financeTab, fieldProps, workspace } = props
  return (
    <>
      {financeTab === 'coverage' && (
        <>
          <p>
            Review each category for this period. An empty category is unknown
            until you explicitly confirm it does not apply.
          </p>
          <div className="form-grid">
            <label className="field">
              Period start
              <input
                {...fieldProps(
                  'coverageStart',
                  workspace.coverage.collections.startDate,
                )}
                required
                type="date"
              />
            </label>
            <label className="field">
              Period end
              <input
                {...fieldProps(
                  'coverageEnd',
                  workspace.coverage.collections.endDate,
                )}
                required
                type="date"
              />
            </label>
            {categories.map((category) => (
              <label className="field" key={category}>
                {
                  {
                    collections: 'Customer collections',
                    suppliers: 'Supplier payments',
                    payroll: 'Payroll',
                    rent: 'Rent',
                    taxes: 'Taxes',
                    financing: 'Financing Debt',
                    other: 'Other commitments',
                  }[category]
                }
                <select
                  {...fieldProps(
                    `coverage-${category}`,
                    workspace.coverage[category].state,
                  )}
                >
                  <option value="unknown">Unknown / add later</option>
                  <option value="supplied">Supplied for this period</option>
                  <option value="absent">
                    Confirmed absent for this period
                  </option>
                  <option value="omitted">
                    Known but omitted from this projection
                  </option>
                </select>
              </label>
            ))}
          </div>
          <p className="muted">
            Unknown or omitted categories keep the projection partial. Coverage
            declarations do not create payment records.
          </p>
        </>
      )}
    </>
  )
}

export function FinanceEntryForm(props: OnboardingViewModel) {
  const {
    draft,
    financeTab,
    setFinanceTab,
    patch,
    financeSubmit,

    captureFields,
  } = props
  return (
    <>
      {draft.section === 'finance' && (
        <div className="stack">
          <div
            className="form-actions"
            role="group"
            aria-label="Finance information type"
          >
            {(
              ['record', 'cash', 'budget', 'commitment', 'coverage'] as const
            ).map((tab) => (
              <button
                key={tab}
                className={`button ${financeTab === tab ? 'primary' : 'secondary'}`}
                onClick={() => {
                  setFinanceTab(tab)
                  patch({
                    fields: { ...draft.fields, $financeTab: tab },
                  })
                }}
              >
                {
                  {
                    record: 'Receipts & payments',
                    cash: 'Available cash',
                    budget: 'Purchasing budget',
                    commitment: 'Recurring commitments',
                    coverage: 'Category review',
                  }[tab]
                }
              </button>
            ))}
          </div>
          <form
            key={financeTab}
            className="stack"
            onSubmit={financeSubmit}
            onChange={captureFields}
          >
            <FinancialRecordFields {...props} />
            <CashFields {...props} />
            <BudgetFields {...props} />
            <CommitmentFields {...props} />
            <CoverageFields {...props} />
            <div className="form-actions">
              <button type="submit" className="button primary">
                Review{' '}
                {financeTab === 'record' ? 'financial record' : financeTab}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
