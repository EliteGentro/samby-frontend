import type { FormEvent } from 'react'
import {
  cutoff,
  categories,
  money,
  type Workspace,
  type Product,
  type Commitment,
  type Category,
  type FinancialRecord,
} from '../../domain/workspace'
import { newId, textValue, maybeNumber } from './onboarding-draft'
import { stableId } from './intake'
type SubmissionContext = {
  workspace: Workspace
  prepare: (workspace: Workspace, summary: string[]) => void
  setError: (message: string) => void
}
type FinancialSubmissionContext = SubmissionContext & {
  financeTab: 'record' | 'cash' | 'budget' | 'coverage' | 'commitment'
  recordKind: FinancialRecord['kind']
}

export function poolSubmit(
  event: FormEvent<HTMLFormElement>,
  context: SubmissionContext,
) {
  const { workspace, prepare, setError } = context

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
  const contributingLocationIds = new Set(locationIds)
  prepare(
    {
      ...workspace,
      inventoryPools: [...(workspace.inventoryPools ?? []), pool],
    },
    [
      `Shared inventory pool · ${name}`,
      `Known contributing locations · ${workspace.locations
        .filter((location) => contributingLocationIds.has(location.id))
        .map((location) => location.name)
        .join(', ')}`,
      `Sales channels using this pool · ${channelNames.length ? channelNames.join(', ') : 'Not supplied'}`,
      'This records a shared-stock relationship. No stock is copied, transferred or assigned to an invented location. Aggregate stock outside these known locations remains separate.',
    ],
  )
}

export function inventorySubmit(
  event: FormEvent<HTMLFormElement>,
  context: SubmissionContext,
) {
  const { workspace, prepare, setError } = context

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
  let location = workspace.locations.find((item) => item.name === locationName)
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

export function financeSubmit(
  event: FormEvent<HTMLFormElement>,
  context: FinancialSubmissionContext,
) {
  const { workspace, prepare, setError, financeTab, recordKind } = context

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
      fulfillment: textValue(form, 'fulfillment') as Commitment['fulfillment'],
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
      {
        ...workspace,
        commitments: [...workspace.commitments, commitment],
      },
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

export function suppliersSubmit(
  event: FormEvent<HTMLFormElement>,
  context: SubmissionContext,
) {
  const { workspace, prepare, setError } = context

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
    setError('Quoted terms must be nonnegative numbers, or blank when unknown.')
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
