import { cleanup, render, screen, fireEvent } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { demoWorkspace } from "../../domain/workspace"
import { SustainabilitySection } from "./SustainabilitySection"

afterEach(cleanup)

describe("SustainabilitySection UI Component", () => {
  it("renders the sustainability rating, score, and carbon footprint metrics for a business", () => {
    const w = demoWorkspace("test-demo")
    const onNavigate = vi.fn()
    const onChange = vi.fn()

    render(
      <SustainabilitySection
        workspace={w}
        onChange={onChange}
        onNavigate={onNavigate}
      />,
    )

    expect(screen.getByText("Overall Sustainability Rating")).toBeInTheDocument()
    expect(screen.getByText("Total Estimated Carbon Footprint")).toBeInTheDocument()
    expect(screen.getByText("Incoming Shipments Received")).toBeInTheDocument()
    expect(screen.getByText("Consolidation Efficiency")).toBeInTheDocument()
    expect(screen.getByText("Avoidable Freight CO2")).toBeInTheDocument()
    expect(screen.getAllByText(/Wholesale Distributor/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Benchmark rating/i)).toBeInTheDocument()
  })

  it("renders the 4 sustainability pillars with scores and weights", () => {
    const w = demoWorkspace("test-demo")

    render(
      <SustainabilitySection
        workspace={w}
        onChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )

    expect(screen.getByText("Logistics & Shipment Consolidation")).toBeInTheDocument()
    expect(screen.getByText("Supplier Network & Locality")).toBeInTheDocument()
    expect(screen.getByText("Inventory Waste & Holding Footprint")).toBeInTheDocument()
    expect(screen.getByText("Packaging & Batch Sizing")).toBeInTheDocument()
  })

  it("navigates to Shipment CO2 Impact subsection and displays delivery runs", () => {
    const w = demoWorkspace("test-demo")

    render(
      <SustainabilitySection
        workspace={w}
        onChange={vi.fn()}
        onNavigate={vi.fn()}
        subsection="Shipment CO2 Impact"
      />,
    )

    expect(screen.getByText("Why Delivery Frequency Drives Up Transport Emissions")).toBeInTheDocument()
    expect(screen.getByText("Recorded Incoming Shipment Runs")).toBeInTheDocument()
    expect(screen.getByText("Supplier Carbon & Delivery Footprint")).toBeInTheDocument()
    expect(screen.getByText("Fragmented Deliveries")).toBeInTheDocument()
  })

  it("navigates to Recommended Actions subsection and displays prioritized reduction cards", () => {
    const w = demoWorkspace("test-demo")
    const onNavigate = vi.fn()

    render(
      <SustainabilitySection
        workspace={w}
        onChange={vi.fn()}
        onNavigate={onNavigate}
        subsection="Recommended Actions"
      />,
    )

    expect(screen.getByText("Targeted Recommendations to Reduce Carbon Footprint")).toBeInTheDocument()
    expect(screen.getByText(/Consolidate Incoming Supplier Shipments/i)).toBeInTheDocument()

    const reviewButtons = screen.getAllByRole("button", { name: /Review Purchases/i })
    expect(reviewButtons.length).toBeGreaterThan(0)
    fireEvent.click(reviewButtons[0])
    expect(onNavigate).toHaveBeenCalledWith("inventory", "filter=purchases")
  })

  it("allows switching business type and calls onChange to persist profile", () => {
    const w = demoWorkspace("test-demo")
    const onChange = vi.fn()

    render(
      <SustainabilitySection
        workspace={w}
        onChange={onChange}
        onNavigate={vi.fn()}
      />,
    )

    const control = screen.getByRole("combobox", { name: "Simulate Business Type" })
    fireEvent.change(control, { target: { value: "ecommerce" } })

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({
          businessType: "eCommerce / Direct-to-Consumer",
        }),
      }),
    )
  })
})
