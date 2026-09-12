import { DataChart, Panel } from '../../components/workspace-ui'
import { SortableTable } from '../../components/SortableTable'
import { number } from '../../domain/workspace'
import type { DailyPoint, ForecastDiagnostics } from '../../lib/analysis'

export function ForecastEvaluation({
  diagnostics: d,
  history,
  unit,
}: {
  diagnostics: ForecastDiagnostics
  history: DailyPoint[]
  unit: string
}) {
  const backtest = d.backtest
  const advanced = ['lightgbm', 'catboost'].includes(d.engine)
  return (
    <>
      <Panel
        title="Historical demand used by this forecast"
        subtitle={`${d.history_start} to ${d.history_end}. ${d.observed_days} observed dates. ${d.evaluation_source}.`}
      >
        <DataChart
          data={history}
          series={[{ key: 'actual', label: 'Observed daily quantity' }]}
          unit={unit}
          label="Saved historical demand context"
        />
        <div className="notice">
          <dl className="details-grid compact-result-details">
            <div>
              <dt>Engine</dt>
              <dd>{d.engine}</dd>
            </div>
            <div>
              <dt>Library version</dt>
              <dd>{d.library_version}</dd>
            </div>
            <div>
              <dt>Training sample</dt>
              <dd>
                {advanced
                  ? `${d.training_rows} fitted rows`
                  : `${d.observed_days} supplied dates`}
              </dd>
            </div>
            <div>
              <dt>Training cutoff</dt>
              <dd>{d.training_cutoff}</dd>
            </div>
          </dl>
          <p>
            The view shows up to the last 365 historical observations; absent
            dates remain unobserved.
          </p>
        </div>
        {!!d.stockout_observations?.length && (
          <div>
            <h3>Observed zero-stock dates</h3>
            <p className="notice">
              These are recorded zero-availability observations within the
              selected scope. A location observation does not establish zero
              stock across the whole pool, and an opening or closing observation
              does not establish full-day duration. The supplied sales
              quantities and fitted numerical inputs are unchanged.
            </p>
            <div className="table-wrap">
              <SortableTable
                className="data-table"
                tableLabel="Observed zero-stock dates"
              >
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Observed phase</th>
                    <th>Location scope</th>
                    <th>Source reference</th>
                    <th>Observation ID</th>
                  </tr>
                </thead>
                <tbody>
                  {d.stockout_observations.map((observation) => (
                    <tr key={observation.id}>
                      <td>{observation.date}</td>
                      <td>{observation.phase}</td>
                      <td>{observation.location_id ?? 'Supplied aggregate'}</td>
                      <td>{observation.source_id ?? observation.id}</td>
                      <td>{observation.id}</td>
                    </tr>
                  ))}
                </tbody>
              </SortableTable>
            </div>
          </div>
        )}
      </Panel>
      <Panel
        title="Temporal forecast evaluation"
        subtitle={
          backtest
            ? `${backtest.start_date} to ${backtest.end_date}. ${backtest.observations} unseen daily observations.`
            : 'A held-out evaluation is unavailable for this history'
        }
      >
        <p>
          {advanced
            ? d.temporal_method
            : 'The simple baseline uses only observations before the forecast start. Its evaluation withholds the final 14 observed dates and repeats the earlier last value or complete prior season without actual-target feedback.'}
        </p>
        {backtest && (
          <>
            <DataChart
              data={backtest.series}
              series={[
                { key: 'actual', label: 'Actual held-out demand' },
                { key: 'predicted', label: `${d.engine} held-out forecast` },
                { key: 'naive', label: 'Naïve benchmark' },
                { key: 'seasonal_naive', label: '7-day seasonal benchmark' },
              ]}
              unit={unit}
              label="Actual versus predicted demand on unseen dates"
            />
            <div className="table-wrap">
              <SortableTable
                className="data-table"
                tableLabel="Forecast evaluation measures"
              >
                <thead>
                  <tr>
                    <th>Measure</th>
                    <th>Selected engine</th>
                    <th>Naïve benchmark</th>
                    <th>Seasonal benchmark</th>
                    <th>Definition</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(d.formulas).map(([key, formula]) => (
                    <tr key={key}>
                      <td>
                        {(
                          {
                            mae: 'Mean absolute error',
                            rmse: 'Root mean squared error',
                            bias: 'Mean forecast bias',
                            wape_percent: 'WAPE',
                          } as Record<string, string>
                        )[key] ?? key}
                      </td>
                      {[
                        backtest.metrics,
                        backtest.naive_metrics,
                        backtest.seasonal_naive_metrics,
                      ].map((metrics, index) => (
                        <td key={index}>
                          {metrics?.[key] == null
                            ? 'Unavailable'
                            : `${number(metrics[key]!)} ${key === 'wape_percent' ? '%' : unit}`}
                        </td>
                      ))}
                      <td>{formula}</td>
                    </tr>
                  ))}
                </tbody>
              </SortableTable>
            </div>
            <p className="notice">
              Evaluation training ends {backtest.training_end}. Lower errors on
              this window do not prove future superiority. Positive bias means
              over-forecasting. Zero-denominator percentage errors stay
              unavailable.
            </p>
          </>
        )}
        <details>
          <summary>Model features and limitations</summary>
          <p>{d.feature_names.join(', ')}</p>
          <ul>
            {d.limitations.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
          <p>
            Contract {d.contract_version}. No calibrated prediction interval is
            claimed.
          </p>
        </details>
      </Panel>
    </>
  )
}
