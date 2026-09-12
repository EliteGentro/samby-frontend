import { SortableTable } from '../../components/SortableTable'
import { DisclosureCard } from '../../components/ui/disclosure-card'
import { CapabilityDisplay } from '../../components/workspace-ui'
import { SelectField } from '../../components/ui/select-field'
import type { Dispatch, SetStateAction } from 'react'
import { TableHead } from '../../components/workspace-ui'
import { useState } from 'react'
import { MetricCard, Panel } from '../../components/workspace-ui'
import {
  financeInsights,
  type FinanceInsightKind,
} from '../../domain/finance-insights'
import {
  cutoff,
  money,
  number,
  shiftDate,
  type Workspace,
} from '../../domain/workspace'

export function FinanceInsights({
  workspace,
  kind,
  asOf,
  start,
  end,
}: {
  workspace: Workspace
  kind: FinanceInsightKind
  asOf?: string
  start?: string
  end?: string
}) {
  const [horizon, setHorizon] = useState(30)
  const windowStart = start ?? asOf ?? cutoff(workspace)
  const result = financeInsights(
    workspace,
    kind,
    asOf,
    windowStart,
    end ?? shiftDate(windowStart, horizon - 1),
  )
  const currency = workspace.profile.currency,
    internal = kind === 'internal',
    party = internal ? 'Customer' : 'Supplier'
  return (
    <>
      <Panel
        capability={internal ? 'internal-debt' : 'external-debt'}
        title={
          internal
            ? 'Customer balances and collections'
            : 'Supplier balances and payments'
        }
        subtitle={`Current supplied balances · ${result.asOf} · ${currency} · ${result.eligibleCount}/${result.candidateCount} records reconciled`}
      >
        <div className="metrics-grid">
          <MetricCard
            label="Known outstanding subtotal"
            value={money(result.total, currency)}
            note="Reconciled working-currency records; excluded records remain separate"
          />
          <MetricCard
            label="Contractually overdue"
            value={money(result.overdue, currency)}
            note={`Due before ${result.asOf}; provider availability is a separate stage`}
          />
          <MetricCard
            label={
              internal
                ? 'Provider availability pending'
                : 'Unscheduled payments'
            }
            value={money(
              internal ? result.providerPending : result.unscheduled,
              currency,
            )}
            note={
              internal
                ? 'Collected invoice amounts awaiting provider availability'
                : 'Outstanding records without usable expected payment dates'
            }
          />
        </div>
        {result.warnings.map((warning) => (
          <p key={warning} className="notice warning">
            {warning}
          </p>
        ))}
        {result.total !== null && (
          <FinanceAgingAndConcentration
            party={party}
            currency={currency}
            result={result}
          />
        )}
        <FinanceTimeline
          internal={internal}
          start={start}
          end={end}
          horizon={horizon}
          setHorizon={setHorizon}
          result={result}
          currency={currency}
        />
      </Panel>
      <FinanceCoverageDetails
        result={result}
        internal={internal}
        workspace={workspace}
      />
    </>
  )
}

function FinanceCoverageDetails({
  result,
  internal,
  workspace,
}: {
  result: ReturnType<typeof financeInsights>
  internal: boolean
  workspace: Workspace
}) {
  return (
    <CapabilityDisplay id={internal ? 'internal-debt' : 'external-debt'}>
      <DisclosureCard
        title="Coverage, payment stages and source references"
        description={`${result.activeCount} outstanding · ${result.settledCount} fully paid · ${result.excluded.length} excluded`}
      >
        <p className="text-xs leading-5 text-muted-foreground">
          {result.activeCount} outstanding records · {result.settledCount} fully
          paid records · {result.excluded.length} excluded records.
        </p>
        {result.excluded.length > 0 && (
          <div className="mt-4 table-wrap">
            <SortableTable
              className="data-table"
              collapsible={false}
              tableLabel="Excluded finance records"
            >
              <TableHead headers={['Excluded record', 'Reason']} />
              <tbody>
                {result.excluded.map((item) => (
                  <tr key={`${item.id}-${item.reason}`}>
                    <th scope="row">
                      {item.name} · {item.id}
                    </th>
                    <td>{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </SortableTable>
          </div>
        )}
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Included identities:{' '}
          {result.records.map((record) => record.id).join(', ') || 'None'}.
        </p>
        <div className="mt-3 grid gap-2">
          {result.sources.map((source) => (
            <p key={source.id} className="small">
              {source.name} · {source.id} · imported{' '}
              {source.importedAt ?? 'date not supplied'}
            </p>
          ))}
        </div>
        <p className="panel-footnote mt-4">
          {internal
            ? 'Receivables use original amount minus cumulative paid amount. Linked provider funds represent the already collected stage and are reconciled against invoice paid amounts before inclusion.'
            : 'Only confirmed supplier payables enter these balances. Purchase orders and recurring commitments are not added again.'}{' '}
          Current source dates do not reconstruct earlier payment states.
          Working timezone: {workspace.profile.timezone}.
        </p>
      </DisclosureCard>
    </CapabilityDisplay>
  )
}

function FinanceTimeline({
  internal,
  start,
  end,
  horizon,
  setHorizon,
  result,
  currency,
}: {
  internal: boolean
  start: string | undefined
  end: string | undefined
  horizon: number
  setHorizon: Dispatch<SetStateAction<number>>
  result: ReturnType<typeof financeInsights>
  currency: string
}) {
  return (
    <section
      aria-label={
        internal ? 'Expected collection timeline' : 'Planned payment timeline'
      }
    >
      <h3>
        {internal
          ? 'Expected collections and availability'
          : 'Planned supplier payments'}
      </h3>
      {start === undefined && end === undefined && (
        <label className="field">
          Expected timeline horizon
          <SelectField
            aria-label="Expected timeline horizon"
            value={horizon}
            onChange={(event) => setHorizon(Number(event.target.value))}
          >
            {[7, 30, 60, 90].map((days) => (
              <option key={days} value={days}>
                Next {days} days
              </option>
            ))}
          </SelectField>
        </label>
      )}
      <p className="muted">
        Expected dates · {result.start} to {result.end}. Amounts are currently
        outstanding; this is neither recorded historical cash flow nor a
        calculated cash balance.
      </p>
      {result.timeline.length ? (
        <div className="table-wrap">
          <SortableTable className="data-table" defaultOpen>
            <thead>
              <tr>
                <th scope="col">Expected date</th>
                {internal ? (
                  <>
                    <th scope="col">Customer collections · {currency}</th>
                    <th scope="col">Provider availability · {currency}</th>
                  </>
                ) : (
                  <th scope="col">Supplier payments · {currency}</th>
                )}
                <th scope="col">Source records</th>
              </tr>
            </thead>
            <tbody>
              {result.timeline.map((point) => (
                <tr key={point.date}>
                  <th scope="row">{point.date}</th>
                  {internal ? (
                    <>
                      <td>{money(point.receivable, currency)}</td>
                      <td>{money(point.provider, currency)}</td>
                    </>
                  ) : (
                    <td>{money(point.payable, currency)}</td>
                  )}
                  <td>{point.recordIds.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </SortableTable>
        </div>
      ) : (
        <p className="notice">
          No reconciled outstanding records have expected dates in this window.
          Missing dates and excluded records do not establish zero future cash
          flow.
        </p>
      )}
      <p className="panel-footnote">
        Unscheduled: {money(result.unscheduled, currency)} · expected before
        this window: {money(result.beforeWindow, currency)} · expected after it:{' '}
        {money(result.beyondWindow, currency)}. Dates are expectations, not
        guarantees or instructions to pay.
      </p>
    </section>
  )
}

function FinanceAgingAndConcentration({
  party,
  currency,
  result,
}: {
  party: 'Customer' | 'Supplier'
  currency: string
  result: ReturnType<typeof financeInsights>
}) {
  return (
    <div className="overview-grid">
      <section aria-label={`${party} overdue aging`}>
        <h3>Current overdue aging</h3>
        <div className="table-wrap">
          <SortableTable className="data-table">
            <thead>
              <tr>
                <th scope="col">Due-date band</th>
                <th scope="col">Outstanding · {currency}</th>
                <th scope="col">Records</th>
              </tr>
            </thead>
            <tbody>
              {result.aging.map((band) => (
                <tr key={band.key}>
                  <th scope="row">{band.label}</th>
                  <td>{money(band.amount, currency)}</td>
                  <td>{band.recordIds.length}</td>
                </tr>
              ))}
            </tbody>
          </SortableTable>
        </div>
        <p className="panel-footnote">
          Days late are calendar days after the contractual due date. A record
          due today is not overdue. Missing due dates stay unknown.
        </p>
      </section>
      <section aria-label={`${party} concentration`}>
        <h3>{party} concentration</h3>
        {result.concentration.length ? (
          <div className="table-wrap">
            <SortableTable className="data-table">
              <thead>
                <tr>
                  <th scope="col">{party}</th>
                  <th scope="col">Outstanding · {currency}</th>
                  <th scope="col">Share of known subtotal</th>
                </tr>
              </thead>
              <tbody>
                {result.concentration.map((item) => (
                  <tr key={item.name}>
                    <th scope="row">{item.name}</th>
                    <td>{money(item.amount, currency)}</td>
                    <td>
                      {item.share === null
                        ? 'Undefined'
                        : `${number(item.share)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </SortableTable>
          </div>
        ) : (
          <p className="notice">
            The reconciled records have no outstanding amount. A zero
            denominator does not produce a concentration percentage.
          </p>
        )}
        <p className="panel-footnote">
          Denominator: {money(result.total, currency)} across the supplied,
          reconciled population. Unassigned counterparties remain a separate
          bucket. No default probability is inferred.
        </p>
      </section>
    </div>
  )
}
