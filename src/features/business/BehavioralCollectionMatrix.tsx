import { useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Info,
  ShieldAlert,
  Zap,
} from 'lucide-react'
import { MetricCard, Panel } from '../../components/workspace-ui'
import {
  behavioralCollectionMatrix,
  type BehavioralMatrixResult,
  type Perspective,
} from '../../domain/behavioral-collection'
import { money, type Page, type Workspace } from '../../domain/workspace'

export function BehavioralCollectionMatrix({
  workspace,
  onNavigate,
}: {
  workspace: Workspace
  onNavigate?: (page: Page, query?: string) => void
}) {
  const [perspective, setPerspective] = useState<Perspective>('p50')
  const [asemStress, setAsemStress] = useState<boolean>(false)

  const result = behavioralCollectionMatrix(workspace, {
    perspective,
    asemStress,
  })
  const currency = workspace.profile.currency

  return (
    <Panel
      capability="internal-debt"
      title="Behavioral Cash Collection Matrix"
      subtitle={`Empirical collection distribution by customer · Base ${result.asOf} · ${result.openInvoiceCount} open invoice${result.openInvoiceCount === 1 ? '' : 's'} · ${result.customerCount} active customer${result.customerCount === 1 ? '' : 's'}`}
      action={
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className={`button ${asemStress ? 'primary' : 'secondary'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderColor: asemStress ? 'var(--amber-800, #b45309)' : undefined,
              backgroundColor: asemStress ? '#d97706' : undefined,
              color: asemStress ? '#fff' : undefined,
              fontWeight: 600,
            }}
            onClick={() => setAsemStress(!asemStress)}
            aria-pressed={asemStress}
          >
            <ShieldAlert size={16} />
            {asemStress
              ? 'ASEM Stress Active (+76d)'
              : 'Activate ASEM Stress (+76d)'}
          </button>
          {onNavigate && (
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                onNavigate(
                  'analysis',
                  `question=Q-CUSTOMER-DEBT&delay=${asemStress ? result.portfolioProfile.p50DelayDays + 76 : result.portfolioProfile.p50DelayDays}`,
                )
              }
            >
              Simulate in Scenarios
              <ArrowUpRight size={16} />
            </button>
          )}
        </div>
      }
    >
      {asemStress && (
        <div
          className="notice warning"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            margin: '0 22px 1rem 22px',
            borderLeft: '4px solid #d97706',
          }}
        >
          <AlertTriangle
            size={22}
            style={{ flexShrink: 0, marginTop: '2px', color: '#d97706' }}
          />
          <div>
            <strong>
              76-day ASEM effect applied (SME Stress Simulation)
            </strong>
            <p style={{ margin: '0.25rem 0 0 0' }}>
              According to the{' '}
              <em>ASEM Entrepreneurship Radiography</em> (Association of
              Entrepreneurs of Mexico), Mexican SMEs experience payment delays
              averaging <strong>+76 days of additional delay</strong> beyond
              contractual terms. This simulation shifts expected collections into
              later horizons to reveal hidden liquidity gaps.
            </p>
          </div>
        </div>
      )}

      {/* Perspective Selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          margin: '0 22px 1.25rem 22px',
          padding: '10px 16px',
          backgroundColor: 'var(--muted)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={16} className="muted" />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
            Collection Projection Model:
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`button small ${perspective === 'p50' && !asemStress ? 'primary' : 'secondary'}`}
            onClick={() => {
              setPerspective('p50')
              setAsemStress(false)
            }}
          >
            <Zap size={14} />
            Empirical P50 (Most Likely)
          </button>
          <button
            type="button"
            className={`button small ${perspective === 'p80' && !asemStress ? 'primary' : 'secondary'}`}
            onClick={() => {
              setPerspective('p80')
              setAsemStress(false)
            }}
          >
            Empirical P80 (Conservative / 80% Risk)
          </button>
          <button
            type="button"
            className={`button small ${perspective === 'naive' && !asemStress ? 'primary' : 'secondary'}`}
            onClick={() => {
              setPerspective('naive')
              setAsemStress(false)
            }}
          >
            Naive Assumption ("Net 30" / Contractual)
          </button>
        </div>
      </div>

      <CollectionMetrics
        result={result}
        currency={currency}
        asemStress={asemStress}
      />

      {result.warnings.map((w) => (
        <p key={w} className="notice small" style={{ margin: '0 22px 1rem 22px' }}>
          {w}
        </p>
      ))}
      <CustomerCollectionMatrix
        result={result}
        currency={currency}
        perspective={perspective}
        asemStress={asemStress}
      />

      <InvoicePredictions
        result={result}
        currency={currency}
        perspective={perspective}
        asemStress={asemStress}
      />

      {/* Transparent methodological note */}
      <details
        style={{
          margin: '1.5rem 22px 22px 22px',
          padding: '14px 18px',
          backgroundColor: 'var(--muted)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        }}
      >
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          <Info
            size={16}
            style={{
              display: 'inline',
              verticalAlign: 'text-bottom',
              marginRight: '0.4rem',
            }}
          />
          Methodology: Why replace "Net 30" with the Behavioral Matrix and
          ASEM Effect?
        </summary>
        <div
          style={{ marginTop: '0.75rem', lineHeight: 1.6, fontSize: '0.9rem' }}
        >
          <p>
            <strong>The illusion of "Net 30":</strong> Conventional accounting
            systems naively assume that if an invoice is issued with 30-day
            terms, the cash will arrive on day 30. In real business operations
            across Mexico and Latin America, each customer has their own
            payment pattern (P50: the empirical median days when they usually
            settle; P80: the timeframe in which 80% of collections are
            achieved).
          </p>
          <p>
            <strong>The 76-day ASEM Effect:</strong> Official data from the
            Association of Entrepreneurs of Mexico (ASEM) reveals that chronic
            payment delays to micro, small, and medium-sized businesses average{' '}
            <strong>76 days beyond agreed terms</strong>, which destroys operating
            liquidity if not modeled proactively. The ASEM Stress toggle lets
            you anticipate this cash flow shock before committing to supplier
            payments or inventory.
          </p>
          <p className="muted">
            Percentiles are automatically recalculated based on your actual
            observations recorded in Finance History. Customers without
            previous invoices inherit the weighted distribution of the overall
            portfolio.
          </p>
        </div>
      </details>
    </Panel>
  )
}

type MatrixViewProps = {
  result: BehavioralMatrixResult
  currency: Workspace['profile']['currency']
  perspective: Perspective
  asemStress: boolean
}

function CollectionMetrics({
  result,
  currency,
  asemStress,
}: Pick<MatrixViewProps, 'result' | 'currency' | 'asemStress'>) {
  return (
    <div className="metrics-grid">
      <MetricCard
        capability="internal-debt"
        label="Total active receivable"
        value={money(result.totalOutstanding, currency)}
        note={`${result.openInvoiceCount} active invoice${result.openInvoiceCount === 1 ? '' : 's'} across ${result.customerCount} customer${result.customerCount === 1 ? '' : 's'}`}
      />
      <MetricCard
        capability="internal-debt"
        label={
          asemStress
            ? 'Terms with ASEM Stress (+76d)'
            : 'Empirical actual terms (P50)'
        }
        value={`${asemStress ? result.weightedAsemDays : result.weightedP50Days} days`}
        note={
          asemStress
            ? 'P50 empirical terms + 76 days SME delay'
            : 'Weighted median collection based on historical behavior'
        }
        accent={asemStress}
      />
      <MetricCard
        capability="internal-debt"
        label="Liquidity gap vs 'Net 30'"
        value={money(result.cashLagAmount, currency)}
        note={
          result.cashLagAmount > 0
            ? `${money(result.cashLag90Amount, currency)} shifted beyond 90 days`
            : 'No lag compared to Net 30 assumption'
        }
      />
      <MetricCard
        capability="internal-debt"
        label="Historical on-time payment rate"
        value={
          result.portfolioProfile.onTimeRate !== null
            ? `${result.portfolioProfile.onTimeRate}%`
            : 'No history'
        }
        note={`${result.portfolioProfile.sampleCount} observed past payment${result.portfolioProfile.sampleCount === 1 ? '' : 's'}`}
      />
    </div>
  )
}

function CustomerCollectionMatrix({
  result,
  currency,
  perspective,
  asemStress,
}: MatrixViewProps) {
  return (
    <section aria-label="Collection Distribution Matrix">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
          marginTop: '1.5rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>
            Collection Distribution Matrix
          </h3>
          <p className="muted small" style={{ margin: '0.25rem 0 0 0' }}>
            Shows which time windows cash will actually arrive in based on{' '}
            <strong>
              {asemStress
                ? 'ASEM Stress Scenario (+76 days SME delay)'
                : perspective === 'p50'
                  ? 'Empirical P50 Behavior (Most likely)'
                  : perspective === 'p80'
                    ? 'Empirical P80 Behavior (Conservative)'
                    : 'Naive Net 30 Assumption (No behavioral adjustment)'}
            </strong>
            .
          </p>
        </div>
      </div>

      {result.matrixRows.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Customer / Debtor</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Outstanding balance
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  0–30 days
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  31–60 days
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  61–90 days
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  91–120 days
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  120+ days
                </th>
                <th scope="col">Behavior</th>
              </tr>
            </thead>
            <tbody>
              {result.matrixRows.map((row) => (
                <tr key={row.customer}>
                  <td>
                    <strong>{row.customer}</strong>
                    <small className="block muted">
                      {row.openInvoiceCount} pending invoice
                      {row.openInvoiceCount > 1 ? 's' : ''}
                    </small>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <strong>{money(row.totalOutstanding, currency)}</strong>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      className={
                        row.buckets['0-30'] > 0 ? 'badge green' : 'muted'
                      }
                    >
                      {row.buckets['0-30'] > 0
                        ? money(row.buckets['0-30'], currency)
                        : '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      className={row.buckets['31-60'] > 0 ? 'badge' : 'muted'}
                    >
                      {row.buckets['31-60'] > 0
                        ? money(row.buckets['31-60'], currency)
                        : '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      className={
                        row.buckets['61-90'] > 0 ? 'badge amber' : 'muted'
                      }
                    >
                      {row.buckets['61-90'] > 0
                        ? money(row.buckets['61-90'], currency)
                        : '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      className={
                        row.buckets['91-120'] > 0 ? 'badge amber' : 'muted'
                      }
                    >
                      {row.buckets['91-120'] > 0
                        ? money(row.buckets['91-120'], currency)
                        : '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      className={
                        row.buckets['120+'] > 0 ? 'badge red' : 'muted'
                      }
                    >
                      {row.buckets['120+'] > 0
                        ? money(row.buckets['120+'], currency)
                        : '—'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${row.profile.p50DelayDays <= 0 ? 'green' : row.profile.p50DelayDays <= 15 ? '' : 'amber'}`}
                    >
                      {row.profile.p50DelayDays <= 0
                        ? 'On time'
                        : `+${row.profile.p50DelayDays}d P50 / +${row.profile.p80DelayDays}d P80`}
                    </span>
                    <small className="block muted" style={{ marginTop: '3px' }}>
                      {row.profile.isBenchmark
                        ? 'Portfolio ref.'
                        : `${row.profile.sampleCount} past payment${row.profile.sampleCount === 1 ? '' : 's'}`}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr
                style={{
                  fontWeight: 'bold',
                  borderTop: '2px solid var(--border)',
                }}
              >
                <td>Projected Total</td>
                <td style={{ textAlign: 'right' }}>{money(result.totalOutstanding, currency)}</td>
                <td style={{ textAlign: 'right' }}>
                  {money(result.matrixTotals['0-30'], currency)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {money(result.matrixTotals['31-60'], currency)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {money(result.matrixTotals['61-90'], currency)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {money(result.matrixTotals['91-120'], currency)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {money(result.matrixTotals['120+'], currency)}
                </td>
                <td>100% Portfolio</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="notice">
          No open customer invoices at this time.
        </p>
      )}
    </section>
  )
}

function InvoicePredictions({
  result,
  currency,
  perspective,
  asemStress,
}: MatrixViewProps) {
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(true)
  return (
    <section style={{ marginTop: '2rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <h3>Individual Invoice Predictions</h3>
        <button
          type="button"
          className="button small secondary"
          onClick={() => setShowInvoiceDetails(!showInvoiceDetails)}
        >
          {showInvoiceDetails
            ? 'Hide invoices'
            : 'Show invoice breakdown'}
        </button>
      </div>

      {showInvoiceDetails && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Invoice / Record</th>
                <th scope="col">Customer</th>
                <th scope="col" style={{ textAlign: 'right' }}>Balance</th>
                <th scope="col">Net 30 Due Date</th>
                <th scope="col">P50 Prediction</th>
                <th scope="col">P80 Prediction</th>
                <th scope="col">ASEM Stress (+76d)</th>
                <th scope="col">Net gap</th>
                <th scope="col">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {result.predictions.map((p) => {
                const delayVsNaive = asemStress
                  ? p.asemDelayDays
                  : perspective === 'p80'
                    ? p.p80DelayDays
                    : p.p50DelayDays

                return (
                  <tr key={p.record.id}>
                    <td>
                      <strong>{p.record.name}</strong>
                      <small className="block muted">{p.record.id}</small>
                    </td>
                    <td>{p.customer}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{money(p.outstanding, currency)}</strong>
                    </td>
                    <td>{p.naiveExpectedDate}</td>
                    <td>
                      <span
                        style={{
                          fontWeight:
                            perspective === 'p50' && !asemStress ? 700 : 400,
                        }}
                      >
                        {p.p50ExpectedDate}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight:
                            perspective === 'p80' && !asemStress ? 700 : 400,
                        }}
                      >
                        {p.p80ExpectedDate}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          color: '#d97706',
                          fontWeight: asemStress ? 700 : 400,
                        }}
                      >
                        {p.asemExpectedDate}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${delayVsNaive <= 0 ? 'green' : delayVsNaive <= 20 ? 'amber' : 'red'}`}
                      >
                        {delayVsNaive > 0
                          ? `+${delayVsNaive} days`
                          : `${delayVsNaive} days`}
                      </span>
                    </td>
                    <td>
                      <span className="badge">
                        {p.confidence === 'high'
                          ? 'High (≥5 invoices)'
                          : p.confidence === 'medium'
                            ? 'Medium'
                            : 'Portfolio Ref.'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
