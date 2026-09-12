import { SelectField } from '../../components/ui/select-field'
import { SortableTable } from '../../components/SortableTable'
import type { Sale, FinancialRecord, Page } from '../../domain/workspace'
import type { Dispatch, SetStateAction } from 'react'
import { TableHead } from '../../components/workspace-ui'
import { historicalStockValue } from '../../domain/historical-metrics'
import {
  CapitalMetricsPanel,
  ObservedServicePanel,
  AgingInventoryPanel,
  HistoricalDemandPanel,
  SupplierHistoryPanel,
  ServiceConsequencesPanel,
} from './HistoricalMetrics'
import { useState } from 'react'
import { CalendarDays, ChevronRight } from 'lucide-react'
import {
  DataChart,
  EmptyState,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  Tabs,
} from '../../components/workspace-ui'
import {
  cutoff,
  money,
  number,
  outstanding,
  type Workspace,
} from '../../domain/workspace'
import {
  financeTotals,
  comparisonWindow,
  periodWindow,
  periods,
  salesSeries,
  salesSummary,
  salesComparison,
  scopedSales,
  stockValue,
  supplierPerformance,
} from '../../domain/selectors'
import { QuarterComparison } from './QuarterComparison'
import { DataQuality } from './DataQuality'
import { SavedProjection } from './SavedProjection'
import { FinanceInsights } from './FinanceInsights'
import { FinanceHistory } from './FinanceHistory'
import type { BusinessPageProps } from './Home'

export function Dashboards({
  workspace: w,
  onChange,
  onNavigate,
  onIntake,
}: BusinessPageProps) {
  const [family, setFamily] = useState('Inventory'),
    [subsection, setSubsection] = useState('Executive')
  const [period, setPeriod] = useState(
    () => sessionStorage.getItem('samby.dashboard.period') ?? 'Last 30 days',
  )
  const [location, setLocation] = useState(''),
    [year, setYear] = useState(Number(cutoff(w).slice(0, 4))),
    [quarter, setQuarter] = useState(3),
    [compare, setCompare] = useState(false)
  const dates = periodWindow(period, cutoff(w), year, quarter),
    sales = scopedSales(w, dates.start, dates.end, location),
    summary = salesSummary(w, sales),
    value = stockValue(w, location),
    totals = financeTotals(w)
  const historical = dates.end < cutoff(w) || dates.start > cutoff(w),
    supplier = supplierPerformance(
      {
        ...w,
        purchases: w.purchases.filter(
          (p) => !location || p.locationId === location,
        ),
      },
      dates.start,
      dates.end,
    ),
    historicalValue = historicalStockValue(w, dates.end, {
      locationId: location || undefined,
    })
  const previous = comparisonWindow(period, dates),
    previousSummary = salesSummary(
      w,
      scopedSales(w, previous.start, previous.end, location),
    ),
    comparison = salesComparison(summary, previousSummary)
  const financeInScope = (record: Workspace['finance'][number]) =>
    financeDashboardIncludes(record, family, subsection)
  const datedFinance = financialRecordsDue(w, dates, financeInScope)
  const [inspection, setInspection] = useState<
    'sales' | 'stock' | 'finance' | 'suppliers' | null
  >(null)
  const familyTabs =
    family === 'Inventory'
      ? ['Executive', 'Inventory', 'Service', 'Suppliers']
      : ['Executive', 'Liquidity', 'Internal Debt', 'External Debt']
  return (
    <>
      <PageHeader
        eyebrow="Dashboards"
        title="The numbers, with context."
        description="Review supported indicators and follow each one back to its records."
        action={
          <div className="inline-actions">
            <CalendarDays size={16} />
            <span className="small muted">
              {dates.start} to {dates.end}
            </span>
          </div>
        }
      />
      <DashboardControls
        family={family}
        setFamily={setFamily}
        setSubsection={setSubsection}
        period={period}
        setPeriod={setPeriod}
        year={year}
        setYear={setYear}
        quarter={quarter}
        setQuarter={setQuarter}
        subsection={subsection}
        location={location}
        setLocation={setLocation}
        w={w}
        compare={compare}
        setCompare={setCompare}
      />
      <DataQuality
        workspace={w}
        start={dates.start}
        end={dates.end}
        location={
          family === 'Inventory' && subsection !== 'Suppliers' ? location : ''
        }
      />
      {period === 'Last 4 quarters' && (
        <QuarterComparison
          workspace={w}
          through={dates.end}
          location={
            family === 'Inventory' && subsection !== 'Suppliers' ? location : ''
          }
          family={family}
          subsection={subsection}
        />
      )}
      <Tabs
        tabs={familyTabs}
        value={subsection}
        onChange={setSubsection}
        label="Dashboard subsection"
      />
      <DashboardContents
        family={family}
        subsection={subsection}
        setInspection={setInspection}
        summary={summary}
        w={w}
        historical={historical}
        historicalValue={historicalValue}
        value={value}
        dates={dates}
        compare={compare}
        previous={previous}
        previousSummary={previousSummary}
        comparison={comparison}
        onIntake={onIntake}
        sales={sales}
        location={location}
        supplier={supplier}
        totals={totals}
        financeInScope={financeInScope}
        datedFinance={datedFinance}
        onNavigate={onNavigate}
        onChange={onChange}
      />
      <DashboardRecordsDialog
        inspection={inspection}
        setInspection={setInspection}
        dates={dates}
        sales={sales}
        w={w}
        location={location}
        supplier={supplier}
      />
    </>
  )
}

function FinancialDashboardRows({
  records,
}: {
  workspace: Workspace
  records: Workspace['finance']
}) {
  return records.length ? (
    <div className="table-wrap">
      <SortableTable className="data-table">
        <TableHead
          headers={[
            'Record',
            'Counterparty',
            'Due date',
            'Current outstanding',
          ]}
        />
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.counterparty || 'Not provided'}</td>
              <td>{r.dueDate}</td>
              <td>{money(outstanding(r), r.currency)}</td>
            </tr>
          ))}
        </tbody>
      </SortableTable>
    </div>
  ) : (
    <EmptyState
      title="No due dates in this reporting period"
      description="This does not confirm that no obligations exist. Review unscheduled records and source coverage in Finance."
    />
  )
}

function DashboardRecordsDialog({
  inspection,
  setInspection,
  dates,
  sales,
  w,
  location,
  supplier,
}: {
  inspection: 'sales' | 'stock' | 'finance' | 'suppliers' | null
  setInspection: Dispatch<
    SetStateAction<'sales' | 'stock' | 'finance' | 'suppliers' | null>
  >
  dates: { start: string; end: string }
  sales: Sale[]
  w: Workspace
  location: string
  supplier: ReturnType<typeof supplierPerformance>
}) {
  return (
    <Modal
      open={inspection !== null}
      onClose={() => setInspection(null)}
      title="Records behind this indicator"
      description={`${dates.start} to ${dates.end}. ${inspection === 'stock' ? 'Stock snapshots retain their own dates.' : inspection === 'finance' ? 'Current balances remain distinct from historical flows.' : 'Only this selected reporting scope is shown.'}`}
      wide
    >
      {inspection === 'sales' ? (
        <div className="table-wrap">
          <SortableTable className="data-table">
            <TableHead
              headers={[
                'Date',
                'Product',
                'Quantity',
                'Amount',
                'Source meaning',
              ]}
            />
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td>{s.date}</td>
                  <td>
                    {w.products.find((p) => p.id === s.productId)?.name ??
                      'Aggregate'}
                  </td>
                  <td>
                    {s.quantity ?? 'Unknown'} {s.unit}
                  </td>
                  <td>{money(s.amount, s.currency)}</td>
                  <td>{s.amountBasis || 'Unknown'}</td>
                </tr>
              ))}
            </tbody>
          </SortableTable>
        </div>
      ) : inspection === 'stock' ? (
        <div className="table-wrap">
          <SortableTable className="data-table">
            <TableHead
              headers={[
                'Product',
                'Scope',
                'Quantity / basis',
                'Unit cost',
                'Stock date',
              ]}
            />
            <tbody>
              {w.stock
                .filter((s) => !location || s.locationId === location)
                .map((s) => (
                  <tr key={s.id}>
                    <td>
                      {w.products.find((p) => p.id === s.productId)?.name}
                    </td>
                    <td>
                      {w.locations.find((l) => l.id === s.locationId)?.name ??
                        'Aggregate'}
                    </td>
                    <td>
                      {s.onHand} · {s.quantityBasis ?? 'on-hand'}
                    </td>
                    <td>
                      {money(
                        w.products.find((p) => p.id === s.productId)?.cost ??
                          null,
                        w.profile.currency,
                      )}
                    </td>
                    <td>{s.asOf}</td>
                  </tr>
                ))}
            </tbody>
          </SortableTable>
        </div>
      ) : inspection === 'finance' ? (
        <FinancialDashboardRows workspace={w} records={w.finance} />
      ) : (
        <div className="stack">
          {supplier.due.map((p) => (
            <p key={p.id}>
              {p.id} · promised {p.promisedDate} · received{' '}
              {p.receivedDate ?? 'Not recorded'} · {p.receivedQuantity}/
              {p.quantity} units
            </p>
          ))}
        </div>
      )}
    </Modal>
  )
}

function FinanceDashboard({
  subsection,
  setInspection,
  historical,
  w,
  totals,
  compare,
  previous,
  financeInScope,
  datedFinance,
  onNavigate,
  onChange,
  dates,
}: {
  subsection: string
  setInspection: Dispatch<
    SetStateAction<'finance' | 'sales' | 'stock' | 'suppliers' | null>
  >
  historical: boolean
  w: Workspace
  totals: ReturnType<typeof financeTotals>
  compare: boolean
  previous: { start: string; end: string; label: string }
  financeInScope: (f: Workspace['finance'][number]) => boolean
  datedFinance: FinancialRecord[]
  onNavigate: (page: Page, query?: string) => void
  onChange: (w: Workspace) => void
  dates: { start: string; end: string }
}) {
  return (
    <>
      {subsection === 'Executive' && (
        <FinanceDashboardMetrics
          setInspection={setInspection}
          historical={historical}
          w={w}
          totals={totals}
        />
      )}
      {compare && (
        <p className="notice">
          {previous.label} · {previous.start} to {previous.end}.{' '}
          {
            w.finance.filter(
              (f) =>
                f.dueDate &&
                f.dueDate >= previous.start &&
                f.dueDate <= previous.end &&
                financeInScope(f),
            ).length
          }{' '}
          records due, compared with {datedFinance.length} in the selected
          period. Current outstanding amounts cannot establish historical cash
          flows or balances without payment history.
        </p>
      )}
      {(subsection === 'Executive' || subsection === 'Liquidity') && (
        <SavedProjection workspace={w} onNavigate={onNavigate} />
      )}
      {(subsection === 'Internal Debt' || subsection === 'External Debt') && (
        <FinanceInsights
          workspace={w}
          kind={subsection === 'Internal Debt' ? 'internal' : 'external'}
          asOf={cutoff(w)}
        />
      )}
      <FinanceHistory
        workspace={w}
        onChange={onChange}
        start={dates.start}
        end={dates.end}
        kind={
          subsection === 'Internal Debt'
            ? 'internal'
            : subsection === 'External Debt'
              ? 'external'
              : undefined
        }
      />
      <Panel
        title={`${subsection === 'Internal Debt' || subsection === 'External Debt' ? subsection : 'Financial'} records due in period`}
        subtitle={`${dates.start} to ${dates.end} · current outstanding amounts, not reconstructed historical balances`}
        action={
          <button className="text-button" onClick={() => onNavigate('finance')}>
            Manage financial data
            <ChevronRight size={15} />
          </button>
        }
      >
        <FinancialDashboardRows workspace={w} records={datedFinance} />
        <p className="panel-footnote">
          Undated records stay in Finance. The reporting period does not change
          the forward planning horizon or the selected saved run.
        </p>
      </Panel>
    </>
  )
}

function SupplierDashboard({
  setInspection,
  supplier,
  dates,
  w,
  onIntake,
  location,
}: {
  setInspection: Dispatch<
    SetStateAction<'sales' | 'stock' | 'finance' | 'suppliers' | null>
  >
  supplier: ReturnType<typeof supplierPerformance>
  dates: { start: string; end: string }
  w: Workspace
  onIntake: (
    section?: 'sales' | 'inventory' | 'finance' | 'suppliers' | 'profile',
  ) => void
  location: string
}) {
  return (
    <>
      <div className="metrics-grid">
        <MetricCard
          hideUnavailable
          onInspect={() => setInspection('suppliers')}
          capability="suppliers"
          label="Orders due in period"
          value={number(supplier.due.length)}
          note="Counting unit · purchase orders"
        />
        <MetricCard
          hideUnavailable
          onInspect={() => setInspection('suppliers')}
          capability="suppliers"
          label="On-time and in-full"
          value={
            supplier.rate === null
              ? 'Not provided'
              : `${number(supplier.rate)}%`
          }
          note={`${supplier.both.length} orders met both conditions`}
        />
        <MetricCard
          hideUnavailable
          onInspect={() => setInspection('suppliers')}
          capability="suppliers"
          label="On-time deliveries"
          value={
            supplier.due.length
              ? `${number((supplier.onTime.length / supplier.due.length) * 100)}%`
              : 'Not provided'
          }
          note="Overdue undelivered orders stay in denominator"
        />
        <MetricCard
          hideUnavailable
          onInspect={() => setInspection('suppliers')}
          capability="suppliers"
          label="In-full deliveries"
          value={
            supplier.due.length
              ? `${number((supplier.inFull.length / supplier.due.length) * 100)}%`
              : 'Not provided'
          }
          note="Recorded received quantity meets ordered quantity"
        />
      </div>
      <Panel
        capability="suppliers"
        title="Supplier delivery observations"
        subtitle={`${dates.start} to ${dates.end} · promised due dates`}
      >
        {supplier.due.length ? (
          <div className="table-wrap">
            <SortableTable className="data-table">
              <TableHead
                headers={[
                  'Order',
                  'Supplier',
                  'Promised',
                  'Received',
                  'Quantity',
                ]}
              />
              <tbody>
                {supplier.due.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>
                      {w.suppliers.find((s) => s.id === p.supplierId)?.name ??
                        'Unknown'}
                    </td>
                    <td>{p.promisedDate}</td>
                    <td>{p.receivedDate ?? 'Not received'}</td>
                    <td>
                      {p.receivedQuantity} / {p.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </SortableTable>
          </div>
        ) : (
          <EmptyState
            title="No eligible supplier observations"
            description="Add promised and actual receipt dates with ordered and received quantities."
            action={
              <button
                className="button secondary"
                onClick={() => onIntake('suppliers')}
              >
                Add supplier data
              </button>
            }
          />
        )}
        <p className="panel-footnote">
          Only purchases with a known matching receipt location enter a location
          scope. Current cumulative received quantities do not reconstruct
          partial receipts at earlier deadlines; those timing limits remain
          disclosed. Historical observations stay separate from quoted lead
          times and hypothetical supplier delays.
        </p>
      </Panel>
      <SupplierHistoryPanel
        workspace={w}
        start={dates.start}
        end={dates.end}
        location={location}
        onIntake={() => onIntake('suppliers')}
      />
    </>
  )
}

function InventoryDashboard({
  setInspection,
  summary,
  w,
  historical,
  historicalValue,
  value,
  dates,
  compare,
  previous,
  previousSummary,
  comparison,
  onIntake,
  onNavigate,
  sales,
  location,
  subsection,
}: {
  setInspection: Dispatch<
    SetStateAction<'sales' | 'stock' | 'finance' | 'suppliers' | null>
  >
  summary: ReturnType<typeof salesSummary>
  w: Workspace
  historical: boolean
  historicalValue: ReturnType<typeof historicalStockValue>
  value: ReturnType<typeof stockValue>
  dates: { start: string; end: string }
  compare: boolean
  previous: { start: string; end: string; label: string }
  previousSummary: ReturnType<typeof salesSummary>
  comparison:
    | { absolute: null; percentage: null; reason: string }
    | { absolute: number; percentage: number | null; reason: string | null }
  onIntake: (
    section?: 'sales' | 'inventory' | 'finance' | 'suppliers' | 'profile',
  ) => void
  onNavigate: BusinessPageProps['onNavigate']
  sales: Sale[]
  location: string
  subsection: string
}) {
  return (
    <>
      <div className="metrics-grid">
        <MetricCard
          hideUnavailable
          onInspect={() => setInspection('sales')}
          capability="sales"
          label="Recorded sales"
          value={money(summary.revenue, w.profile.currency)}
          note={`${summary.revenueRows} usable monetary records in selected period`}
        />
        <MetricCard
          hideUnavailable
          onInspect={() => setInspection('sales')}
          capability="margin"
          label="Gross margin"
          value={
            summary.margin === null
              ? 'Not provided'
              : `${number(summary.margin)}%`
          }
          note={`${summary.marginRows} costed records${summary.currentCostRows ? ` · ${summary.currentCostRows} estimated with current product costs` : ' · recorded historical unit costs'} · not net profit`}
        />
        <MetricCard
          hideUnavailable
          onInspect={() => setInspection('stock')}
          capability="inventory-value"
          label="Inventory at cost"
          value={
            historical
              ? money(historicalValue.value, w.profile.currency)
              : money(value.value, w.profile.currency)
          }
          note={
            historical
              ? `${historicalValue.count}/${historicalValue.total} historical scopes · ${historicalValue.estimated} explicitly estimated · ${dates.end}`
              : `${value.count}/${value.total} positions valued · ${value.dateLabel}`
          }
        />
        <MetricCard
          hideUnavailable
          onInspect={() => setInspection('sales')}
          capability="sales"
          label="Products sold"
          value={
            summary.productCount ? number(summary.productCount) : 'Not provided'
          }
          note="Identifiable products in selected period"
        />
      </div>
      {compare && (
        <div className="notice">
          {previous.label} · {previous.start} to {previous.end}. Recorded sales{' '}
          {money(previousSummary.revenue, w.profile.currency)}.{' '}
          {comparison.absolute !== null
            ? `Absolute difference ${money(comparison.absolute, w.profile.currency)}. ${comparison.percentage !== null ? `${number(comparison.percentage)}% change.` : comparison.reason}`
            : comparison.reason}{' '}
          Period coverage may differ; this is not a like-for-like claim.
        </div>
      )}
      {subsection === 'Executive' ? (
        <Panel
          capability="sales"
          title="Recorded sales"
          subtitle={`${w.profile.currency} · known observation dates only`}
          action={
            <button className="text-button" onClick={() => onIntake('sales')}>
              Review sales data
              <ChevronRight size={15} />
            </button>
          }
        >
          <DataChart
            data={salesSeries(w, sales)}
            series={[{ key: 'revenue', label: 'Sales amount' }]}
            unit={w.profile.currency}
            label="Sales over the selected reporting period"
          />
          <p className="panel-footnote">
            {sales.length
              ? `${summary.revenueRows} of ${sales.length} records support monetary totals. Missing observation dates are not zero.`
              : 'No sales observations support this reporting period.'}
          </p>
        </Panel>
      ) : (
        <div className="notice mb-4 flex items-center justify-between">
          <div>
            <strong>Macro Inventory Perspective.</strong> Capital velocity,
            turnover (DIO), and demand history are summarized below. Detailed
            SKU-level distribution graphs are available in the Inventory
            section.
          </div>
          <button
            className="button secondary small shrink-0 ml-3"
            onClick={() => onNavigate('inventory')}
          >
            View Inventory graphs
            <ChevronRight size={14} />
          </button>
        </div>
      )}
      <CapitalMetricsPanel
        workspace={w}
        start={dates.start}
        end={dates.end}
        location={location}
        onIntake={() => onIntake('inventory')}
      />
      {subsection === 'Inventory' && (
        <HistoricalDemandPanel
          workspace={w}
          start={dates.start}
          end={dates.end}
          location={location}
          onIntake={() => onIntake('sales')}
        />
      )}
      {subsection === 'Inventory' && (
        <AgingInventoryPanel
          workspace={w}
          asOf={dates.end}
          location={location}
          onIntake={() => onIntake('inventory')}
        />
      )}
    </>
  )
}

function DashboardControls({
  family,
  setFamily,
  setSubsection,
  period,
  setPeriod,
  year,
  setYear,
  quarter,
  setQuarter,
  subsection,
  location,
  setLocation,
  w,
  compare,
  setCompare,
}: {
  family: string
  setFamily: Dispatch<SetStateAction<string>>
  setSubsection: Dispatch<SetStateAction<string>>
  period: string
  setPeriod: Dispatch<SetStateAction<string>>
  year: number
  setYear: Dispatch<SetStateAction<number>>
  quarter: number
  setQuarter: Dispatch<SetStateAction<number>>
  subsection: string
  location: string
  setLocation: Dispatch<SetStateAction<string>>
  w: Workspace
  compare: boolean
  setCompare: Dispatch<SetStateAction<boolean>>
}) {
  return (
    <div className="dashboard-controls">
      <Tabs
        tabs={['Inventory', 'Finance']}
        value={family}
        onChange={(v) => {
          setFamily(v)
          setSubsection('Executive')
        }}
        label="Dashboard family"
      />
      <div className="filter-bar">
        <SelectField
          label="Dashboard reporting period"
          className="w-auto"
          value={period}
          onValueChange={(nextPeriod) => {
            setPeriod(nextPeriod)
            sessionStorage.setItem('samby.dashboard.period', nextPeriod)
          }}
          options={periods.map((option) => ({
            value: option,
            label: option,
          }))}
        />
        {period === 'Selected quarter' && (
          <>
            <input
              aria-label="Reporting year"
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(e) => {
                const value = e.target.value.trim()
                const nextYear = value ? Number(value) : undefined
                if (nextYear !== undefined && Number.isFinite(nextYear))
                  setYear(nextYear)
              }}
            />
            <SelectField
              label="Reporting quarter"
              className="w-auto"
              value={String(quarter)}
              onValueChange={(nextQuarter) => setQuarter(Number(nextQuarter))}
              options={[1, 2, 3, 4].map((option) => ({
                value: String(option),
                label: `Quarter ${option}`,
              }))}
            />
          </>
        )}
        {family === 'Inventory' && subsection !== 'Suppliers' && (
          <SelectField
            label="Dashboard location"
            value={location}
            onValueChange={setLocation}
            className="min-w-64 max-w-full"
            options={[
              { value: '', label: 'All known locations and aggregate' },
              ...w.locations.map((item) => ({
                value: item.id,
                label: item.name,
              })),
            ]}
          />
        )}
        <label className="group flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-transparent px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-card hover:text-foreground">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
            className="size-3.5 shrink-0 cursor-pointer rounded border-border accent-secondary outline-none focus-visible:ring-3 focus-visible:ring-secondary/20"
          />
          Compare previous period
        </label>
      </div>
    </div>
  )
}

function FinanceDashboardMetrics({
  setInspection,
  historical,
  w,
  totals,
}: {
  setInspection: Dispatch<
    SetStateAction<'finance' | 'sales' | 'stock' | 'suppliers' | null>
  >
  historical: boolean
  w: Workspace
  totals: ReturnType<typeof financeTotals>
}) {
  return (
    <div className="metrics-grid">
      <MetricCard
        hideUnavailable
        onInspect={() => setInspection('finance')}
        capability="liquidity"
        label="Available cash"
        value={
          historical
            ? 'Not provided'
            : money(w.cash?.amount ?? null, w.profile.currency)
        }
        note={
          historical
            ? 'Historical balance cannot be reconstructed'
            : w.cash
              ? `${w.cash.phase} snapshot · ${w.cash.date}`
              : 'No dated cash snapshot'
        }
      />
      <MetricCard
        hideUnavailable
        onInspect={() => setInspection('finance')}
        capability="internal-debt"
        label="Internal Debt"
        value={
          historical ||
          !w.finance.some(
            (f) => f.kind === 'receivable' || f.kind === 'provider_pending',
          )
            ? 'Not provided'
            : money(totals.internal, w.profile.currency)
        }
        note="Current customer balances and provider-pending funds"
      />
      <MetricCard
        hideUnavailable
        onInspect={() => setInspection('finance')}
        capability="external-debt"
        label="External Debt"
        value={
          historical || !w.finance.some((f) => f.kind === 'payable')
            ? 'Not provided'
            : money(totals.external, w.profile.currency)
        }
        note="Current confirmed supplier payables"
      />
      <MetricCard
        hideUnavailable
        onInspect={() => setInspection('finance')}
        capability="financing"
        label="Known Financing Debt payments"
        value={
          historical || !w.finance.some((f) => f.kind === 'financing')
            ? 'Not provided'
            : money(totals.financing, w.profile.currency)
        }
        note="Known schedule only, current records"
      />
    </div>
  )
}

function financeDashboardIncludes(
  record: Workspace['finance'][number],
  family: string,
  subsection: string,
) {
  if (family !== 'Finance') return true
  if (subsection === 'Internal Debt')
    return record.kind === 'receivable' || record.kind === 'provider_pending'
  if (subsection === 'External Debt') return record.kind === 'payable'
  return true
}

function financialRecordsDue(
  workspace: Workspace,
  period: { start: string; end: string },
  includesRecord: (record: Workspace['finance'][number]) => boolean,
) {
  return workspace.finance.filter(
    (record) =>
      record.dueDate &&
      record.dueDate >= period.start &&
      record.dueDate <= period.end &&
      includesRecord(record),
  )
}

function DashboardContents({
  family,
  subsection,
  setInspection,
  summary,
  w,
  historical,
  historicalValue,
  value,
  dates,
  compare,
  previous,
  previousSummary,
  comparison,
  onIntake,
  sales,
  location,
  supplier,
  totals,
  financeInScope,
  datedFinance,
  onNavigate,
  onChange,
}: {
  family: string
  subsection: string
  setInspection: Dispatch<
    SetStateAction<'sales' | 'stock' | 'finance' | 'suppliers' | null>
  >
  summary: ReturnType<typeof salesSummary>
  w: Workspace
  historical: boolean
  historicalValue: ReturnType<typeof historicalStockValue>
  value: ReturnType<typeof stockValue>
  dates: { start: string; end: string }
  compare: boolean
  previous: { start: string; end: string; label: string }
  previousSummary: ReturnType<typeof salesSummary>
  comparison:
    | { absolute: null; percentage: null; reason: string }
    | { absolute: number; percentage: number | null; reason: string | null }
  onIntake: (
    section?: 'sales' | 'inventory' | 'finance' | 'suppliers' | 'profile',
  ) => void
  sales: Sale[]
  location: string
  supplier: ReturnType<typeof supplierPerformance>
  totals: ReturnType<typeof financeTotals>
  financeInScope: (record: Workspace['finance'][number]) => boolean
  datedFinance: FinancialRecord[]
  onNavigate: (page: Page, query?: string) => void
  onChange: (w: Workspace) => void
}) {
  if (
    family === 'Inventory' &&
    (subsection === 'Executive' || subsection === 'Inventory')
  )
    return (
      <InventoryDashboard
        setInspection={setInspection}
        summary={summary}
        w={w}
        historical={historical}
        historicalValue={historicalValue}
        value={value}
        dates={dates}
        compare={compare}
        previous={previous}
        previousSummary={previousSummary}
        comparison={comparison}
        onIntake={onIntake}
        onNavigate={onNavigate}
        sales={sales}
        location={location}
        subsection={subsection}
      />
    )
  if (family === 'Inventory' && subsection === 'Service')
    return (
      <>
        <ObservedServicePanel
          workspace={w}
          start={dates.start}
          end={dates.end}
          location={location}
          onIntake={() => onIntake('inventory')}
        />
        <ServiceConsequencesPanel
          workspace={w}
          start={dates.start}
          end={dates.end}
          location={location}
          onIntake={() => onIntake('inventory')}
        />
      </>
    )
  if (family === 'Inventory' && subsection === 'Suppliers')
    return (
      <SupplierDashboard
        setInspection={setInspection}
        supplier={supplier}
        dates={dates}
        w={w}
        onIntake={onIntake}
        location={location}
      />
    )
  return (
    <FinanceDashboard
      subsection={subsection}
      setInspection={setInspection}
      historical={historical}
      w={w}
      totals={totals}
      compare={compare}
      previous={previous}
      financeInScope={financeInScope}
      datedFinance={datedFinance}
      onNavigate={onNavigate}
      onChange={onChange}
      dates={dates}
    />
  )
}
