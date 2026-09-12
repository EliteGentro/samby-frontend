import { BulkReviewStage } from './onboarding-bulk'
import { SelectField } from '../../components/ui/select-field'
import { Check } from 'lucide-react'
import { AdvancedDataEntry, type AdvancedDataKind } from './AdvancedDataEntry'
import { type OnboardingProps } from './onboarding-draft'
import { onboardingStages } from './onboarding-model'
import { ConfirmedSourceReview, SalesReviewStage } from './onboarding-sales'
import {
  InformationStage,
  PendingReview,
  ProfileStage,
  ResultStage,
} from './onboarding-stages'
import { useOnboardingController } from './use-onboarding'

export function Onboarding(props: OnboardingProps) {
  const view = useOnboardingController(props)
  const {
    advancedKind,
    workspace,
    onChange,
    setAdvancedKind,
    sourceReview,
    draft,
    pending,
    excelFile,
    excelSheets,
    loading,
    excelSheet,
    loadFile,
    importWarnings,
    draftStorageAvailable,
    visibleStep,
    error,
  } = view
  if (advancedKind)
    return (
      <AdvancedDataEntry
        workspace={workspace}
        onChange={onChange}
        kind={advancedKind}
        onClose={() => setAdvancedKind(null)}
      />
    )
  if (sourceReview) return <ConfirmedSourceReview {...view} />
  return (
    <div className="stack onboarding">
      {draft.step === 1 && !pending && draft.section !== 'sales' && (
        <div className="form-actions">
          {(draft.section === 'inventory'
            ? ['history', 'service', 'aging']
            : draft.section === 'finance' || draft.section === 'suppliers'
              ? ['terms']
              : []
          ).map((kind) => (
            <button
              className="button secondary"
              key={kind}
              onClick={() => setAdvancedKind(kind as AdvancedDataKind)}
            >
              {
                {
                  history: 'Inventory history',
                  service: 'Observed service',
                  aging: 'Receipt age layers',
                  terms: 'Payment terms',
                }[kind]
              }
            </button>
          ))}
        </div>
      )}
      {draft.step === 2 && excelFile && excelSheets.length > 1 && (
        <label className="field">
          Worksheet
          <SelectField
            disabled={loading}
            value={excelSheet}
            onChange={(event) => void loadFile(excelFile, event.target.value)}
          >
            {excelSheets.map((sheet) => (
              <option key={sheet.name} value={sheet.name}>
                {sheet.name} · {sheet.rowCount} rows
              </option>
            ))}
          </SelectField>
          <small>
            Changing sheets starts a fresh review; no unconfirmed rows are
            applied.
          </small>
        </label>
      )}
      {importWarnings.map((warning) => (
        <p className="notice warning" key={warning}>
          {warning}
        </p>
      ))}
      {!draftStorageAvailable && (
        <p className="notice warning" role="status">
          Browser storage is unavailable or full. Your open draft is still
          editable, but it may not resume after closing. Confirmed workspace
          records follow the workspace retention status.
        </p>
      )}
      <div className="stepper" aria-label="Onboarding progress">
        {onboardingStages.map(({ id, label }, index) => (
          <span
            key={id}
            className={
              visibleStep === index
                ? 'current'
                : visibleStep > index
                  ? 'complete'
                  : ''
            }
            aria-current={visibleStep === index ? 'step' : undefined}
          >
            <span>{visibleStep > index ? <Check size={14} /> : index + 1}</span>
            {label}
          </span>
        ))}
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <ProfileStage {...view} />
      <InformationStage {...view} />
      <PendingReview {...view} />
      <SalesReviewStage {...view} />
      <BulkReviewStage {...view} />
      <ResultStage {...view} />
    </div>
  )
}

export const DataEntry = Onboarding
export type { OnboardingProps } from './onboarding-draft'
export type { DataSection } from './onboarding-model'
