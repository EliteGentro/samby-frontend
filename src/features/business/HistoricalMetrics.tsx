import { useState } from 'react'
import {
  historicalDemandMetrics,
  serviceConsequences,
  supplierHistory,
} from '../../domain/historical-metrics'
import {
  CapabilityDisplay,
  TableHead,
  EmptyState,
  MetricCard,
  Panel,
} from '../../components/workspace-ui'
import { SortableTable } from '../../components/SortableTable'
import { DisclosureCard } from '../../components/ui/disclosure-card'
import {
  agingMetrics,
  capitalMetrics,
  metricVersion,
  serviceMetrics,
} from '../../domain/selectors'
import { money, number, type Workspace } from '../../domain/workspace'
const display = (value: number | null, suffix = '') =>
  value === null ? 'Not provided' : `${number(value)}${suffix}`
type Props = {
  workspace: Workspace
  start: string
  end: string
  location?: string
  onIntake: () => void
}
export function CapitalMetricsPanel({
  workspace: w,
  start,
  end,
  location,
  onIntake,
}: Props) {
  const result = capitalMetrics(w, start, end, {
    locationId: location || undefined,
  })
  const categories = [
    ...new Set(
      result.rows.map(
        (row) =>
          w.products.find((p) => p.id === row.productId)?.category ||
          'Uncategorized',
      ),
    ),
  ].map((category) => {
    const rows = result.rows.filter(
        (row) =>
          (w.products.find((p) => p.id === row.productId)?.category ||
            'Uncategorized') === category,
      ),
      average = rows.reduce((sum, row) => sum + row.averageInventory, 0),
      cogs = rows.reduce((sum, row) => sum + row.costOfGoods, 0),
      profit =
        rows.every((row) => row.grossProfit !== null) &&
        new Set(rows.map((row) => row.amountBasis)).size === 1
          ? rows.reduce((sum, row) => sum + row.grossProfit!, 0)
          : null
    return {
      category,
      count: rows.length,
      dio: cogs > 0 ? (average / cogs) * result.days : null,
      gmroi: average > 0 && profit !== null ? profit / average : null,
    }
  })
  return (
    <>
      <Panel
        capability="turnover-dio"
        title="Inventory investment over the period"
        subtitle={`${start} to ${end} · ${result.days} calendar days · ${w.profile.currency} · ${result.rows.length}/${result.totalScopes} supplied product/location scopes`}
        action={
          <button className="text-button" onClick={onIntake}>
            Add inventory history
          </button>
        }
      >
        {result.rows.length ? (
          <>
            <div className="metrics-grid">
              <MetricCard
                capability="turnover-dio"
                label="Average inventory at cost"
                value={money(result.averageInventory, w.profile.currency)}
                note="Time-weighted daily values for the supported subset"
              />
              <MetricCard
                capability="turnover-dio"
                label="Inventory turnover"
                value={display(result.turnover, ' turns')}
                note={`${money(result.costOfGoods, w.profile.currency)} period COGS ÷ average inventory`}
              />
              <MetricCard
                capability="turnover-dio"
                label="Days inventory outstanding"
                value={display(result.dio, ' days')}
                note={`Average inventory ÷ period COGS × ${result.days}; not annualized`}
              />
              <MetricCard
                capability="gmroi"
                label="Gross margin return on inventory"
                value={display(result.gmroi)}
                note="Period gross profit ÷ average inventory at cost"
              />
            </div>
            <div className="table-wrap">
              <SortableTable className="data-table">
                <TableHead
                  headers={[
                    'Product / location',
                    'Average cost value',
                    'Period COGS',
                    'Gross profit',
                    'Turnover',
                    'DIO',
                    'GMROI',
                    'Coverage',
                  ]}
                />
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={`${row.productId}-${row.locationId}`}>
                      <td>
                        {row.product}
                        <small className="block muted">
                          {w.locations.find((l) => l.id === row.locationId)
                            ?.name ?? 'Aggregate scope'}
                        </small>
                      </td>
                      <td>{money(row.averageInventory, w.profile.currency)}</td>
                      <td>{money(row.costOfGoods, w.profile.currency)}</td>
                      <td>{money(row.grossProfit, w.profile.currency)}</td>
                      <td>{display(row.turnover)}</td>
                      <td>{display(row.dio)}</td>
                      <td>{display(row.gmroi)}</td>
                      <td>
                        {row.observedSalesDates} sales observation dates ·{' '}
                        {row.estimatedDays} explicitly estimated inventory days
                        <small className="block muted">
                          Sources · {row.sourceIds.join(', ')}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </SortableTable>
            </div>
          </>
        ) : (
          <EmptyState
            title="Add compatible period history"
            description="Enter daily inventory at historical unit cost, or explicitly confirm a constant-value interval estimate. Sales need their own historical cost per unit. Gaps and unsupported scopes stay excluded."
            action={
              <button className="button secondary" onClick={onIntake}>
                Add historical records
              </button>
            }
          />
        )}
        {result.warnings.map((warning) => (
          <p key={warning} className="notice warning">
            {warning}
          </p>
        ))}
        <p className="panel-footnote">
          {metricVersion} · Daily inventory values are weighted by calendar
          days. Interval estimates are explicitly identified; no gap is silently
          interpolated. Recorded sales provide the numerator: missing sales
          dates are unobserved, not zero. Nonpositive denominators produce no
          ratio. High turnover alone does not establish service quality or
          profitability.
        </p>
      </Panel>
      {categories.length > 0 && (
        <CapabilityDisplay id="turnover-dio">
          <DisclosureCard
            title="Category GMROI versus DIO"
            description={`${categories.length} supported ${categories.length === 1 ? 'category' : 'categories'} · compare inventory days with period gross-margin return`}
          >
            <div className="table-wrap">
              <SortableTable className="data-table">
                <TableHead
                  headers={[
                    'Category',
                    'Included product/location scopes',
                    'DIO · days',
                    'GMROI · period currency/currency',
                  ]}
                />
                <tbody>
                  {categories.map((row) => (
                    <tr key={row.category}>
                      <td>{row.category}</td>
                      <td>{row.count}</td>
                      <td>{display(row.dio)}</td>
                      <td>{display(row.gmroi)}</td>
                    </tr>
                  ))}
                </tbody>
              </SortableTable>
            </div>
          </DisclosureCard>
        </CapabilityDisplay>
      )}
    </>
  )
}
export function ObservedServicePanel({
  workspace: w,
  start,
  end,
  location,
  onIntake,
}: Props) {
  const rows = serviceMetrics(w, start, end, {
    locationId: location || undefined,
  })
  return (
    <Panel
      capability="service"
      title="Observed service"
      subtitle={`${start} to ${end} · initial-request fulfillment · product-specific units`}
      action={
        <button className="text-button" onClick={onIntake}>
          Add service observations
        </button>
      }
    >
      {rows.length ? (
        <div className="table-wrap">
          <SortableTable className="data-table">
            <TableHead
              headers={[
                'Product / unit',
                'Requested / fulfilled',
                'Unit fill',
                'Line fill',
                'In-stock observations',
                'Unmet units / days',
                'Availability coverage',
              ]}
            />
            <tbody>
              {rows.map((row) => (
                <tr key={row.productId}>
                  <td>
                    {row.product}
                    <small className="block muted">{row.unit}</small>
                  </td>
                  <td>
                    {display(row.requested)} / {display(row.fulfilled)}
                  </td>
                  <td>{display(row.fillRate, '%')}</td>
                  <td>
                    {display(row.lineFill, '%')}
                    <small className="block muted">
                      {row.lines} request lines
                    </small>
                  </td>
                  <td>
                    {display(row.inStockRate, '%')}
                    <small className="block muted">
                      {row.stockObservations} {row.phase ?? 'unknown-phase'}{' '}
                      states
                    </small>
                  </td>
                  <td>
                    {display(row.unmet)} / {row.unmetDays}
                  </td>
                  <td>
                    {row.zeroStockDays === null
                      ? 'Unreconciled states'
                      : `${row.zeroStockDays} zero-stock observations`}
                    {row.observedMinutes > 0 && (
                      <small className="block muted">
                        {row.unavailableMinutes} out-of-stock minutes /{' '}
                        {row.observedMinutes} measured minutes
                      </small>
                    )}
                    {row.issue && (
                      <small className="block negative">{row.issue}</small>
                    )}
                    <small className="block muted">
                      {row.sourceIds.join(', ')}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </SortableTable>
        </div>
      ) : (
        <EmptyState
          title="Record requested demand and fulfillment"
          description="Sales alone cannot establish service. Confirm the requested and initially fulfilled units, daily available-state observations, or measured availability duration."
          action={
            <button className="button secondary" onClick={onIntake}>
              Add service observations
            </button>
          }
        />
      )}
      <p className="panel-footnote">
        {metricVersion} · Unit fill = initially fulfilled/requested units. Line
        fill counts fully fulfilled request rows, not weighted units. In-stock
        rate counts positive daily available states; it does not describe
        intraday availability. Missing days are unobserved. Unmet units are not
        classified as lost or backordered without the corresponding source
        evidence.
      </p>
    </Panel>
  )
}
export function AgingInventoryPanel({
  workspace: w,
  asOf,
  location,
  onIntake,
}: {
  workspace: Workspace
  asOf: string
  location?: string
  onIntake: () => void
}) {
  const rows = agingMetrics(w, asOf, { locationId: location || undefined })
  return (
    <Panel
      capability="aged-excess"
      title="Receipt age and excess inventory"
      subtitle={`As of ${asOf} · calendar days since original receipt · current remaining units`}
      action={
        <button className="text-button" onClick={onIntake}>
          Add receipt layers or targets
        </button>
      }
    >
      {rows.length ? (
        <div className="table-wrap">
          <SortableTable className="data-table">
            <TableHead
              headers={[
                'Product / unit',
                'On hand',
                '0–30 days',
                '31–90 days',
                '91+ days',
                'Age unknown',
                'Target / excess',
                'Coverage',
              ]}
            />
            <tbody>
              {rows.map((row) => (
                <tr key={row.productId}>
                  <td>
                    {row.product}
                    <small className="block muted">{row.unit}</small>
                  </td>
                  <td>{display(row.onHand)}</td>
                  {row.bands.map((band) => (
                    <td key={band.label}>{display(band.quantity)}</td>
                  ))}
                  <td>{display(row.unaged)}</td>
                  <td>
                    {display(row.target)} / {display(row.excess)}
                    <small className="block muted">
                      {money(row.excessValue, w.profile.currency)} excess at
                      current cost
                    </small>
                  </td>
                  <td>
                    {row.issue ??
                      `${display(row.knownQuantity)} units with receipt age`}
                    <small className="block muted">
                      {row.sourceIds.join(', ')}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </SortableTable>
        </div>
      ) : (
        <EmptyState
          title="No matching stock age observations"
          description="Receipt layers must reconcile to a physical-stock snapshot on the same date. A product-wide target enables excess for the full product scope."
          action={
            <button className="button secondary" onClick={onIntake}>
              Add inventory detail
            </button>
          }
        />
      )}
      <p className="panel-footnote">
        {metricVersion} · Age bands use receipt dates, with no inferred FIFO.
        Quantities without layers keep unknown age. Excess is positive on-hand
        quantity above an explicit product-wide target; a selected location
        cannot inherit that global target. Old, slow-moving and excess stock are
        different concepts.
      </p>
    </Panel>
  )
}
export function PaymentTermsPanel({
  workspace: w,
  onIntake,
}: {
  workspace: Workspace
  onIntake: () => void
}) {
  return (
    <Panel
      capability="payment-terms"
      title="Recorded payment terms"
      subtitle="Contractual timing conventions remain separate from scheduled financial events"
      action={
        <button className="text-button" onClick={onIntake}>
          Add or review terms
        </button>
      }
    >
      {(w.paymentTerms ?? []).length ? (
        <div className="table-wrap">
          <SortableTable className="data-table">
            <TableHead
              headers={[
                'Counterparty',
                'Balance terms',
                'Advance',
                'Status',
                'Source reference',
              ]}
            />
            <tbody>
              {w.paymentTerms!.map((term) => (
                <tr key={term.id}>
                  <td>
                    {term.counterparty}
                    <small className="block muted">{term.party}</small>
                  </td>
                  <td>
                    {term.days} calendar days from {term.startEvent}
                  </td>
                  <td>
                    {term.advancePercent === undefined
                      ? 'Unknown'
                      : `${term.advancePercent}% at ${term.advanceDays} days from same event`}
                  </td>
                  <td>
                    <span className="badge">{term.status}</span>
                  </td>
                  <td>{term.reference || term.sourceId}</td>
                </tr>
              ))}
            </tbody>
          </SortableTable>
        </div>
      ) : (
        <EmptyState
          title="No payment convention recorded"
          description="Capture the supplier or customer, payment days, starting event and whether the terms are agreed or proposed."
          action={
            <button className="button secondary" onClick={onIntake}>
              Record payment terms
            </button>
          }
        />
      )}
      <p className="panel-footnote">
        Terms alone do not change due dates, collection dates or opening cash. A
        scenario must select the term and its triggering event. Proposed terms
        require explicit hypothetical consent; an advance offset can be negative
        to mean before that event.
      </p>
    </Panel>
  )
}

export function HistoricalDemandPanel({
  workspace: w,
  start,
  end,
  location,
  onIntake,
}: Props) {
  const [threshold, setThreshold] = useState(0)
  const rows = historicalDemandMetrics(w, start, end, location, threshold)
  return (
    <Panel
      title="Historical demand and stock coverage"
      subtitle={`${start} to ${end} · observed unit demand; current available stock keeps its own date`}
      action={
        <button className="text-button" onClick={onIntake}>
          Review sales coverage
        </button>
      }
    >
      <div className="panel-body">
        <label className="field">
          Slow-moving threshold · maximum recorded units in this period
          <input
            type="number"
            min="0"
            value={threshold}
            onChange={(e) => {
              const value = e.target.value.trim()
              const nextThreshold = value ? Number(value) : undefined
              if (nextThreshold !== undefined && Number.isFinite(nextThreshold))
                setThreshold(Math.max(0, nextThreshold))
            }}
          />
          <small>
            This is your visible screening rule, not a universal target. Units
            remain product-specific.
          </small>
        </label>
      </div>
      <div className="table-wrap">
        <SortableTable className="data-table">
          <TableHead
            headers={[
              'Product / unit',
              'Observed dates',
              'Recorded units',
              'Daily demand',
              'Available / stock date',
              'Days of supply',
              'Slow-moving screen',
            ]}
          />
          <tbody>
            {rows.map((row) => (
              <tr key={row.productId}>
                <td>
                  {row.product}
                  <small className="block muted">{row.unit}</small>
                </td>
                <td>
                  {row.observedDates} / {row.days}
                </td>
                <td>{display(row.units)}</td>
                <td>{display(row.dailyRate)}</td>
                <td>
                  {display(row.available)}
                  <small className="block muted">{row.asOf || 'Unknown'}</small>
                </td>
                <td>{display(row.daysSupply)}</td>
                <td>
                  {row.slowMoving === null
                    ? 'Coverage incomplete'
                    : row.slowMoving
                      ? `At or below ${threshold}`
                      : `Above ${threshold}`}
                </td>
              </tr>
            ))}
          </tbody>
        </SortableTable>
      </div>
      <p className="panel-footnote">
        {metricVersion} · Available quantity / positive recorded daily demand
        over this exact window. Every date needs a compatible observation;
        absent dates are not assumed zero. Zero demand does not produce infinite
        or fabricated finite days of supply. This historical-rate screen does
        not consume forecast-model values.
      </p>
    </Panel>
  )
}

export function SupplierHistoryPanel({
  workspace: w,
  start,
  end,
  location,
  onIntake,
}: Props) {
  const result = supplierHistory(w, start, end, location)
  return (
    <>
      <Panel
        capability="suppliers"
        title="Supplier lead time and open-order age"
        subtitle={`${start} to ${result.through} · recorded receipts and orders`}
        action={
          <button className="text-button" onClick={onIntake}>
            Add purchase observations
          </button>
        }
      >
        <p className="panel-body muted">
          {result.measuredOrders}/{result.eligibleOrders} recorded receipt
          orders have a usable order date and positive received quantity.{' '}
          {result.supplierCount}/{result.totalSuppliers} supplied suppliers have
          lead-time observations.{' '}
          {location &&
            `${result.unallocated} purchases without a receipt location are outside this location scope.`}
        </p>
        {result.observations.length ? (
          <div className="table-wrap">
            <SortableTable className="data-table">
              <TableHead
                headers={[
                  'Supplier / product',
                  'Quoted lead time',
                  'Observed mean',
                  'Sample standard deviation',
                  'Coverage',
                ]}
              />
              <tbody>
                {result.observations.map((row) => (
                  <tr key={`${row.supplierId}-${row.productId}`}>
                    <td>
                      {row.supplier}
                      <small className="block muted">{row.product}</small>
                    </td>
                    <td>{display(row.quoted, ' days')}</td>
                    <td>{display(row.mean, ' days')}</td>
                    <td>{display(row.standardDeviation, ' days')}</td>
                    <td>
                      {row.count} order-to-recorded-receipt observations ·{' '}
                      {row.partial} partially received orders
                      <small className="block muted">
                        Orders · {row.orderIds.join(', ')} · sources{' '}
                        {row.sourceIds.join(', ') ||
                          'original purchase records'}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </SortableTable>
          </div>
        ) : (
          <p className="panel-body muted">
            No compatible receipt observations in this period.
          </p>
        )}
        <p className="panel-footnote">
          Observed lead time is calendar days from recorded order date to the
          provided receipt date. Each purchase supplies one receipt observation;
          cumulative partial quantities do not reveal missing receipt events.
          Variability is sample standard deviation (n−1), unavailable for one
          observation. Quoted product lead time is separate. Open-order age uses
          order date, and current cumulative quantities cannot reconstruct
          undocumented historical receipts.
        </p>
      </Panel>
      <CapabilityDisplay id="suppliers">
        <DisclosureCard
          title="Open purchase orders"
          description={`${result.open.length} ${result.open.length === 1 ? 'order' : 'orders'} · as of ${result.through} · remaining quantities and promised deadlines`}
          defaultOpen
        >
          {result.open.length ? (
            <div className="table-wrap">
              <SortableTable className="data-table">
                <TableHead
                  headers={[
                    'Order / product',
                    'Order-date age',
                    'Remaining units',
                    'Promised deadline',
                    'Recorded supply policy',
                  ]}
                />
                <tbody>
                  {result.open.map((row) => {
                    const product = w.products.find(
                      (p) => p.id === row.productId,
                    )
                    return (
                      <tr key={row.id}>
                        <td>
                          {row.id}
                          <small className="block muted">{product?.name}</small>
                        </td>
                        <td>{row.age} days</td>
                        <td>
                          {number(row.remaining)} {product?.unit}
                        </td>
                        <td>
                          {row.promisedDate ?? 'Unknown'}
                          <small className="block muted">
                            {row.overdue
                              ? 'Overdue and still open'
                              : row.promisedDate
                                ? 'Not overdue'
                                : 'Unscheduled'}
                          </small>
                        </td>
                        <td>
                          Safety stock {display(product?.safetyStock ?? null)} ·
                          quoted lead{' '}
                          {display(product?.leadTimeDays ?? null, ' days')}
                          <small className="block muted">
                            No modeled coverage inferred
                          </small>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </SortableTable>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No open orders with a usable order date at this cutoff.
            </p>
          )}
        </DisclosureCard>
      </CapabilityDisplay>
    </>
  )
}

export function ServiceConsequencesPanel({
  workspace: w,
  start,
  end,
  location,
  onIntake,
}: Props) {
  const result = serviceConsequences(w, start, end, location)
  const detailed = result.rows.filter(
    (row) =>
      (row.unmetDisposition && row.unmetDisposition !== 'unknown') ||
      row.orderReference,
  )
  return (
    <Panel
      capability="service"
      title="Unmet demand and customer timing"
      subtitle={`${start} to ${end} · original requested deadlines and explicit classifications`}
      action={
        <button className="text-button" onClick={onIntake}>
          Record service details
        </button>
      }
    >
      {detailed.length ? (
        <div className="table-wrap">
          <SortableTable className="data-table">
            <TableHead
              headers={[
                'Product / order reference',
                'Requested deadline',
                'Lost units',
                'Estimated lost margin',
                'Pending backorder / age',
                'Actual delivery timing',
              ]}
            />
            <tbody>
              {detailed.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.product}
                    <small className="block muted">
                      {row.orderReference || 'Unknown order reference'} ·{' '}
                      {row.sourceId}
                    </small>
                    {row.issue && (
                      <small className="block negative">{row.issue}</small>
                    )}
                  </td>
                  <td>{row.date}</td>
                  <td>
                    {row.unmetDisposition === 'lost'
                      ? display(row.lost)
                      : 'Not classified lost'}{' '}
                    {row.unit}
                  </td>
                  <td>
                    {money(row.estimatedLostMargin, w.profile.currency)}
                    <small className="block muted">
                      {row.lostMarginBasis || 'No margin estimate supplied'}
                    </small>
                  </td>
                  <td>
                    {row.unmetDisposition === 'backordered'
                      ? `${display(row.remaining)} ${row.unit} / ${display(row.backlogAge, ' days')} at ${row.backlogAsOf ?? 'unknown date'}`
                      : 'Not classified backordered'}
                  </td>
                  <td>
                    {row.deliveredDate ?? 'Unknown'}
                    <small className="block muted">
                      {row.deliveryDaysAfterDeadline === null
                        ? 'No comparable delivery timing'
                        : row.deliveryDaysAfterDeadline > 0
                          ? `${row.deliveryDaysAfterDeadline} days after requested deadline`
                          : row.deliveryDaysAfterDeadline === 0
                            ? 'On requested date'
                            : `${-row.deliveryDaysAfterDeadline} days before requested deadline`}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </SortableTable>
        </div>
      ) : (
        <p className="panel-body muted">
          No classified lost/backordered demand or customer order timing
          supplied. Zero stock alone establishes neither.
        </p>
      )}
      {result.targets.length > 0 && (
        <div className="table-wrap">
          <SortableTable className="data-table">
            <TableHead
              headers={[
                'Product',
                'Explicit target measure',
                'Observed subset',
                'Target',
                'Difference',
              ]}
            />
            <tbody>
              {result.targets.map((row) => (
                <tr key={row.product}>
                  <td>{row.product}</td>
                  <td>{row.basis}</td>
                  <td>{display(row.measured, '%')}</td>
                  <td>{row.target}%</td>
                  <td>{display(row.percentagePoints, ' percentage points')}</td>
                </tr>
              ))}
            </tbody>
          </SortableTable>
        </div>
      )}
      <p className="panel-footnote">
        Recorded lost and carried units are disjoint. Backorder age runs from
        the initial requested deadline to its stated remaining-balance
        observation date; later fulfillment does not change initial fill. Lost
        margin is an explicit per-unit estimate × recorded lost units, not
        observed lost revenue or guaranteed recoverable profit. Delivery timing
        alone does not prove full delivery. Target comparisons use only the
        supplied observations and matching definition, not unobserved
        business-wide service; product-wide targets do not apply to a selected
        location.
      </p>
    </Panel>
  )
}
