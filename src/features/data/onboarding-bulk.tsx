import { Download, FileSpreadsheet, Plus, Upload } from 'lucide-react'
import { SelectField } from '../../components/ui/select-field'
import { SortableTable } from '../../components/SortableTable'
import {
  bulkImportFields,
  importDatasetNames,
  templatePaths,
} from './bulk-intake'
import type { Interpretation } from './intake'
import type { OnboardingViewModel } from './use-onboarding'

export function BulkEntry({
  draft,
  confirmedSources,
  openSourceReview,
  move,
  patch,
  loading,
  loadFile,
}: OnboardingViewModel) {
  if (draft.section === 'sales' || draft.section === 'profile') return null
  const dataset = draft.section
  return (
    <div className="stack">
      {confirmedSources.length > 0 && (
        <details className="panel">
          <summary>Review confirmed imports</summary>
          <div className="stack">
            {confirmedSources.map((source) => (
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
      {draft.file && draft.fileDataset === dataset && (
        <div className="notice">
          <p>
            Your review draft from {draft.sourceName} is saved for this session.
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
          <Upload size={16} /> Import {importDatasetNames[dataset]}
        </button>
        <button
          className={`button ${draft.tab === 'manual' ? 'primary' : 'secondary'}`}
          onClick={() => patch({ tab: 'manual' })}
        >
          <Plus size={16} /> Enter {importDatasetNames[dataset]} manually
        </button>
        <a className="button secondary" href={templatePaths[dataset]} download>
          <Download size={16} /> Download {importDatasetNames[dataset]} template
        </a>
      </div>
      {draft.tab === 'upload' && (
        <div className="panel stack">
          <FileSpreadsheet size={28} />
          <h3>Upload {importDatasetNames[dataset]} from CSV / Excel</h3>
          <p>
            CSV is parsed locally; XLS and XLSX sheets are parsed by the
            analytical service for review. Select a worksheet before confirming.
            Up to 10,000 rows and 5 MB.
          </p>
          <label className="field">
            Choose your {importDatasetNames[dataset]} file
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
          <p className="muted">
            Map the source columns in the next step. Blank optional values
            remain unknown, and nothing is applied before review.
          </p>
          {loading && <p role="status">Reading your file…</p>}
        </div>
      )}
    </div>
  )
}

export function BulkReviewStage(view: OnboardingViewModel) {
  const {
    draft,
    bulkReviewed,
    patch,
    workspace,
    confirmed,
    setConfirmed,
    move,
    closeDraft,
    canEdit,
    applyImportedRows,
  } = view
  const { section, file, mapping } = draft
  if (
    draft.step !== 2 ||
    section === 'sales' ||
    section === 'profile' ||
    draft.fileDataset !== section ||
    !file ||
    !mapping
  )
    return null
  const usable = bulkReviewed.filter((row) => row.status === 'usable')
  return (
    <div className="stack">
      <div>
        <h2>Check how your {importDatasetNames[section]} are understood.</h2>
        <p className="muted">
          {draft.sourceName} · {file.rows.length} source rows ·{' '}
          {draft.sourceType === 'csv'
            ? 'CSV read locally'
            : 'Workbook read by SAMBY'}
          . Nothing is applied until you confirm.
        </p>
      </div>
      <div className="form-grid">
        {bulkImportFields[section].map(({ key, label }) => (
          <label key={key} className="field">
            {label}
            <SelectField
              value={mapping[key] ?? ''}
              onChange={(event) =>
                patch({
                  mapping: {
                    ...mapping,
                    [key]:
                      event.target.value === ''
                        ? null
                        : Number(event.target.value),
                  },
                })
              }
            >
              <option value="">Not supplied</option>
              {file.headers.map((header, column) => (
                <option
                  value={column}
                  key={`${file.fingerprint}-column-${column}-${header}`}
                >
                  {header}
                </option>
              ))}
            </SelectField>
          </label>
        ))}
      </div>
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
      </div>
      <p className="muted">
        Number format · decimal point, no thousands separator. Blank is unknown.
        Zero is a recorded value.
      </p>
      <div className="form-actions">
        <span className="badge">{usable.length} usable</span>
        <span className="badge">
          {bulkReviewed.filter((row) => row.status === 'pending').length}{' '}
          pending
        </span>
        <span className="badge">
          {bulkReviewed.filter((row) => row.status === 'excluded').length}{' '}
          excluded
        </span>
      </div>
      <BulkReviewTable {...view} />
      {bulkReviewed.length > 100 && (
        <p className="muted">
          Showing the first 100 rows. All {bulkReviewed.length} rows are
          validated and included in the counts. Correct larger files in the
          source CSV.
        </p>
      )}
      <div className="notice">
        Only usable rows are applied. Pending and excluded rows are retained in
        this intake draft for review and contribute no totals. Similar product
        names and SKU variants are never silently merged; use SKU
        standardization after import to review corrections.
      </div>
      <label className="field checkbox-field">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        I confirm these mappings, meaning and {usable.length} usable rows.{' '}
        {bulkReviewed.length - usable.length} pending or excluded rows will not
        be applied.
      </label>
      <div className="form-actions">
        <button className="button secondary" onClick={() => move(1)}>
          Back to edit
        </button>
        <button className="button secondary" onClick={closeDraft}>
          Cancel review
        </button>
        <button
          className="button primary"
          disabled={!confirmed || !usable.length || !canEdit(section)}
          onClick={applyImportedRows}
        >
          Confirm &amp; apply {usable.length} rows
        </button>
      </div>
    </div>
  )
}

function BulkReviewTable({ draft, bulkReviewed, patch }: OnboardingViewModel) {
  const excluded = new Set(draft.excluded)
  return (
    <div className="table-wrap">
      <SortableTable
        className="data-table"
        defaultOpen
        tableLabel="Imported review rows"
      >
        <thead>
          <tr>
            <th>Include</th>
            <th>Row / status</th>
            <th>Record</th>
            <th>Interpreted values</th>
            <th>Review note</th>
          </tr>
        </thead>
        <tbody>
          {bulkReviewed.slice(0, 100).map((row) => (
            <tr key={row.index}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Include row ${row.index + 1}`}
                  checked={!excluded.has(row.index)}
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
              <td>{row.title}</td>
              <td>
                {row.details.map((detail) => (
                  <small className="block" key={detail}>
                    {detail}
                  </small>
                ))}
              </td>
              <td>
                {row.reasons.length
                  ? row.reasons.join(' ')
                  : 'Ready to import after confirmation.'}
              </td>
            </tr>
          ))}
        </tbody>
      </SortableTable>
    </div>
  )
}
