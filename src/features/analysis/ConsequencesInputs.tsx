import type { Workspace } from '../../domain/workspace'
import type { AnalysisConfig, Assumptions } from '../../lib/analysis'
import { FieldRequirement, OptionalHelp } from './FieldRequirement'
import { SelectField } from '../../components/ui/select-field'

export function ConsequencesInputs({
  config: c,
  workspace: w,
  onAssumption,
}: {
  config: AnalysisConfig
  workspace: Workspace
  onAssumption: <K extends keyof Assumptions>(
    key: K,
    value: Assumptions[K],
  ) => void
}) {
  const a = c.assumptions,
    hasFinance = c.output_families.some((f) => f === 'cash' || f === 'debt')
  const pool = w.inventoryPools?.find((item) => item.id === c.inventory_pool_id)
  const positions = w.stock.filter(
    (s) =>
      s.productId === c.product_id &&
      (!c.location_id || s.locationId === c.location_id) &&
      (!pool ||
        Boolean(s.locationId && pool.locationIds.includes(s.locationId))),
  )
  const backlog = positions.reduce((sum, p) => sum + (p.backordered ?? 0), 0)
  const supplierTerm = w.paymentTerms?.find(
      (t) => t.id === a.supplier_terms_id,
    ),
    customerTerm = w.paymentTerms?.find((t) => t.id === a.customer_terms_id)
  const purchasing =
    c.question === 'Q-REPLENISH' ||
    c.question === 'Q-SLOW-SUPPLIER' ||
    c.question === 'Q-SUPPLIER-ORDER-STOCKOUT' ||
    (c.question === 'Q-EXPLORE' && Number(a.order_quantity) > 0)
  const numeric = (
    key:
      | 'purchase_paid_amount'
      | 'invoice_delay_days'
      | 'customer_advance_received',
    label: string,
    options: { required?: boolean; help: string },
  ) => (
    <label className="field">
      <FieldRequirement required={options.required}>{label}</FieldRequirement>
      <input
        aria-label={label}
        type="number"
        min="0"
        step={key === 'invoice_delay_days' ? 1 : 'any'}
        value={a[key] ?? ''}
        onChange={(e) =>
          onAssumption(
            key,
            e.target.value === '' ? undefined : Number(e.target.value),
          )
        }
      />
      {options.required ? (
        <small className="muted">{options.help}</small>
      ) : (
        <OptionalHelp>{options.help}</OptionalHelp>
      )}
    </label>
  )
  const date = (
    key: 'purchase_invoice_date' | 'customer_order_date' | 'dispatch_date',
    label: string,
    help?: string,
  ) => (
    <label className="field">
      <FieldRequirement required>{label}</FieldRequirement>
      <input
        aria-label={label}
        type="date"
        value={a[key] ?? ''}
        onChange={(e) => onAssumption(key, e.target.value || undefined)}
      />
      {help && <small className="muted">{help}</small>}
    </label>
  )
  const terms = (party: 'supplier' | 'customer') => (
    <label className="field">
      {party === 'supplier'
        ? 'Supplier payment terms'
        : 'Customer collection terms'}
      <SelectField
        aria-label={
          party === 'supplier'
            ? 'Supplier payment terms'
            : 'Customer collection terms'
        }
        value={a[`${party}_terms_id`] ?? ''}
        onChange={(e) =>
          onAssumption(`${party}_terms_id`, e.target.value || undefined)
        }
      >
        <option value="">Use existing financial records only</option>
        {w.paymentTerms
          ?.filter((t) => t.party === party)
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.counterparty} · {t.days} days from {t.startEvent} · {t.status}
            </option>
          ))}
      </SelectField>
      <small>
        <strong>Optional.</strong> If left blank, only existing financial
        records are used and no new {party === 'supplier' ? 'payment' : 'collection'}
        schedule is derived. Terms are saved with this run; proposed terms do
        not imply agreement.
      </small>
    </label>
  )
  return (
    <>
      <fieldset>
        <legend>Backorders and fulfillment</legend>
        <label className="field">
          <FieldRequirement required>New unmet demand policy</FieldRequirement>
          <SelectField
            aria-label="New unmet demand policy"
            value={a.backlog_policy ?? 'lost_sales'}
            onChange={(e) =>
              onAssumption(
                'backlog_policy',
                e.target.value as Assumptions['backlog_policy'],
              )
            }
          >
            <option value="lost_sales">
              Lost demand · do not carry new unmet units
            </option>
            <option value="carry">Carry new unmet units as backorders</option>
          </SelectField>
          <small>
            Receipts arrive first, then previous backorders are served before
            today's new demand.
          </small>
        </label>
        {backlog > 0 && (
          <>
            <p className="notice">
              The selected stock records contain {backlog} opening backordered
              units. Existing backlog is carried and served first regardless of
              the policy for new demand. Its earlier age and prior invoicing
              remain unknown.
            </p>
            <label className="field">
              <FieldRequirement required>
                Relationship between backlog and reservations
              </FieldRequirement>
              <SelectField
                aria-label="Relationship between backlog and reservations"
                value={a.backlog_reservation_overlap ?? ''}
                onChange={(e) =>
                  onAssumption(
                    'backlog_reservation_overlap',
                    e.target
                      .value as Assumptions['backlog_reservation_overlap'],
                  )
                }
              >
                <option value="">Choose the confirmed relationship</option>
                <option value="included">
                  Reserved stock is allocated to these backorders
                </option>
                <option value="additional">
                  Reservations concern other demand
                </option>
              </SelectField>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={Boolean(a.opening_backlog_confirmed)}
                onChange={(e) =>
                  onAssumption('opening_backlog_confirmed', e.target.checked)
                }
              />
              <span>
                I accept the supplied backlog and reservation relationship at
                the opening boundary.
                <span className="required-marker" aria-hidden="true">
                  {' '}
                  *
                </span>
              </span>
            </label>
          </>
        )}
      </fieldset>
      {hasFinance && (
        <fieldset>
          <legend>Connect scenario events to Finance</legend>
          <p className="notice">
            Create new cash consequences only from explicit terms and economic
            links. Existing invoices, provider settlements, advances and
            purchase payments remain separate source records. Opening backlog
            does not create a second invoice.
          </p>
          {!w.paymentTerms?.length && (
            <p className="notice">
              Add agreed or proposed customer/supplier terms in Finance to
              derive scenario collections or purchasing payments. Without a
              selected term, this run retains only the separately recorded
              financial events.
            </p>
          )}
          <div className="form-grid">
            {terms('customer')}
            {customerTerm && (
              <label className="field">
                <FieldRequirement required>
                  Modeled demand in Finance
                </FieldRequirement>
                <SelectField
                  aria-label="Modeled demand in Finance"
                  value={a.demand_cash_treatment ?? ''}
                  onChange={(e) =>
                    onAssumption(
                      'demand_cash_treatment',
                      e.target.value as Assumptions['demand_cash_treatment'],
                    )
                  }
                >
                  <option value="">
                    Declare its relationship to existing invoices
                  </option>
                  <option value="incremental">
                    New fulfilled demand creates additional invoice cohorts
                  </option>
                  <option value="already_recorded">
                    Already represented by existing financial records
                  </option>
                </SelectField>
              </label>
            )}
            {customerTerm && a.demand_cash_treatment === 'incremental' && (
              <>
                {numeric(
                  'invoice_delay_days',
                  'Invoice delay after fulfillment in days',
                  {
                    required: customerTerm.startEvent === 'invoice-date',
                    help:
                      customerTerm.startEvent === 'invoice-date'
                        ? 'Use 0 to invoice on fulfillment.'
                        : 'If left blank, 0 is used and invoices are created on fulfillment.',
                  },
                )}
                {numeric(
                  'customer_advance_received',
                  'Customer advance already reflected in opening cash',
                  {
                    help: 'If left blank, 0 is used; no modeled sale is treated as already received in opening cash.',
                  },
                )}
                {customerTerm.startEvent === 'order-date' &&
                  date(
                    'customer_order_date',
                    'Customer order date for the modeled demand',
                  )}
              </>
            )}
            {purchasing && c.output_families.includes('cash') && (
              <>
                {terms('supplier')}
                {supplierTerm && (
                  <>
                    <label className="field">
                      <FieldRequirement required>
                        Modeled purchase in Finance
                      </FieldRequirement>
                      <SelectField
                        aria-label="Modeled purchase in Finance"
                        value={a.purchase_cash_treatment ?? ''}
                        onChange={(e) =>
                          onAssumption(
                            'purchase_cash_treatment',
                            e.target
                              .value as Assumptions['purchase_cash_treatment'],
                          )
                        }
                      >
                        <option value="">
                          Declare the economic relationship
                        </option>
                        {a.purchase_id ? (
                          <option value="replace_linked">
                            Replace this purchase's linked unpaid cash schedule
                            once
                          </option>
                        ) : (
                          <option value="incremental">
                            A separate new planned purchase
                          </option>
                        )}
                        <option value="already_recorded">
                          Already represented by existing financial records
                        </option>
                      </SelectField>
                    </label>
                    {!a.purchase_id &&
                      numeric(
                        'purchase_paid_amount',
                        'Planned purchase amount already reflected in opening cash',
                        {
                          help: 'If left blank, 0 is used; none of the planned purchase is treated as already paid.',
                        },
                      )}
                    {supplierTerm.startEvent === 'invoice-date' &&
                      date('purchase_invoice_date', 'Supplier invoice date')}
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={Boolean(a.supplier_payment_before_dispatch)}
                        onChange={(e) => {
                          onAssumption(
                            'supplier_payment_before_dispatch',
                            e.target.checked,
                          )
                          if (!e.target.checked)
                            onAssumption('dispatch_date', undefined)
                        }}
                      />
                      <span>
                        I accept full supplier payment before dispatch as a
                        prerequisite. <strong>Optional.</strong> If unchecked,
                        no dispatch prerequisite is tested.
                      </span>
                    </label>
                    {a.supplier_payment_before_dispatch &&
                      date(
                        'dispatch_date',
                        'Supplier dispatch date',
                        'Required because full payment before dispatch is selected.',
                      )}
                  </>
                )}
              </>
            )}
          </div>
          {[supplierTerm, customerTerm].filter(Boolean).map((term) => (
            <p className="small muted" key={term!.id}>
              {term!.counterparty} · {term!.status} · {term!.days} days after{' '}
              {term!.startEvent} · advance{' '}
              {term!.advancePercent === undefined
                ? 'unknown'
                : `${term!.advancePercent}%`}{' '}
              at {term!.advanceDays ?? 'unknown'} days relative to the same
              event. Reference {term!.reference}.
            </p>
          ))}
          {[supplierTerm, customerTerm].some(
            (term) => term && term.advancePercent === undefined,
          ) && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={Boolean(a.terms_no_advance_confirmed)}
                onChange={(e) =>
                  onAssumption('terms_no_advance_confirmed', e.target.checked)
                }
              />
              <span>
                I assume no advance for selected terms whose advance is
                unrecorded; the full unpaid balance follows the stated payment
                days.
                <span className="required-marker" aria-hidden="true">
                  {' '}
                  *
                </span>
              </span>
            </label>
          )}
          {(supplierTerm?.status === 'proposed' ||
            customerTerm?.status === 'proposed') && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={Boolean(a.terms_accepted)}
                onChange={(e) =>
                  onAssumption('terms_accepted', e.target.checked)
                }
              />
              <span>
                I accept these proposed terms as a scenario assumption. They
                are not agreed commercial terms.
                <span className="required-marker" aria-hidden="true">
                  {' '}
                  *
                </span>
              </span>
            </label>
          )}
        </fieldset>
      )}
    </>
  )
}
