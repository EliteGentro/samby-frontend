import type { Workspace } from '../../domain/workspace'
import type { AnalysisConfig, Assumptions } from '../../lib/analysis'

type Props = {
  config: AnalysisConfig
  workspace: Workspace
  onAssumption: <K extends keyof Assumptions>(
    key: K,
    value: Assumptions[K],
  ) => void
}
export function PolicyInputs({
  config: c,
  workspace: w,
  onAssumption: set,
}: Props) {
  const a = c.assumptions
  const numeric = (
    key:
      | 'reorder_point'
      | 'safety_stock'
      | 'service_target'
      | 'discount_percent'
      | 'demand_multiplier',
    label: string,
    max?: number,
  ) => (
    <label className="field">
      {label}
      <input
        aria-label={label}
        type="number"
        min="0"
        max={max}
        step="any"
        value={a[key] ?? ''}
        onChange={(e) =>
          set(key, e.target.value === '' ? undefined : Number(e.target.value))
        }
      />
    </label>
  )
  return (
    <fieldset>
      <legend>Owner-selected policy and commercial assumptions</legend>
      {['Q-REPLENISH', 'Q-EXPLORE'].includes(c.question) && (
        <label className="field">
          Purchasing plan
          <select
            aria-label="Purchasing plan"
            value={a.order_policy ?? 'explicit'}
            onChange={(e) => {
              set('order_policy', e.target.value as Assumptions['order_policy'])
              if (e.target.value === 'reorder') {
                set('order_date', undefined)
                set('receipt_date', undefined)
              }
            }}
          >
            <option value="explicit">One explicit dated purchase</option>
            <option value="reorder">My fixed-quantity reorder rule</option>
          </select>
          <small>
            The rule orders the supplied quantity at daily close when inventory
            position is at or below your threshold. It never chooses or
            optimizes a policy.
          </small>
        </label>
      )}
      <div className="form-grid">
        {a.order_policy === 'reorder' &&
          numeric('reorder_point', 'Reorder point in product units')}
        {numeric('safety_stock', 'Safety-stock target in product units')}
        {numeric(
          'service_target',
          'Immediate unit-fill target in percent',
          100,
        )}
        {!w.muted.includes('price') &&
          numeric('discount_percent', 'Selling-price discount in percent', 100)}
      </div>
      <p className="small muted">
        Safety-stock and service targets are measured against your selected
        plan. A price discount changes sales value and margin; no demand
        elasticity is inferred. Rule receipts arrive after the supplied lead
        time, with a minimum of the next day when lead time is zero.
      </p>
      {c.question === 'Q-EXPLORE' && (
        <div className="form-grid">
          {numeric(
            'demand_multiplier',
            'Demand multiplier during an explicit interval',
          )}
          <label className="field">
            Demand change starts
            <input
              aria-label="Demand change starts"
              type="date"
              value={a.demand_start_date ?? ''}
              onChange={(e) =>
                set('demand_start_date', e.target.value || undefined)
              }
            />
          </label>
          <label className="field">
            Demand change ends
            <input
              aria-label="Demand change ends"
              type="date"
              value={a.demand_end_date ?? ''}
              onChange={(e) =>
                set('demand_end_date', e.target.value || undefined)
              }
            />
          </label>
        </div>
      )}
    </fieldset>
  )
}

export function CreditInputs({
  config: c,
  workspace: w,
  onAssumption: set,
}: Props) {
  const a = c.assumptions,
    term = w.paymentTerms?.find((t) => t.id === a.customer_terms_id)
  return (
    <fieldset>
      <legend>Additional credit sales and unpaid balance</legend>
      <p className="small muted">
        An explicit new sales amount can create receivables without inventory
        inputs. It is additional to the existing invoice register. The unpaid
        share is a deterministic scenario assumption, not a customer-default
        probability.
      </p>
      <div className="form-grid">
        <label className="field">
          Additional credit sales amount
          <input
            aria-label="Additional credit sales amount"
            type="number"
            min="0"
            step="any"
            value={a.new_credit_sales_amount ?? ''}
            onChange={(e) =>
              set(
                'new_credit_sales_amount',
                e.target.value === '' ? undefined : Number(e.target.value),
              )
            }
          />
        </label>
        <label className="field">
          Additional credit sales date
          <input
            aria-label="Additional credit sales date"
            type="date"
            value={a.new_credit_sales_date ?? ''}
            onChange={(e) =>
              set('new_credit_sales_date', e.target.value || undefined)
            }
          />
        </label>
        <label className="field">
          Share left unpaid, from 0 to 1
          <input
            aria-label="Share left unpaid, from 0 to 1"
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={a.unpaid_share ?? ''}
            onChange={(e) =>
              set(
                'unpaid_share',
                e.target.value === '' ? undefined : Number(e.target.value),
              )
            }
          />
        </label>
        {!c.output_families.includes('inventory') && (
          <>
            <label className="field">
              Customer collection terms
              <select
                aria-label="Customer collection terms"
                value={a.customer_terms_id ?? ''}
                onChange={(e) => {
                  set('customer_terms_id', e.target.value || undefined)
                  set(
                    'demand_cash_treatment',
                    e.target.value ? 'incremental' : undefined,
                  )
                }}
              >
                <option value="">Select terms for the additional sales</option>
                {w.paymentTerms
                  ?.filter((t) => t.party === 'customer')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.counterparty} · {t.days} days from {t.startEvent} ·{' '}
                      {t.status}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              Invoice delay after the credit sale in days
              <input
                aria-label="Invoice delay after the credit sale in days"
                type="number"
                min="0"
                step="1"
                value={a.invoice_delay_days ?? ''}
                onChange={(e) =>
                  set(
                    'invoice_delay_days',
                    e.target.value === '' ? undefined : Number(e.target.value),
                  )
                }
              />
            </label>
            {term?.startEvent === 'order-date' && (
              <label className="field">
                Customer order date
                <input
                  aria-label="Customer order date"
                  type="date"
                  value={a.customer_order_date ?? ''}
                  onChange={(e) =>
                    set('customer_order_date', e.target.value || undefined)
                  }
                />
              </label>
            )}
            <label className="field">
              Customer advance already received
              <input
                aria-label="Customer advance already received"
                type="number"
                min="0"
                step="any"
                value={a.customer_advance_received ?? ''}
                onChange={(e) =>
                  set(
                    'customer_advance_received',
                    e.target.value === '' ? undefined : Number(e.target.value),
                  )
                }
              />
            </label>
            {term && term.advancePercent === undefined && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={Boolean(a.terms_no_advance_confirmed)}
                  onChange={(e) =>
                    set('terms_no_advance_confirmed', e.target.checked)
                  }
                />
                I assume no advance for these unrecorded customer advance terms.
              </label>
            )}
            {term?.status === 'proposed' && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={Boolean(a.terms_accepted)}
                  onChange={(e) => set('terms_accepted', e.target.checked)}
                />
                I accept proposed customer terms as a hypothetical scenario.
              </label>
            )}
          </>
        )}
      </div>
    </fieldset>
  )
}

export function PaymentTimingInputs({
  config: c,
  workspace: w,
  onAssumption: set,
}: Props) {
  const a = c.assumptions
  const linkedPurchases = new Set(
    w.finance
      .filter((item) => item.kind === 'payable')
      .map((item) => item.linkedRecordId),
  )
  const obligations = [
    ...w.finance
      .filter(
        (item) =>
          !['receivable', 'provider_pending'].includes(item.kind) &&
          item.amount > item.paidAmount &&
          !item.cashIncluded,
      )
      .map((item) => ({
        id: item.id,
        label: item.name,
        amount: item.amount - item.paidAmount,
        date: item.expectedDate,
      })),
    ...w.purchases
      .filter(
        (item) =>
          !linkedPurchases.has(item.id) &&
          item.amount != null &&
          item.amount > item.paidAmount,
      )
      .map((item) => ({
        id: item.id,
        label: `Purchase ${item.id}`,
        amount: item.amount! - item.paidAmount,
        date: item.plannedPaymentDate,
      })),
  ]
  if (!obligations.length) return null
  return (
    <fieldset>
      <legend>Outgoing payment timing</legend>
      <p className="small muted">
        Compare one changed payment date without creating a purchase or a second
        payable. A hypothetical date does not amend the supplier or other
        obligation agreement.
      </p>
      <div className="form-grid">
        <label className="field">
          Outgoing payment to change
          <select
            aria-label="Outgoing payment to change"
            value={a.payment_id ?? ''}
            onChange={(e) => {
              set('payment_id', e.target.value || undefined)
              if (!e.target.value) {
                set('payment_date', undefined)
                set('payment_change_accepted', undefined)
              }
            }}
          >
            <option value="">Keep recorded payment dates</option>
            {obligations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} · {item.amount} · {item.date ?? 'unscheduled'}
              </option>
            ))}
          </select>
        </label>
        {a.payment_id && (
          <label className="field">
            Alternative outgoing payment date
            <input
              aria-label="Alternative outgoing payment date"
              type="date"
              min={c.start_date}
              value={a.payment_date ?? ''}
              onChange={(e) => set('payment_date', e.target.value || undefined)}
            />
          </label>
        )}
      </div>
      {a.payment_id && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={Boolean(a.payment_change_accepted)}
            onChange={(e) => set('payment_change_accepted', e.target.checked)}
          />
          I accept this outgoing payment date as hypothetical; it does not
          establish counterparty agreement.
        </label>
      )}
    </fieldset>
  )
}
