import type { Product, Sale, FinancialRecord } from '../../domain/workspace'
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CircleCheck,
  Clock3,
  FilePlus2,
  Package,
  Sparkles,
  Wallet,
} from 'lucide-react'
import {
  DataChart,
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  ViewLink,
} from '../../components/workspace-ui'
import { DataQuality } from './DataQuality'
import {
  availability,
  cutoff,
  dateLabel,
  money,
  number,
  outstanding,
  shiftDate,
  visibleCapability,
  type Page,
  type Workspace,
} from '../../domain/workspace'
import {
  financeTotals,
  salesSeries,
  salesSummary,
  scopedSales,
  stockValue,
} from '../../domain/selectors'

export type BusinessPageProps = {
  workspace: Workspace
  onChange: (w: Workspace) => void
  onNavigate: (page: Page, query?: string) => void
  onIntake: (
    section?: 'sales' | 'inventory' | 'finance' | 'suppliers' | 'profile',
  ) => void
}

export function Home({
  workspace: w,
  onNavigate,
  onIntake,
}: BusinessPageProps) {
  const asOf = cutoff(w),
    recentStart = shiftDate(asOf, -29)
  const recentSales = scopedSales(w, recentStart, asOf)
  const recordedDates = w.sales
    .map((sale) => sale.date)
    .filter((date) => date <= asOf)
    .sort()
  const salesPeriod =
    !recentSales.length && recordedDates.length
      ? {
          start: recordedDates[0],
          end: recordedDates[recordedDates.length - 1],
          historical: true,
        }
      : { start: recentStart, end: asOf, historical: false }
  const sales = scopedSales(w, salesPeriod.start, salesPeriod.end),
    summary = salesSummary(w, sales),
    finance = financeTotals(w),
    valuation = stockValue(w)
  const overdue = w.finance.filter(
    (f) =>
      f.kind === 'receivable' &&
      f.dueDate &&
      f.dueDate < asOf &&
      outstanding(f) > 0,
  )
  const low = w.products.filter(
    (p) =>
      p.reorderPoint !== null &&
      availability(w, p.id) !== null &&
      availability(w, p.id)! < p.reorderPoint,
  )
  const upcoming = w.finance
    .filter(
      (f) => f.expectedDate && f.expectedDate >= asOf && outstanding(f) > 0,
    )
    .sort((a, b) => (a.expectedDate ?? '').localeCompare(b.expectedDate ?? ''))
    .slice(0, 4)
  const hasData = w.sales.length + w.stock.length + w.finance.length > 0
  const ranked = w.products
    .map((p) => ({
      product: p,
      sales: sales.filter((s) => s.productId === p.id),
    }))
    .map((row) => ({ ...row, amount: salesSummary(w, row.sales).revenue }))
    .filter((r) => r.sales.length > 0)
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
    .slice(0, 5)
  return (
    <>
      <PageHeader
        eyebrow="Business overview"
        title={
          hasData ? 'Your business, in view.' : 'A clearer picture starts here.'
        }
        description={
          hasData
            ? salesPeriod.historical
              ? `Recorded sales history covers ${salesPeriod.start} to ${salesPeriod.end}. Inventory and financial records retain their own dates.`
              : `A connected view of your sales, inventory and money. ${dateLabel(recentStart)} to ${dateLabel(asOf)}, ${asOf.slice(0, 4)}.`
            : 'Start with the information you already have. Add more when you need it.'
        }
        action={
          <button className="button primary" onClick={() => onIntake()}>
            <FilePlus2 size={17} />
            Add data
          </button>
        }
      />
      {!hasData ? (
        <GettingStarted onIntake={onIntake} w={w} />
      ) : (
        <>
          {salesPeriod.historical && (
            <p className="notice">
              No sales are recorded in the last 30 days. Showing your supplied
              sales history.
            </p>
          )}
          <DataQuality
            workspace={w}
            start={salesPeriod.start}
            end={salesPeriod.end}
          />
          <OverviewMetrics
            w={w}
            summary={summary}
            sales={sales}
            salesPeriod={salesPeriod}
            finance={finance}
            valuation={valuation}
          />
          <div className="overview-grid">
            <Panel
              capability="sales"
              title="Sales over time"
              subtitle={`Recorded ${salesPeriod.historical ? 'historical ' : ''}monetary sales · ${w.profile.currency} · ${salesPeriod.start} to ${salesPeriod.end}`}
              action={
                <ViewLink onClick={() => onNavigate('dashboards')}>
                  View dashboard
                </ViewLink>
              }
            >
              <DataChart
                data={salesSeries(w, sales)}
                series={[{ key: 'revenue', label: 'Net recorded sales' }]}
                label="Recorded sales over time"
                unit={w.profile.currency}
              />
              <p className="chart-disclaimer">
                Missing dates are unobserved, not confirmed zero-sales days.
              </p>
            </Panel>
            <AttentionPanel
              w={w}
              overdue={overdue}
              onNavigate={onNavigate}
              low={low}
            />
          </div>
          <div className="overview-grid">
            <ProductSalesPanel
              salesPeriod={salesPeriod}
              onNavigate={onNavigate}
              ranked={ranked}
              w={w}
            />
            <CalendarPanel
              onNavigate={onNavigate}
              upcoming={upcoming}
              w={w}
              onIntake={onIntake}
            />
          </div>
          <section className="scenario-banner">
            <span className="scenario-symbol">
              <Sparkles size={25} />
            </span>
            <div>
              <h2>What changes if your next decision changes?</h2>
              <p>
                Explore a new order, a replenishment plan or the timing of a
                collection.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => onNavigate('analysis')}
            >
              Explore a scenario
              <ArrowRight size={17} />
            </button>
          </section>
        </>
      )}
      <p className="page-footnote">
        {w.mode === 'demo'
          ? 'Demonstration workspace · coherent synthetic records · not a validated customer dataset'
          : 'Business workspace · check the save status above before leaving'}
        <span>
          {hasData
            ? `Data cutoff ${asOf} · ${w.profile.timezone}`
            : 'No business analysis has been generated yet'}
        </span>
      </p>
    </>
  )
}

function CalendarPanel({
  onNavigate,
  upcoming,
  w,
  onIntake,
}: {
  onNavigate: (page: Page, query?: string) => void
  upcoming: FinancialRecord[]
  w: Workspace
  onIntake: (
    section?: 'sales' | 'inventory' | 'finance' | 'suppliers' | 'profile',
  ) => void
}) {
  return (
    <Panel
      title="On the calendar"
      subtitle="Upcoming recorded receipts and payments"
      action={
        <ViewLink onClick={() => onNavigate('finance')}>Finance</ViewLink>
      }
    >
      {upcoming.length ? (
        <div className="calendar-list">
          {upcoming.map((f) => (
            <button
              key={f.id}
              onClick={() => onNavigate('finance')}
              className="calendar-row"
            >
              <span className="calendar-date">
                <small>{dateLabel(f.expectedDate!).split(' ')[0]}</small>
                <strong>{f.expectedDate!.slice(8)}</strong>
              </span>
              <span className="calendar-description">
                <strong>{f.counterparty}</strong>
                <small>{f.name}</small>
              </span>
              <span
                className={
                  f.kind === 'receivable' || f.kind === 'provider_pending'
                    ? 'positive'
                    : 'amount'
                }
              >
                {f.kind === 'receivable' || f.kind === 'provider_pending'
                  ? '+'
                  : '−'}
                {money(outstanding(f), w.profile.currency)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No scheduled events"
          description="Add expected collection or payment dates to your records."
          action={
            <button
              className="button secondary"
              onClick={() => onIntake('finance')}
            >
              Add financial data
            </button>
          }
        />
      )}
    </Panel>
  )
}

function ProductSalesPanel({
  salesPeriod,
  onNavigate,
  ranked,
  w,
}: {
  salesPeriod: { start: string; end: string; historical: boolean }
  onNavigate: (page: Page, query?: string) => void
  ranked: { amount: number | null; product: Product; sales: Sale[] }[]
  w: Workspace
}) {
  return (
    <Panel
      capability="sales"
      title="Sales by product"
      subtitle={`${salesPeriod.historical ? `Recorded history · ${salesPeriod.start} to ${salesPeriod.end}` : 'Last 30 days'} · recorded monetary amounts`}
      action={
        <ViewLink onClick={() => onNavigate('inventory')}>Inventory</ViewLink>
      }
    >
      {ranked.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th className="numeric">Sales</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ product: p, sales: rows, amount }) => (
                <tr key={p.id}>
                  <td>
                    <div className="product-cell">
                      <span
                        className={`product-icon category-${p.category.toLowerCase()}`}
                      >
                        <Package size={19} />
                      </span>
                      <div>
                        <strong>{p.name}</strong>
                        <small>{p.sku}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {rows.every((s) => s.quantity !== null && s.unit === p.unit)
                      ? number(
                          rows.reduce(
                            (sum, s) =>
                              sum +
                              s.quantity! * (s.kind === 'return' ? -1 : 1),
                            0,
                          ),
                        )
                      : 'Not provided'}{' '}
                    <span className="muted">{p.unit}</span>
                  </td>
                  <td className="numeric">
                    {money(amount, w.profile.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No product sales in this period"
          description="Aggregate amounts can still support the sales chart. Add product references for this breakdown."
        />
      )}
    </Panel>
  )
}

function AttentionPanel({
  w,
  overdue,
  onNavigate,
  low,
}: {
  w: Workspace
  overdue: FinancialRecord[]
  onNavigate: (page: Page, query?: string) => void
  low: Product[]
}) {
  return (
    <Panel
      title="Needs your attention"
      subtitle="Recorded exceptions, with context"
      className="attention-panel"
    >
      {!w.muted.includes('internal-debt') && overdue.length > 0 && (
        <button
          className="attention-item"
          onClick={() => onNavigate('finance', 'tab=Internal%20Debt')}
        >
          <span className="attention-icon amber">
            <Clock3 size={19} />
          </span>
          <div>
            <strong>
              {overdue.length} overdue collection
              {overdue.length !== 1 ? 's' : ''}
            </strong>
            <p>
              {money(
                overdue.reduce((s, f) => s + outstanding(f), 0),
                w.profile.currency,
              )}{' '}
              outstanding
            </p>
            <small>Expected dates are estimates</small>
          </div>
          <ArrowUpRight size={16} />
        </button>
      )}
      {!w.muted.includes('stock') && low.length > 0 && (
        <button
          className="attention-item"
          onClick={() => onNavigate('inventory', 'filter=low')}
        >
          <span className="attention-icon">
            <Package size={19} />
          </span>
          <div>
            <strong>
              {low.length} product{low.length !== 1 ? 's' : ''} below reorder
              point
            </strong>
            <p>Compared with your recorded thresholds</p>
            <small>Review the scope before planning</small>
          </div>
          <ArrowUpRight size={16} />
        </button>
      )}
      <button className="attention-item" onClick={() => onNavigate('data')}>
        <span className="attention-icon green">
          <CircleCheck size={19} />
        </span>
        <div>
          <strong>Your data has more to tell you</strong>
          <p>Review coverage and optional capabilities</p>
          <small>Missing inputs remain visible</small>
        </div>
        <ArrowUpRight size={16} />
      </button>
    </Panel>
  )
}

function OverviewMetrics({
  w,
  summary,
  sales,
  salesPeriod,
  finance,
  valuation,
}: {
  w: Workspace
  summary: ReturnType<typeof salesSummary>
  sales: Sale[]
  salesPeriod: { start: string; end: string; historical: boolean }
  finance: ReturnType<typeof financeTotals>
  valuation: ReturnType<typeof stockValue>
}) {
  return (
    <div className="metrics-grid">
      {visibleCapability(w, 'sales') && (
        <MetricCard
          capability="sales"
          label="Recorded sales"
          value={money(summary.revenue, w.profile.currency)}
          note={`${sales.length} record${sales.length === 1 ? '' : 's'} · ${salesPeriod.historical ? `recorded history · ${salesPeriod.start} to ${salesPeriod.end}` : 'last 30 days'}`}
          icon={<BarChart3 size={17} />}
        />
      )}
      {visibleCapability(w, 'internal-debt') && (
        <MetricCard
          capability="internal-debt"
          label="Internal Debt"
          value={money(finance.internal, w.profile.currency)}
          note={`${money(finance.pending, w.profile.currency)} pending availability`}
          icon={<Clock3 size={17} />}
        />
      )}
      {visibleCapability(w, 'inventory-value') && (
        <MetricCard
          capability="inventory-value"
          label="Inventory at cost"
          value={money(valuation.value, w.profile.currency)}
          note={`${valuation.count} of ${valuation.total} positions valued · ${valuation.dateLabel}`}
          icon={<Package size={17} />}
        />
      )}
      {w.cash && !w.muted.includes('liquidity') && (
        <MetricCard
          capability="liquidity"
          label="Available cash"
          value={money(w.cash.amount, w.profile.currency)}
          note={`${w.cash.phase === 'opening' ? 'Opening' : 'End-of-day'} snapshot · ${dateLabel(w.cash.date)}`}
          icon={<Wallet size={17} />}
          accent
        />
      )}
    </div>
  )
}

function GettingStarted({
  onIntake,
  w,
}: {
  onIntake: (
    section?: 'sales' | 'inventory' | 'finance' | 'suppliers' | 'profile',
  ) => void
  w: Workspace
}) {
  return (
    <>
      <section className="welcome-panel">
        <div>
          <span className="badge yellow">YOUR FIRST STEP</span>
          <h2>
            Turn your sales into
            <br />a useful starting point.
          </h2>
          <p>
            Import a sales file or enter a few records. You can start with
            inventory or a receivable, too. Everything else can wait.
          </p>
          <button className="button primary" onClick={() => onIntake()}>
            Set up my workspace
            <ArrowRight size={17} />
          </button>
          <p className="small muted">
            {w.onboarding.deferred
              ? 'Setup was deferred. Resume whenever you are ready.'
              : 'No complete catalog or inventory setup required.'}
          </p>
        </div>
        <div className="journey-preview">
          {[
            [
              BarChart3,
              'Start with what you sell',
              'Dates, products and the amounts you know.',
            ],
            [
              Boxes,
              'Connect the details',
              'Add stock, suppliers and customer payments.',
            ],
            [
              Sparkles,
              'Explore a decision',
              'Compare a new order, purchase or collection.',
            ],
          ].map(([Icon, title, text], i) => {
            const ItemIcon = Icon as typeof BarChart3
            return (
              <div className="journey-step" key={String(title)}>
                <span>
                  <ItemIcon size={22} />
                </span>
                <div>
                  <small>0{i + 1}</small>
                  <h3>{String(title)}</h3>
                  <p>{String(text)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>
      <div className="three-grid">
        {[
          [
            'Sales history',
            'Understand recorded sales without assuming stock or cash.',
            'sales',
          ],
          [
            'Current inventory',
            'Start with quantities and known locations.',
            'inventory',
          ],
          [
            'Customer payments',
            'Record what is owed and when you expect it.',
            'finance',
          ],
        ].map(([title, description, section]) => (
          <button
            className="starter-card"
            key={title}
            onClick={() =>
              onIntake(section as 'sales' | 'inventory' | 'finance')
            }
          >
            <span>
              {section === 'sales' ? (
                <BarChart3 />
              ) : section === 'inventory' ? (
                <Package />
              ) : (
                <Wallet />
              )}
            </span>
            <h3>{title}</h3>
            <p>{description}</p>
            <ArrowUpRight size={18} />
          </button>
        ))}
      </div>
    </>
  )
}
