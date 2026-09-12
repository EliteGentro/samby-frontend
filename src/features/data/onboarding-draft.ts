import {
  type Page,
  type QuestionKey,
  type Workspace,
} from '../../domain/workspace'
import {
  importFields,
  optionalNumber,
  type ColumnMapping,
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
  file: ParsedFile
  mapping: ColumnMapping
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
  sourceName: string
  sourceType: 'csv' | 'manual' | 'xlsx'
  mapping: ColumnMapping | null
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
  const fallback: IntakeDraft = {
    profile: workspace.profile,
    section:
      section && section !== 'profile'
        ? section
        : questionGuidance(workspace.profile.firstQuestion).blocks[0],
    file: null,
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
    tab: 'upload',
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
          !importFields.every(
            ({ key }) =>
              saved.mapping![key] === null ||
              (Number.isInteger(saved.mapping![key]) &&
                saved.mapping![key]! >= 0 &&
                saved.mapping![key]! < saved.file!.headers.length),
          )))
    )
      return fallback
    const fields = { ...saved.fields }
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
    const needsProfile =
      !workspace.profile.name.trim() || !workspace.profile.currency.trim()
    return {
      ...saved,
      fields,
      profile:
        fields.$profileEditing === 'true' ? saved.profile : workspace.profile,
      section: selectedSection,
      step:
        needsProfile || section === 'profile'
          ? 0
          : saved.step === 2 &&
              selectedSection === 'sales' &&
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
