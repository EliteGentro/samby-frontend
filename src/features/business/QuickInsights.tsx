import { useMemo, useState } from 'react'
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Coins,
  FilePlus2,
  Filter,
  Flame,
  Gauge,
  Lightbulb,
  Percent,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react'
import {
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
} from '../../components/workspace-ui'
import {
  evaluateQuickInsights,
  type BusinessOptimization,
  type BusinessThreat,
  type HealthPillarKey,
  type HealthPillarScore,
  type ThreatSeverity,
} from '../../domain/quick-insights'
import {
  cutoff,
  dateLabel,
  money,
  type Workspace,
} from '../../domain/workspace'
import type { BusinessPageProps } from './Home'

type FilterSeverity = 'all' | 'critical' | 'warning' | 'optimizations'

interface PillarChartMeta {
  key: HealthPillarKey
  title: string
  colorVar: string
  ticks: number
  icon: (size?: number) => React.ReactNode
}

const PILLAR_CHART_CONFIG: PillarChartMeta[] = [
  {
    key: 'liquidity',
    title: 'Liquidity & Runway',
    colorVar: 'var(--secondary)',
    ticks: 18,
    icon: (size = 18) => <Wallet size={size} />,
  },
  {
    key: 'inventory',
    title: 'Supply Chain & Stock',
    colorVar: 'var(--chart-1)',
    ticks: 15,
    icon: (size = 18) => <Boxes size={size} />,
  },
  {
    key: 'suppliers',
    title: 'Supplier Reliability',
    colorVar: 'var(--chart-2)',
    ticks: 12,
    icon: (size = 18) => <Truck size={size} />,
  },
  {
    key: 'profitability',
    title: 'Commercial & Margins',
    colorVar: 'var(--chart-3)',
    ticks: 15,
    icon: (size = 18) => <TrendingUp size={size} />,
  },
]

const TOTAL_TICKS = 60
const GAUGE_CX = 105
const GAUGE_CY = 105
const GAUGE_R_INNER = 74
const GAUGE_R_OUTER = 92

const TICKS_DATA = Array.from({ length: TOTAL_TICKS }, (_, i) => {
  const angleDeg = (i / TOTAL_TICKS) * 360 - 90
  const angleRad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  const x1 = GAUGE_CX + GAUGE_R_INNER * cos
  const y1 = GAUGE_CY + GAUGE_R_INNER * sin
  const x2 = GAUGE_CX + GAUGE_R_OUTER * cos
  const y2 = GAUGE_CY + GAUGE_R_OUTER * sin

  let pillarKey: HealthPillarKey = 'profitability'
  if (i < 18) pillarKey = 'liquidity'
  else if (i < 33) pillarKey = 'inventory'
  else if (i < 45) pillarKey = 'suppliers'

  return {
    index: i,
    x1,
    y1,
    x2,
    y2,
    pillarKey,
  }
})

export function QuickInsights({
  workspace: w,
  onNavigate,
  onIntake,
}: BusinessPageProps) {
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>('all')
  const [pillarFilter, setPillarFilter] = useState<HealthPillarKey | 'all'>('all')
  const [chartMode, setChartMode] = useState<'pillars' | 'progress'>('pillars')
  const [hoveredPillar, setHoveredPillar] = useState<HealthPillarKey | null>(null)

  const insights = useMemo(() => evaluateQuickInsights(w), [w])
  const { healthScore, threats, optimizations, summary } = insights

  const hasData = w.sales.length + w.stock.length + w.finance.length > 0

  // Filtered threats and optimizations
  const filteredThreats = useMemo(() => {
    if (severityFilter === 'optimizations') return []
    return threats.filter((t) => {
      const matchPillar = pillarFilter === 'all' || t.pillar === pillarFilter
      const matchSeverity =
        severityFilter === 'all' ||
        (severityFilter === 'critical' && t.severity === 'critical') ||
        (severityFilter === 'warning' && t.severity === 'warning')
      return matchPillar && matchSeverity
    })
  }, [threats, severityFilter, pillarFilter])

  const filteredOptimizations = useMemo(() => {
    return optimizations.filter((o) => {
      const matchPillar = pillarFilter === 'all' || o.pillar === pillarFilter
      const matchSeverity =
        severityFilter === 'all' || severityFilter === 'optimizations'
      return matchPillar && matchSeverity
    })
  }, [optimizations, severityFilter, pillarFilter])

  const totalVisibleItems =
    filteredThreats.length +
    (severityFilter === 'all' || severityFilter === 'optimizations'
      ? filteredOptimizations.length
      : 0)

  const gradeColorClass =
    healthScore.grade === 'Strong'
      ? 'grade-strong'
      : healthScore.grade === 'Good'
        ? 'grade-good'
        : healthScore.grade === 'Fair'
          ? 'grade-fair'
          : 'grade-risk'

  return (
    <div className="quick-insights-page">
      <PageHeader
        eyebrow="Executive Diagnostics"
        title="Quick Insights"
        description="Comprehensive business health score, active threat prevention, and capital optimization levers."
        action={
          <div className="header-actions-group">
            <button
              className="button secondary"
              onClick={() => onNavigate('analysis')}
              title="Model alternative financial & supply decisions"
            >
              <Sparkles size={16} />
              Simulate scenario
            </button>
            <button
              className="button primary"
              onClick={() => onIntake()}
              title="Add or update business records"
            >
              <FilePlus2 size={16} />
              Add data
            </button>
          </div>
        }
      />

      {!hasData ? (
        <EmptyState
          title="No business diagnostics available yet"
          description="Add sales, stock positions, or financial records to calculate your Business Health Score, detect critical risks, and receive optimization guidance."
          action={
            <button className="button primary" onClick={() => onIntake()}>
              <FilePlus2 size={16} />
              Start initial data intake
            </button>
          }
        />
      ) : (
        <>
          {/* TOP EXECUTIVE HERO: HEALTH SCORE & KEY ALERTS */}
          <div className="insights-hero-grid">
            <article className={`health-score-card ${gradeColorClass}`}>
              <div className="health-score-top-bar">
                <div className="health-badge-row">
                  <span className="health-label">Business Health Score</span>
                  <span className={`status-badge ${gradeColorClass}`}>
                    {healthScore.grade === 'Strong' && <ShieldCheck size={13} />}
                    {healthScore.grade === 'Good' && <CheckCircle2 size={13} />}
                    {healthScore.grade === 'Fair' && <AlertTriangle size={13} />}
                    {healthScore.grade === 'At Risk' && <AlertOctagon size={13} />}
                    {healthScore.grade}
                  </span>
                </div>
                <div className="ticked-view-toggle" role="group" aria-label="Health score chart view">
                  <button
                    type="button"
                    className={`ticked-toggle-btn ${chartMode === 'pillars' ? 'active' : ''}`}
                    onClick={() => setChartMode('pillars')}
                  >
                    Pillars
                  </button>
                  <button
                    type="button"
                    className={`ticked-toggle-btn ${chartMode === 'progress' ? 'active' : ''}`}
                    onClick={() => setChartMode('progress')}
                  >
                    Progress
                  </button>
                </div>
              </div>

              <h2 className="health-headline">{healthScore.summary}</h2>

              <div className="ticked-chart-body">
                <div className="ticked-gauge-wrap">
                  <svg
                    className="ticked-gauge-svg"
                    viewBox="0 0 210 210"
                    aria-label={`Radial score dial showing ${healthScore.overallScore} out of 100`}
                  >
                    {TICKS_DATA.map((t) => {
                      const pillar = PILLAR_CHART_CONFIG.find((p) => p.key === t.pillarKey)!
                      let stroke = pillar.colorVar
                      let opacity = 1
                      let strokeWidth = 3.2

                      if (chartMode === 'pillars') {
                        const isFocused =
                          hoveredPillar !== null
                            ? t.pillarKey === hoveredPillar
                            : pillarFilter === 'all' || t.pillarKey === pillarFilter
                        opacity = isFocused ? 1 : 0.22
                        strokeWidth =
                          isFocused && (hoveredPillar === t.pillarKey || pillarFilter === t.pillarKey)
                            ? 3.8
                            : 3.2
                      } else {
                        const activeCount = Math.round((healthScore.overallScore / 100) * TOTAL_TICKS)
                        const isFilled = t.index < activeCount
                        stroke = isFilled
                          ? healthScore.grade === 'Strong'
                            ? 'var(--color-positive)'
                            : healthScore.grade === 'Good'
                              ? 'var(--secondary)'
                              : healthScore.grade === 'Fair'
                                ? 'var(--color-warning)'
                                : 'var(--color-error)'
                          : 'color-mix(in srgb, var(--border) 80%, transparent)'
                        opacity = isFilled ? 1 : 0.35
                        strokeWidth = isFilled ? 3.4 : 2.6
                      }

                      return (
                        <line
                          key={t.index}
                          x1={t.x1}
                          y1={t.y1}
                          x2={t.x2}
                          y2={t.y2}
                          stroke={stroke}
                          strokeWidth={strokeWidth}
                          strokeLinecap="round"
                          opacity={opacity}
                          className="ticked-tick"
                          onMouseEnter={() => setHoveredPillar(t.pillarKey)}
                          onMouseLeave={() => setHoveredPillar(null)}
                          onClick={() =>
                            setPillarFilter((prev) => (prev === t.pillarKey ? 'all' : t.pillarKey))
                          }
                        />
                      )
                    })}
                  </svg>

                  <div className="ticked-gauge-center">
                    <div className="ticked-center-icon-badge">
                      {hoveredPillar ? (
                        PILLAR_CHART_CONFIG.find((p) => p.key === hoveredPillar)?.icon(18)
                      ) : healthScore.grade === 'Strong' ? (
                        <ShieldCheck size={18} />
                      ) : healthScore.grade === 'Good' ? (
                        <CheckCircle2 size={18} />
                      ) : healthScore.grade === 'Fair' ? (
                        <AlertTriangle size={18} />
                      ) : (
                        <AlertOctagon size={18} />
                      )}
                    </div>
                    <span className="ticked-center-label">
                      {hoveredPillar
                        ? PILLAR_CHART_CONFIG.find((p) => p.key === hoveredPillar)?.title
                        : 'Health Score'}
                    </span>
                    <span className="score-num ticked-center-value">
                      {hoveredPillar ? healthScore.pillars[hoveredPillar].score : healthScore.overallScore}
                    </span>
                    <span className="score-max ticked-center-sub">
                      {hoveredPillar
                        ? `/100 · ${healthScore.pillars[hoveredPillar].status}`
                        : `/100 · ${healthScore.grade}`}
                    </span>
                  </div>
                </div>

                <div
                  className="ticked-breakdown-list"
                  role="list"
                  aria-label="Operational Pillars Breakdown"
                >
                  {PILLAR_CHART_CONFIG.map((pillar) => {
                    const pData = healthScore.pillars[pillar.key]
                    const isSelected = pillarFilter === pillar.key

                    return (
                      <button
                        type="button"
                        key={pillar.key}
                        className={`ticked-breakdown-row ${isSelected ? 'active' : ''}`}
                        onMouseEnter={() => setHoveredPillar(pillar.key)}
                        onMouseLeave={() => setHoveredPillar(null)}
                        onClick={() =>
                          setPillarFilter((prev) => (prev === pillar.key ? 'all' : pillar.key))
                        }
                        aria-pressed={isSelected}
                        aria-label={`Filter by ${pData.title}, score ${pData.score}`}
                      >
                        <div className="ticked-breakdown-left">
                          <span
                            className="ticked-pill-indicator"
                            style={{ background: pillar.colorVar }}
                            aria-hidden="true"
                          />
                          <span className="ticked-breakdown-name">{pData.title}</span>
                        </div>
                        <div className="ticked-breakdown-right">
                          <span className="ticked-breakdown-score">{pData.score}</span>
                          <span className={`ticked-breakdown-status ${pData.status}`}>
                            {pData.status === 'optimal'
                              ? 'Optimal'
                              : pData.status === 'stable'
                                ? 'Stable'
                                : pData.status === 'warning'
                                  ? 'Warning'
                                  : 'Critical'}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <p className="health-subtext">
                Audited across 4 operational pillars: Liquidity, Inventory,
                Suppliers, and Profitability as of {dateLabel(cutoff(w))}.
              </p>
            </article>

            <div className="hero-metrics-column">
              <MetricCard
                label="Critical Threats"
                value={String(summary.criticalThreatCount)}
                note={
                  summary.criticalThreatCount > 0
                    ? 'Immediate conditions to prevent'
                    : 'No critical threats active'
                }
                accent={summary.criticalThreatCount > 0}
                icon={<ShieldAlert size={20} className={summary.criticalThreatCount > 0 ? 'text-critical' : ''} />}
              />
              <MetricCard
                label="Emerging Risks"
                value={String(summary.warningCount)}
                note="Watchlist items requiring mitigation"
                icon={<AlertTriangle size={20} className={summary.warningCount > 0 ? 'text-warning' : ''} />}
              />
              <MetricCard
                label="Trapped Working Capital"
                value={
                  summary.trappedCapitalEstimate !== null
                    ? money(summary.trappedCapitalEstimate, summary.currency)
                    : 'Minimal'
                }
                note={
                  summary.trappedCapitalEstimate !== null
                    ? 'Excess stock available for liquidation'
                    : 'Turnover aligned with targets'
                }
                icon={<Coins size={20} />}
              />
            </div>
          </div>

          {/* 4 OPERATIONAL PILLARS BREAKDOWN */}
          <section className="pillars-section" aria-label="Operational Pillars">
            <div className="section-header-compact">
              <h3>Operational Pillar Diagnostics</h3>
              <span className="section-header-hint">
                Weighted components contributing to overall business score
              </span>
            </div>

            <div className="pillars-grid">
              {(
                [
                  'liquidity',
                  'inventory',
                  'suppliers',
                  'profitability',
                ] as HealthPillarKey[]
              ).map((key) => {
                const pillar = healthScore.pillars[key]
                return (
                  <PillarCard
                    key={key}
                    pillar={pillar}
                    active={pillarFilter === key}
                    onSelect={() =>
                      setPillarFilter((prev) => (prev === key ? 'all' : key))
                    }
                  />
                )
              })}
            </div>
          </section>

          {/* THREATS, WARNINGS & OPTIMIZATIONS CONTAINER */}
          <section className="diagnostics-feed-section" aria-label="Actionable Insights Feed">
            <div className="feed-controls-bar">
              <div className="filter-pills" role="tablist" aria-label="Filter insights by severity">
                <button
                  role="tab"
                  aria-selected={severityFilter === 'all'}
                  className={`filter-pill ${severityFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setSeverityFilter('all')}
                >
                  All Diagnostics ({threats.length + optimizations.length})
                </button>
                <button
                  role="tab"
                  aria-selected={severityFilter === 'critical'}
                  className={`filter-pill critical-pill ${severityFilter === 'critical' ? 'active' : ''}`}
                  onClick={() => setSeverityFilter('critical')}
                >
                  <ShieldAlert size={14} />
                  Critical Threats ({summary.criticalThreatCount})
                </button>
                <button
                  role="tab"
                  aria-selected={severityFilter === 'warning'}
                  className={`filter-pill warning-pill ${severityFilter === 'warning' ? 'active' : ''}`}
                  onClick={() => setSeverityFilter('warning')}
                >
                  <AlertTriangle size={14} />
                  Warnings ({summary.warningCount})
                </button>
                <button
                  role="tab"
                  aria-selected={severityFilter === 'optimizations'}
                  className={`filter-pill opt-pill ${severityFilter === 'optimizations' ? 'active' : ''}`}
                  onClick={() => setSeverityFilter('optimizations')}
                >
                  <Lightbulb size={14} />
                  Optimizations ({optimizations.length})
                </button>
              </div>

              {pillarFilter !== 'all' && (
                <div className="active-filter-tag">
                  <span>Filtered by: <strong>{pillarTitle(pillarFilter)}</strong></span>
                  <button
                    className="text-button"
                    onClick={() => setPillarFilter('all')}
                    aria-label="Clear area filter"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            {totalVisibleItems === 0 ? (
              <div className="feed-empty-panel">
                <ShieldCheck size={32} className="text-positive" />
                <h4>No items match the selected filter</h4>
                <p>No active threats or optimizations match this category.</p>
                <button
                  className="button secondary"
                  onClick={() => {
                    setSeverityFilter('all')
                    setPillarFilter('all')
                  }}
                >
                  Show all diagnostics
                </button>
              </div>
            ) : (
              <div className="insights-cards-list">
                {/* THREATS & WARNINGS */}
                {filteredThreats.map((threat) => (
                  <ThreatCard
                    key={threat.id}
                    threat={threat}
                    onNavigate={onNavigate}
                  />
                ))}

                {/* OPTIMIZATIONS */}
                {(severityFilter === 'all' || severityFilter === 'optimizations') &&
                  filteredOptimizations.map((opt) => (
                    <OptimizationCard
                      key={opt.id}
                      optimization={opt}
                      onNavigate={onNavigate}
                    />
                  ))}
              </div>
            )}
          </section>
        </>
      )}

      <p className="page-footnote">
        Insights engine evaluated as of {cutoff(w)} · Based on verified
        historical and scheduled records · Estimates are deterministic and auditable.
      </p>
    </div>
  )
}

function PillarCard({
  pillar,
  active,
  onSelect,
}: {
  pillar: HealthPillarScore
  active: boolean
  onSelect: () => void
}) {
  const icon =
    pillar.key === 'liquidity' ? (
      <Wallet size={16} />
    ) : pillar.key === 'inventory' ? (
      <Boxes size={16} />
    ) : pillar.key === 'suppliers' ? (
      <Truck size={16} />
    ) : (
      <TrendingUp size={16} />
    )

  const statusClass = `status-${pillar.status}`

  return (
    <article
      className={`pillar-diagnostic-card ${statusClass} ${active ? 'active' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      aria-label={`Filter by ${pillar.title} pillar, score ${pillar.score}`}
    >
      <div className="pillar-header">
        <div className="pillar-title-row">
          <span className="pillar-icon">{icon}</span>
          <span className="pillar-name">{pillar.title}</span>
        </div>
        <span className="pillar-score-badge">{pillar.score}/100</span>
      </div>

      <div className="pillar-progress-track">
        <div
          className={`pillar-progress-fill ${statusClass}`}
          style={{ width: `${pillar.score}%` }}
        />
      </div>

      <div className="pillar-key-metric">
        <span className="metric-name">{pillar.metricLabel}</span>
        <strong className="metric-val">{pillar.metricValue}</strong>
      </div>

      <p className="pillar-summary-text">{pillar.summary}</p>

      {pillar.vulnerabilities.length > 0 ? (
        <div className="pillar-note vulnerability">
          <AlertTriangle size={12} />
          <span>{pillar.vulnerabilities[0]}</span>
        </div>
      ) : pillar.strengths.length > 0 ? (
        <div className="pillar-note strength">
          <CheckCircle2 size={12} />
          <span>{pillar.strengths[0]}</span>
        </div>
      ) : null}
    </article>
  )
}

function ThreatCard({
  threat,
  onNavigate,
}: {
  threat: BusinessThreat
  onNavigate: BusinessPageProps['onNavigate']
}) {
  const isCritical = threat.severity === 'critical'

  return (
    <article className={`insight-card threat-card ${threat.severity}`}>
      <div className="insight-card-header">
        <div className="threat-badge-group">
          <span className={`severity-tag ${threat.severity}`}>
            {isCritical ? (
              <>
                <ShieldAlert size={14} />
                Critical Threat
              </>
            ) : (
              <>
                <AlertTriangle size={14} />
                Emerging Risk
              </>
            )}
          </span>
          <span className="pillar-chip">{pillarTitle(threat.pillar)}</span>
        </div>
        <span className="impact-tag">{threat.impact}</span>
      </div>

      <h3 className="insight-title">{threat.title}</h3>

      <div className="insight-detail-block">
        <span className="detail-label">Current Observation:</span>
        <p className="detail-text">{threat.currentCondition}</p>
      </div>

      {/* CALLOUT TO PREVENT FUTURE CRITICAL CONDITIONS */}
      <div className="future-risk-callout">
        <div className="callout-header">
          <Flame size={15} />
          <strong>Critical Condition to Prevent:</strong>
        </div>
        <p className="callout-text">{threat.futureRisk}</p>
      </div>

      <div className="threat-resolution-row">
        <div className="action-recommendation">
          <strong>Recommended Mitigation: </strong>
          <span>{threat.recommendedAction}</span>
        </div>
        <button
          className="button action-jump-button"
          onClick={() => onNavigate(threat.targetPage, threat.targetQuery)}
        >
          {threat.actionLabel}
          <ArrowRight size={14} />
        </button>
      </div>
    </article>
  )
}

function OptimizationCard({
  optimization: opt,
  onNavigate,
}: {
  optimization: BusinessOptimization
  onNavigate: BusinessPageProps['onNavigate']
}) {
  return (
    <article className="insight-card optimization-card">
      <div className="insight-card-header">
        <div className="threat-badge-group">
          <span className="severity-tag optimization">
            <Lightbulb size={14} />
            Optimization
          </span>
          <span className="pillar-chip">{pillarTitle(opt.pillar)}</span>
        </div>
        <span className="benefit-highlight">{opt.potentialBenefit}</span>
      </div>

      <h3 className="insight-title">{opt.title}</h3>

      <div className="insight-detail-block">
        <span className="detail-label">Expected Operational Impact:</span>
        <p className="detail-text font-mono">{opt.metricImpact}</p>
      </div>

      <div className="opt-rationale-block">
        <p>{opt.rationale}</p>
      </div>

      <div className="threat-resolution-row">
        <div className="action-recommendation">
          <strong>Action Plan: </strong>
          <span>Execute this optimization in the {opt.targetPage} module.</span>
        </div>
        <button
          className="button secondary action-jump-button"
          onClick={() => onNavigate(opt.targetPage, opt.targetQuery)}
        >
          {opt.actionLabel}
          <ArrowRight size={14} />
        </button>
      </div>
    </article>
  )
}

function pillarTitle(key: HealthPillarKey): string {
  switch (key) {
    case 'liquidity':
      return 'Liquidity & Runway'
    case 'inventory':
      return 'Supply Chain & Stock'
    case 'suppliers':
      return 'Supplier Reliability'
    case 'profitability':
      return 'Commercial & Margins'
  }
}
