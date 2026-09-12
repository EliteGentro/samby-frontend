import { useWorkspaceAccess } from '../../components/workspace-access-context'
import { platformRequest } from '../../lib/workspace-api'
import { AdvancedDataEntry, type AdvancedDataKind } from './AdvancedDataEntry'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Plus,
  Upload,
  X,
} from 'lucide-react'
import {
  cutoff,
  catalogCapabilities,
  categories,
  money,
  questions,
  type Category,
  type Commitment,
  type FinancialRecord,
  type Product,
  type QuestionKey,
  type Workspace,
} from '../../domain/workspace'
import {
  applyReviewedSales,
  guessMapping,
  importFields,
  optionalNumber,
  parseCsv,
  reviewRows,
  stableId,
  type ColumnMapping,
  type Interpretation,
  type ParsedFile,
} from './intake'
import {
  applyBulkImport,
  bulkImportFields,
  guessBulkMapping,
  importDatasetNames,
  reviewBulkRows,
  templatePaths,
  type BulkColumnMapping,
  type BulkReviewedRow,
  type ImportDataset,
} from './bulk-intake'

export type DataSection =
  | 'sales'
  | 'inventory'
  | 'finance'
  | 'suppliers'
  | 'profile'
export type OnboardingProps = {
  workspace: Workspace
  onChange: (workspace: Workspace) => void
  onClose: () => void
  initialSection?: DataSection
  onFirstDecision?: (question: QuestionKey) => void
}
type ConfirmedReview = {
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
type IntakeDraft = {
  profile: Workspace['profile']
  section: DataSection
  file: ParsedFile | null
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
const manualHeaders = [
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
const blankRow = () => ['', '', '', '', '', '', '', '', '', 'sale', '']
const sectionNames: Record<DataSection, string> = {
  sales: 'Sales',
  inventory: 'Inventory & costs',
  suppliers: 'Purchasing & suppliers',
  finance: 'Finance & collections',
  profile: 'Business profile',
}
const textValue = (form: FormData, key: string) =>
  String(form.get(key) ?? '').trim()
const maybeNumber = (form: FormData, key: string) =>
  optionalNumber(textValue(form, key))
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

function initialDraft(
  workspace: Workspace,
  section?: DataSection,
): IntakeDraft {
  const fallback: IntakeDraft = {
    profile: workspace.profile,
    section: section === 'profile' ? 'sales' : (section ?? 'sales'),
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
    tab:
      section && section !== 'sales' && section !== 'profile'
        ? 'manual'
        : 'upload',
    step:
      section === 'profile'
        ? 0
        : section || workspace.onboarding.completed
          ? 1
          : workspace.onboarding.step,
    fields: {},
  }
  try {
    const raw = sessionStorage.getItem(`samby-intake-${workspace.id}`)
    if (!raw) return fallback
    const saved = JSON.parse(raw) as Partial<IntakeDraft>
    if (!Array.isArray(saved.manual) || !saved.interpretation || !saved.profile)
      return fallback
    return {
      ...fallback,
      ...saved,
      ...(section
        ? {
            section: section === 'profile' ? 'sales' : section,
            step:
              section === 'profile'
                ? 0
                : saved.section === section && saved.step === 2
                  ? 2
                  : 1,
          }
        : {}),
    }
  } catch {
    return fallback
  }
}

function persistDraft(workspaceId: string, draft: IntakeDraft | null): boolean {
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

export function Onboarding({
  workspace,
  onChange,
  onClose,
  initialSection,
  onFirstDecision,
}: OnboardingProps) {
  const { canEdit } = useWorkspaceAccess()
  const [draft, setDraft] = useState<IntakeDraft>(() =>
    initialDraft(workspace, initialSection),
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [advancedKind, setAdvancedKind] = useState<AdvancedDataKind | null>(
    null,
  )
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelSheets, setExcelSheets] = useState<
    { name: string; rowCount: number }[]
  >([])
  const [excelSheet, setExcelSheet] = useState('')
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [draftStorageAvailable, setDraftStorageAvailable] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState<{
    workspace: Workspace
    summary: string[]
  } | null>(null)
  const [lastSource, setLastSource] = useState('')
  const [sourceReview, setSourceReview] = useState<ConfirmedReview | null>(null)
  const [inventoryTab, setInventoryTab] = useState<'stock' | 'pool'>(() =>
    draft.fields.$inventoryTab === 'pool' ? 'pool' : 'stock',
  )
  const [financeTab, setFinanceTab] = useState<
    'record' | 'cash' | 'budget' | 'coverage' | 'commitment'
  >(
    () =>
      (draft.fields.$financeTab as
        | 'record'
        | 'cash'
        | 'budget'
        | 'coverage'
        | 'commitment') || 'record',
  )
  const [recordKind, setRecordKind] = useState<FinancialRecord['kind']>(
    () => (draft.fields.$recordKind as FinancialRecord['kind']) || 'receivable',
  )
  useEffect(() => {
    let mounted = true
    const stored = persistDraft(workspace.id, draft)
    queueMicrotask(() => {
      if (mounted) setDraftStorageAvailable(stored)
    })
    return () => {
      mounted = false
    }
  }, [draft, workspace.id])
  const patch = (next: Partial<IntakeDraft>) => {
    setDraft((current) => ({ ...current, ...next }))
    setError('')
    setConfirmed(false)
  }
  const move = (step: number) => {
    patch({ step })
    onChange({
      ...workspace,
      revision: workspace.revision + 1,
      onboarding: { ...workspace.onboarding, step },
    })
  }
  const salesReviewed = useMemo(
    () =>
      draft.section === 'sales' && draft.file && draft.mapping
        ? reviewRows(
            draft.file,
            draft.mapping as ColumnMapping,
            draft.interpretation,
            workspace,
            draft.excluded,
          )
        : [],
    [
      draft.section,
      draft.file,
      draft.mapping,
      draft.interpretation,
      draft.excluded,
      workspace,
    ],
  )
  const bulkReviewed = useMemo(
    () =>
      draft.section !== 'sales' &&
      draft.section !== 'profile' &&
      draft.file &&
      draft.mapping
        ? reviewBulkRows(
            draft.section,
            draft.file,
            draft.mapping,
            draft.interpretation,
            workspace,
            draft.excluded,
          )
        : [],
    [
      draft.section,
      draft.file,
      draft.mapping,
      draft.interpretation,
      draft.excluded,
      workspace,
    ],
  )
  const reviewed =
    draft.section === 'sales' ? salesReviewed : bulkReviewed
  const usable = reviewed.filter((row) => row.status === 'usable')
  const confirmedSources = workspace.sources.filter((source) => {
    if (!source.review || source.type === 'demo') return false
    const dataset = source.review.interpretation.dataset
    return draft.section === 'sales'
      ? !dataset || dataset === 'sales'
      : dataset === draft.section
  })
  const usableCapabilities = catalogCapabilities.filter((capability) =>
    capability.check(workspace),
  )
  const firstQuestion = questions.find(
    (question) => question.key === workspace.profile.firstQuestion,
  )
  const finish = (question?: QuestionKey) => {
    const supported = usableCapabilities.length > 0
    onChange({
      ...workspace,
      revision: workspace.revision + 1,
      onboarding: {
        ...workspace.onboarding,
        step: 3,
        completed: true,
        deferred: !supported,
        firstAnalysisAt: supported
          ? (workspace.onboarding.firstAnalysisAt ?? new Date().toISOString())
          : workspace.onboarding.firstAnalysisAt,
      },
    })
    const draftStored = persistDraft(
      workspace.id,
      draft.file ? { ...draft, step: 1 } : null,
    )
    if (!draftStored) setDraftStorageAvailable(false)
    if (question && onFirstDecision) onFirstDecision(question)
    else onClose()
  }
  const defer = () => {
    onChange({
      ...workspace,
      revision: workspace.revision + 1,
      onboarding: {
        ...workspace.onboarding,
        step: 3,
        completed: true,
        deferred: true,
      },
    })
    patch({ step: 3 })
  }
  const loadFile = async (file: File | undefined, sheetName?: string) => {
    if (!file) return
    setError('')
    setLoading(true)
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error('Choose a file smaller than 5 MB.')
      if (/\.csv$/i.test(file.name)) {
        const parsed = parseCsv(await file.text())
        setExcelFile(null)
        setExcelSheets([])
        setImportWarnings([])
        patch({
          file: parsed,
          mapping:
            draft.section === 'sales'
              ? guessMapping(parsed.headers)
              : guessBulkMapping(
                  draft.section as Exclude<ImportDataset, 'sales'>,
                  parsed.headers,
                ),
          sourceName: file.name,
          sourceType: 'csv',
          excluded: [],
          step: 2,
        })
      } else if (/\.xlsx?$/i.test(file.name)) {
        const form = new FormData()
        form.set('file', file)
        if (sheetName) form.set('sheet_name', sheetName)
        const preview = await platformRequest<{
          sheets: { name: string; rowCount: number }[]
          selectedSheet: string
          headers: string[]
          rows: string[][]
          fingerprint: string
          sourceName: string
          warnings: string[]
        }>('/imports/preview', { method: 'POST', body: form }, workspace.id)
        setExcelFile(file)
        setExcelSheets(preview.sheets)
        setExcelSheet(preview.selectedSheet)
        setImportWarnings(preview.warnings)
        patch({
          file: {
            headers: preview.headers,
            rows: preview.rows,
            fingerprint: stableId(
              `${preview.fingerprint}|${preview.selectedSheet}`,
            ),
          },
          mapping:
            draft.section === 'sales'
              ? guessMapping(preview.headers)
              : guessBulkMapping(
                  draft.section as Exclude<ImportDataset, 'sales'>,
                  preview.headers,
                ),
          sourceName: `${preview.sourceName} · ${preview.selectedSheet}`,
          sourceType: 'xlsx',
          excluded: [],
          step: 2,
        })
      } else throw new Error('Choose a CSV, XLS or XLSX file.')
      onChange({
        ...workspace,
        revision: workspace.revision + 1,
        onboarding: { ...workspace.onboarding, step: 2 },
      })
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'The file could not be read. No unreviewed rows were applied.',
      )
    } finally {
      setLoading(false)
    }
  }
  const reviewManual = () => {
    const rows = draft.manual.filter((row) =>
      row.slice(0, 9).some((cell) => cell.trim()),
    )
    if (!rows.length) {
      setError(
        'Enter at least one sale before reviewing. You can also continue later.',
      )
      return
    }
    const file = {
      headers: manualHeaders,
      rows,
      fingerprint: stableId(JSON.stringify([manualHeaders, ...rows])),
    }
    patch({
      file,
      mapping: Object.fromEntries(
        importFields.map(({ key }, index) => [key, index]),
      ) as ColumnMapping,
      sourceName: 'Manual sales entry',
      sourceType: 'manual',
      excluded: [],
      step: 2,
    })
    onChange({
      ...workspace,
      revision: workspace.revision + 1,
      onboarding: { ...workspace.onboarding, step: 2 },
    })
  }
  const applySales = () => {
    if (!draft.file || !confirmed || !canEdit('sales')) return
    try {
      const next = applyReviewedSales(
        workspace,
        draft.file,
        salesReviewed,
        draft.interpretation,
        draft.sourceName,
        draft.sourceType,
        draft.mapping as ColumnMapping,
      )
      onChange({
        ...next,
        onboarding: { ...next.onboarding, step: 3, deferred: false },
      })
      setLastSource(
        `${usable.length} sale records confirmed from ${draft.sourceName}`,
      )
      patch({
        step: 3,
        ...(salesReviewed.some((row) => row.status !== 'usable')
          ? {}
          : { file: null, mapping: null, manual: [blankRow()], excluded: [] }),
      })
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'The records could not be applied.',
      )
    }
  }
  const applyImportedRows = () => {
    if (
      !draft.file ||
      !draft.mapping ||
      !confirmed ||
      draft.section === 'sales' ||
      draft.section === 'profile' ||
      !canEdit(draft.section)
    )
      return
    try {
      const next = applyBulkImport(
        workspace,
        draft.section,
        draft.file,
        bulkReviewed,
        draft.interpretation,
        draft.sourceName,
        draft.sourceType === 'manual' ? 'csv' : draft.sourceType,
        draft.mapping,
      )
      onChange({
        ...next,
        onboarding: { ...next.onboarding, step: 3, deferred: false },
      })
      setLastSource(
        `${usable.length} ${importDatasetNames[draft.section]} records confirmed from ${draft.sourceName}`,
      )
      patch({
        step: 3,
        ...(bulkReviewed.some((row) => row.status !== 'usable')
          ? {}
          : { file: null, mapping: null, excluded: [] }),
      })
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'The records could not be applied.',
      )
    }
  }
  const openSourceReview = (sourceId: string) => {
    const source = workspace.sources.find((item) => item.id === sourceId)
    if (!source?.review) {
      setError(
        'The original source review is unavailable. Confirmed records remain unchanged.',
      )
      return
    }
    const review = source.review,
      meaning = review.interpretation,
      dataset: ImportDataset = ['inventory', 'suppliers', 'finance'].includes(
        String(meaning.dataset),
      )
        ? (meaning.dataset as ImportDataset)
        : 'sales'
    const interpretation: Interpretation = {
      dateFormat:
        meaning.dateFormat === 'dmy'
          ? 'dmy'
          : meaning.dateFormat === 'mdy'
            ? 'mdy'
            : 'iso',
      unit: typeof meaning.unit === 'string' ? meaning.unit : '',
      currency:
        typeof meaning.currency === 'string'
          ? meaning.currency
          : workspace.profile.currency,
      amountBasis:
        typeof meaning.amountBasis === 'string' ? meaning.amountBasis : '',
      rowMeaning:
        meaning.rowMeaning === 'invoice-total'
          ? 'invoice-total'
          : meaning.rowMeaning === 'daily'
            ? 'daily'
            : 'transaction',
      duplicatesReviewed: meaning.duplicatesReviewed === true,
    }
    const fields =
      dataset === 'sales' ? importFields : bulkImportFields[dataset]
    const mapping = Object.fromEntries(
      fields.map(({ key }) => [key, review.columnMapping[key] ?? null]),
    ) as BulkColumnMapping
    setSourceReview({
      dataset,
      file: {
        headers: review.headers,
        rows: review.rows,
        fingerprint: source.id,
      },
      mapping,
      interpretation,
      sourceName: source.name,
      acceptedRows: review.acceptedRowIndexes,
      excludedRows: review.excludedRowIndexes,
      pendingRows: review.rows
        .map((_, index) => index)
        .filter(
          (index) =>
            !review.acceptedRowIndexes.includes(index) &&
            !review.excludedRowIndexes.includes(index),
        ),
      confirmedAt: source.importedAt,
    })
  }
  const profileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEdit('settings')) return
    if (!draft.profile.name.trim()) {
      setError('Enter your business name to continue.')
      return
    }
    if (
      draft.profile.currency !== workspace.profile.currency &&
      (workspace.sales.some((sale) => sale.amount !== null) ||
        workspace.finance.length > 0 ||
        workspace.products.some(
          (product) => product.cost !== null || product.price !== null,
        ) ||
        workspace.cash ||
        workspace.budget ||
        workspace.purchases.some((purchase) => purchase.amount !== null))
    ) {
      setError(
        'Existing monetary records use the current working currency. Currency conversion is unsupported, so keep that currency for this workspace.',
      )
      return
    }
    onChange({
      ...workspace,
      revision: workspace.revision + 1,
      profile: { ...draft.profile, name: draft.profile.name.trim() },
      onboarding: { ...workspace.onboarding, step: 1 },
    })
    patch({
      step: 1,
      interpretation: {
        ...draft.interpretation,
        currency: draft.profile.currency,
      },
    })
  }
  const fieldKey = (name: string) =>
    `${draft.section}-${draft.section === 'finance' ? financeTab : ''}-${name}`
  const captureFields = (event: FormEvent<HTMLFormElement>) => {
    const form = new FormData(event.currentTarget)
    const names = [
      ...event.currentTarget.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >('[name]'),
    ].map((field) => field.name)
    setDraft((current) => {
      const fields = { ...current.fields }
      for (const name of names) delete fields[fieldKey(name)]
      return {
        ...current,
        fields: {
          ...fields,
          ...Object.fromEntries(
            [...form.entries()].map(([key, value]) => [
              fieldKey(key),
              String(value),
            ]),
          ),
        },
      }
    })
  }
  const fieldProps = (name: string, fallback = '') => ({
    name,
    defaultValue: draft.fields[fieldKey(name)] ?? fallback,
  })
  const prepare = (next: Workspace, summary: string[]) => {
    setPending({ workspace: next, summary })
    setError('')
    setConfirmed(false)
  }
  const savePending = () => {
    if (
      !pending ||
      !confirmed ||
      !canEdit(draft.section === 'profile' ? 'settings' : draft.section)
    )
      return
    const source = {
      id: newId('src'),
      name: sectionNames[draft.section],
      type: 'manual' as const,
      importedAt: new Date().toISOString(),
      rowCount: 1,
      excludedCount: 0,
    }
    onChange({
      ...pending.workspace,
      revision: workspace.revision + 1,
      stock: pending.workspace.stock.map((record) =>
        workspace.stock.some((old) => old.id === record.id)
          ? record
          : { ...record, sourceId: source.id },
      ),
      purchases: pending.workspace.purchases.map((record) =>
        workspace.purchases.some((old) => old.id === record.id)
          ? record
          : { ...record, sourceId: source.id },
      ),
      finance: pending.workspace.finance.map((record) =>
        workspace.finance.some((old) => old.id === record.id)
          ? record
          : { ...record, sourceId: source.id },
      ),
      commitments: pending.workspace.commitments.map((record) =>
        workspace.commitments.some((old) => old.id === record.id)
          ? record
          : { ...record, sourceId: source.id },
      ),
      sources: [...pending.workspace.sources, source],
      onboarding: { ...workspace.onboarding, step: 3, deferred: false },
    })
    setLastSource(pending.summary[0])
    setPending(null)
    patch({ step: 3, fields: {} })
  }
  const poolSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget),
      name = textValue(form, 'poolName')
    const locationIds = workspace.locations
      .filter((location) => form.get(`poolLocation-${location.id}`) === 'on')
      .map((location) => location.id)
    const channelNames = [
      ...new Set(
        textValue(form, 'poolChannels')
          .split(',')
          .map((channel) => channel.trim())
          .filter(Boolean),
      ),
    ]
    if (!name || locationIds.length === 0) {
      setError(
        'Name the pool and select at least one known contributing location. Unknown physical distribution cannot establish a shared pool.',
      )
      return
    }
    if ((workspace.inventoryPools ?? []).some((pool) => pool.name === name)) {
      setError(
        'A pool with this exact name already exists. Choose a distinct relationship name.',
      )
      return
    }
    const pool = { id: newId('pool'), name, locationIds, channelNames }
    prepare(
      {
        ...workspace,
        inventoryPools: [...(workspace.inventoryPools ?? []), pool],
      },
      [
        `Shared inventory pool · ${name}`,
        `Known contributing locations · ${workspace.locations
          .filter((location) => locationIds.includes(location.id))
          .map((location) => location.name)
          .join(', ')}`,
        `Sales channels using this pool · ${channelNames.length ? channelNames.join(', ') : 'Not supplied'}`,
        'This records a shared-stock relationship. No stock is copied, transferred or assigned to an invented location. Aggregate stock outside these known locations remains separate.',
      ],
    )
  }
  const inventorySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget),
      sku = textValue(form, 'sku'),
      name = textValue(form, 'productName'),
      unit = textValue(form, 'stockUnit'),
      quantity = maybeNumber(form, 'stockQuantity'),
      reservations = maybeNumber(form, 'reserved'),
      backordered = maybeNumber(form, 'backordered'),
      basis = textValue(form, 'quantityBasis')
    const cost = maybeNumber(form, 'cost'),
      price = maybeNumber(form, 'price'),
      reorderPoint = maybeNumber(form, 'reorderPoint'),
      safetyStock = maybeNumber(form, 'safetyStock'),
      serviceTarget = maybeNumber(form, 'serviceTarget'),
      serviceTargetBasis = textValue(
        form,
        'serviceTargetBasis',
      ) as Product['serviceTargetBasis'],
      targetStock = maybeNumber(form, 'targetStock')
    if (
      (!sku && !name) ||
      !unit ||
      quantity === null ||
      !Number.isFinite(quantity)
    ) {
      setError(
        'Provide a product reference or name, unit and recorded stock quantity. Zero is valid.',
      )
      return
    }
    if (
      [cost, price].some(
        (value) => value !== null && (!Number.isFinite(value) || value < 0),
      )
    ) {
      setError(
        'Costs and prices must be nonnegative numbers, or blank when unknown.',
      )
      return
    }
    if (
      [reorderPoint, safetyStock, serviceTarget, targetStock].some(
        (value) => value !== null && (!Number.isFinite(value) || value < 0),
      ) ||
      (serviceTarget !== null && serviceTarget > 100)
    ) {
      setError(
        'Reorder point and safety stock must be nonnegative quantities. Service target must be from 0 to 100. Blank means unknown.',
      )
      return
    }
    if (
      reservations !== null &&
      (!Number.isFinite(reservations) || reservations < 0)
    ) {
      setError('Reservations must be zero or a positive recorded quantity.')
      return
    }
    if (
      backordered !== null &&
      (!Number.isFinite(backordered) || backordered < 0)
    ) {
      setError(
        'Backordered demand must be a nonnegative recorded quantity, or blank when unknown.',
      )
      return
    }
    const existing = workspace.products.find(
      (product) => sku && product.sku === sku,
    )
    if (existing && existing.unit !== unit) {
      setError(
        `This product uses ${existing.unit}. A unit conversion needs a confirmed basis before it can be combined.`,
      )
      return
    }
    const product: Product = existing
      ? {
          ...existing,
          cost: cost ?? existing.cost,
          price: price ?? existing.price,
          reorderPoint: reorderPoint ?? existing.reorderPoint,
          safetyStock: safetyStock ?? existing.safetyStock,
          serviceTarget: serviceTarget ?? existing.serviceTarget,
          serviceTargetBasis:
            serviceTarget !== null
              ? serviceTargetBasis || undefined
              : existing.serviceTargetBasis,
          targetStock: targetStock ?? existing.targetStock,
          brand: textValue(form, 'brand') || existing.brand,
        }
      : {
          id: newId('p'),
          sku: sku || `INT-${stableId(name).toUpperCase()}`,
          name: name || sku,
          category: textValue(form, 'category'),
          brand: textValue(form, 'brand'),
          targetStock,
          unit,
          cost,
          price,
          supplierId: null,
          leadTimeDays: null,
          moq: null,
          casePack: null,
          reorderPoint,
          safetyStock,
          serviceTarget,
          serviceTargetBasis: serviceTargetBasis || undefined,
        }
    const locationName = textValue(form, 'stockLocation'),
      asOf = textValue(form, 'stockDate')
    let location = workspace.locations.find(
      (item) => item.name === locationName,
    )
    const locations = [...workspace.locations]
    if (locationName && !location) {
      location = { id: newId('loc'), name: locationName }
      locations.push(location)
    }
    const mixedScopes = workspace.stock.some(
      (stock) =>
        stock.productId === product.id &&
        Boolean(stock.locationId) !== Boolean(location),
    )
    if (mixedScopes) {
      setError(
        'This product already has stock at another level of detail. Reconcile the aggregate and location records first so stock is not counted twice.',
      )
      return
    }
    const stock = {
      id: newId('stock'),
      productId: product.id,
      locationId: location?.id ?? null,
      onHand: quantity,
      backordered,
      reserved: basis === 'available' ? null : reservations,
      quantityBasis:
        basis === 'available' ? ('available' as const) : ('on-hand' as const),
      asOf,
    }
    const next = {
      ...workspace,
      products: [
        ...workspace.products.filter((item) => item.id !== product.id),
        product,
      ],
      locations,
      stock: [
        ...workspace.stock.filter(
          (item) =>
            !(
              item.productId === product.id &&
              item.locationId === stock.locationId
            ),
        ),
        stock,
      ],
    }
    prepare(next, [
      `${product.name} · ${quantity} ${unit} ${basis === 'available' ? 'already available' : 'on hand'}`,
      `Reference · ${product.sku} · unit ${unit} · category ${product.category || 'Unknown'}`,
      `Scope · ${locationName || 'Aggregate business stock'} · as of ${asOf}`,
      basis === 'available'
        ? 'Reservations are already deducted. They will not be deducted again.'
        : reservations === null
          ? 'Reservations are unknown. Available stock cannot be calculated.'
          : `${reservations} ${unit} reserved`,
      `Target inventory · ${product.targetStock ?? 'Unknown'} ${unit} across supplied locations · brand ${product.brand || 'Unknown'}`,
      `Recorded product policy · reorder point ${product.reorderPoint ?? 'Unknown'} ${unit} · safety stock ${product.safetyStock ?? 'Unknown'} ${unit} · service target ${product.serviceTarget === null ? 'Unknown' : `${product.serviceTarget}%`}. Applies to this product across supplied locations; this snapshot does not create a location-specific policy. Service target basis: ${product.serviceTargetBasis ?? 'Unknown; no attainment comparison'}.`,
      `Backordered demand · ${backordered === null ? 'Unknown' : `${backordered} ${unit}`}. This record does not select a simulation backlog policy.`,
      `Unit cost · ${money(product.cost, workspace.profile.currency)} · selling price · ${money(product.price, workspace.profile.currency)}. Existing stock in the same product and location is replaced by this snapshot.`,
    ])
  }
  const financeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (financeTab === 'commitment') {
      const amount = maybeNumber(form, 'commitmentAmount')
      if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
        setError('Expected amount must be nonnegative, or blank when unknown.')
        return
      }
      const linkedPayableId = textValue(form, 'linkedPayableId') || null
      const commitment: Commitment = {
        id: newId('commitment'),
        name: textValue(form, 'commitmentName'),
        supplierId: textValue(form, 'commitmentSupplier') || null,
        amount,
        currency: workspace.profile.currency,
        cadence: textValue(form, 'commitmentCadence') as Commitment['cadence'],
        nextDate: textValue(form, 'commitmentDate') || null,
        fulfillment: textValue(
          form,
          'fulfillment',
        ) as Commitment['fulfillment'],
        payment: textValue(form, 'commitmentPayment') as Commitment['payment'],
        linkedPayableId,
      }
      const payable = linkedPayableId
        ? workspace.finance.find(
            (record) =>
              record.id === linkedPayableId && record.kind === 'payable',
          )
        : null
      if (linkedPayableId && !payable) {
        setError(
          'Select an existing confirmed supplier payable, or leave the link empty.',
        )
        return
      }
      prepare(
        { ...workspace, commitments: [...workspace.commitments, commitment] },
        [
          `Recurring commitment · ${commitment.name}`,
          `Supplier · ${workspace.suppliers.find((supplier) => supplier.id === commitment.supplierId)?.name ?? 'Unknown / add later'} · ${commitment.cadence}`,
          `Expected amount · ${money(amount, workspace.profile.currency)} · next expected date · ${commitment.nextDate ?? 'Unknown'}`,
          `Fulfillment · ${commitment.fulfillment.replace('_', ' ')} · payment · ${commitment.payment}`,
          payable
            ? `Confirmed payable · ${payable.name}. The expectation and this payable are not counted twice.`
            : 'This is an expected commitment, not a confirmed supplier payable. It does not increase External Debt.',
        ],
      )
      return
    }
    if (financeTab === 'coverage') {
      const startDate = textValue(form, 'coverageStart'),
        endDate = textValue(form, 'coverageEnd')
      if (endDate < startDate) {
        setError('Coverage end date must be on or after its start date.')
        return
      }
      const coverage = { ...workspace.coverage }
      for (const category of categories)
        coverage[category] = {
          state: textValue(
            form,
            `coverage-${category}`,
          ) as Workspace['coverage'][Category]['state'],
          startDate,
          endDate,
        }
      prepare({ ...workspace, coverage }, [
        `Category review · ${startDate} through ${endDate}`,
        ...categories.map(
          (category) => `${category} · ${coverage[category].state}`,
        ),
      ])
      return
    }
    const amount = maybeNumber(form, 'financeAmount')
    if (
      amount === null ||
      !Number.isFinite(amount) ||
      (financeTab !== 'cash' && amount < 0)
    ) {
      setError(
        financeTab === 'cash'
          ? 'Enter the recorded cash balance, including a negative balance when applicable.'
          : 'Enter a nonnegative amount. Leave this block for later if the amount is unknown.',
      )
      return
    }
    if (financeTab === 'cash') {
      const reserve = maybeNumber(form, 'reserve')
      if (reserve !== null && (!Number.isFinite(reserve) || reserve < 0)) {
        setError('Reserve must be nonnegative or blank.')
        return
      }
      const cash = {
        amount,
        date: textValue(form, 'cashDate'),
        phase: textValue(form, 'cashPhase') as 'opening' | 'end-of-day',
        reserve,
      }
      prepare({ ...workspace, cash }, [
        `Available cash · ${money(amount, workspace.profile.currency)}`,
        `${cash.date} · ${cash.phase === 'opening' ? 'Opening balance before that day’s events' : 'End-of-day balance after that day’s events'}`,
        `Reserve · ${money(reserve, workspace.profile.currency)}`,
      ])
    } else if (financeTab === 'budget') {
      const startDate = textValue(form, 'budgetStart'),
        endDate = textValue(form, 'budgetEnd')
      if (endDate < startDate) {
        setError('Budget end date must be on or after its start date.')
        return
      }
      prepare({ ...workspace, budget: { amount, startDate, endDate } }, [
        `Purchasing budget · ${money(amount, workspace.profile.currency)}`,
        `${startDate} through ${endDate} · order commitment basis`,
        'This budget is a spending limit. It does not establish available cash.',
      ])
    } else {
      const paidAmount = maybeNumber(form, 'paidAmount')
      if (
        paidAmount === null ||
        !Number.isFinite(paidAmount) ||
        paidAmount < 0 ||
        paidAmount > amount
      ) {
        setError(
          'Confirm paid amount, including zero. It must not exceed the original amount.',
        )
        return
      }
      const category: Category = ['receivable', 'provider_pending'].includes(
        recordKind,
      )
        ? 'collections'
        : recordKind === 'payable'
          ? 'suppliers'
          : recordKind === 'financing'
            ? 'financing'
            : (textValue(form, 'recordCategory') as Category)
      const record: FinancialRecord = {
        id: newId('fin'),
        kind: recordKind,
        name: textValue(form, 'recordName'),
        counterparty: textValue(form, 'counterparty'),
        amount,
        paidAmount,
        currency: workspace.profile.currency,
        dueDate: textValue(form, 'dueDate') || null,
        expectedDate: textValue(form, 'expectedDate') || null,
        category,
        linkedRecordId:
          (recordKind === 'payable'
            ? textValue(form, 'linkedPurchaseId')
            : recordKind === 'provider_pending'
              ? textValue(form, 'linkedRecordId')
              : '') || null,
        cashIncluded: form.get('cashIncluded') === 'on',
      }
      if (recordKind === 'payable' && record.linkedRecordId) {
        const purchase = workspace.purchases.find(
          (item) => item.id === record.linkedRecordId,
        )
        if (!purchase) {
          setError(
            'Select an existing purchase to link, or leave the purchase link empty.',
          )
          return
        }
        const allocated = workspace.finance
          .filter(
            (item) =>
              item.kind === 'payable' && item.linkedRecordId === purchase.id,
          )
          .reduce((total, item) => total + item.amount, 0)
        if (purchase.amount !== null && allocated + amount > purchase.amount) {
          setError(
            'The linked supplier payable amounts would exceed the purchase amount. Reconcile duplicate or partial invoices before confirming.',
          )
          return
        }
      }
      if (recordKind === 'provider_pending' && record.linkedRecordId) {
        const invoice = workspace.finance.find(
          (item) => item.id === record.linkedRecordId,
        )
        if (invoice && amount > invoice.paidAmount) {
          setError(
            'Provider-pending funds must be part of the linked invoice’s recorded collected amount. Review the invoice payment first to prevent double counting.',
          )
          return
        }
      }
      prepare({ ...workspace, finance: [...workspace.finance, record] }, [
        `${record.name} · ${record.kind.replace('_', ' ')}`,
        `${money(amount, record.currency)} original · ${money(paidAmount, record.currency)} paid · ${money(amount - paidAmount, record.currency)} remaining`,
        `Due · ${record.dueDate || 'Unknown'} · expected availability/payment · ${record.expectedDate || 'Unscheduled'}`,
        record.linkedRecordId
          ? `Linked record · ${workspace.finance.find((item) => item.id === record.linkedRecordId)?.name ?? (workspace.purchases.some((item) => item.id === record.linkedRecordId) ? `Purchase ${record.linkedRecordId}` : record.linkedRecordId)}`
          : 'No linked record. Unknown dates remain unscheduled.',
      ])
    }
  }
  const suppliersSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget),
      supplierName = textValue(form, 'supplierName'),
      productId = textValue(form, 'supplierProduct')
    const leadTime = maybeNumber(form, 'leadTime'),
      cost = maybeNumber(form, 'supplierCost'),
      moq = maybeNumber(form, 'moq'),
      pack = maybeNumber(form, 'casePack')
    if (
      [leadTime, cost, moq, pack].some(
        (value) => value !== null && (!Number.isFinite(value) || value < 0),
      )
    ) {
      setError(
        'Quoted terms must be nonnegative numbers, or blank when unknown.',
      )
      return
    }
    if (leadTime !== null && !Number.isInteger(leadTime)) {
      setError('Lead time uses whole calendar days.')
      return
    }
    if ((moq !== null && moq <= 0) || (pack !== null && pack <= 0)) {
      setError(
        'Minimum order and case-pack quantities must be positive when provided.',
      )
      return
    }
    const supplier = workspace.suppliers.find(
      (item) => item.name === supplierName,
    ) ?? { id: newId('sup'), name: supplierName, active: true }
    const products = workspace.products.map((product) =>
      product.id === productId
        ? {
            ...product,
            supplierId: supplier.id,
            leadTimeDays: leadTime,
            cost: cost ?? product.cost,
            moq,
            casePack: pack,
          }
        : product,
    )
    const purchases = [...workspace.purchases]
    const quantity = maybeNumber(form, 'purchaseQuantity')
    if (quantity !== null) {
      const purchaseAmount = maybeNumber(form, 'purchaseAmount'),
        paidAmount = maybeNumber(form, 'purchasePaidAmount')
      if (
        !productId ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !textValue(form, 'orderDate')
      ) {
        setError(
          'An open purchase needs a product, positive quantity and order date.',
        )
        return
      }
      if (
        purchaseAmount !== null &&
        (!Number.isFinite(purchaseAmount) || purchaseAmount < 0)
      ) {
        setError('Purchase amount must be nonnegative or blank.')
        return
      }
      if (
        paidAmount === null ||
        !Number.isFinite(paidAmount) ||
        paidAmount < 0 ||
        (purchaseAmount !== null && paidAmount > purchaseAmount)
      ) {
        setError(
          'Confirm the purchase amount already paid, including zero if unpaid. It must not exceed the purchase amount.',
        )
        return
      }
      const receiptStatus = textValue(form, 'receiptStatus'),
        receivedQuantity = maybeNumber(form, 'receivedQuantity'),
        receivedDate = textValue(form, 'receivedDate')
      if (!['not-received', 'received'].includes(receiptStatus)) {
        setError(
          'Confirm whether this purchase has been received; unknown receipt status is not zero received.',
        )
        return
      }
      if (
        receiptStatus === 'received' &&
        (receivedQuantity === null ||
          !Number.isFinite(receivedQuantity) ||
          receivedQuantity <= 0 ||
          receivedQuantity > quantity ||
          !receivedDate ||
          receivedDate < textValue(form, 'orderDate') ||
          receivedDate > cutoff(workspace))
      ) {
        setError(
          'A recorded receipt needs a positive quantity no greater than ordered and its actual date on or after the order date, within observed history.',
        )
        return
      }
      const purchaseId = `po-${stableId(JSON.stringify([workspace.id, ...form.entries()]))}`
      if (purchases.some((p) => p.id === purchaseId)) {
        setError(
          'This exact purchase has already been confirmed. Review its existing source before correcting or replacing it.',
        )
        return
      }
      purchases.push({
        id: purchaseId,
        productId,
        supplierId: supplier.id,
        quantity,
        amount: purchaseAmount,
        orderDate: textValue(form, 'orderDate'),
        promisedDate: textValue(form, 'promisedDate') || null,
        receivedDate: receiptStatus === 'received' ? receivedDate : null,
        receivedQuantity: receiptStatus === 'received' ? receivedQuantity! : 0,
        plannedPaymentDate: textValue(form, 'paymentDate') || null,
        locationId: textValue(form, 'receiptLocation') || null,
        paidAmount,
      })
    }
    prepare(
      {
        ...workspace,
        suppliers: [
          ...workspace.suppliers.filter((item) => item.id !== supplier.id),
          supplier,
        ],
        products,
        purchases,
      },
      [
        `Supplier · ${supplier.name}`,
        productId
          ? `Product terms · ${products.find((product) => product.id === productId)?.name}`
          : 'No product terms attached yet.',
        `Quoted lead time · ${leadTime === null ? 'Unknown' : `${leadTime} calendar days from order placement`}`,
        `Unit cost · ${money(productId ? (products.find((product) => product.id === productId)?.cost ?? null) : null, workspace.profile.currency)} · minimum order · ${moq ?? 'Unknown'} · case pack · ${pack ?? 'Unknown'}`,
        quantity === null
          ? 'No purchase is created.'
          : `Open purchase · ${quantity} units · ${money(maybeNumber(form, 'purchaseAmount'), workspace.profile.currency)} · ${money(maybeNumber(form, 'purchasePaidAmount'), workspace.profile.currency)} already paid`,
        quantity === null
          ? 'No purchase receipt is recorded.'
          : `Recorded receipt status · ${textValue(form, 'receiptStatus')} · ${maybeNumber(form, 'receivedQuantity') ?? 0} units on ${textValue(form, 'receivedDate') || 'no receipt date'}. This purchase observation does not change the separately recorded stock snapshot.`,
        quantity === null
          ? 'No stock receipt is created.'
          : `Receipt location · ${workspace.locations.find((location) => location.id === textValue(form, 'receiptLocation'))?.name ?? 'Unallocated'} · order · ${textValue(form, 'orderDate')} · promised receipt · ${textValue(form, 'promisedDate') || 'Unknown'} · expected payment · ${textValue(form, 'paymentDate') || 'Unscheduled'}`,
      ],
    )
  }

  if (advancedKind)
    return (
      <AdvancedDataEntry
        workspace={workspace}
        onChange={onChange}
        kind={advancedKind}
        onClose={() => setAdvancedKind(null)}
      />
    )
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
          {sourceReview.dataset === 'sales' ? (
            <p>
              Row meaning · {sourceReview.interpretation.rowMeaning} · date
              format · {sourceReview.interpretation.dateFormat}
            </p>
          ) : (
            <p>
              Dataset · {importDatasetNames[sourceReview.dataset]} · date
              format · {sourceReview.interpretation.dateFormat}
            </p>
          )}
          <p>
            Number format · decimal point · currency ·{' '}
            {sourceReview.interpretation.currency}
          </p>
          {sourceReview.dataset === 'sales' && (
            <p>
              Amount meaning ·{' '}
              {sourceReview.interpretation.amountBasis || 'Amounts not provided'}
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
                  <th key={index}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sourceReview.file.rows.slice(0, 100).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td>
                    {rowIndex + 1} ·{' '}
                    {sourceReview.acceptedRows.includes(rowIndex)
                      ? 'accepted'
                      : sourceReview.pendingRows.includes(rowIndex)
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
  return (
    <div className="stack onboarding">
      {draft.step === 1 && (
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
        {['Your business', 'Add information', 'Review', 'Your next step'].map(
          (label, index) => (
            <span
              key={label}
              className={
                draft.step === index
                  ? 'current'
                  : draft.step > index
                    ? 'complete'
                    : ''
              }
              aria-current={draft.step === index ? 'step' : undefined}
            >
              <span>
                {draft.step > index ? <Check size={14} /> : index + 1}
              </span>
              {label}
            </span>
          ),
        )}
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {draft.step === 0 && (
        <form className="stack" onSubmit={profileSubmit}>
          <div>
            <h2>Start with the data you already have.</h2>
            <p className="muted">
              Understand your sales, then connect them with inventory,
              purchasing and available cash.
            </p>
          </div>
          <div className="form-grid">
            <label className="field">
              Business name
              <input
                required
                autoFocus
                value={draft.profile.name}
                onChange={(event) =>
                  patch({
                    profile: { ...draft.profile, name: event.target.value },
                  })
                }
                autoComplete="organization"
              />
            </label>
            <label className="field">
              Working currency
              <SelectField
                value={draft.profile.currency}
                onChange={(event) =>
                  patch({
                    profile: { ...draft.profile, currency: event.target.value },
                  })
                }
              >
                <option value="MXN">MXN · Mexican peso</option>
                <option value="USD">USD · US dollar</option>
              </SelectField>
              <small>
                Records use one compatible currency. No conversion is assumed.
              </small>
            </label>
            <label className="field">
              Business type <span className="muted">Optional</span>
              <input
                value={draft.profile.businessType}
                onChange={(event) =>
                  patch({
                    profile: {
                      ...draft.profile,
                      businessType: event.target.value,
                    },
                  })
                }
                placeholder="Distributor, retailer, e-commerce…"
              />
            </label>
            <label className="field">
              What would you like to understand first?
              <SelectField
                value={draft.profile.firstQuestion}
                onChange={(event) =>
                  patch({
                    profile: {
                      ...draft.profile,
                      firstQuestion: event.target.value,
                    },
                  })
                }
              >
                <option value="sales">Understand my sales</option>
                {questions.slice(0, 3).map((question) => (
                  <option key={question.key} value={question.key}>
                    {question.label}
                  </option>
                ))}
              </SelectField>
              <small>
                This guides your next step. You can change it later.
              </small>
            </label>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Save for later
            </button>
            <button className="button primary" type="submit">
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}
      {draft.step === 1 && !pending && (
        <>
          <div>
            <h2>Add the information you have.</h2>
            <p className="muted">
              Sales are a useful starting point. You can also begin with stock,
              a receivable or a supplier purchase.
            </p>
          </div>
          <div
            className="form-actions"
            role="group"
            aria-label="Information type"
          >
            {(['sales', 'inventory', 'suppliers', 'finance'] as const).map(
              (section) => (
                <button
                  key={section}
                  className={`button ${draft.section === section ? 'primary' : 'secondary'}`}
                  aria-pressed={draft.section === section}
                  onClick={() =>
                    patch({
                      section,
                      file: null,
                      mapping: null,
                      sourceName: '',
                      excluded: [],
                    })
                  }
                >
                  {sectionNames[section]}
                </button>
              ),
            )}
          </div>
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
              {draft.file && (
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
                <a
                  className="button secondary"
                  href={templatePaths.sales}
                  download
                >
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
                    confirming. For CSV, export the relevant sheet as CSV UTF-8.
                    Up to 10,000 rows and 5 MB.
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
                  <p className="muted">
                    Dates, products, quantities and sale amounts can be mapped
                    in the next step. A complete product catalog is optional.
                  </p>
                  {loading && <p role="status">Reading your file…</p>}
                </div>
              ) : (
                <>
                  <p className="muted">
                    Enter recorded sales. Use YYYY-MM-DD dates and decimal
                    points. Blank values stay unknown. A dated amount can be
                    reviewed without product quantities.
                  </p>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          {manualHeaders
                            .filter((_, index) => index !== 8)
                            .map((header) => (
                              <th key={header}>{header}</th>
                            ))}
                          <th>Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.manual.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, columnIndex) =>
                              columnIndex === 8 ? null : (
                                <td key={columnIndex}>
                                  {columnIndex === 9 ? (
                                    <SelectField
                                      aria-label={`Type row ${rowIndex + 1}`}
                                      value={cell}
                                      onChange={(event) =>
                                        patch({
                                          manual: draft.manual.map(
                                            (item, index) =>
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
                                      type={columnIndex === 0 ? 'date' : 'text'}
                                      value={cell}
                                      onChange={(event) =>
                                        patch({
                                          manual: draft.manual.map(
                                            (item, index) =>
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
                              ),
                            )}
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
                      onClick={() =>
                        patch({ manual: [...draft.manual, blankRow()] })
                      }
                    >
                      <Plus size={16} /> Add row
                    </button>
                    <button className="button primary" onClick={reviewManual}>
                      Review these sales <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              )}
              <div className="notice">
                A future customer order is a scenario event. Save your business
                context, then use “Evaluate a new order” in Forecast &amp;
                Simulate.
              </div>
            </div>
          )}
          {draft.section !== 'sales' && draft.section !== 'profile' && (
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
              {draft.file && (
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
                  <Upload size={16} /> Import {importDatasetNames[draft.section]}
                </button>
                <button
                  className={`button ${draft.tab === 'manual' ? 'primary' : 'secondary'}`}
                  onClick={() => patch({ tab: 'manual' })}
                >
                  <Plus size={16} /> Enter {importDatasetNames[draft.section]} manually
                </button>
                <a
                  className="button secondary"
                  href={templatePaths[draft.section]}
                  download
                >
                  <Download size={16} /> Download {importDatasetNames[draft.section]} template
                </a>
              </div>
              {draft.tab === 'upload' && (
                <div className="panel stack">
                  <FileSpreadsheet size={28} />
                  <h3>Upload {importDatasetNames[draft.section]} from CSV / Excel</h3>
                  <p>
                    CSV is parsed locally; XLS and XLSX sheets are parsed by the
                    analytical service for review. Select a worksheet before
                    confirming. Up to 10,000 rows and 5 MB.
                  </p>
                  <label className="field">
                    Choose your {importDatasetNames[draft.section]} file
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
                    Map the source columns in the next step. Blank optional
                    values remain unknown, and nothing is applied before review.
                  </p>
                  {loading && <p role="status">Reading your file…</p>}
                </div>
              )}
            </div>
          )}
          {draft.section === 'inventory' && draft.tab === 'manual' && (
            <div
              className="form-actions"
              role="group"
              aria-label="Inventory information type"
            >
              <button
                className={`button ${inventoryTab === 'stock' ? 'primary' : 'secondary'}`}
                onClick={() => {
                  setInventoryTab('stock')
                  patch({
                    fields: { ...draft.fields, $inventoryTab: 'stock' },
                  })
                }}
              >
                Stock &amp; costs
              </button>
              <button
                className={`button ${inventoryTab === 'pool' ? 'primary' : 'secondary'}`}
                onClick={() => {
                  setInventoryTab('pool')
                  patch({ fields: { ...draft.fields, $inventoryTab: 'pool' } })
                }}
              >
                Shared inventory pool
              </button>
            </div>
          )}
          {draft.section === 'inventory' &&
            draft.tab === 'manual' &&
            inventoryTab === 'pool' && (
            <form
              className="stack"
              onSubmit={poolSubmit}
              onChange={captureFields}
            >
              <p>
                A pool records which known locations and sales channels share
                stock. Its total retains the physical contribution of each
                location. It does not create duplicate inventory.
              </p>
              <label className="field">
                Pool name
                <input {...fieldProps('poolName')} required />
              </label>
              <fieldset>
                <legend>Contributing physical locations</legend>
                {workspace.locations.length ? (
                  workspace.locations.map((location) => (
                    <label className="checkbox-field" key={location.id}>
                      <input
                        type="checkbox"
                        name={`poolLocation-${location.id}`}
                        defaultChecked={
                          draft.fields[
                            fieldKey(`poolLocation-${location.id}`)
                          ] === 'on'
                        }
                      />
                      {location.name}
                    </label>
                  ))
                ) : (
                  <p className="notice">
                    Add stock with at least one known location first. Aggregate
                    stock cannot be split into invented warehouses.
                  </p>
                )}
              </fieldset>
              <label className="field">
                Sales channels using this pool{' '}
                <span className="muted">Optional</span>
                <input
                  {...fieldProps('poolChannels')}
                  placeholder="Separate your channel names with commas"
                />
                <small>
                  A channel uses the selected pool. It does not own another copy
                  of that stock.
                </small>
              </label>
              {(workspace.inventoryPools ?? []).length > 0 && (
                <div className="panel">
                  <h3>Declared pools</h3>
                  {workspace.inventoryPools!.map((pool) => (
                    <p key={pool.id}>
                      {pool.name} ·{' '}
                      {pool.locationIds
                        .map(
                          (id) =>
                            workspace.locations.find(
                              (location) => location.id === id,
                            )?.name ?? id,
                        )
                        .join(', ')}{' '}
                      · {pool.channelNames.join(', ') || 'No channels supplied'}
                    </p>
                  ))}
                </div>
              )}
              <div className="form-actions">
                <button
                  type="submit"
                  className="button primary"
                  disabled={!workspace.locations.length}
                >
                  Review shared pool
                </button>
              </div>
            </form>
          )}
          {draft.section === 'inventory' &&
            draft.tab === 'manual' &&
            inventoryTab === 'stock' && (
            <form
              className="stack"
              onSubmit={inventorySubmit}
              onChange={captureFields}
            >
              <div className="form-grid">
                <label className="field">
                  SKU or product reference
                  <input {...fieldProps('sku')} list="intake-skus" />
                  <datalist id="intake-skus">
                    {workspace.products.map((product) => (
                      <option key={product.id} value={product.sku}>
                        {product.name}
                      </option>
                    ))}
                  </datalist>
                  <small>
                    Exact references stay distinct. A missing SKU can receive a
                    reviewed internal reference.
                  </small>
                </label>
                <label className="field">
                  Product name
                  <input {...fieldProps('productName')} />
                </label>
                <label className="field">
                  Quantity basis
                  <SelectField {...fieldProps('quantityBasis', 'on-hand')}>
                    <option value="on-hand">On hand · physical stock</option>
                    <option value="available">
                      Available · reservations already deducted
                    </option>
                  </SelectField>
                </label>
                <label className="field">
                  Recorded stock quantity
                  <input
                    {...fieldProps('stockQuantity')}
                    required
                    inputMode="decimal"
                  />
                  <small>
                    Zero is a confirmed quantity. Negative source values remain
                    visible as exceptions.
                  </small>
                </label>
                <label className="field">
                  Unit
                  <input
                    {...fieldProps('stockUnit')}
                    required
                    placeholder="pieces, boxes…"
                  />
                </label>
                <label className="field">
                  Reserved quantity <span className="muted">Optional</span>
                  <input {...fieldProps('reserved')} inputMode="decimal" />
                  <small>
                    For on-hand stock. Blank means unknown, including whether
                    reservations exist.
                  </small>
                </label>
                <label className="field">
                  Backordered quantity <span className="muted">Optional</span>
                  <input {...fieldProps('backordered')} inputMode="decimal" />
                  <small>
                    Known outstanding customer demand. Blank is unknown.
                    Separate from reservations and on-hand stock.
                  </small>
                </label>
                <label className="field">
                  Stock date
                  <input {...fieldProps('stockDate')} type="date" required />
                </label>
                <label className="field">
                  Location <span className="muted">Optional</span>
                  <input {...fieldProps('stockLocation')} />
                  <small>
                    Blank means aggregate business scope. No warehouse split is
                    inferred.
                  </small>
                </label>
                <label className="field">
                  Unit cost · {workspace.profile.currency}
                  <input {...fieldProps('cost')} inputMode="decimal" />
                  <small>
                    Cost for one unit above. Blank is unknown. Zero is a
                    confirmed cost.
                  </small>
                </label>
                <label className="field">
                  Unit selling price · {workspace.profile.currency}
                  <input {...fieldProps('price')} inputMode="decimal" />
                </label>
                <label className="field">
                  Category <span className="muted">Optional</span>
                  <input {...fieldProps('category')} />
                </label>
                <label className="field">
                  Brand <span className="muted">Optional</span>
                  <input {...fieldProps('brand')} />
                </label>
                <label className="field">
                  Target inventory quantity{' '}
                  <span className="muted">Optional</span>
                  <input {...fieldProps('targetStock')} inputMode="decimal" />
                  <small>
                    Explicit product-wide physical stock target; used to
                    calculate excess for the full product scope.
                  </small>
                </label>
                <label className="field">
                  Reorder point <span className="muted">Optional</span>
                  <input {...fieldProps('reorderPoint')} inputMode="decimal" />
                  <small>
                    Product quantity in the unit above. Applies across supplied
                    locations.
                  </small>
                </label>
                <label className="field">
                  Safety stock <span className="muted">Optional</span>
                  <input {...fieldProps('safetyStock')} inputMode="decimal" />
                  <small>
                    Recorded product quantity, not a calculated optimum.
                  </small>
                </label>
                <label className="field">
                  Service target % <span className="muted">Optional</span>
                  <input {...fieldProps('serviceTarget')} inputMode="decimal" />
                </label>
                <label className="field">
                  Service target definition
                  <SelectField {...fieldProps('serviceTargetBasis')}>
                    <option value="">Unknown · no attainment comparison</option>
                    <option value="initial-unit-fill">
                      Initially fulfilled / requested units
                    </option>
                    <option value="daily-in-stock">
                      Positive daily closing availability observations
                    </option>
                  </SelectField>
                  <small>
                    Owner-selected target from 0 to 100. No historical service
                    score is implied.
                  </small>
                </label>
              </div>
              <div className="form-actions">
                <button className="button primary" type="submit">
                  Review inventory
                </button>
              </div>
            </form>
          )}
          {draft.section === 'suppliers' && draft.tab === 'manual' && (
            <form
              className="stack"
              onSubmit={suppliersSubmit}
              onChange={captureFields}
            >
              <div className="form-grid">
                <label className="field">
                  Supplier name
                  <input
                    {...fieldProps('supplierName')}
                    required
                    list="intake-suppliers"
                  />
                  <datalist id="intake-suppliers">
                    {workspace.suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.name} />
                    ))}
                  </datalist>
                </label>
                <label className="field">
                  Product <span className="muted">Optional</span>
                  <SelectField {...fieldProps('supplierProduct')}>
                    <option value="">Add relationship later</option>
                    {workspace.products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} · {product.name}
                      </option>
                    ))}
                  </SelectField>
                </label>
                <label className="field">
                  Quoted lead time · calendar days
                  <input {...fieldProps('leadTime')} inputMode="numeric" />
                  <small>
                    Measured from order placement to receipt. This is a supplied
                    term, not historical reliability.
                  </small>
                </label>
                <label className="field">
                  Unit cost · {workspace.profile.currency}
                  <input {...fieldProps('supplierCost')} inputMode="decimal" />
                </label>
                <label className="field">
                  Minimum order quantity
                  <input {...fieldProps('moq')} inputMode="decimal" />
                </label>
                <label className="field">
                  Units per case / pack
                  <input {...fieldProps('casePack')} inputMode="decimal" />
                </label>
              </div>
              <h3>
                Open purchase <span className="muted">Optional</span>
              </h3>
              <p className="muted">
                Leave quantity blank to save only supplier terms. These records
                do not create a confirmed payable or imply payment.
              </p>
              <div className="form-grid">
                <label className="field">
                  Purchase quantity
                  <input
                    {...fieldProps('purchaseQuantity')}
                    inputMode="decimal"
                  />
                </label>
                <label className="field">
                  Purchase amount · {workspace.profile.currency}
                  <input
                    {...fieldProps('purchaseAmount')}
                    inputMode="decimal"
                  />
                </label>
                <label className="field">
                  Purchase amount already paid · {workspace.profile.currency}
                  <input
                    {...fieldProps('purchasePaidAmount')}
                    inputMode="decimal"
                  />
                  <small>
                    For an open purchase, confirm zero if unpaid. An unknown
                    amount is not assumed to be zero.
                  </small>
                </label>
                <label className="field">
                  Receipt location <span className="muted">Optional</span>
                  <SelectField {...fieldProps('receiptLocation')}>
                    <option value="">Unallocated / unknown</option>
                    {workspace.locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </SelectField>
                  <small>
                    Only explicitly allocated receipts can enter a location or
                    shared-pool scenario.
                  </small>
                </label>
                <label className="field">
                  Order date
                  <input {...fieldProps('orderDate')} type="date" />
                </label>
                <label className="field">
                  Promised receipt date
                  <input {...fieldProps('promisedDate')} type="date" />
                </label>
                <label className="field">
                  Receipt status
                  <SelectField {...fieldProps('receiptStatus')}>
                    <option value="">Confirm receipt status</option>
                    <option value="not-received">Confirmed not received</option>
                    <option value="received">
                      Recorded receipt (full or partial)
                    </option>
                  </SelectField>
                </label>
                <label className="field">
                  Quantity received on the recorded receipt date
                  <input
                    {...fieldProps('receivedQuantity')}
                    inputMode="decimal"
                  />
                </label>
                <label className="field">
                  Actual purchase receipt date
                  <input {...fieldProps('receivedDate')} type="date" />
                  <small>
                    One dated receipt observation. Remaining unrecorded partial
                    receipts stay unknown. Stock snapshots are entered
                    independently.
                  </small>
                </label>
                <label className="field">
                  Expected payment date
                  <input {...fieldProps('paymentDate')} type="date" />
                </label>
              </div>
              <div className="form-actions">
                <button className="button primary" type="submit">
                  Review supplier information
                </button>
              </div>
            </form>
          )}
          {draft.section === 'finance' && draft.tab === 'manual' && (
            <div className="stack">
              <div
                className="form-actions"
                role="group"
                aria-label="Finance information type"
              >
                {(
                  [
                    'record',
                    'cash',
                    'budget',
                    'commitment',
                    'coverage',
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab}
                    className={`button ${financeTab === tab ? 'primary' : 'secondary'}`}
                    onClick={() => {
                      setFinanceTab(tab)
                      patch({ fields: { ...draft.fields, $financeTab: tab } })
                    }}
                  >
                    {
                      {
                        record: 'Receipts & payments',
                        cash: 'Available cash',
                        budget: 'Purchasing budget',
                        commitment: 'Recurring commitments',
                        coverage: 'Category review',
                      }[tab]
                    }
                  </button>
                ))}
              </div>
              <form
                key={financeTab}
                className="stack"
                onSubmit={financeSubmit}
                onChange={captureFields}
              >
                {financeTab === 'record' && (
                  <>
                    <div className="form-grid">
                      <label className="field">
                        Record type
                        <SelectField
                          value={recordKind}
                          onChange={(event) => {
                            setRecordKind(
                              event.target.value as FinancialRecord['kind'],
                            )
                            patch({
                              fields: {
                                ...draft.fields,
                                $recordKind: event.target.value,
                              },
                            })
                          }}
                        >
                          <option value="receivable">
                            Customer receivable · Internal Debt
                          </option>
                          <option value="provider_pending">
                            Collected, pending availability · Internal Debt
                          </option>
                          <option value="payable">
                            Supplier payable · External Debt
                          </option>
                          <option value="financing">
                            Financing Debt repayment
                          </option>
                          <option value="operating">Operating payment</option>
                        </SelectField>
                      </label>
                      <label className="field">
                        Record / invoice name
                        <input {...fieldProps('recordName')} required />
                      </label>
                      <label className="field">
                        Customer, supplier or counterparty
                        <input {...fieldProps('counterparty')} required />
                      </label>
                      <label className="field">
                        Original amount · {workspace.profile.currency}
                        <input
                          {...fieldProps('financeAmount')}
                          required
                          inputMode="decimal"
                        />
                      </label>
                      <label className="field">
                        Amount already paid / collected ·{' '}
                        {workspace.profile.currency}
                        <input
                          {...fieldProps('paidAmount')}
                          required
                          inputMode="decimal"
                        />
                        <small>
                          Enter a confirmed zero if unpaid. Partial collection
                          reduces this record, not sales.
                        </small>
                      </label>
                      <label className="field">
                        Due date <span className="muted">Optional</span>
                        <input {...fieldProps('dueDate')} type="date" />
                      </label>
                      <label className="field">
                        Expected availability / payment date{' '}
                        <span className="muted">Optional</span>
                        <input {...fieldProps('expectedDate')} type="date" />
                        <small>
                          When money is expected to become available or leave. A
                          due date is not a guarantee.
                        </small>
                      </label>
                      {recordKind === 'operating' && (
                        <label className="field">
                          Category
                          <SelectField {...fieldProps('recordCategory', 'payroll')}>
                            <option value="payroll">Payroll</option>
                            <option value="rent">Rent</option>
                            <option value="taxes">Taxes</option>
                            <option value="other">
                              Other operating payment
                            </option>
                          </SelectField>
                        </label>
                      )}
                      {recordKind === 'payable' && (
                        <label className="field">
                          Linked purchase order
                          <SelectField {...fieldProps('linkedPurchaseId')}>
                            <option value="">No purchase order linked</option>
                            {workspace.purchases.map((purchase) => (
                              <option key={purchase.id} value={purchase.id}>
                                {purchase.id} ·{' '}
                                {workspace.suppliers.find(
                                  (supplier) =>
                                    supplier.id === purchase.supplierId,
                                )?.name ?? 'Supplier unknown'}{' '}
                                ·{' '}
                                {money(
                                  purchase.amount,
                                  workspace.profile.currency,
                                )}
                              </option>
                            ))}
                          </SelectField>
                          <small>
                            Link a purchase and its supplier invoice to keep the
                            same payment from being counted twice. Cash
                            execution checks the allocation and paid amounts.
                          </small>
                        </label>
                      )}
                      {recordKind === 'provider_pending' && (
                        <label className="field">
                          Linked customer receivable
                          <SelectField {...fieldProps('linkedRecordId')}>
                            <option value="">No existing linked invoice</option>
                            {workspace.finance
                              .filter((record) => record.kind === 'receivable')
                              .map((record) => (
                                <option key={record.id} value={record.id}>
                                  {record.name}
                                </option>
                              ))}
                          </SelectField>
                          <small>
                            Pending funds must already be recorded as collected
                            on the linked invoice.
                          </small>
                        </label>
                      )}
                    </div>
                    <label className="field checkbox-field">
                      <input
                        type="checkbox"
                        name="cashIncluded"
                        defaultChecked={
                          draft.fields[fieldKey('cashIncluded')] === 'on'
                        }
                      />
                      This amount is already reflected in the supplied cash
                      balance.
                    </label>
                    <p className="muted">
                      Unknown dates remain unscheduled. Borrowing and repayment
                      schedules are limited to what you supply.
                    </p>
                  </>
                )}
                {financeTab === 'cash' && (
                  <>
                    <p>
                      Available cash is money the business can use on the stated
                      date. Exclude uncollected sales and funds still pending
                      with a provider.
                    </p>
                    <div className="form-grid">
                      <label className="field">
                        Available cash · {workspace.profile.currency}
                        <input
                          {...fieldProps(
                            'financeAmount',
                            workspace.cash?.amount.toString(),
                          )}
                          required
                          inputMode="decimal"
                        />
                      </label>
                      <label className="field">
                        Balance date
                        <input
                          {...fieldProps('cashDate', workspace.cash?.date)}
                          type="date"
                          required
                        />
                      </label>
                      <label className="field">
                        When was this balance measured?
                        <SelectField
                          {...fieldProps(
                            'cashPhase',
                            workspace.cash?.phase ?? 'opening',
                          )}
                        >
                          <option value="opening">
                            Opening · before this day's events
                          </option>
                          <option value="end-of-day">
                            End of day · after this day's events
                          </option>
                        </SelectField>
                      </label>
                      <label className="field">
                        Owner-selected cash reserve ·{' '}
                        {workspace.profile.currency}
                        <input
                          {...fieldProps(
                            'reserve',
                            workspace.cash?.reserve?.toString(),
                          )}
                          inputMode="decimal"
                        />
                        <small>
                          Optional. Blank means no reserve was supplied. It is
                          separate from purchasing budget.
                        </small>
                      </label>
                    </div>
                  </>
                )}
                {financeTab === 'budget' && (
                  <>
                    <p>
                      A purchasing budget is the limit you assign to purchase
                      commitments in a period. It does not establish cash
                      availability.
                    </p>
                    <div className="form-grid">
                      <label className="field">
                        Budget amount · {workspace.profile.currency}
                        <input
                          {...fieldProps(
                            'financeAmount',
                            workspace.budget?.amount.toString(),
                          )}
                          required
                          inputMode="decimal"
                        />
                      </label>
                      <label className="field">
                        Period start
                        <input
                          {...fieldProps(
                            'budgetStart',
                            workspace.budget?.startDate,
                          )}
                          type="date"
                          required
                        />
                      </label>
                      <label className="field">
                        Period end
                        <input
                          {...fieldProps(
                            'budgetEnd',
                            workspace.budget?.endDate,
                          )}
                          type="date"
                          required
                        />
                      </label>
                    </div>
                    <div className="notice">
                      Comparison basis · purchases committed by order date.
                      Payment timing is evaluated separately in cash planning.
                    </div>
                  </>
                )}
                {financeTab === 'commitment' && (
                  <>
                    <p>
                      Record an expected supplier period and its cadence.
                      Fulfillment and payment are separate. This form does not
                      create a confirmed payable or invent a future payment
                      schedule.
                    </p>
                    <div className="form-grid">
                      <label className="field">
                        Commitment name
                        <input {...fieldProps('commitmentName')} required />
                      </label>
                      <label className="field">
                        Supplier <span className="muted">Optional</span>
                        <SelectField {...fieldProps('commitmentSupplier')}>
                          <option value="">Unknown / add later</option>
                          {workspace.suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </option>
                          ))}
                        </SelectField>
                      </label>
                      <label className="field">
                        Cadence
                        <SelectField {...fieldProps('commitmentCadence', 'monthly')}>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </SelectField>
                      </label>
                      <label className="field">
                        Expected amount · {workspace.profile.currency}
                        <input
                          {...fieldProps('commitmentAmount')}
                          inputMode="decimal"
                        />
                        <small>
                          Blank means unknown. Zero is a confirmed amount.
                        </small>
                      </label>
                      <label className="field">
                        Next expected period date{' '}
                        <span className="muted">Optional</span>
                        <input {...fieldProps('commitmentDate')} type="date" />
                        <small>
                          The next expected supply date. An unknown date remains
                          unscheduled.
                        </small>
                      </label>
                      <label className="field">
                        Fulfillment status
                        <SelectField {...fieldProps('fulfillment', 'unknown')}>
                          <option value="unknown">Unknown</option>
                          <option value="fulfilled">Fulfilled</option>
                          <option value="not_fulfilled">Not fulfilled</option>
                        </SelectField>
                      </label>
                      <label className="field">
                        Payment status
                        <SelectField {...fieldProps('commitmentPayment', 'unknown')}>
                          <option value="unknown">Unknown</option>
                          <option value="paid">Paid</option>
                          <option value="unpaid">Unpaid</option>
                        </SelectField>
                      </label>
                      <label className="field">
                        Linked confirmed supplier payable
                        <SelectField {...fieldProps('linkedPayableId')}>
                          <option value="">No confirmed payable linked</option>
                          {workspace.finance
                            .filter((record) => record.kind === 'payable')
                            .map((record) => (
                              <option key={record.id} value={record.id}>
                                {record.name} · {record.counterparty}
                              </option>
                            ))}
                        </SelectField>
                        <small>
                          Link the realization to keep expected and confirmed
                          obligations from being counted twice.
                        </small>
                      </label>
                    </div>
                  </>
                )}
                {financeTab === 'coverage' && (
                  <>
                    <p>
                      Review each category for this period. An empty category is
                      unknown until you explicitly confirm it does not apply.
                    </p>
                    <div className="form-grid">
                      <label className="field">
                        Period start
                        <input
                          {...fieldProps(
                            'coverageStart',
                            workspace.coverage.collections.startDate,
                          )}
                          required
                          type="date"
                        />
                      </label>
                      <label className="field">
                        Period end
                        <input
                          {...fieldProps(
                            'coverageEnd',
                            workspace.coverage.collections.endDate,
                          )}
                          required
                          type="date"
                        />
                      </label>
                      {categories.map((category) => (
                        <label className="field" key={category}>
                          {
                            {
                              collections: 'Customer collections',
                              suppliers: 'Supplier payments',
                              payroll: 'Payroll',
                              rent: 'Rent',
                              taxes: 'Taxes',
                              financing: 'Financing Debt',
                              other: 'Other commitments',
                            }[category]
                          }
                          <SelectField
                            {...fieldProps(
                              `coverage-${category}`,
                              workspace.coverage[category].state,
                            )}
                          >
                            <option value="unknown">Unknown / add later</option>
                            <option value="supplied">
                              Supplied for this period
                            </option>
                            <option value="absent">
                              Confirmed absent for this period
                            </option>
                            <option value="omitted">
                              Known but omitted from this projection
                            </option>
                          </SelectField>
                        </label>
                      ))}
                    </div>
                    <p className="muted">
                      Unknown or omitted categories keep the projection partial.
                      Coverage declarations do not create payment records.
                    </p>
                  </>
                )}
                <div className="form-actions">
                  <button type="submit" className="button primary">
                    Review{' '}
                    {financeTab === 'record' ? 'financial record' : financeTab}
                  </button>
                </div>
              </form>
            </div>
          )}
          <div className="form-actions">
            <button className="button secondary" onClick={defer}>
              Continue for now
            </button>
            <button className="button secondary" onClick={onClose}>
              Save draft &amp; close
            </button>
            {!initialSection && (
              <button className="button secondary" onClick={() => move(0)}>
                Business details
              </button>
            )}
          </div>
        </>
      )}
      {pending && (
        <div className="stack">
          <h2>Review before applying</h2>
          <div className="panel stack">
            {pending.summary.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
          <p className="muted">
            Confirmed manual records are saved to the workspace service.
            Submitted analytical runs preserve their own durable input
            snapshots.
          </p>
          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I confirm these values and their stated meaning.
          </label>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setPending(null)}
            >
              Back to edit
            </button>
            <button
              className="button secondary"
              onClick={() => {
                setPending(null)
                onClose()
              }}
            >
              Cancel review
            </button>
            <button
              className="button primary"
              disabled={
                !confirmed ||
                !canEdit(
                  draft.section === 'profile' ? 'settings' : draft.section,
                )
              }
              onClick={savePending}
            >
              Confirm &amp; apply
            </button>
          </div>
        </div>
      )}
      {draft.step === 2 && draft.file && draft.mapping && (
        <div className="stack">
          <div>
            <h2>
              Check how your {importDatasetNames[draft.section as ImportDataset]} are
              understood.
            </h2>
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
          <div className="form-grid">
            {(draft.section === 'sales'
              ? importFields
              : bulkImportFields[
                  draft.section as Exclude<ImportDataset, 'sales'>
                ]
            ).map(({ key, label }) => (
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
                    <option value={index} key={index}>
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
            {draft.section === 'sales' && (
              <>
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
              </>
            )}
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
            {draft.section === 'sales' && (
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
            )}
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
          <div className="table-wrap">
            {draft.section === 'sales' ? (
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
                  {salesReviewed.slice(0, 100).map((row) => (
                    <tr key={row.index}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Include row ${row.index + 1}`}
                          checked={!draft.excluded.includes(row.index)}
                          onChange={(event) =>
                            patch({
                              excluded: event.target.checked
                                ? draft.excluded.filter(
                                    (index) => index !== row.index,
                                  )
                                : [...draft.excluded, row.index],
                            })
                          }
                        />
                      </td>
                      <td>
                        {row.index + 1} ·{' '}
                        <span className="badge">{row.status}</span>
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
            ) : (
              <table className="data-table">
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
                  {(bulkReviewed as BulkReviewedRow[])
                    .slice(0, 100)
                    .map((row) => (
                      <tr key={row.index}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Include row ${row.index + 1}`}
                            checked={!draft.excluded.includes(row.index)}
                            onChange={(event) =>
                              patch({
                                excluded: event.target.checked
                                  ? draft.excluded.filter(
                                      (index) => index !== row.index,
                                    )
                                  : [...draft.excluded, row.index],
                              })
                            }
                          />
                        </td>
                        <td>
                          {row.index + 1} ·{' '}
                          <span className="badge">{row.status}</span>
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
              </table>
            )}
          </div>
          {reviewed.length > 100 && (
            <p className="muted">
              Showing the first 100 rows. All {reviewed.length} rows are
              validated and included in the counts. Correct larger files in the
              source CSV.
            </p>
          )}
          <div className="notice">
            Only usable rows are applied. Pending and excluded rows are retained
            in this intake draft for review and contribute no totals. Similar
            product names and SKU variants are never silently merged; use SKU
            standardization after import to review corrections.
          </div>
          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I confirm these mappings, meaning and {usable.length} usable rows.{' '}
            {reviewed.length - usable.length} pending or excluded rows will not
            be applied.
          </label>
          <div className="form-actions">
            <button className="button secondary" onClick={() => move(1)}>
              Back to edit
            </button>
            <button
              className="button secondary"
              onClick={() => {
                patch({ step: 1 })
                onClose()
              }}
            >
              Cancel review
            </button>
            <button
              className="button primary"
              disabled={
                !confirmed ||
                usable.length === 0 ||
                !canEdit(draft.section === 'profile' ? 'settings' : draft.section)
              }
              onClick={
                draft.section === 'sales' ? applySales : applyImportedRows
              }
            >
              Confirm &amp; apply {usable.length} rows
            </button>
          </div>
        </div>
      )}
      {draft.step === 3 && (
        <div className="stack">
          <div>
            <CheckCircle2 size={32} />
            <h2>
              {usableCapabilities.length
                ? 'Your information is ready to explore.'
                : 'Your workspace is ready when you are.'}
            </h2>
            <p className="muted">
              {lastSource ||
                (usableCapabilities.length
                  ? 'Continue with the records you have confirmed.'
                  : 'You have deferred data entry. No analysis has been calculated.')}
            </p>
          </div>
          {usableCapabilities.length ? (
            <>
              <div className="panel stack">
                {usableCapabilities.slice(0, 6).map((capability) => (
                  <div key={capability.id}>
                    <strong>{capability.name}</strong>
                    <p className="muted">{capability.warning}</p>
                  </div>
                ))}
              </div>
              <p className="muted">
                {workspace.sales.length} sales · {workspace.products.length}{' '}
                products · {workspace.stock.length} stock records ·{' '}
                {workspace.finance.length} financial records. Only supported
                data appears in your workspace. Forecast eligibility is checked
                separately for each engine.
              </p>
            </>
          ) : (
            <div className="notice">
              Start with one dated sale amount, a product quantity, stock or a
              receivable. Cash, margin and forecasts remain unavailable until
              their required information is supplied.
            </div>
          )}
          <div className="notice">
            <p>
              Scope ·{' '}
              {workspace.sales.length
                ? `${workspace.sales.length} sales observations from ${workspace.sales.map((sale) => sale.date).sort()[0]} through ${workspace.sales
                    .map((sale) => sale.date)
                    .sort()
                    .at(-1)}. `
                : ''}
              {workspace.stock.length
                ? `${workspace.stock.length} dated stock positions, ${workspace.stock.filter((stock) => stock.locationId === null).length} with aggregate physical scope. `
                : ''}
              {workspace.finance.length
                ? `${workspace.finance.filter((record) => !record.expectedDate).length} financial records remain unscheduled.`
                : ''}
            </p>
            {firstQuestion && (
              <p>
                Your next question · {firstQuestion.label}. Confirmed records
                are reused; the scenario asks for missing inputs and assumptions
                before running.
              </p>
            )}
          </div>
          <div className="form-actions">
            <button className="button secondary" onClick={() => move(1)}>
              Add more information
            </button>
            {firstQuestion &&
              onFirstDecision &&
              usableCapabilities.length > 0 && (
                <button
                  className="button primary"
                  onClick={() => finish(firstQuestion.key)}
                >
                  {firstQuestion.label} <ArrowRight size={16} />
                </button>
              )}
            <button
              className={
                firstQuestion &&
                onFirstDecision &&
                usableCapabilities.length > 0
                  ? 'button secondary'
                  : 'button primary'
              }
              onClick={() => finish()}
            >
              {usableCapabilities.length
                ? 'View my workspace'
                : 'Continue for now'}{' '}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export const DataEntry = Onboarding
import { SelectField } from '../../components/ui/select-field'
