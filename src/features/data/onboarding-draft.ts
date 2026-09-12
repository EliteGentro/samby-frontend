import {
  bulkImportFields,
  type BulkColumnMapping,
  type ImportDataset,
} from './bulk-intake'
import {
  type Page,
  type QuestionKey,
  type Workspace,
} from '../../domain/workspace'
import {
  importFields,
  optionalNumber,
  type Interpretation,
  type ParsedFile,
} from './intake'
import { questionGuidance, type DataSection } from './onboarding-model'

export type OnboardingProps = {
  workspace: Workspace
  onChange: (workspace: Workspace) => void
  onClose: () => void
  initialSection?: DataSection
  onFirstDecision?: (question: QuestionKey) => void
  onViewResult?: (page: Page) => void
}

export type ConfirmedReview = {
  dataset: ImportDataset
  file: ParsedFile
  mapping: BulkColumnMapping
  interpretation: Interpretation
  sourceName: string
  acceptedRows: number[]
  pendingRows: number[]
  excludedRows: number[]
  confirmedAt: string
}

export type IntakeDraft = {
  profile: Workspace['profile']
  section: DataSection
  file: ParsedFile | null
  fileDataset: ImportDataset | null
  sourceName: string
  sourceType: 'csv' | 'manual' | 'xlsx'
  mapping: BulkColumnMapping | null
  interpretation: Interpretation
  excluded: number[]
  manual: string[][]
  tab: 'upload' | 'manual'
  step: number
  fields: Record<string, string>
}

export const manualHeaders = [
  'Date',
  'SKU',
  'Product',
  'Quantity',
  'Unit',
  'Amount',
  'Currency',
  'Location',
  'Reference',
  'Kind',
  'Historical unit cost',
]

export const blankRow = () => ['', '', '', '', '', '', '', '', '', 'sale', '']

export const sectionNames: Record<DataSection, string> = {
  sales: 'Sales',
  inventory: 'Inventory & costs',
  suppliers: 'Purchasing & suppliers',
  finance: 'Finance & collections',
  profile: 'Business profile',
}

export const textValue = (form: FormData, key: string) =>
  String(form.get(key) ?? '').trim()

export const maybeNumber = (form: FormData, key: string) =>
  optionalNumber(textValue(form, key))

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

export function initialDraft(
  workspace: Workspace,
  section?: DataSection,
): IntakeDraft {
  const firstSection =
    section && section !== 'profile'
      ? section
      : questionGuidance(workspace.profile.firstQuestion).blocks[0]
  const fallback: IntakeDraft = {
    profile: workspace.profile,
    section: firstSection,
    file: null,
    fileDataset: null,
    sourceName: '',
    sourceType: 'csv',
    mapping: null,
    interpretation: {
      dateFormat: 'iso',
      unit: '',
      currency: workspace.profile.currency,
      amountBasis: '',
      rowMeaning: 'transaction',
      duplicatesReviewed: false,
    },
    excluded: [],
    manual: [blankRow()],
    tab: firstSection === 'sales' ? 'upload' : 'manual',
    step:
      !workspace.profile.name.trim() ||
      !workspace.profile.currency.trim() ||
      section === 'profile'
        ? 0
        : 1,
    fields: {},
  }
  try {
    const raw = sessionStorage.getItem(`samby-intake-${workspace.id}`)
    if (!raw) return fallback
    const saved = JSON.parse(raw) as IntakeDraft
    const fileDataset = saved?.fileDataset ?? legacyFileDataset(saved)
    const strings = (value: unknown): value is string[] =>
      Array.isArray(value) && value.every((cell) => typeof cell === 'string')
    if (
      !saved ||
      typeof saved !== 'object' ||
      !Array.isArray(saved.manual) ||
      !saved.manual.length ||
      !saved.manual.every(
        (row) => strings(row) && row.length === manualHeaders.length,
      ) ||
      !saved.profile ||
      !['name', 'currency', 'timezone', 'businessType', 'firstQuestion'].every(
        (key) =>
          typeof saved.profile[key as keyof typeof saved.profile] === 'string',
      ) ||
      !saved.interpretation ||
      !['iso', 'dmy', 'mdy'].includes(saved.interpretation.dateFormat) ||
      !['transaction', 'daily', 'invoice-total'].includes(
        saved.interpretation.rowMeaning,
      ) ||
      !['unit', 'currency', 'amountBasis'].every(
        (key) =>
          typeof saved.interpretation[key as keyof Interpretation] === 'string',
      ) ||
      typeof saved.interpretation.duplicatesReviewed !== 'boolean' ||
      !['sales', 'inventory', 'finance', 'suppliers'].includes(saved.section) ||
      (fileDataset !== null &&
        !['sales', 'inventory', 'finance', 'suppliers'].includes(
          fileDataset,
        )) ||
      ![0, 1, 2, 3].includes(saved.step) ||
      !['upload', 'manual'].includes(saved.tab) ||
      !['csv', 'xlsx', 'manual'].includes(saved.sourceType) ||
      typeof saved.sourceName !== 'string' ||
      !saved.fields ||
      Array.isArray(saved.fields) ||
      typeof saved.fields !== 'object' ||
      !Object.values(saved.fields).every(
        (value) => typeof value === 'string',
      ) ||
      !Array.isArray(saved.excluded) ||
      !saved.excluded.every((index) => Number.isInteger(index) && index >= 0) ||
      (saved.file !== null &&
        (!saved.file ||
          !strings(saved.file.headers) ||
          !Array.isArray(saved.file.rows) ||
          !saved.file.rows.every(strings) ||
          typeof saved.file.fingerprint !== 'string')) ||
      (saved.mapping !== null &&
        (!saved.file ||
          !saved.mapping ||
          !(
            fileDataset && fileDataset !== 'sales'
              ? bulkImportFields[fileDataset]
              : importFields
          ).every(
            ({ key }) =>
              saved.mapping![key] === null ||
              (Number.isInteger(saved.mapping![key]) &&
                saved.mapping![key]! >= 0 &&
                saved.mapping![key]! < saved.file!.headers.length),
          )))
    )
      return fallback
    const fields = {
      ...saved.fields,
      [`$entryTab-${saved.section}`]: saved.tab,
    }
    if (saved.step === 0) fields.$profileEditing = 'true'
    for (const [key, value] of Object.entries(fields)) {
      if (key.startsWith('inventory--')) {
        const name = key.slice('inventory--'.length)
        fields[
          `inventory-${name.startsWith('pool') ? 'pool' : 'stock'}-${name}`
        ] = value
        delete fields[key]
      }
    }
    const selectedSection =
      section && section !== 'profile' ? section : saved.section
    const restoredTab = fields[`$entryTab-${selectedSection}`]
    const needsProfile =
      !workspace.profile.name.trim() || !workspace.profile.currency.trim()
    return {
      ...saved,
      fileDataset,
      fields,
      tab:
        restoredTab === 'manual' || restoredTab === 'upload'
          ? restoredTab
          : selectedSection === 'sales'
            ? 'upload'
            : 'manual',
      profile:
        fields.$profileEditing === 'true' ? saved.profile : workspace.profile,
      section: selectedSection,
      step:
        needsProfile || section === 'profile'
          ? 0
          : saved.step === 2 &&
              selectedSection === fileDataset &&
              saved.file &&
              saved.mapping
            ? 2
            : saved.step === 0 && !section
              ? 0
              : 1,
    }
  } catch {
    return fallback
  }
}

export function persistDraft(
  workspaceId: string,
  draft: IntakeDraft | null,
): boolean {
  try {
    if (draft)
      sessionStorage.setItem(
        `samby-intake-${workspaceId}`,
        JSON.stringify(draft),
      )
    else sessionStorage.removeItem(`samby-intake-${workspaceId}`)
    return true
  } catch {
    return false
  }
}

function legacyFileDataset(saved: IntakeDraft): ImportDataset | null {
  if (!saved?.file) return null
  const mapping = saved.mapping
  if (mapping && typeof mapping === 'object') {
    if ('stockQuantity' in mapping) return 'inventory'
    if ('purchaseReference' in mapping) return 'suppliers'
    if ('counterparty' in mapping) return 'finance'
  }
  return 'sales'
}
