import { useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Info,
  Leaf,
  RefreshCw,
  Sparkles,
  TrendingDown,
  Truck,
} from "lucide-react"
import {
  DataChart,
  EmptyState,
  MetricCard,
  Panel,
  TableHead,
  Tabs,
} from "../../components/workspace-ui"
import { SortableTable } from "../../components/SortableTable"
import { SelectField } from "../../components/ui/select-field"
import { Progress } from "../../components/ui/progress"
import type { Workspace, Page } from "../../domain/workspace"
import {
  assessSustainability,
  BUSINESS_PROFILES,
  type BusinessTypeKey,
} from "../../domain/sustainability"

export interface SustainabilitySectionProps {
  workspace: Workspace
  onChange: (w: Workspace) => void
  onNavigate: (page: Page, query?: string) => void
  onIntake?: (
    section?: 'sales' | 'inventory' | 'finance' | 'suppliers' | 'profile',
  ) => void
  subsection?: string
  setSubsection?: (sub: string) => void
}

export function SustainabilitySection({
  workspace: w,
  onChange,
  onNavigate,
  subsection: controlledSubsection,
  setSubsection: controlledSetSubsection,
}: SustainabilitySectionProps) {
  const [internalSubsection, setInternalSubsection] = useState("Overview")
  const subsection = controlledSubsection ?? internalSubsection
  const setSubsection = controlledSetSubsection ?? setInternalSubsection

  const [customTypeKey, setCustomTypeKey] = useState<BusinessTypeKey | "">(
    "",
  )
  const [priorityFilter, setPriorityFilter] = useState("All")

  const assessment = useMemo(() => {
    const override = customTypeKey
      ? BUSINESS_PROFILES[customTypeKey]?.label
      : undefined
    return assessSustainability(w, override)
  }, [w, customTypeKey])

  const { businessProfile, overallScore, grade, gradeLabel, statusMessage, footprint, pillars, recommendations } =
    assessment

  const profileOptions = Object.values(BUSINESS_PROFILES).map((p) => ({
    value: p.key,
    label: p.label,
  }))

  const gradeTone =
    grade === "A"
      ? "green"
      : grade === "B"
        ? "green"
        : grade === "C"
          ? "amber"
          : "error"

  const filteredRecommendations = recommendations.filter((r) => {
    if (priorityFilter === "All") return true
    if (priorityFilter === "High priority") return r.priority === "high"
    if (priorityFilter === "Medium priority") return r.priority === "medium"
    if (priorityFilter === "Quick wins") return r.priority === "low" || r.scoreBoost >= 6
    return true
  })

  function handleSaveProfile(key: BusinessTypeKey) {
    const profile = BUSINESS_PROFILES[key]
    if (!profile) return
    onChange({
      ...w,
      profile: {
        ...w.profile,
        businessType: profile.label,
      },
    })
  }

  return (
    <div className="sustainability-section">
      {/* Business Type Context & Profile Selector */}
      <div className="sustainability-profile-bar">
        <div className="profile-info">
          <div className="profile-badge-row">
            <span className="badge green">
              <Leaf size={12} />
              Sustainability Rating Engine
            </span>
            <span className="badge neutral">
              Archetype: {businessProfile.label}
            </span>
          </div>
          <p className="profile-description">
            {businessProfile.description} Benchmark rating:{" "}
            <strong>{businessProfile.benchmarkScore} / 100</strong>.
          </p>
        </div>

        <div className="profile-actions">
          <SelectField
            label="Simulate Business Type"
            value={customTypeKey || businessProfile.key}
            onValueChange={(val) => {
              const key = val as BusinessTypeKey
              setCustomTypeKey(key)
              handleSaveProfile(key)
            }}
            options={profileOptions}
          />
        </div>
      </div>

      {/* Subsection Navigation Tabs if not rendered by Dashboards */}
      {!controlledSubsection && (
        <Tabs
          tabs={["Overview", "Shipment CO2 Impact", "Recommended Actions"]}
          value={subsection}
          onChange={setSubsection}
          label="Sustainability views"
        />
      )}

      {/* VIEW 1: OVERVIEW */}
      {subsection === "Overview" && (
        <>
          <div className="sustainability-hero-grid">
            <article className="sustainability-scorecard">
              <div className="scorecard-header">
                <div>
                  <p className="eyebrow">Overall Sustainability Rating</p>
                  <h2>{gradeLabel}</h2>
                </div>
                <div className={`score-circle score-${gradeTone}`}>
                  <span className="score-grade">{grade}</span>
                  <span className="score-num">{overallScore}/100</span>
                </div>
              </div>
              <p className="scorecard-status">{statusMessage}</p>
              <div className="benchmark-track">
                <div className="benchmark-bar-wrap">
                  <span
                    className="benchmark-marker"
                    style={{ left: `${businessProfile.benchmarkScore}%` }}
                    title={`Sector benchmark: ${businessProfile.benchmarkScore}`}
                  >
                    ▼ Benchmark ({businessProfile.benchmarkScore})
                  </span>
                  <div className="benchmark-progress-bg">
                    <div
                      className={`benchmark-progress-fill fill-${gradeTone}`}
                      style={{ width: `${overallScore}%` }}
                    />
                  </div>
                </div>
                <div className="benchmark-legend">
                  <span>Score: {overallScore} / 100</span>
                  <span>
                    {overallScore >= businessProfile.benchmarkScore
                      ? `+${overallScore - businessProfile.benchmarkScore} pts vs ${businessProfile.label} benchmark`
                      : `${overallScore - businessProfile.benchmarkScore} pts vs ${businessProfile.label} benchmark`}
                  </span>
                </div>
              </div>
            </article>

            <div className="sustainability-metrics-column">
              <MetricCard
                label="Total Estimated Carbon Footprint"
                value={`${footprint.totalCO2Kg.toLocaleString()} kg CO2e`}
                note={`~${(footprint.totalCO2Kg / 1000).toFixed(2)} metric tons (freight transport & holding)`}
                icon={<Leaf size={16} />}
                accent
              />
              <MetricCard
                label="Incoming Shipments Received"
                value={`${footprint.shipmentCount} delivery runs`}
                note={`Across ${w.purchases.length} purchase orders · avg ${footprint.avgUnitsPerShipment} units/run`}
                icon={<Truck size={16} />}
              />
              <MetricCard
                label="Consolidation Efficiency"
                value={`${footprint.consolidationEfficiencyPct}%`}
                note={
                  footprint.fragmentedShipmentCount > 0
                    ? `${footprint.fragmentedShipmentCount} unbatched shipments within 7-day windows`
                    : "No fragmented delivery runs detected"
                }
                trend={
                  footprint.fragmentedShipmentCount > 0
                    ? "Optimization potential"
                    : "Optimal batching"
                }
                icon={<RefreshCw size={16} />}
              />
              <MetricCard
                label="Avoidable Freight CO2"
                value={`${footprint.avoidableCO2Kg.toLocaleString()} kg CO2e`}
                note="Can be eliminated by consolidating into scheduled weekly delivery runs"
                trend={footprint.avoidableCO2Kg > 0 ? "High savings" : "Minimal waste"}
                icon={<TrendingDown size={16} />}
              />
            </div>
          </div>

          {/* Pillars Assessment */}
          <Panel
            title="Sustainability Pillars by Operational Impact"
            subtitle={`Pillar weightings tailored for ${businessProfile.label} operations`}
          >
            <div className="pillars-grid">
              {Object.entries(pillars).map(([key, pillar]) => (
                <div key={key} className="pillar-card">
                  <div className="pillar-header">
                    <div>
                      <h4>{pillar.name}</h4>
                      <p className="pillar-desc">{pillar.description}</p>
                    </div>
                    <span
                      className={`badge ${
                        pillar.rating === "Exceptional" || pillar.rating === "Good"
                          ? "green"
                          : pillar.rating === "Moderate"
                            ? "amber"
                            : "error"
                      }`}
                    >
                      {pillar.rating}
                    </span>
                  </div>
                  <div className="pillar-score-row">
                    <span className="pillar-score">{pillar.score} / 100</span>
                    <span className="pillar-weight">
                      Weight: {Math.round(pillar.weight * 100)}%
                    </span>
                  </div>
                  <Progress value={pillar.score} />
                </div>
              ))}
            </div>
          </Panel>

          {/* Top Recommendations Preview */}
          <Panel
            title="Immediate Actions to Cut Emissions"
            subtitle="Prioritized steps based on your actual purchase records and supplier schedules"
            action={
              <button
                className="text-button"
                onClick={() => setSubsection("Recommended Actions")}
              >
                View full action plan
                <ArrowRight size={15} />
              </button>
            }
          >
            <div className="recommendations-summary-list">
              {recommendations.slice(0, 3).map((rec) => (
                <div key={rec.id} className="rec-summary-item">
                  <div className="rec-summary-content">
                    <div className="rec-tags">
                      <span
                        className={`badge ${
                          rec.priority === "high" ? "error" : "blue"
                        }`}
                      >
                        {rec.priority.toUpperCase()} PRIORITY
                      </span>
                      <span className="badge neutral">{rec.category}</span>
                      <span className="badge green">
                        -{rec.co2ReductionKg} kg CO2e
                      </span>
                      <span className="badge amber">
                        +{rec.scoreBoost} pts score
                      </span>
                    </div>
                    <h4>{rec.title}</h4>
                    <p className="small muted">{rec.evidence}</p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => onNavigate(rec.targetPage as Page, rec.targetQuery)}
                  >
                    {rec.actionLabel}
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}

      {/* VIEW 2: SHIPMENT CO2 IMPACT */}
      {subsection === "Shipment CO2 Impact" && (
        <>
          <div className="sustainability-callout">
            <Info size={20} />
            <div>
              <h4>Why Delivery Frequency Drives Up Transport Emissions</h4>
              <p>
                Every incoming shipment requires an individual freight trip with fixed base fuel consumption, regardless of vehicle load fill. Receiving multiple small shipments from the same supplier or on consecutive days multiplies transit overhead. Consolidating orders into designated weekly or bi-weekly receiving slots slashes delivery miles and eliminates up to 40% of transport CO2.
              </p>
            </div>
          </div>

          <div className="metrics-grid">
            <MetricCard
              label="Total Delivery Runs"
              value={`${footprint.shipmentCount}`}
              note={`${footprint.unitsReceived.toLocaleString()} total units received`}
              icon={<Truck size={16} />}
            />
            <MetricCard
              label="Avg Freight CO2 per Run"
              value={`${footprint.avgCO2PerShipmentKg} kg CO2e`}
              note={`Benchmark: ${businessProfile.typicalCO2PerShipmentKg} kg / delivery`}
              icon={<Leaf size={16} />}
            />
            <MetricCard
              label="Fragmented Deliveries"
              value={`${footprint.fragmentedShipmentCount} runs`}
              note="Separate shipments arriving within 7 days from identical suppliers"
              trend={footprint.fragmentedShipmentCount > 0 ? "Requires consolidation" : "Good"}
              icon={<AlertCircle size={16} />}
            />
            <MetricCard
              label="Deliveries Savable"
              value={`${
                footprint.fragmentedShipmentCount > 0
                  ? footprint.fragmentedShipmentCount -
                    new Set(footprint.shipments.map((s) => s.windowGroupKey)).size
                  : 0
              } trips`}
              note={`Would eliminate ~${footprint.avoidableCO2Kg} kg CO2e` }
              icon={<TrendingDown size={16} />}
            />
          </div>

          {/* Monthly Emissions Trend */}
          {footprint.monthlyCO2Series.length > 0 && (
            <Panel
              title="Freight Emissions Over Time"
              subtitle="Monthly transport CO2 (kg CO2e) and shipment delivery count"
            >
              <DataChart
                data={footprint.monthlyCO2Series.map((d) => ({
                  date: `${d.month}-01`,
                  co2Kg: d.co2Kg,
                  shipments: d.shipments * 10,
                }))}
                series={[
                  { key: "co2Kg", label: "Transport CO2 (kg CO2e)", color: "var(--chart-1)" },
                  { key: "shipments", label: "Shipment runs (scaled x10)", color: "var(--chart-2)" },
                ]}
                label="Monthly freight CO2 emissions"
                unit="kg CO2e"
              />
            </Panel>
          )}

          {/* Supplier Breakdown */}
          <Panel
            title="Supplier Carbon & Delivery Footprint"
            subtitle="Identifies suppliers with frequent unbatched delivery runs"
          >
            {footprint.supplierBreakdown.length > 0 ? (
              <div className="table-wrap">
                <SortableTable className="data-table">
                  <TableHead
                    headers={[
                      "Supplier",
                      "Shipment Runs",
                      "Units Received",
                      "Total Transport CO2",
                      "Unbatched Runs",
                      "Avoidable CO2",
                    ]}
                  />
                  <tbody>
                    {footprint.supplierBreakdown.map((s) => (
                      <tr key={s.supplierId}>
                        <td>
                          <strong>{s.supplierName}</strong>
                        </td>
                        <td>{s.shipmentCount}</td>
                        <td>{s.totalUnits.toLocaleString()}</td>
                        <td>
                          <strong>{s.co2Kg} kg CO2e</strong>
                        </td>
                        <td>
                          {s.fragmentedCount > 1 ? (
                            <span className="badge amber">
                              {s.fragmentedCount} runs in 7-day windows
                            </span>
                          ) : (
                            <span className="badge green">Consolidated</span>
                          )}
                        </td>
                        <td>
                          {s.avoidableCO2Kg > 0 ? (
                            <span className="badge error">
                              -{s.avoidableCO2Kg} kg savable
                            </span>
                          ) : (
                            <span className="muted">0 kg</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </SortableTable>
              </div>
            ) : (
              <EmptyState
                title="No purchase shipments recorded"
                description="Record supplier purchases or import inventory intake to see supplier carbon metrics."
              />
            )}
          </Panel>

          {/* Shipments Detailed Table */}
          <Panel
            title="Recorded Incoming Shipment Runs"
            subtitle="Analyzed by supplier, date, cargo volume, and consolidation status"
          >
            {footprint.shipments.length > 0 ? (
              <div className="table-wrap">
                <SortableTable className="data-table">
                  <TableHead
                    headers={[
                      "Date",
                      "Supplier",
                      "SKUs / Products",
                      "Units Received",
                      "Est. Trip CO2",
                      "Consolidation Status",
                    ]}
                  />
                  <tbody>
                    {footprint.shipments.map((shipment) => (
                      <tr key={shipment.id}>
                        <td>{shipment.date}</td>
                        <td>{shipment.supplierName}</td>
                        <td>{shipment.productIds.length} items</td>
                        <td>{shipment.totalQuantity.toLocaleString()}</td>
                        <td>
                          <strong>{shipment.estimatedCO2Kg} kg</strong>
                        </td>
                        <td>
                          {shipment.isFragmented ? (
                            <span className="badge amber">
                              Fragmented (arrived in same week)
                            </span>
                          ) : (
                            <span className="badge green">
                              <CheckCircle2 size={12} /> Scheduled Batch
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </SortableTable>
              </div>
            ) : (
              <EmptyState
                title="No shipments found in current scope"
                description="Add dated purchase orders to view incoming delivery analysis."
              />
            )}
          </Panel>
        </>
      )}

      {/* VIEW 3: RECOMMENDED ACTIONS */}
      {subsection === "Recommended Actions" && (
        <>
          <div className="actions-header-bar">
            <div>
              <h3>Targeted Recommendations to Reduce Carbon Footprint</h3>
              <p className="small muted">
                Action items evaluated against your actual order records, delivery intervals, and {businessProfile.label} profile.
              </p>
            </div>
            <div className="action-filters">
              <Tabs
                tabs={["All", "High priority", "Medium priority", "Quick wins"]}
                value={priorityFilter}
                onChange={setPriorityFilter}
                label="Filter recommendations"
              />
            </div>
          </div>

          <div className="action-cards-grid">
            {filteredRecommendations.length > 0 ? (
              filteredRecommendations.map((rec) => (
                <article key={rec.id} className="sustainability-action-card">
                  <div className="action-card-top">
                    <div className="action-tags">
                      <span
                        className={`badge ${
                          rec.priority === "high"
                            ? "error"
                            : rec.priority === "medium"
                              ? "blue"
                              : "green"
                        }`}
                      >
                        {rec.priority.toUpperCase()} PRIORITY
                      </span>
                      <span className="badge neutral">{rec.category}</span>
                    </div>
                    <div className="action-impact-badges">
                      <span className="badge green">
                        <TrendingDown size={12} />
                        -{rec.co2ReductionKg} kg CO2e
                      </span>
                      <span className="badge amber">
                        <Sparkles size={12} />
                        +{rec.scoreBoost} pts
                      </span>
                    </div>
                  </div>

                  <h3 className="action-card-title">{rec.title}</h3>
                  <p className="action-card-desc">{rec.description}</p>

                  <div className="action-evidence-box">
                    <strong>Evidence from your records:</strong>
                    <p>{rec.evidence}</p>
                  </div>

                  <div className="action-steps-box">
                    <strong>Actionable Implementation Steps:</strong>
                    <ul>
                      {rec.actionableSteps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="action-card-footer">
                    <button
                      className="button primary"
                      onClick={() =>
                        onNavigate(rec.targetPage as Page, rec.targetQuery)
                      }
                    >
                      {rec.actionLabel}
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState
                title="No recommendations match this filter"
                description="Switch priority filter to view other recommendations."
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
