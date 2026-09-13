import type { Workspace, Purchase, Product, Supplier } from "./workspace"
import { cutoff, shiftDate } from "./workspace"

export type BusinessTypeKey =
  | "wholesale_distributor"
  | "ecommerce"
  | "retail"
  | "manufacturer"
  | "food_beverage"
  | "logistics_3pl"
  | "general"

export interface BusinessTypeProfile {
  key: BusinessTypeKey
  label: string
  description: string
  benchmarkScore: number
  typicalCO2PerShipmentKg: number
  pillarWeights: {
    shipments: number
    sourcing: number
    inventory: number
    packaging: number
  }
}

export const BUSINESS_PROFILES: Record<BusinessTypeKey, BusinessTypeProfile> = {
  wholesale_distributor: {
    key: "wholesale_distributor",
    label: "Wholesale Distributor",
    description:
      "High freight volume from diverse suppliers, palletized fulfillment, and regional warehousing. Shipment consolidation is primary.",
    benchmarkScore: 72,
    typicalCO2PerShipmentKg: 42,
    pillarWeights: {
      shipments: 0.4,
      sourcing: 0.2,
      inventory: 0.2,
      packaging: 0.2,
    },
  },
  ecommerce: {
    key: "ecommerce",
    label: "eCommerce / Direct-to-Consumer",
    description:
      "High parcel delivery cadence, individual customer dispatches, fast-paced small-batch replenishment, and packaging waste.",
    benchmarkScore: 68,
    typicalCO2PerShipmentKg: 28,
    pillarWeights: {
      shipments: 0.45,
      sourcing: 0.15,
      inventory: 0.15,
      packaging: 0.25,
    },
  },
  retail: {
    key: "retail",
    label: "Retail Store / Multi-store",
    description:
      "Store-level replenishments, regular supplier delivery drops, customer foot-traffic, and shelf presentation.",
    benchmarkScore: 70,
    typicalCO2PerShipmentKg: 35,
    pillarWeights: {
      shipments: 0.35,
      sourcing: 0.25,
      inventory: 0.25,
      packaging: 0.15,
    },
  },
  manufacturer: {
    key: "manufacturer",
    label: "Manufacturer / Light Assembly",
    description:
      "Heavy raw material intake, long-haul component supply chains, production batching, and high freight mass.",
    benchmarkScore: 65,
    typicalCO2PerShipmentKg: 75,
    pillarWeights: {
      shipments: 0.35,
      sourcing: 0.35,
      inventory: 0.2,
      packaging: 0.1,
    },
  },
  food_beverage: {
    key: "food_beverage",
    label: "Food & Beverage / Perishables",
    description:
      "Frequent deliveries for shelf-life management, refrigerated cold-chain transport (+40% CO2), and spoilage risk.",
    benchmarkScore: 64,
    typicalCO2PerShipmentKg: 55,
    pillarWeights: {
      shipments: 0.35,
      sourcing: 0.2,
      inventory: 0.35,
      packaging: 0.1,
    },
  },
  logistics_3pl: {
    key: "logistics_3pl",
    label: "Logistics / 3PL & Freight",
    description:
      "High transport throughput, freight consolidation, multi-client warehousing, and route density.",
    benchmarkScore: 74,
    typicalCO2PerShipmentKg: 40,
    pillarWeights: {
      shipments: 0.5,
      sourcing: 0.2,
      inventory: 0.2,
      packaging: 0.1,
    },
  },
  general: {
    key: "general",
    label: "General Trading / Commercial",
    description:
      "Balanced commercial distribution, inventory management, and standard fulfillment operations.",
    benchmarkScore: 70,
    typicalCO2PerShipmentKg: 38,
    pillarWeights: {
      shipments: 0.3,
      sourcing: 0.25,
      inventory: 0.25,
      packaging: 0.2,
    },
  },
}

export function resolveBusinessType(raw?: string): BusinessTypeProfile {
  if (!raw || !raw.trim()) {
    return BUSINESS_PROFILES.wholesale_distributor
  }
  const text = raw.trim().toLowerCase()
  if (
    text.includes("distributor") ||
    text.includes("wholesale") ||
    text.includes("mayoreo")
  ) {
    return BUSINESS_PROFILES.wholesale_distributor
  }
  if (
    text.includes("ecommerce") ||
    text.includes("e-commerce") ||
    text.includes("d2c") ||
    text.includes("online")
  ) {
    return BUSINESS_PROFILES.ecommerce
  }
  if (
    text.includes("retail") ||
    text.includes("store") ||
    text.includes("tienda") ||
    text.includes("comercio")
  ) {
    return BUSINESS_PROFILES.retail
  }
  if (
    text.includes("manufactur") ||
    text.includes("assembly") ||
    text.includes("fabrica") ||
    text.includes("producci")
  ) {
    return BUSINESS_PROFILES.manufacturer
  }
  if (
    text.includes("food") ||
    text.includes("beverage") ||
    text.includes("alimento") ||
    text.includes("perish") ||
    text.includes("restaur")
  ) {
    return BUSINESS_PROFILES.food_beverage
  }
  if (
    text.includes("logistics") ||
    text.includes("3pl") ||
    text.includes("transporte") ||
    text.includes("freight")
  ) {
    return BUSINESS_PROFILES.logistics_3pl
  }
  return BUSINESS_PROFILES.general
}

export interface ShipmentEvent {
  id: string
  date: string
  supplierId: string
  supplierName: string
  locationId: string | null
  purchaseIds: string[]
  productIds: string[]
  totalQuantity: number
  totalAmount: number
  estimatedCO2Kg: number
  isFragmented: boolean
  windowGroupKey: string
}

export interface CarbonFootprint {
  totalCO2Kg: number
  incomingShipmentsCO2Kg: number
  holdingDeadStockCO2Kg: number
  shipmentCount: number
  unitsReceived: number
  avgCO2PerShipmentKg: number
  avgUnitsPerShipment: number
  fragmentedShipmentCount: number
  avoidableCO2Kg: number
  consolidationEfficiencyPct: number
  shipments: ShipmentEvent[]
  supplierBreakdown: {
    supplierId: string
    supplierName: string
    shipmentCount: number
    totalUnits: number
    co2Kg: number
    avoidableCO2Kg: number
    fragmentedCount: number
  }[]
  monthlyCO2Series: { month: string; co2Kg: number; shipments: number }[]
}

export interface PillarScore {
  name: string
  score: number
  weight: number
  weightedScore: number
  description: string
  rating: "Exceptional" | "Good" | "Moderate" | "Poor"
}

export type ScoreGrade = "A" | "B" | "C" | "D" | "F"

export interface SustainabilityRecommendation {
  id: string
  title: string
  priority: "high" | "medium" | "low"
  category: "Logistics" | "Sourcing" | "Inventory" | "Packaging"
  description: string
  actionableSteps: string[]
  co2ReductionKg: number
  scoreBoost: number
  evidence: string
  actionLabel: string
  targetPage: string
  targetQuery?: string
}

export interface SustainabilityAssessment {
  businessProfile: BusinessTypeProfile
  overallScore: number
  grade: ScoreGrade
  gradeLabel: string
  statusMessage: string
  footprint: CarbonFootprint
  pillars: {
    shipments: PillarScore
    sourcing: PillarScore
    inventory: PillarScore
    packaging: PillarScore
  }
  recommendations: SustainabilityRecommendation[]
  asOfDate: string
}

export function groupShipmentEvents(
  purchases: Purchase[],
  suppliers: Supplier[],
  products: Product[],
  profile: BusinessTypeProfile,
): ShipmentEvent[] {
  const supplierMap = new Map<string, string>()
  suppliers.forEach((s) => supplierMap.set(s.id, s.name))

  const productMap = new Map<string, Product>()
  products.forEach((p) => productMap.set(p.id, p))

  const groups = new Map<
    string,
    {
      date: string
      supplierId: string
      locationId: string | null
      purchases: Purchase[]
    }
  >()

  for (const p of purchases) {
    const date = p.receivedDate || p.orderDate
    if (!date) continue
    const key = `${p.supplierId}::${date}::${p.locationId ?? "none"}`
    const existing = groups.get(key)
    if (existing) {
      existing.purchases.push(p)
    } else {
      groups.set(key, {
        date,
        supplierId: p.supplierId,
        locationId: p.locationId ?? null,
        purchases: [p],
      })
    }
  }

  const rawShipments = Array.from(groups.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  )

  const supplierShipments = new Map<
    string,
    { date: string; index: number; groupKey: string }[]
  >()

  rawShipments.forEach((s, index) => {
    const list = supplierShipments.get(s.supplierId) ?? []
    list.push({ date: s.date, index, groupKey: "" })
    supplierShipments.set(s.supplierId, list)
  })

  for (const [, list] of supplierShipments) {
    if (list.length === 0) continue
    let currentWindowStart = list[0].date
    let windowId = 1
    for (let i = 0; i < list.length; i++) {
      const diffDays =
        (Date.parse(list[i].date) - Date.parse(currentWindowStart)) / 86_400_000
      if (diffDays > 7) {
        currentWindowStart = list[i].date
        windowId++
      }
      list[i].groupKey = `win-${windowId}`
    }
  }

  const events: ShipmentEvent[] = rawShipments.map((group, idx) => {
    const supList = supplierShipments.get(group.supplierId) ?? []
    const winEntry = supList.find((item) => item.index === idx)
    const windowGroupKey = winEntry
      ? `${group.supplierId}-${winEntry.groupKey}`
      : `win-${idx}`

    const sameWindowCount = supList.filter(
      (item) => item.groupKey === (winEntry?.groupKey ?? ""),
    ).length
    const isFragmented = sameWindowCount > 1

    const totalQuantity = group.purchases.reduce(
      (sum, p) => sum + (p.receivedQuantity > 0 ? p.receivedQuantity : p.quantity),
      0,
    )
    const totalAmount = group.purchases.reduce(
      (sum, p) => sum + (p.amount ?? 0),
      0,
    )
    const purchaseIds = group.purchases.map((p) => p.id)
    const productIds = Array.from(
      new Set(group.purchases.map((p) => p.productId)),
    )

    const maxLeadTime = productIds.reduce((max, pid) => {
      const lead = productMap.get(pid)?.leadTimeDays ?? 5
      return Math.max(max, lead)
    }, 5)

    let baseTripCO2 = 45
    if (maxLeadTime <= 3) {
      baseTripCO2 = 15
    } else if (maxLeadTime > 14) {
      baseTripCO2 = 110
    }

    const unitCO2 = totalQuantity * 0.08

    const isColdChain =
      profile.key === "food_beverage" ||
      productIds.some((pid) => {
        const cat = productMap.get(pid)?.category?.toLowerCase() ?? ""
        return (
          cat.includes("food") ||
          cat.includes("beverage") ||
          cat.includes("cold") ||
          cat.includes("perishable")
        )
      })

    const estimatedCO2Kg = Math.round(
      (baseTripCO2 + unitCO2) * (isColdChain ? 1.4 : 1.0),
    )

    return {
      id: `shipment-${idx + 1}`,
      date: group.date,
      supplierId: group.supplierId,
      supplierName: supplierMap.get(group.supplierId) || "Unknown supplier",
      locationId: group.locationId,
      purchaseIds,
      productIds,
      totalQuantity,
      totalAmount,
      estimatedCO2Kg,
      isFragmented,
      windowGroupKey,
    }
  })

  return events
}

export function calculateCarbonFootprint(
  workspace: Workspace,
  profile: BusinessTypeProfile,
): CarbonFootprint {
  const shipments = groupShipmentEvents(
    workspace.purchases,
    workspace.suppliers,
    workspace.products,
    profile,
  )

  const incomingShipmentsCO2Kg = shipments.reduce(
    (sum, s) => sum + s.estimatedCO2Kg,
    0,
  )
  const unitsReceived = shipments.reduce((sum, s) => sum + s.totalQuantity, 0)
  const shipmentCount = shipments.length

  const windowCounts = new Map<string, ShipmentEvent[]>()
  shipments.forEach((s) => {
    const list = windowCounts.get(s.windowGroupKey) ?? []
    list.push(s)
    windowCounts.set(s.windowGroupKey, list)
  })

  let avoidableCO2Kg = 0
  let fragmentedShipmentCount = 0

  windowCounts.forEach((list) => {
    if (list.length > 1) {
      fragmentedShipmentCount += list.length
      const extraTrips = list.length - 1
      const avgTripBase = profile.typicalCO2PerShipmentKg * 0.75
      avoidableCO2Kg += Math.round(extraTrips * avgTripBase)
    }
  })

  const asOf = cutoff(workspace)
  const recentCutoff = shiftDate(asOf, -60)
  const recentSaleProducts = new Set(
    workspace.sales
      .filter((s) => s.date >= recentCutoff)
      .map((s) => s.productId),
  )

  const stagnantStockUnits = workspace.stock
    .filter((s) => !recentSaleProducts.has(s.productId))
    .reduce((sum, s) => sum + Math.max(0, s.onHand), 0)

  const isColdChain = profile.key === "food_beverage"
  const holdingDeadStockCO2Kg = Math.round(
    stagnantStockUnits * (isColdChain ? 0.25 : 0.08),
  )

  const totalCO2Kg = incomingShipmentsCO2Kg + holdingDeadStockCO2Kg

  const avgCO2PerShipmentKg =
    shipmentCount > 0 ? Math.round(incomingShipmentsCO2Kg / shipmentCount) : 0
  const avgUnitsPerShipment =
    shipmentCount > 0 ? Math.round(unitsReceived / shipmentCount) : 0

  const consolidationEfficiencyPct =
    shipmentCount > 0
      ? Math.round(
          ((shipmentCount -
            (fragmentedShipmentCount > 0
              ? fragmentedShipmentCount - windowCounts.size
              : 0)) /
            shipmentCount) *
            100,
        )
      : 100

  const supplierAgg = new Map<
    string,
    {
      supplierId: string
      supplierName: string
      shipmentCount: number
      totalUnits: number
      co2Kg: number
      avoidableCO2Kg: number
      fragmentedCount: number
    }
  >()

  shipments.forEach((s) => {
    const existing = supplierAgg.get(s.supplierId) ?? {
      supplierId: s.supplierId,
      supplierName: s.supplierName,
      shipmentCount: 0,
      totalUnits: 0,
      co2Kg: 0,
      avoidableCO2Kg: 0,
      fragmentedCount: 0,
    }
    existing.shipmentCount++
    existing.totalUnits += s.totalQuantity
    existing.co2Kg += s.estimatedCO2Kg
    if (s.isFragmented) existing.fragmentedCount++
    supplierAgg.set(s.supplierId, existing)
  })

  windowCounts.forEach((list) => {
    if (list.length > 1) {
      const supId = list[0].supplierId
      const agg = supplierAgg.get(supId)
      if (agg) {
        agg.avoidableCO2Kg += Math.round(
          (list.length - 1) * profile.typicalCO2PerShipmentKg * 0.75,
        )
      }
    }
  })

  const supplierBreakdown = Array.from(supplierAgg.values()).sort(
    (a, b) => b.co2Kg - a.co2Kg,
  )

  const monthlyMap = new Map<string, { co2Kg: number; shipments: number }>()
  shipments.forEach((s) => {
    const month = s.date.slice(0, 7)
    const cur = monthlyMap.get(month) ?? { co2Kg: 0, shipments: 0 }
    cur.co2Kg += s.estimatedCO2Kg
    cur.shipments++
    monthlyMap.set(month, cur)
  })

  const monthlyCO2Series = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }))

  return {
    totalCO2Kg,
    incomingShipmentsCO2Kg,
    holdingDeadStockCO2Kg,
    shipmentCount,
    unitsReceived,
    avgCO2PerShipmentKg,
    avgUnitsPerShipment,
    fragmentedShipmentCount,
    avoidableCO2Kg,
    consolidationEfficiencyPct,
    shipments,
    supplierBreakdown,
    monthlyCO2Series,
  }
}

export function calculateSustainabilityScore(
  workspace: Workspace,
  profile: BusinessTypeProfile,
  footprint: CarbonFootprint,
): {
  overallScore: number
  grade: ScoreGrade
  gradeLabel: string
  statusMessage: string
  pillars: {
    shipments: PillarScore
    sourcing: PillarScore
    inventory: PillarScore
    packaging: PillarScore
  }
} {
  let shipmentScore = 80
  if (footprint.shipmentCount > 0) {
    const fragRatio =
      footprint.fragmentedShipmentCount / footprint.shipmentCount
    const consolidationPenalty = Math.round(fragRatio * 45)

    let batchBonus = 0
    if (footprint.avgUnitsPerShipment >= 100) batchBonus = 10
    else if (footprint.avgUnitsPerShipment < 25) batchBonus = -10

    shipmentScore = Math.max(
      30,
      Math.min(100, 95 - consolidationPenalty + batchBonus),
    )
  }

  let sourcingScore = 75
  if (workspace.products.length > 0) {
    const productsWithLead = workspace.products.filter(
      (p) => p.leadTimeDays !== null && p.leadTimeDays !== undefined,
    )
    if (productsWithLead.length > 0) {
      const avgLeadTime =
        productsWithLead.reduce((sum, p) => sum + (p.leadTimeDays ?? 0), 0) /
        productsWithLead.length

      if (avgLeadTime <= 5) {
        sourcingScore = 92
      } else if (avgLeadTime <= 10) {
        sourcingScore = 84
      } else if (avgLeadTime <= 20) {
        sourcingScore = 70
      } else {
        sourcingScore = 55
      }
    }
  }

  let inventoryScore = 82
  const totalStockUnits = workspace.stock.reduce(
    (sum, s) => sum + Math.max(0, s.onHand),
    0,
  )
  if (totalStockUnits > 0) {
    const asOf = cutoff(workspace)
    const recentCutoff = shiftDate(asOf, -60)
    const activeProducts = new Set(
      workspace.sales
        .filter((s) => s.date >= recentCutoff)
        .map((s) => s.productId),
    )
    const deadUnits = workspace.stock
      .filter((s) => !activeProducts.has(s.productId))
      .reduce((sum, s) => sum + Math.max(0, s.onHand), 0)

    const deadRatio = deadUnits / totalStockUnits
    if (deadRatio > 0.4) {
      inventoryScore = 45
    } else if (deadRatio > 0.2) {
      inventoryScore = 65
    } else if (deadRatio > 0.05) {
      inventoryScore = 82
    } else {
      inventoryScore = 95
    }
  }

  let packagingScore = 80
  if (workspace.purchases.length > 0) {
    let alignedCount = 0
    let totalChecked = 0
    const prodMap = new Map(workspace.products.map((p) => [p.id, p]))

    for (const p of workspace.purchases) {
      const prod = prodMap.get(p.productId)
      if (!prod) continue
      totalChecked++
      const moqValid = prod.moq ? p.quantity >= prod.moq : true
      const casePackValid = prod.casePack
        ? p.quantity % prod.casePack === 0
        : true
      if (moqValid && casePackValid) {
        alignedCount++
      }
    }

    if (totalChecked > 0) {
      packagingScore = Math.round(
        50 + (alignedCount / totalChecked) * 45,
      )
    }
  }

  const weights = profile.pillarWeights
  const weightedTotal =
    shipmentScore * weights.shipments +
    sourcingScore * weights.sourcing +
    inventoryScore * weights.inventory +
    packagingScore * weights.packaging

  const overallScore = Math.round(Math.max(20, Math.min(100, weightedTotal)))

  let grade: ScoreGrade
  let gradeLabel: string
  let statusMessage: string

  if (overallScore >= 90) {
    grade = "A"
    gradeLabel = "Exceptional Sustainability"
    statusMessage =
      "Outstanding transport consolidation, efficient supplier lead times, and lean warehouse inventory."
  } else if (overallScore >= 80) {
    grade = "B"
    gradeLabel = "Good Environmental Performance"
    statusMessage =
      "Controlled delivery frequency and low emissions. Minor consolidation opportunities remain."
  } else if (overallScore >= 70) {
    grade = "C"
    gradeLabel = "Moderate Environmental Impact"
    statusMessage =
      "Frequent small shipments and unbatched reorders produce elevated CO2 emissions."
  } else if (overallScore >= 60) {
    grade = "D"
    gradeLabel = "High Carbon Intensity"
    statusMessage =
      "Unconsolidated shipments and high delivery cadence produce significant excess CO2."
  } else {
    grade = "F"
    gradeLabel = "Critical Carbon Footprint"
    statusMessage =
      "Severe delivery fragmentation and stagnant inventory footprint require immediate intervention."
  }

  const getRating = (val: number): PillarScore["rating"] => {
    if (val >= 85) return "Exceptional"
    if (val >= 75) return "Good"
    if (val >= 60) return "Moderate"
    return "Poor"
  }

  return {
    overallScore,
    grade,
    gradeLabel,
    statusMessage,
    pillars: {
      shipments: {
        name: "Logistics & Shipment Consolidation",
        score: shipmentScore,
        weight: weights.shipments,
        weightedScore: Math.round(shipmentScore * weights.shipments),
        description:
          "Evaluates delivery frequency, shipment batch sizing, and freight trip consolidation.",
        rating: getRating(shipmentScore),
      },
      sourcing: {
        name: "Supplier Network & Locality",
        score: sourcingScore,
        weight: weights.sourcing,
        weightedScore: Math.round(sourcingScore * weights.sourcing),
        description:
          "Measures transit distance proxy and supplier lead times for domestic vs long-haul freight.",
        rating: getRating(sourcingScore),
      },
      inventory: {
        name: "Inventory Waste & Holding Footprint",
        score: inventoryScore,
        weight: weights.inventory,
        weightedScore: Math.round(inventoryScore * weights.inventory),
        description:
          "Penalizes stagnant and dead stock consuming continuous warehouse lighting, HVAC, and energy.",
        rating: getRating(inventoryScore),
      },
      packaging: {
        name: "Packaging & Batch Sizing",
        score: packagingScore,
        weight: weights.packaging,
        weightedScore: Math.round(packagingScore * weights.packaging),
        description:
          "Rewards purchasing in full case-pack and pallet multiples to optimize truck cubic fill.",
        rating: getRating(packagingScore),
      },
    },
  }
}

export function generateSustainabilityRecommendations(
  workspace: Workspace,
  profile: BusinessTypeProfile,
  footprint: CarbonFootprint,
  pillars: {
    shipments: PillarScore
    sourcing: PillarScore
    inventory: PillarScore
    packaging: PillarScore
  },
): SustainabilityRecommendation[] {
  const recommendations: SustainabilityRecommendation[] = []

  if ((footprint.fragmentedShipmentCount > 0 && footprint.avoidableCO2Kg > 0) || pillars.shipments.score < 75) {
    const topFragmentedSup = footprint.supplierBreakdown.find(
      (s) => s.fragmentedCount > 1,
    )
    const supName = topFragmentedSup?.supplierName ?? "primary suppliers"
    recommendations.push({
      id: "rec-consolidate-shipments",
      title: "Consolidate Incoming Supplier Shipments into Weekly Delivery Windows",
      priority: "high",
      category: "Logistics",
      description:
        "Receiving multiple separate shipments within short windows significantly inflates freight transport emissions. Grouping purchase orders into scheduled weekly or bi-weekly receiving slots drastically reduces delivery vehicle miles.",
      actionableSteps: [
        `Align purchase order schedules with ${supName} to deliver in a single designated weekly delivery window.`,
        "Coordinate minimum order batching across multiple SKUs from the same supplier.",
        "Shift from on-demand fragmented purchase orders to synchronized periodic replenishment.",
      ],
      co2ReductionKg: footprint.avoidableCO2Kg,
      scoreBoost: Math.min(14, Math.round((footprint.avoidableCO2Kg / Math.max(1, footprint.incomingShipmentsCO2Kg)) * 25) + 4),
      evidence: `Detected ${footprint.fragmentedShipmentCount} shipments arriving within 7 days from identical suppliers, generating ~${footprint.avoidableCO2Kg} kg of avoidable transport CO2.`,
      actionLabel: "Review Purchases",
      targetPage: "inventory",
      targetQuery: "filter=purchases",
    })
  }

  const prodMap = new Map(workspace.products.map((p) => [p.id, p]))
  const nonCasePackPurchases = workspace.purchases.filter((p) => {
    const prod = prodMap.get(p.productId)
    return prod?.casePack && p.quantity % prod.casePack !== 0
  })

  if (nonCasePackPurchases.length > 0 || pillars.packaging.score < 75) {
    recommendations.push({
      id: "rec-case-pack-alignment",
      title: "Enforce Full Case-Pack and Pallet Multiples on Reorders",
      priority: "medium",
      category: "Packaging",
      description:
        "Ordering quantities that break master case packs leads to partial pallet configurations, empty truck volume (void space), and excessive secondary packaging and wrap.",
      actionableSteps: [
        "Update replenishment rules to round purchase quantities up to standard case-pack multiples.",
        "Review product case pack sizes in Catalog Settings to ensure accurate master carton specifications.",
        "Negotiate pallet-layer pricing incentives with suppliers.",
      ],
      co2ReductionKg: Math.round(nonCasePackPurchases.length * 18),
      scoreBoost: 6,
      evidence: `${nonCasePackPurchases.length} purchase orders were placed in quantities that divide case packs, creating loose cargo handling and excess corrugated waste.`,
      actionLabel: "Review Catalog Settings",
      targetPage: "data",
      targetQuery: "tab=catalog",
    })
  }

  const longLeadProducts = workspace.products.filter(
    (p) => (p.leadTimeDays ?? 0) > 14,
  )
  if (longLeadProducts.length > 0 || pillars.sourcing.score < 75) {
    recommendations.push({
      id: "rec-regional-sourcing",
      title: "Evaluate Regional Suppliers to Reduce Long-Haul Transport Distance",
      priority: profile.key === "manufacturer" ? "high" : "medium",
      category: "Sourcing",
      description:
        "Suppliers with extended lead times (>14 days) typically rely on long-haul freight or inter-regional transit, which carries a much heavier carbon footprint per ton-km than regional suppliers.",
      actionableSteps: [
        `Review the ${longLeadProducts.length} products sourced from long lead-time suppliers.`,
        "Assess whether regional or domestic alternatives can supply secondary volume.",
        "Increase buffer cycle stock to prevent expedited freight or emergency air/courier dispatches.",
      ],
      co2ReductionKg: Math.round(longLeadProducts.length * 45),
      scoreBoost: 7,
      evidence: `${longLeadProducts.length} items have lead times exceeding 14 days, accounting for high base transport transit emissions.`,
      actionLabel: "Inspect Suppliers",
      targetPage: "dashboards",
      targetQuery: "family=Inventory&subsection=Suppliers",
    })
  }

  const asOf = cutoff(workspace)
  const recentCutoff = shiftDate(asOf, -60)
  const activeProductIds = new Set(
    workspace.sales
      .filter((s) => s.date >= recentCutoff)
      .map((s) => s.productId),
  )
  const deadStockProducts = workspace.products.filter(
    (p) =>
      !activeProductIds.has(p.id) &&
      workspace.stock.some((s) => s.productId === p.id && s.onHand > 0),
  )

  if (deadStockProducts.length > 0 || footprint.holdingDeadStockCO2Kg > 20 || pillars.inventory.score < 75) {
    recommendations.push({
      id: "rec-liquidate-dead-stock",
      title: "Liberate Stagnant Inventory to Eliminate Warehouse Holding Emissions",
      priority: profile.key === "food_beverage" ? "high" : "medium",
      category: "Inventory",
      description:
        "Stagnant stock ties up warehouse floor space that continuously expends electricity for lighting, temperature moderation, handling, and refrigeration.",
      actionableSteps: [
        "Deploy promotional bundles or liquidation discounts for items with zero sales in the last 60 days.",
        "Reclaim warehouse capacity to avoid leased space expansion and unnecessary facility energy draw.",
        profile.key === "food_beverage"
          ? "Donate or clearance near-expiry perishables before spoilage generates landfill methane."
          : "Review minimum stocking policies to avoid reordering slow-velocity items.",
      ],
      co2ReductionKg: footprint.holdingDeadStockCO2Kg,
      scoreBoost: 8,
      evidence: `Identified stagnant inventory generating an estimated ${footprint.holdingDeadStockCO2Kg} kg CO2e in ongoing facility holding footprint.`,
      actionLabel: "Dead Stock Analysis",
      targetPage: "analysis",
      targetQuery: "question=Q-DEAD-STOCK",
    })
  }

  if (profile.key === "ecommerce" || profile.key === "retail") {
    recommendations.push({
      id: "rec-eco-shipping",
      title: "Incentivize Consolidated Customer Delivery Windows",
      priority: "medium",
      category: "Logistics",
      description:
        "Single-item customer dispatches produce disproportionately high last-mile emissions. Offering consolidated shipping windows reduces van miles.",
      actionableSteps: [
        "Offer customers a \"Green Delivery Day\" option to group multiple orders into one delivery.",
        "Set up automated shipment hold rules that bundle orders going to the same delivery address.",
      ],
      co2ReductionKg: 120,
      scoreBoost: 5,
      evidence:
        "High dispatch frequency in direct-to-consumer models can be reduced by 15-25% with order bundling incentives.",
      actionLabel: "Review Sales",
      targetPage: "inventory",
      targetQuery: "filter=sales",
    })
  }

  return recommendations
}

export function assessSustainability(
  workspace: Workspace,
  customBusinessType?: string,
): SustainabilityAssessment {
  const businessProfile = resolveBusinessType(
    customBusinessType ?? workspace.profile.businessType,
  )
  const footprint = calculateCarbonFootprint(workspace, businessProfile)
  const scoring = calculateSustainabilityScore(
    workspace,
    businessProfile,
    footprint,
  )
  const recommendations = generateSustainabilityRecommendations(
    workspace,
    businessProfile,
    footprint,
    scoring.pillars,
  )

  return {
    businessProfile,
    overallScore: scoring.overallScore,
    grade: scoring.grade,
    gradeLabel: scoring.gradeLabel,
    statusMessage: scoring.statusMessage,
    footprint,
    pillars: scoring.pillars,
    recommendations,
    asOfDate: cutoff(workspace),
  }
}
