import {
  poolSubmit,
  inventorySubmit,
  financeSubmit,
  suppliersSubmit,
} from './onboarding-submissions'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useWorkspaceAccess } from '../../components/workspace-access-context'
import {
  catalogCapabilities,
  isCapabilityMuted,
  questions,
  type FinancialRecord,
  type QuestionKey,
  type Workspace,
} from '../../domain/workspace'
import { platformRequest } from '../../lib/workspace-api'
import { type AdvancedDataKind } from './AdvancedDataEntry'
import {
  applyReviewedSales,
  guessMapping,
  importFields,
  parseCsv,
  reviewRows,
  stableId,
  type ColumnMapping,
  type Interpretation,
} from './intake'
import {
  blankRow,
  initialDraft,
  manualHeaders,
  newId,
  persistDraft,
  sectionNames,
  type ConfirmedReview,
  type IntakeDraft,
  type OnboardingProps,
} from './onboarding-draft'
import { questionGuidance } from './onboarding-model'

export function useOnboardingController({
  workspace,
  onChange,
  onClose,
  initialSection,
  onFirstDecision,
  onViewResult,
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
    fieldPrefix: string
  } | null>(null)
  const [lastSource, setLastSource] = useState('')
  const [sourceReview, setSourceReview] = useState<ConfirmedReview | null>(null)
  const [inventoryTab, setInventoryTab] = useState<'stock' | 'pool'>(() =>
    draft.fields.$inventoryTab === 'pool' ? 'pool' : 'stock',
  )
  const [financeTab, setFinanceTab] = useState<
    'record' | 'cash' | 'budget' | 'coverage' | 'commitment'
  >(() => {
    const saved = draft.fields.$financeTab
    return saved === 'cash' ||
      saved === 'budget' ||
      saved === 'coverage' ||
      saved === 'commitment'
      ? saved
      : 'record'
  })
  const [recordKind, setRecordKind] = useState<FinancialRecord['kind']>(() => {
    const saved = draft.fields.$recordKind
    return saved === 'provider_pending' ||
      saved === 'payable' ||
      saved === 'financing' ||
      saved === 'operating'
      ? saved
      : 'receivable'
  })
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
    setDraft((current) => ({
      ...current,
      ...next,
      ...(next.profile && current.step === 0 && next.step !== 1
        ? {
            fields: {
              ...current.fields,
              ...next.fields,
              $profileEditing: 'true',
            },
          }
        : {}),
    }))
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
  const reviewed = useMemo(
    () =>
      draft.file && draft.mapping
        ? reviewRows(
            draft.file,
            draft.mapping,
            draft.interpretation,
            workspace,
            draft.excluded,
          )
        : [],
    [
      draft.file,
      draft.mapping,
      draft.interpretation,
      draft.excluded,
      workspace,
    ],
  )
  const usable = reviewed.filter((row) => row.status === 'usable')
  const supportedCapabilities = catalogCapabilities.filter(
    (capability) => capability.firstResult && capability.check(workspace),
  )
  const usableCapabilities = supportedCapabilities.filter(
    (capability) => !isCapabilityMuted(capability, workspace),
  )
  const resultsHidden =
    supportedCapabilities.length > 0 && usableCapabilities.length === 0
  const guidance = questionGuidance(draft.profile.firstQuestion)
  const questionCapability = catalogCapabilities.find(
    (capability) => capability.questionKey === draft.profile.firstQuestion,
  )
  const missingPrerequisite = questionCapability?.requires
    ?.map((id) =>
      catalogCapabilities.find((capability) => capability.id === id),
    )
    .find((capability) => capability && !capability.check(workspace))
  const nextSection = missingPrerequisite?.entrySection ?? guidance.blocks[0]
  const firstResult =
    usableCapabilities.find(
      (capability) => capability.entrySection === guidance.blocks[0],
    ) ?? usableCapabilities[0]
  const visibleStep = pending ? 2 : draft.step
  const changeQuestion = (value: string) => {
    if (!canEdit('settings')) return
    const profile = { ...draft.profile, firstQuestion: value }
    patch({
      profile,
      ...(draft.step === 1
        ? { section: questionGuidance(value).blocks[0] }
        : {}),
    })
    if (draft.step !== 0)
      onChange({
        ...workspace,
        revision: workspace.revision + 1,
        profile: { ...workspace.profile, firstQuestion: value },
      })
  }
  const closeDraft = () => {
    if (!persistDraft(workspace.id, draft)) setDraftStorageAvailable(false)
    onClose()
  }
  const dates = usable.map((row) => row.date).sort()
  const unitGroups = [
    ...new Set(
      usable.filter((row) => row.quantity !== null).map((row) => row.unit),
    ),
  ]
  const productGroups = new Set(
    usable
      .filter((row) => row.sku || row.name)
      .map((row) => row.sku || row.name),
  )
  const locations = [
    ...new Set(usable.map((row) => row.location).filter(Boolean)),
  ]
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
        deferred: supportedCapabilities.length === 0,
        firstAnalysisAt: supported
          ? (workspace.onboarding.firstAnalysisAt ?? new Date().toISOString())
          : workspace.onboarding.firstAnalysisAt,
      },
    })
    const draftStored = persistDraft(workspace.id, { ...draft, step: 1 })
    if (!draftStored) setDraftStorageAvailable(false)
    if (question && onFirstDecision) onFirstDecision(question)
    else if (resultsHidden && onViewResult) onViewResult('data')
    else if (firstResult?.firstResult && onViewResult)
      onViewResult(firstResult.firstResult.page)
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
          mapping: guessMapping(parsed.headers),
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
          mapping: guessMapping(preview.headers),
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
      row.some((cell, index) =>
        index === 9 ? cell === 'return' : cell.trim(),
      ),
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
        reviewed,
        draft.interpretation,
        draft.sourceName,
        draft.sourceType,
        draft.mapping!,
      )
      onChange({
        ...next,
        onboarding: { ...next.onboarding, step: 3, deferred: false },
      })
      setLastSource(
        `${usable.length} sale records confirmed from ${draft.sourceName}`,
      )
      const pendingManual = reviewed
        .filter((row) => row.status === 'pending')
        .map((row) => row.original)
      patch({
        step: 3,
        ...(draft.sourceType === 'manual'
          ? {
              file: null,
              mapping: null,
              manual: pendingManual.length ? pendingManual : [blankRow()],
              excluded: [],
            }
          : reviewed.some((row) => row.status !== 'usable')
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
      meaning = review.interpretation
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
    const mapping = Object.fromEntries(
      importFields.map(({ key }) => [key, review.columnMapping[key] ?? null]),
    ) as ColumnMapping
    const acceptedRows = new Set(review.acceptedRowIndexes)
    const excludedRows = new Set(review.excludedRowIndexes)
    setSourceReview({
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
          (index) => !acceptedRows.has(index) && !excludedRows.has(index),
        ),
      confirmedAt: source.importedAt,
    })
  }
  const profileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEdit('settings')) return
    if (!draft.profile.name.trim() || !draft.profile.currency.trim()) {
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
      fields: Object.fromEntries(
        Object.entries(draft.fields).filter(
          ([key]) => key !== '$profileEditing',
        ),
      ),
      ...(!workspace.profile.name.trim() &&
      (!initialSection || initialSection === 'profile')
        ? { section: guidance.blocks[0] }
        : {}),
      interpretation: {
        ...draft.interpretation,
        currency: draft.profile.currency,
      },
    })
  }
  const fieldPrefix = `${draft.section}-${draft.section === 'finance' ? financeTab : draft.section === 'inventory' ? inventoryTab : ''}-`
  const fieldKey = (name: string) => `${fieldPrefix}${name}`
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
    setPending({ workspace: next, summary, fieldPrefix })
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
    patch({
      step: 3,
      fields: Object.fromEntries(
        Object.entries(draft.fields).filter(
          ([key]) => !key.startsWith(pending.fieldPrefix),
        ),
      ),
    })
  }

  return {
    advancedKind,
    workspace,
    onChange,
    onClose,
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
    patch,
    reviewManual,
    openSourceReview,
    move,
    inventoryTab,
    poolSubmit: (event: FormEvent<HTMLFormElement>) =>
      poolSubmit(event, { workspace, prepare, setError }),
    captureFields,
    fieldProps,
    locations,
    fieldKey,
    inventorySubmit: (event: FormEvent<HTMLFormElement>) =>
      inventorySubmit(event, { workspace, prepare, setError }),
    suppliersSubmit: (event: FormEvent<HTMLFormElement>) =>
      suppliersSubmit(event, { workspace, prepare, setError }),
    financeTab,
    recordKind,
    setRecordKind,
    setFinanceTab,
    financeSubmit: (event: FormEvent<HTMLFormElement>) =>
      financeSubmit(event, {
        workspace,
        prepare,
        setError,
        financeTab,
        recordKind,
      }),
    guidance,
    changeQuestion,
    firstQuestion,
    onFirstDecision,
    finish,
    setInventoryTab,
    defer,
    closeDraft,
    initialSection,
    profileSubmit,
    confirmed,
    setConfirmed,
    setPending,
    canEdit,
    savePending,
    dates,
    productGroups,
    usable,
    unitGroups,
    reviewed,
    applySales,
    firstResult,
    lastSource,
    resultsHidden,
    usableCapabilities,
    missingPrerequisite,
    nextSection,
    setSourceReview,
  }
}

export type OnboardingViewModel = ReturnType<typeof useOnboardingController>
