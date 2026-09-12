import {
  bulkImportFields,
  importDatasetNames,
  templatePaths,
} from './bulk-intake'
import { SelectField } from '../../components/ui/select-field'
import {
  ArrowRight,
  Download,
  FileSpreadsheet,
  Plus,
  Upload,
  X,
} from 'lucide-react'
import { importFields, stableId, type Interpretation } from './intake'
import { blankRow, manualHeaders } from './onboarding-draft'
import { type OnboardingViewModel } from './use-onboarding'

export function ManualSalesEntry(props: OnboardingViewModel) {
  const { draft, patch, reviewManual } = props
  return (
    <>
      <p className="muted">
        Enter recorded sales. Use YYYY-MM-DD dates and decimal points. Blank
        values stay unknown. A dated amount can be reviewed without product
        quantities.
      </p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {manualHeaders.map((header, index) => (
                <th key={header}>
                  <span>{header}</span>
                  <small
                    className="onboarding-column-help"
                    id={`sales-help-${index}`}
                  >
                    {importFields[index].help}
                  </small>
                </th>
              ))}
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            {draft.manual.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, columnIndex) => (
                  <td key={columnIndex}>
                    {columnIndex === 9 ? (
                      <SelectField
                        aria-label={`Type row ${rowIndex + 1}`}
                        aria-describedby={`sales-help-${columnIndex}`}
                        value={cell}
                        onChange={(event) =>
                          patch({
                            manual: draft.manual.map((item, index) =>
                              index === rowIndex
                                ? item.map((value, col) =>
                                    col === columnIndex
                                      ? event.target.value
                                      : value,
                                  )
                                : item,
                            ),
                          })
                        }
                      >
                        <option value="sale">Sale</option>
                        <option value="return">Return</option>
                      </SelectField>
                    ) : (
                      <input
                        aria-label={`${manualHeaders[columnIndex]} row ${rowIndex + 1}`}
                        aria-describedby={`sales-help-${columnIndex}`}
                        type={columnIndex === 0 ? 'date' : 'text'}
                        value={cell}
                        onChange={(event) =>
                          patch({
                            manual: draft.manual.map((item, index) =>
                              index === rowIndex
                                ? item.map((value, col) =>
                                    col === columnIndex
                                      ? event.target.value
                                      : value,
                                  )
                                : item,
                            ),
                          })
                        }
                      />
                    )}
                  </td>
                ))}
                <td>
                  <button
                    className="button secondary"
                    aria-label={`Remove row ${rowIndex + 1}`}
                    onClick={() =>
                      patch({
                        manual:
                          draft.manual.length > 1
                            ? draft.manual.filter(
                                (_, index) => index !== rowIndex,
                              )
                            : [blankRow()],
                      })
                    }
                  >
                    <X size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-actions">
        <button
          className="button secondary"
          onClick={() => patch({ manual: [...draft.manual, blankRow()] })}
        >
          <Plus size={16} /> Add row
        </button>
        <button className="button primary" onClick={reviewManual}>
          Review these sales <ArrowRight size={16} />
        </button>
      </div>
    </>
  )
}

export function SalesEntry(props: OnboardingViewModel) {
  const {
    draft,
    workspace,
    openSourceReview,
    move,
    patch,
    loading,

    loadFile,
  } = props
  return (
    <>
      {draft.section === 'sales' && (
        <div className="stack">
          {workspace.sources.filter(
            (source) =>
              workspace.sales.some((sale) => sale.sourceId === source.id) &&
              source.type !== 'demo',
          ).length > 0 && (
            <details className="panel">
              <summary>Review confirmed imports</summary>
              <div className="stack">
                {workspace.sources
                  .filter(
                    (source) =>
                      workspace.sales.some(
                        (sale) => sale.sourceId === source.id,
                      ) && source.type !== 'demo',
                  )
                  .map((source) => (
                    <button
                      className="button secondary"
                      key={source.id}
                      onClick={() => openSourceReview(source.id)}
                    >
                      {source.name} · {source.rowCount} accepted rows
                    </button>
                  ))}
              </div>
            </details>
          )}
          {draft.file && draft.fileDataset === 'sales' && (
            <div className="notice">
              <p>
                Your review draft from {draft.sourceName} is saved for this
                session.
              </p>
              <button className="button secondary" onClick={() => move(2)}>
                Resume saved review
              </button>
            </div>
          )}
          <div className="form-actions">
            <button
              className={`button ${draft.tab === 'upload' ? 'primary' : 'secondary'}`}
              onClick={() => patch({ tab: 'upload' })}
            >
              <Upload size={16} /> Import sales
            </button>
            <button
              className={`button ${draft.tab === 'manual' ? 'primary' : 'secondary'}`}
              onClick={() => patch({ tab: 'manual' })}
            >
              <Plus size={16} /> Enter sales manually
            </button>
            <a className="button secondary" href={templatePaths.sales} download>
              <Download size={16} /> Download sales template
            </a>
          </div>
          {draft.tab === 'upload' ? (
            <div className="panel stack">
              <FileSpreadsheet size={28} />
              <h3>Upload sales from CSV / Excel</h3>
              <p>
                CSV is parsed locally; XLS and XLSX sheets are parsed by the
                analytical service for review. Select a worksheet before
                confirming. For CSV, export the relevant sheet as CSV UTF-8. Up
                to 10,000 rows and 5 MB.
              </p>
              <label className="field">
                Choose your sales file
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  disabled={loading}
                  onChange={(event) => {
                    void loadFile(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
              </label>
              <a
                className="button secondary"
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(`${manualHeaders.join(',')}\n`)}`}
                download="samby-sales-blank-template.csv"
              >
                Download blank CSV template
              </a>
              <p className="small muted">
                The template contains column headers only. Add your own recorded
                sales; no sample records are included.
              </p>
              <p className="muted">
                Dates, products, quantities and sale amounts can be mapped in
                the next step. A complete product catalog is optional.
              </p>
              {loading && <p role="status">Reading your file…</p>}
            </div>
          ) : (
            <ManualSalesEntry {...props} />
          )}
          <div className="notice">
            A future customer order is a scenario event. It does not create
            recorded sales.
          </div>
        </div>
      )}
    </>
  )
}

export function SalesColumnMapping(props: OnboardingViewModel) {
  const { draft, patch } = props
  return (
    <div className="form-grid">
      {importFields.map(({ key, label, help }) => (
        <label key={key} className="field">
          {label}
          <SelectField
            value={draft.mapping![key] ?? ''}
            onChange={(event) =>
              patch({
                mapping: {
                  ...draft.mapping!,
                  [key]:
                    event.target.value === ''
                      ? null
                      : Number(event.target.value),
                },
              })
            }
          >
            <option value="">Not supplied</option>
            {draft.file!.headers.map((header, index) => (
              <option
                value={index}
                key={`${draft.file!.fingerprint}-column-${index}-${header}`}
              >
                {header}
              </option>
            ))}
          </SelectField>
          <small>{help}</small>
        </label>
      ))}
    </div>
  )
}

export function SalesReviewScope(props: OnboardingViewModel) {
  const {
    dates,
    productGroups,
    usable,
    locations,
    unitGroups,
    draft,
    reviewed,
  } = props
  return (
    <section
      className="panel stack onboarding-coverage"
      aria-label="Sales review scope"
    >
      <h3>What these usable rows support</h3>
      <p>
        {dates.length
          ? `Recorded dates · ${dates[0]} through ${dates.at(-1)}`
          : 'No usable dated rows yet.'}
      </p>
      <p>
        {productGroups.size} identifiable products ·{' '}
        {usable.filter((row) => !row.sku && !row.name).length} aggregate sales
        rows ·{' '}
        {locations.length
          ? `named locations · ${locations.join(', ')}`
          : 'aggregate location scope'}
      </p>
      <p>
        {unitGroups.length
          ? `Comparable unit groups · ${unitGroups.join(', ')}. Quantities combine only within compatible products and units.`
          : 'No usable product quantities. Amounts support monetary summaries only.'}
      </p>
      <p>
        Amount definition ·{' '}
        {draft.interpretation.amountBasis ||
          'No confirmed amount definition yet'}
        . Each row represents{' '}
        {draft.interpretation.rowMeaning === 'daily'
          ? 'a daily product total'
          : draft.interpretation.rowMeaning === 'invoice-total'
            ? 'an invoice total reviewed for repetition'
            : 'one sale or return line'}
        .
      </p>
      <p className="muted">
        {reviewed.filter((row) => row.status === 'pending').length} pending and{' '}
        {reviewed.filter((row) => row.status === 'excluded').length} excluded
        rows contribute no totals or date coverage. Missing days remain unknown.
        Returns stay separate; this review does not establish cash collected or
        a forecast.
      </p>
    </section>
  )
}

export function SalesReviewTable(props: OnboardingViewModel) {
  const excludedRows = new Set(props.draft.excluded)
  const { reviewed, draft, patch } = props
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Include</th>
            <th>Row / status</th>
            <th>Date</th>
            <th>Product / proposed reference</th>
            <th>Quantity</th>
            <th>Amount</th>
            <th>Review note</th>
          </tr>
        </thead>
        <tbody>
          {reviewed.slice(0, 100).map((row) => (
            <tr key={row.index}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Include row ${row.index + 1}`}
                  checked={!excludedRows.has(row.index)}
                  onChange={(event) =>
                    patch({
                      excluded: event.target.checked
                        ? draft.excluded.filter((index) => index !== row.index)
                        : [...draft.excluded, row.index],
                    })
                  }
                />
              </td>
              <td>
                {row.index + 1} · <span className="badge">{row.status}</span>
              </td>
              <td>{row.date || 'Unknown'}</td>
              <td>
                {row.name || row.sku || 'Aggregate sales'}
                {row.name && !row.sku && (
                  <small className="muted">
                    {' '}
                    Internal reference proposed · INT-
                    {stableId(row.name).toUpperCase()}
                  </small>
                )}
              </td>
              <td>
                {row.quantity === null
                  ? 'Unknown'
                  : Number.isNaN(row.quantity)
                    ? 'Invalid'
                    : `${row.quantity} ${row.unit}`}
              </td>
              <td>
                {row.amount === null
                  ? 'Unknown'
                  : Number.isNaN(row.amount)
                    ? 'Invalid'
                    : `${row.amount} ${row.currency}`}
              </td>
              <td>
                {row.reasons.length
                  ? row.reasons.join(' ')
                  : row.kind === 'return'
                    ? 'Return, preserved separately from sales.'
                    : row.location
                      ? `Location · ${row.location}`
                      : 'Aggregate location scope.'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SalesReviewStage(props: OnboardingViewModel) {
  const {
    draft,

    patch,
    workspace,
    usable,
    reviewed,
    confirmed,
    setConfirmed,
    move,
    closeDraft,
    canEdit,
    applySales,
  } = props
  return (
    <>
      {draft.step === 2 &&
        draft.section === 'sales' &&
        draft.fileDataset === 'sales' &&
        draft.file &&
        draft.mapping && (
          <div className="stack">
            <div>
              <h2>Check how your sales are understood.</h2>
              <p className="muted">
                {draft.sourceName} · {draft.file.rows.length} source rows ·{' '}
                {draft.sourceType === 'csv'
                  ? 'CSV read locally'
                  : draft.sourceType === 'xlsx'
                    ? 'Workbook read by SAMBY'
                    : 'Manual entry'}
                . Nothing is applied until you confirm.
              </p>
            </div>
            <SalesColumnMapping {...props} />
            <h3>Confirm the meaning</h3>
            <div className="form-grid">
              <label className="field">
                Date format
                <SelectField
                  value={draft.interpretation.dateFormat}
                  onChange={(event) =>
                    patch({
                      interpretation: {
                        ...draft.interpretation,
                        dateFormat: event.target
                          .value as Interpretation['dateFormat'],
                      },
                    })
                  }
                >
                  <option value="iso">YYYY-MM-DD</option>
                  <option value="dmy">DD/MM/YYYY</option>
                  <option value="mdy">MM/DD/YYYY</option>
                </SelectField>
              </label>
              <label className="field">
                Row meaning
                <SelectField
                  value={draft.interpretation.rowMeaning}
                  onChange={(event) =>
                    patch({
                      interpretation: {
                        ...draft.interpretation,
                        rowMeaning: event.target
                          .value as Interpretation['rowMeaning'],
                        duplicatesReviewed: false,
                      },
                    })
                  }
                >
                  <option value="transaction">One sale / return line</option>
                  <option value="daily">Daily product total</option>
                  <option value="invoice-total">
                    Invoice total that may repeat across lines
                  </option>
                </SelectField>
              </label>
              <label className="field">
                Fallback unit{' '}
                <span className="muted">If missing in the row</span>
                <input
                  value={draft.interpretation.unit}
                  onChange={(event) =>
                    patch({
                      interpretation: {
                        ...draft.interpretation,
                        unit: event.target.value,
                      },
                    })
                  }
                  placeholder="Confirm the same unit for these rows"
                />
              </label>
              <label className="field">
                Currency
                <SelectField
                  value={draft.interpretation.currency}
                  onChange={(event) =>
                    patch({
                      interpretation: {
                        ...draft.interpretation,
                        currency: event.target.value,
                      },
                    })
                  }
                >
                  <option value={workspace.profile.currency}>
                    {workspace.profile.currency}
                  </option>
                </SelectField>
              </label>
              <label className="field">
                Amount definition{' '}
                <span className="muted">Required when amounts are present</span>
                <input
                  value={draft.interpretation.amountBasis}
                  onChange={(event) =>
                    patch({
                      interpretation: {
                        ...draft.interpretation,
                        amountBasis: event.target.value,
                      },
                    })
                  }
                  placeholder="Describe tax, discounts and returns"
                />
                <small>
                  For example, state whether tax is excluded and discounts are
                  already deducted. This example is not saved automatically.
                </small>
              </label>
            </div>
            <p className="muted">
              Number format · decimal point, no thousands separator. Blank is
              unknown. Zero is a recorded value. Missing days are not assumed to
              be zero-sales days.
            </p>
            {draft.interpretation.rowMeaning === 'invoice-total' && (
              <label className="field checkbox-field">
                <input
                  type="checkbox"
                  checked={draft.interpretation.duplicatesReviewed}
                  onChange={(event) =>
                    patch({
                      interpretation: {
                        ...draft.interpretation,
                        duplicatesReviewed: event.target.checked,
                      },
                    })
                  }
                />
                I reviewed invoice references and excluded repeated invoice
                totals.
              </label>
            )}
            <div className="form-actions">
              <span className="badge">{usable.length} usable</span>
              <span className="badge">
                {reviewed.filter((row) => row.status === 'pending').length}{' '}
                pending
              </span>
              <span className="badge">
                {reviewed.filter((row) => row.status === 'excluded').length}{' '}
                excluded
              </span>
            </div>
            <SalesReviewScope {...props} />
            <SalesReviewTable {...props} />
            {reviewed.length > 100 && (
              <p className="muted">
                Showing the first 100 rows. All {reviewed.length} rows are
                validated and included in the counts. Correct larger files in
                the source CSV.
              </p>
            )}
            <div className="notice">
              Only usable rows are applied. Pending rows remain editable.
              Excluded rows stay in the source review and contribute no totals.
              Similar product names are never merged. An internal reference
              shown above is applied only with your confirmation.
            </div>
            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              I confirm these mappings, meaning and {usable.length} usable rows.{' '}
              {reviewed.length - usable.length} pending or excluded rows will
              not be applied.
            </label>
            <div className="form-actions">
              <button className="button secondary" onClick={() => move(1)}>
                Back to edit
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  closeDraft()
                }}
              >
                Cancel review
              </button>
              <button
                className="button primary"
                disabled={
                  !confirmed || usable.length === 0 || !canEdit('sales')
                }
                onClick={applySales}
              >
                Confirm &amp; apply {usable.length} rows
              </button>
            </div>
          </div>
        )}
    </>
  )
}

export function ConfirmedSourceReview(view: OnboardingViewModel) {
  const { sourceReview, setSourceReview } = view
  const acceptedRows = new Set(sourceReview?.acceptedRows)
  const pendingRows = new Set(sourceReview?.pendingRows)
  if (sourceReview)
    return (
      <div className="stack">
        <div>
          <h2>Confirmed source review</h2>
          <p className="muted">
            {sourceReview.sourceName} · confirmed{' '}
            {sourceReview.confirmedAt.slice(0, 10)}. Original source values and
            confirmed interpretation are preserved separately from accepted
            records in this workspace.
          </p>
        </div>
        <div className="panel stack">
          <p>
            {sourceReview.dataset === 'sales'
              ? `Row meaning · ${sourceReview.interpretation.rowMeaning}`
              : `Dataset · ${importDatasetNames[sourceReview.dataset]}`}{' '}
            · date format · {sourceReview.interpretation.dateFormat}
          </p>
          <p>
            Number format · decimal point · currency ·{' '}
            {sourceReview.interpretation.currency}
          </p>
          {sourceReview.dataset === 'sales' && (
            <p>
              Amount meaning ·{' '}
              {sourceReview.interpretation.amountBasis ||
                'Amounts not provided'}
            </p>
          )}
          <p>
            {sourceReview.acceptedRows.length} accepted ·{' '}
            {sourceReview.pendingRows.length} pending ·{' '}
            {sourceReview.excludedRows.length} excluded
          </p>
          {(sourceReview.dataset === 'sales'
            ? importFields
            : bulkImportFields[sourceReview.dataset]
          )
            .filter((field) => sourceReview.mapping[field.key] !== null)
            .map((field) => (
              <p key={field.key}>
                {sourceReview.file.headers[sourceReview.mapping[field.key]!]} →{' '}
                {field.label}
              </p>
            ))}
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Original row</th>
                {sourceReview.file.headers.map((header, index) => (
                  <th
                    key={`${sourceReview.file.fingerprint}-column-${index}-${header}`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sourceReview.file.rows.slice(0, 100).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td>
                    {rowIndex + 1} ·{' '}
                    {acceptedRows.has(rowIndex)
                      ? 'accepted'
                      : pendingRows.has(rowIndex)
                        ? 'pending'
                        : 'excluded'}
                  </td>
                  {row.map((value, columnIndex) => (
                    <td key={columnIndex}>
                      {value === '' ? 'Not supplied' : value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sourceReview.file.rows.length > 100 && (
          <p className="muted">Showing the first 100 original rows.</p>
        )}
        <div className="form-actions">
          <button
            className="button secondary"
            onClick={() => setSourceReview(null)}
          >
            Back to intake
          </button>
        </div>
      </div>
    )

  return null
}
