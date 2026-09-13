import { describe, expect, it } from "vitest"
import { emptyWorkspace, demoWorkspace, type Purchase, type Product, type Supplier } from "./workspace"
import {
  assessSustainability,
  calculateCarbonFootprint,
  calculateSustainabilityScore,
  generateSustainabilityRecommendations,
  groupShipmentEvents,
  resolveBusinessType,
  BUSINESS_PROFILES,
} from "./sustainability"

describe("Sustainability Domain Logic", () => {
  it("resolves business types and archetypes correctly", () => {
    expect(resolveBusinessType("Wholesale distributor").key).toBe("wholesale_distributor")
    expect(resolveBusinessType("d2c ecommerce brand").key).toBe("ecommerce")
    expect(resolveBusinessType("Retail grocery store").key).toBe("retail")
    expect(resolveBusinessType("Automotive parts manufacturer").key).toBe("manufacturer")
    expect(resolveBusinessType("Food & beverage distribution").key).toBe("food_beverage")
    expect(resolveBusinessType("3PL freight logistics").key).toBe("logistics_3pl")
    expect(resolveBusinessType("Consulting and trade").key).toBe("general")
    expect(resolveBusinessType("").key).toBe("wholesale_distributor")
  })

  it("groups purchases into shipment events and detects delivery fragmentation", () => {
    const suppliers: Supplier[] = [
      { id: "sup-1", name: "Alpha Supplier", active: true },
    ]
    const products: Product[] = [
      {
        id: "prod-1",
        sku: "P1",
        name: "Box A",
        category: "Industrial",
        unit: "pcs",
        cost: 10,
        price: 20,
        supplierId: "sup-1",
        leadTimeDays: 5,
        moq: 10,
        casePack: 10,
        reorderPoint: null,
        safetyStock: null,
        serviceTarget: null,
      },
    ]
    // 3 separate purchases on 3 close dates from same supplier (within 7 days)
    const purchases: Purchase[] = [
      {
        id: "po-1",
        productId: "prod-1",
        supplierId: "sup-1",
        quantity: 50,
        amount: 500,
        orderDate: "2026-09-01",
        promisedDate: "2026-09-05",
        receivedDate: "2026-09-05",
        receivedQuantity: 50,
        plannedPaymentDate: null,
        paidAmount: 0,
      },
      {
        id: "po-2",
        productId: "prod-1",
        supplierId: "sup-1",
        quantity: 30,
        amount: 300,
        orderDate: "2026-09-03",
        promisedDate: "2026-09-07",
        receivedDate: "2026-09-07",
        receivedQuantity: 30,
        plannedPaymentDate: null,
        paidAmount: 0,
      },
      {
        id: "po-3",
        productId: "prod-1",
        supplierId: "sup-1",
        quantity: 40,
        amount: 400,
        orderDate: "2026-09-06",
        promisedDate: "2026-09-09",
        receivedDate: "2026-09-09",
        receivedQuantity: 40,
        plannedPaymentDate: null,
        paidAmount: 0,
      },
    ]

    const profile = BUSINESS_PROFILES.wholesale_distributor
    const shipments = groupShipmentEvents(purchases, suppliers, products, profile)

    expect(shipments).toHaveLength(3)
    expect(shipments.every((s) => s.isFragmented)).toBe(true)
    expect(shipments[0].estimatedCO2Kg).toBeGreaterThan(0)
  })

  it("calculates carbon footprint and identifies avoidable CO2 from frequent unbatched shipments", () => {
    const w = demoWorkspace("test-demo")
    const profile = BUSINESS_PROFILES.wholesale_distributor
    const footprint = calculateCarbonFootprint(w, profile)

    expect(footprint.shipmentCount).toBeGreaterThan(0)
    expect(footprint.totalCO2Kg).toBeGreaterThan(0)
    expect(footprint.incomingShipmentsCO2Kg).toBeGreaterThan(0)
    expect(footprint.supplierBreakdown.length).toBeGreaterThan(0)
    expect(footprint.monthlyCO2Series.length).toBeGreaterThan(0)

    // Demo workspace has multiple separate purchase dates from same suppliers
    expect(footprint.fragmentedShipmentCount).toBeGreaterThan(0)
    expect(footprint.avoidableCO2Kg).toBeGreaterThan(0)
  })

  it("calculates pillar scores and overall rating reflecting business type weights", () => {
    const w = demoWorkspace("test-demo")
    const wholesaleProfile = BUSINESS_PROFILES.wholesale_distributor
    const wholesaleFootprint = calculateCarbonFootprint(w, wholesaleProfile)
    const wholesaleResult = calculateSustainabilityScore(w, wholesaleProfile, wholesaleFootprint)

    expect(wholesaleResult.overallScore).toBeGreaterThanOrEqual(20)
    expect(wholesaleResult.overallScore).toBeLessThanOrEqual(100)
    expect(["A", "B", "C", "D", "F"]).toContain(wholesaleResult.grade)
    expect(wholesaleResult.pillars.shipments.weight).toBe(0.4)
    expect(wholesaleResult.pillars.sourcing.weight).toBe(0.2)

    // Compare with eCommerce weights
    const ecomProfile = BUSINESS_PROFILES.ecommerce
    const ecomFootprint = calculateCarbonFootprint(w, ecomProfile)
    const ecomResult = calculateSustainabilityScore(w, ecomProfile, ecomFootprint)
    expect(ecomResult.pillars.shipments.weight).toBe(0.45)
  })

  it("generates actionable recommendations with quantifiable CO2 reductions", () => {
    const w = demoWorkspace("test-demo")
    const profile = BUSINESS_PROFILES.wholesale_distributor
    const footprint = calculateCarbonFootprint(w, profile)
    const scoring = calculateSustainabilityScore(w, profile, footprint)
    const recommendations = generateSustainabilityRecommendations(w, profile, footprint, scoring.pillars)

    expect(recommendations.length).toBeGreaterThan(0)
    const consolidationRec = recommendations.find((r) => r.id === "rec-consolidate-shipments")
    expect(consolidationRec).toBeDefined()
    expect(consolidationRec?.co2ReductionKg).toBeGreaterThan(0)
    expect(consolidationRec?.scoreBoost).toBeGreaterThan(0)
    expect(consolidationRec?.actionableSteps.length).toBeGreaterThan(0)
  })

  it("runs full assessment smoothly on both demo and empty workspaces", () => {
    const demo = assessSustainability(demoWorkspace("demo-1"))
    expect(demo.overallScore).toBeDefined()
    expect(demo.grade).toBeDefined()
    expect(demo.footprint.shipmentCount).toBeGreaterThan(0)

    const empty = assessSustainability(emptyWorkspace("empty-1", "business"))
    expect(empty.overallScore).toBeDefined()
    expect(empty.footprint.shipmentCount).toBe(0)
    expect(empty.footprint.totalCO2Kg).toBe(0)
  })
})
