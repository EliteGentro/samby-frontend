import { cutoff, type CapabilityScope, type Workspace } from './workspace'

const finite = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const dayNumber = (date: string) => Date.parse(`${date}T12:00:00Z`) / 86400000
const key = (productId: string, locationId: string | null) =>
  `${productId}|${locationId ?? 'aggregate'}`
const netAmount = (basis: string) =>
  /net|excluding|before tax|sin impuesto/i.test(basis) &&
  !/including tax|with tax/i.test(basis)
export const metricVersion = 'samby-observed-metrics-v1'

export function capitalMetrics(
  w: Workspace,
  start: string,
  end: string,
  scope: CapabilityScope = {},
) {
  const days = Math.round(dayNumber(end) - dayNumber(start)) + 1
  const snapshots = (w.inventoryHistory ?? []).filter(
    (s) =>
      (!scope.productId || s.productId === scope.productId) &&
      (!scope.locationId || s.locationId === scope.locationId) &&
      (!scope.sourceId || s.sourceId === scope.sourceId) &&
      s.asOf <= end &&
      s.throughDate >= start,
  )
  const warnings: string[] = []
  const groups = [
    ...new Set(snapshots.map((s) => key(s.productId, s.locationId))),
  ]
  const rows = groups.flatMap((group) => {
    const records = snapshots.filter(
        (s) => key(s.productId, s.locationId) === group,
      ),
      first = records[0],
      product = w.products.find((p) => p.id === first.productId)
    if (!product || days < 1 || days > 3660) return []
    if (
      !scope.locationId &&
      snapshots.some(
        (s) =>
          s.productId === first.productId &&
          (s.locationId === null) !== (first.locationId === null),
      )
    ) {
      warnings.push(
        `${product.name}: aggregate and location histories overlap; reconcile the scope.`,
      )
      return []
    }
    let valueDays = 0,
      estimatedDays = 0
    for (let date = dayNumber(start); date <= dayNumber(end); date++) {
      const matches = records.filter(
        (s) => dayNumber(s.asOf) <= date && dayNumber(s.throughDate) >= date,
      )
      if (
        matches.length !== 1 ||
        !finite(matches[0].unitCost) ||
        matches[0].unitCost < 0 ||
        matches[0].currency !== w.profile.currency ||
        matches[0].unit !== product.unit ||
        !finite(matches[0].quantity) ||
        matches[0].quantity < 0
      ) {
        warnings.push(
          `${product.name}: missing, overlapping or incompatible inventory cost coverage. This scope is excluded from period ratios.`,
        )
        return []
      }
      const record = matches[0]
      if (
        record.method === 'daily-observed' &&
        record.asOf !== record.throughDate
      ) {
        warnings.push(
          `${product.name}: a daily observation cannot cover several unobserved days.`,
        )
        return []
      }
      valueDays += record.quantity * record.unitCost!
      if (record.method === 'constant-estimate') estimatedDays++
    }
    const sales = w.sales.filter(
      (s) =>
        s.productId === product.id &&
        (first.locationId === null || s.locationId === first.locationId) &&
        s.date >= start &&
        s.date <= end &&
        (!scope.sourceId || s.sourceId === scope.sourceId),
    )
    const costed = sales.filter(
      (s) =>
        finite(s.quantity) &&
        s.quantity >= 0 &&
        s.unit === product.unit &&
        finite(s.unitCost) &&
        s.unitCost >= 0 &&
        (s.costUnit || s.unit) === s.unit &&
        s.currency === w.profile.currency,
    )
    if (!sales.length || costed.length !== sales.length) {
      warnings.push(
        `${product.name}: the selected sales need a dated, compatible cost for each row. No sales rows does not confirm zero cost of goods sold.`,
      )
      return []
    }
    const costOfGoods = costed.reduce(
      (sum, s) =>
        sum + s.quantity! * s.unitCost! * (s.kind === 'return' ? -1 : 1),
      0,
    )
    const monetary = costed.filter(
      (s) => finite(s.amount) && netAmount(s.amountBasis),
    )
    const compatibleRevenue =
      monetary.length === costed.length &&
      new Set(monetary.map((s) => s.amountBasis.trim().toLowerCase())).size ===
        1
    const revenue = compatibleRevenue
      ? monetary.reduce(
          (sum, s) => sum + s.amount! * (s.kind === 'return' ? -1 : 1),
          0,
        )
      : null
    const averageInventory = valueDays / days,
      grossProfit = revenue === null ? null : revenue - costOfGoods
    return [
      {
        amountBasis: compatibleRevenue
          ? (monetary[0]?.amountBasis.trim().toLowerCase() ?? null)
          : null,
        productId: product.id,
        product: product.name,
        locationId: first.locationId,
        unit: product.unit,
        averageInventory,
        costOfGoods,
        grossProfit,
        turnover:
          averageInventory > 0 && costOfGoods >= 0
            ? costOfGoods / averageInventory
            : null,
        dio: costOfGoods > 0 ? (averageInventory / costOfGoods) * days : null,
        gmroi:
          averageInventory > 0 && grossProfit !== null
            ? grossProfit / averageInventory
            : null,
        estimatedDays,
        observedSalesDates: new Set(sales.map((s) => s.date)).size,
        sourceIds: [
          ...new Set([
            ...records.map((s) => s.sourceId),
            ...sales.map((s) => s.sourceId),
          ]),
        ],
      },
    ]
  })
  const averageInventory = rows.length
    ? rows.reduce((sum, row) => sum + row.averageInventory, 0)
    : null
  const costOfGoods = rows.length
    ? rows.reduce((sum, row) => sum + row.costOfGoods, 0)
    : null
  const grossProfit =
    rows.length &&
    new Set(rows.map((row) => row.amountBasis)).size === 1 &&
    rows.every((row) => row.grossProfit !== null)
      ? rows.reduce((sum, row) => sum + row.grossProfit!, 0)
      : null
  return {
    version: metricVersion,
    start,
    end,
    days,
    rows,
    warnings: [...new Set(warnings)],
    totalScopes: groups.length,
    averageInventory,
    costOfGoods,
    grossProfit,
    turnover:
      averageInventory !== null &&
      averageInventory > 0 &&
      costOfGoods !== null &&
      costOfGoods >= 0
        ? costOfGoods / averageInventory
        : null,
    dio:
      averageInventory !== null && costOfGoods !== null && costOfGoods > 0
        ? (averageInventory / costOfGoods) * days
        : null,
    gmroi:
      averageInventory !== null && averageInventory > 0 && grossProfit !== null
        ? grossProfit / averageInventory
        : null,
  }
}

export function serviceMetrics(
  w: Workspace,
  start: string,
  end: string,
  scope: CapabilityScope = {},
) {
  const observations = (w.serviceObservations ?? []).filter(
    (s) =>
      s.date >= start &&
      s.date <= end &&
      (!scope.productId || s.productId === scope.productId) &&
      (!scope.locationId || s.locationId === scope.locationId) &&
      (!scope.sourceId || s.sourceId === scope.sourceId),
  )
  return w.products
    .filter((p) => !scope.productId || p.id === scope.productId)
    .flatMap((product) => {
      const rows = observations.filter(
        (s) => s.productId === product.id && s.unit === product.unit,
      )
      if (!rows.length) return []
      const overlap =
        rows.some((s) => s.locationId === null) &&
        rows.some((s) => s.locationId !== null)
      const compatibleRows = overlap ? [] : rows
      const referenced = compatibleRows.filter((s) => s.orderReference),
        duplicateDemand =
          new Set(referenced.map((s) => `${s.date}|${s.orderReference}`))
            .size !== referenced.length
      const demand = (duplicateDemand ? [] : compatibleRows).filter(
        (s) =>
          finite(s.requested) &&
          s.requested >= 0 &&
          finite(s.fulfilled) &&
          s.fulfilled >= 0 &&
          s.fulfilled <= s.requested &&
          s.deadline === 'initial-request',
      )
      const requested = demand.reduce((sum, s) => sum + s.requested!, 0),
        fulfilled = demand.reduce((sum, s) => sum + s.fulfilled!, 0)
      const stock = compatibleRows.filter(
        (s) => finite(s.availableQuantity) && s.availableQuantity >= 0,
      )
      const samePhase = new Set(stock.map((s) => s.phase)).size <= 1
      const distinctStock = new Map(
        stock.map((s) => [
          `${s.date}|${s.locationId ?? 'aggregate'}|${s.phase}`,
          s,
        ]),
      )
      const duplicateStock = distinctStock.size !== stock.length
      const positive = stock.filter((s) => s.availableQuantity! > 0).length
      const lines = demand.filter((s) => s.requested! > 0)
      const durationRows = compatibleRows.filter((s) =>
        finite(s.observedMinutes),
      )
      const duplicateDuration =
        new Set(
          durationRows.map((s) => `${s.date}|${s.locationId ?? 'aggregate'}`),
        ).size !== durationRows.length
      const timed = (duplicateDuration ? [] : compatibleRows).filter(
        (s) =>
          finite(s.observedMinutes) &&
          s.observedMinutes > 0 &&
          finite(s.inStockMinutes) &&
          s.inStockMinutes >= 0 &&
          s.inStockMinutes <= s.observedMinutes,
      )
      const observedMinutes = timed.reduce(
        (sum, s) => sum + s.observedMinutes!,
        0,
      )
      return [
        {
          productId: product.id,
          product: product.name,
          unit: product.unit,
          rows: rows.length,
          demandRows: demand.length,
          requested: demand.length ? requested : null,
          fulfilled: demand.length ? fulfilled : null,
          fillRate: requested > 0 ? (fulfilled / requested) * 100 : null,
          lineFill: lines.length
            ? (lines.filter((s) => s.fulfilled === s.requested).length /
                lines.length) *
              100
            : null,
          lines: lines.length,
          unmet: demand.length ? requested - fulfilled : null,
          unmetDays: new Set(
            demand
              .filter((s) => s.fulfilled! < s.requested!)
              .map((s) => s.date),
          ).size,
          inStockRate:
            stock.length && samePhase && !duplicateStock
              ? (positive / stock.length) * 100
              : null,
          stockObservations: stock.length,
          zeroStockDays:
            samePhase && !duplicateStock
              ? stock.filter((s) => s.availableQuantity === 0).length
              : null,
          phase: stock[0]?.phase ?? null,
          observedMinutes,
          unavailableMinutes: observedMinutes
            ? observedMinutes -
              timed.reduce((sum, s) => sum + s.inStockMinutes!, 0)
            : null,
          issue: overlap
            ? 'Aggregate and location service scopes overlap; reconcile before combining.'
            : duplicateDemand
              ? 'Repeated product/order-reference/requested-date observations need reconciliation.'
              : duplicateDuration
                ? 'Repeated date/location duration windows need reconciliation.'
                : duplicateStock
                  ? 'Repeated date/location/phase availability observations must be reconciled.'
                  : !samePhase
                    ? 'Opening and closing observations cannot be combined in one in-stock rate.'
                    : null,
          sourceIds: [...new Set(rows.map((s) => s.sourceId))],
        },
      ]
    })
}

export function agingMetrics(
  w: Workspace,
  asOf: string,
  scope: CapabilityScope = {},
) {
  return w.products
    .filter((p) => !scope.productId || p.id === scope.productId)
    .flatMap((product) => {
      const positions = w.stock.filter(
        (s) =>
          s.productId === product.id &&
          (!scope.locationId || s.locationId === scope.locationId) &&
          s.asOf === asOf &&
          s.quantityBasis !== 'available',
      )
      const overlap =
        positions.some((s) => s.locationId === null) &&
        positions.some((s) => s.locationId !== null)
      const onHand =
        positions.length && !overlap
          ? positions.reduce((sum, s) => sum + s.onHand, 0)
          : null
      const layers = (w.inventoryLayers ?? []).filter(
        (s) =>
          s.productId === product.id &&
          (!scope.locationId || s.locationId === scope.locationId) &&
          (!scope.sourceId || s.sourceId === scope.sourceId) &&
          s.asOf === asOf &&
          positions.some((position) => position.locationId === s.locationId) &&
          s.unit === product.unit &&
          s.receiptDate <= asOf &&
          finite(s.remainingQuantity) &&
          s.remainingQuantity >= 0,
      )
      if (!layers.length && !positions.length) return []
      const knownQuantity = layers.reduce(
        (sum, s) => sum + s.remainingQuantity,
        0,
      )
      const consistent = onHand !== null && onHand >= knownQuantity
      const bands = [
        { label: '0–30 days', min: 0, max: 30 },
        { label: '31–90 days', min: 31, max: 90 },
        { label: '91+ days', min: 91, max: Infinity },
      ].map((b) => ({
        ...b,
        quantity:
          consistent && layers.length
            ? layers
                .filter((s) => {
                  const age = Math.floor(
                    dayNumber(asOf) - dayNumber(s.receiptDate),
                  )
                  return age >= b.min && age <= b.max
                })
                .reduce((sum, s) => sum + s.remainingQuantity, 0)
            : null,
      }))
      const target =
        !scope.locationId &&
        finite(product.targetStock) &&
        product.targetStock >= 0
          ? product.targetStock
          : null
      return [
        {
          productId: product.id,
          product: product.name,
          unit: product.unit,
          onHand,
          knownQuantity: layers.length ? knownQuantity : null,
          unaged: consistent ? onHand! - knownQuantity : null,
          bands,
          target,
          excess:
            target !== null && onHand !== null
              ? Math.max(0, onHand - target)
              : null,
          excessValue:
            target !== null && onHand !== null && finite(product.cost)
              ? Math.max(0, onHand - target) * product.cost
              : null,
          issue: overlap
            ? 'Aggregate and location positions overlap.'
            : layers.length && !consistent
              ? 'Receipt layers need a matching as-of stock quantity and must not exceed it.'
              : null,
          sourceIds: [...new Set(layers.map((s) => s.sourceId))],
        },
      ]
    })
}

export function historicalDemandMetrics(
  w: Workspace,
  start: string,
  end: string,
  locationId = '',
  slowThreshold = 0,
) {
  const days = Math.round(dayNumber(end) - dayNumber(start)) + 1
  return w.products.map((product) => {
    const sales = w.sales.filter(
      (s) =>
        s.productId === product.id &&
        s.date >= start &&
        s.date <= end &&
        (!locationId || s.locationId === locationId),
    )
    const eligible = sales.filter(
        (s) => finite(s.quantity) && s.quantity >= 0 && s.unit === product.unit,
      ),
      dates = new Set(eligible.map((s) => s.date))
    const complete =
      days > 0 && eligible.length === sales.length && dates.size === days
    const units = eligible.reduce(
      (sum, s) => sum + s.quantity! * (s.kind === 'return' ? -1 : 1),
      0,
    )
    const positions = w.stock.filter(
        (s) =>
          s.productId === product.id &&
          (!locationId || s.locationId === locationId),
      ),
      overlap =
        positions.some((s) => s.locationId === null) &&
        positions.some((s) => s.locationId !== null)
    const available =
      positions.length &&
      !overlap &&
      positions.every(
        (s) => s.quantityBasis === 'available' || s.reserved !== null,
      )
        ? positions.reduce(
            (sum, s) =>
              sum +
              s.onHand -
              (s.quantityBasis === 'available' ? 0 : s.reserved!),
            0,
          )
        : null
    const dailyRate = complete ? units / days : null
    return {
      productId: product.id,
      product: product.name,
      unit: product.unit,
      observedDates: dates.size,
      days,
      units: eligible.length ? units : null,
      dailyRate,
      available,
      asOf: [...new Set(positions.map((s) => s.asOf))].join(', '),
      daysSupply:
        available !== null &&
        available >= 0 &&
        dailyRate !== null &&
        dailyRate > 0
          ? available / dailyRate
          : null,
      slowMoving: complete ? units <= slowThreshold : null,
    }
  })
}

export function historicalStockValue(
  w: Workspace,
  date: string,
  scope: CapabilityScope = {},
) {
  const snapshots = (w.inventoryHistory ?? []).filter(
    (s) =>
      s.asOf <= date &&
      s.throughDate >= date &&
      (!scope.locationId || s.locationId === scope.locationId) &&
      (!scope.productId || s.productId === scope.productId) &&
      (!scope.sourceId || s.sourceId === scope.sourceId),
  )
  const groups = [
      ...new Set(snapshots.map((s) => key(s.productId, s.locationId))),
    ],
    warnings: string[] = []
  const rows = groups.flatMap((group) => {
    const matching = snapshots.filter(
        (s) => key(s.productId, s.locationId) === group,
      ),
      first = matching[0],
      product = w.products.find((p) => p.id === first.productId)
    if (!product) return []
    if (
      matching.length !== 1 ||
      (!scope.locationId &&
        snapshots.some(
          (s) =>
            s.productId === first.productId &&
            (s.locationId === null) !== (first.locationId === null),
        ))
    ) {
      warnings.push(
        `${product.name}: overlapping cost observations are excluded.`,
      )
      return []
    }
    if (
      first.unit !== product.unit ||
      first.currency !== w.profile.currency ||
      !finite(first.quantity) ||
      first.quantity < 0 ||
      !finite(first.unitCost) ||
      first.unitCost < 0 ||
      (first.method === 'daily-observed' && first.asOf !== first.throughDate)
    ) {
      warnings.push(
        `${product.name}: incompatible historical quantity, cost or observation method.`,
      )
      return []
    }
    return [
      {
        productId: product.id,
        product: product.name,
        locationId: first.locationId,
        value: first.quantity * first.unitCost,
        quantity: first.quantity,
        unit: first.unit,
        unitCost: first.unitCost,
        estimated: first.method === 'constant-estimate',
        sourceId: first.sourceId,
      },
    ]
  })
  return {
    date,
    rows,
    value: rows.length ? rows.reduce((sum, row) => sum + row.value, 0) : null,
    count: rows.length,
    total: groups.length,
    estimated: rows.filter((row) => row.estimated).length,
    warnings,
  }
}

export function supplierHistory(
  w: Workspace,
  start: string,
  end: string,
  locationId = '',
) {
  const through = end < cutoff(w) ? end : cutoff(w)
  const purchases = w.purchases.filter(
    (p) => !locationId || p.locationId === locationId,
  )
  const received = purchases.filter(
    (p) =>
      p.receivedDate &&
      p.receivedDate >= start &&
      p.receivedDate <= through &&
      p.orderDate &&
      p.orderDate <= p.receivedDate &&
      p.receivedQuantity > 0,
  )
  const groups = [
    ...new Set(received.map((p) => `${p.supplierId}|${p.productId}`)),
  ]
  const observations = groups.map((group) => {
    const rows = received.filter(
        (p) => `${p.supplierId}|${p.productId}` === group,
      ),
      first = rows[0],
      days = rows.map(
        (p) => dayNumber(p.receivedDate!) - dayNumber(p.orderDate!),
      ),
      mean = days.reduce((a, b) => a + b, 0) / days.length
    return {
      supplierId: first.supplierId,
      productId: first.productId,
      supplier:
        w.suppliers.find((s) => s.id === first.supplierId)?.name ??
        'Unknown supplier',
      product:
        w.products.find((p) => p.id === first.productId)?.name ??
        first.productId,
      quoted:
        w.products.find((p) => p.id === first.productId)?.leadTimeDays ?? null,
      count: rows.length,
      mean,
      standardDeviation:
        rows.length > 1
          ? Math.sqrt(
              days.reduce((sum, day) => sum + (day - mean) ** 2, 0) /
                (days.length - 1),
            )
          : null,
      partial: rows.filter((p) => p.receivedQuantity < p.quantity).length,
      orderIds: rows.map((p) => p.id),
      sourceIds: [
        ...new Set(rows.flatMap((p) => (p.sourceId ? [p.sourceId] : []))),
      ],
    }
  })
  const open = purchases
    .filter(
      (p) =>
        p.orderDate &&
        p.orderDate <= through &&
        (!p.receivedDate ||
          p.receivedDate > through ||
          p.receivedQuantity < p.quantity),
    )
    .map((p) => ({
      ...p,
      age: dayNumber(through) - dayNumber(p.orderDate!),
      remaining:
        p.receivedDate && p.receivedDate <= through
          ? Math.max(0, p.quantity - p.receivedQuantity)
          : p.quantity,
      overdue: Boolean(p.promisedDate && p.promisedDate < through),
    }))
  return {
    through,
    observations,
    open,
    eligibleOrders: purchases.filter(
      (p) =>
        p.receivedDate && p.receivedDate >= start && p.receivedDate <= through,
    ).length,
    measuredOrders: received.length,
    supplierCount: new Set(received.map((p) => p.supplierId)).size,
    totalSuppliers: new Set(purchases.map((p) => p.supplierId)).size,
    unallocated: w.purchases.filter((p) => !p.locationId).length,
  }
}

export function serviceConsequences(
  w: Workspace,
  start: string,
  end: string,
  locationId = '',
) {
  const observations = (w.serviceObservations ?? []).filter(
    (s) =>
      s.date >= start &&
      s.date <= end &&
      (!locationId || s.locationId === locationId),
  )
  const rows = observations.flatMap((record) => {
    const product = w.products.find((p) => p.id === record.productId)
    if (!product || record.unit !== product.unit) return []
    const overlap =
      !locationId &&
      observations.some(
        (s) =>
          s.productId === record.productId &&
          (s.locationId === null) !== (record.locationId === null),
      )
    const duplicate = Boolean(
      record.orderReference &&
        observations.some(
          (s) =>
            s.id !== record.id &&
            s.productId === record.productId &&
            s.date === record.date &&
            s.orderReference === record.orderReference,
        ),
    )
    const unmet =
      !overlap &&
      !duplicate &&
      finite(record.requested) &&
      finite(record.fulfilled) &&
      record.requested >= record.fulfilled &&
      record.fulfilled >= 0
        ? record.requested - record.fulfilled
        : null
    const lost = record.unmetDisposition === 'lost' ? unmet : null
    const remaining =
      record.unmetDisposition === 'backordered' &&
      unmet !== null &&
      finite(record.backlogRemaining) &&
      record.backlogRemaining >= 0 &&
      record.backlogRemaining <= unmet &&
      record.backlogAsOf &&
      record.backlogAsOf >= record.date &&
      record.backlogAsOf <= end
        ? record.backlogRemaining
        : null
    return [
      {
        ...record,
        product: product.name,
        unmet,
        lost,
        estimatedLostMargin:
          lost !== null &&
          finite(record.lostUnitMargin) &&
          record.lostMarginBasis?.trim()
            ? lost * record.lostUnitMargin
            : null,
        remaining,
        backlogAge:
          remaining !== null && record.backlogAsOf
            ? dayNumber(record.backlogAsOf) - dayNumber(record.date)
            : null,
        deliveryDaysAfterDeadline:
          record.orderReference &&
          record.deliveredDate &&
          record.deliveredDate <= end
            ? dayNumber(record.deliveredDate) - dayNumber(record.date)
            : null,
        issue: overlap
          ? 'Aggregate and location observations overlap; derived demand is excluded.'
          : duplicate
            ? 'Duplicate product/order-reference/requested-date observations; reconcile before deriving consequences.'
            : null,
      },
    ]
  })
  const targets = serviceMetrics(w, start, end, {
    locationId: locationId || undefined,
  }).flatMap((row) => {
    const product = w.products.find((p) => p.id === row.productId)!
    if (
      locationId ||
      !finite(product.serviceTarget) ||
      product.serviceTarget < 0 ||
      product.serviceTarget > 100 ||
      !product.serviceTargetBasis
    )
      return []
    const measured =
      product.serviceTargetBasis === 'initial-unit-fill'
        ? row.fillRate
        : row.phase === 'closing'
          ? row.inStockRate
          : null
    return [
      {
        product: product.name,
        basis: product.serviceTargetBasis,
        target: product.serviceTarget,
        measured,
        percentagePoints:
          measured === null ? null : measured - product.serviceTarget,
      },
    ]
  })
  return { rows, targets }
}
