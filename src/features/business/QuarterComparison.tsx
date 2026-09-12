import { Panel } from '../../components/workspace-ui'
import { money, type Workspace } from '../../domain/workspace'
import { salesSummary, scopedSales } from '../../domain/selectors'

export function QuarterComparison({
  workspace: w,
  through,
  location = '',
  family,
  subsection,
}: {
  workspace: Workspace
  through: string
  location?: string
  family: string
  subsection?: string
}) {
  const end = new Date(`${through}T12:00:00Z`),
    q = Math.floor(end.getUTCMonth() / 3)
  const quarters = Array.from({ length: 4 }, (_, i) => {
    const start = new Date(
        Date.UTC(end.getUTCFullYear(), (q - 3 + i) * 3, 1, 12),
      ),
      finish = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0, 12),
      )
        .toISOString()
        .slice(0, 10)
    const startDate = start.toISOString().slice(0, 10),
      endDate = finish > through ? through : finish
    const rows = scopedSales(w, startDate, endDate, location),
      summary = salesSummary(w, rows)
    return {
      label: `Q${Math.floor(start.getUTCMonth() / 3) + 1} ${start.getUTCFullYear()}`,
      start: startDate,
      end: endDate,
      partial: finish > through,
      rows,
      summary,
      financial: w.finance.filter(
        (f) =>
          f.dueDate &&
          f.dueDate >= startDate &&
          f.dueDate <= endDate &&
          (subsection === 'Internal Debt'
            ? ['receivable', 'provider_pending'].includes(f.kind)
            : subsection === 'External Debt'
              ? f.kind === 'payable'
              : true),
      ),
    }
  })
  return (
    <Panel
      title="Last four quarters"
      subtitle="Recorded period totals and observed coverage"
    >
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Observed window</th>
              <th>{family === 'Inventory' ? 'Sales rows' : 'Records due'}</th>
              <th>
                {family === 'Inventory'
                  ? `Recorded sales · ${w.profile.currency}`
                  : 'Historical balance'}
              </th>
              {family === 'Inventory' && <th>Amount definition</th>}
            </tr>
          </thead>
          <tbody>
            {quarters.map((row) => (
              <tr key={row.label}>
                <td>
                  {row.label}
                  {row.partial ? ' · partial quarter' : ''}
                </td>
                <td>
                  {row.start} to {row.end}
                </td>
                <td>
                  {family === 'Inventory'
                    ? row.rows.length
                    : row.financial.length}
                </td>
                <td>
                  {family === 'Inventory'
                    ? money(row.summary.revenue, w.profile.currency)
                    : 'Unavailable without historic snapshots'}
                </td>
                {family === 'Inventory' && (
                  <td>
                    {row.summary.bases.length === 1
                      ? row.summary.bases[0]
                      : row.summary.bases.length
                        ? 'Conflicting definitions'
                        : 'Not provided'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="panel-footnote">
        Missing observations stay unavailable. Short or partial quarters are not
        automatically comparable. Financial due-date counts do not establish
        cash movements or past outstanding balances.
      </p>
    </Panel>
  )
}
