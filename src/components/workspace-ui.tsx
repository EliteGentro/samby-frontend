import { useContext, useId, useState, type ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { ArrowUpRight, ChevronDown, Database, X } from 'lucide-react'
import { useDialogFocus } from './use-dialog-focus'
import { dateLabel, number } from '../domain/workspace'

import { CapabilityDisplayContext } from './capability-context'
import { SortableTable } from './SortableTable'

export function CapabilityDisplay({
  id,
  children,
}: {
  id: string
  children: ReactNode
}) {
  return useContext(CapabilityDisplayContext).includes(id) ? null : (
    <>{children}</>
  )
}

export function TableHead({ headers }: { headers: readonly string[] }) {
  return (
    <thead>
      <tr>
        {headers.map((header) => (
          <th key={header}>{header}</th>
        ))}
      </tr>
    </thead>
  )
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  wide?: boolean
}) {
  const focus = useDialogFocus()
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          {...focus}
          className={`modal-content ${wide ? 'wide' : ''}`}
          {...(!description ? { 'aria-describedby': undefined } : {})}
        >
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Dialog.Description>{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 tabIndex={-1}>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="page-actions">{action}</div>}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  note,
  trend,
  icon,
  accent = false,
  capability,
  hideUnavailable = false,
  onInspect,
}: {
  hideUnavailable?: boolean
  onInspect?: () => void
  capability?: string
  label: string
  value: string
  note: string
  trend?: string
  icon?: ReactNode
  accent?: boolean
}) {
  const muted = useContext(CapabilityDisplayContext)
  if (
    (capability && muted.includes(capability)) ||
    (hideUnavailable && value === 'Not provided')
  )
    return null
  return (
    <article className={`metric-card ${accent ? 'accent' : ''}`}>
      <div className="metric-label">
        {label}
        {icon}
      </div>
      <div className="metric-value">{value}</div>
      <p className="metric-note">
        {trend && <span className="trend">{trend}</span>}
        {note}
      </p>
      {onInspect && (
        <button
          className="text-button"
          onClick={onInspect}
          aria-label={`Inspect ${label}`}
        >
          Inspect records
          <ArrowUpRight size={13} />
        </button>
      )}
    </article>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        {icon ?? <Database size={26} strokeWidth={1.5} />}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function Tabs({
  tabs,
  value,
  onChange,
  label = 'View',
}: {
  tabs: string[]
  value: string
  onChange: (value: string) => void
  label?: string
}) {
  return (
    <div className="tabs" role="group" aria-label={label}>
      {tabs.map((tab) => (
        <button
          className={value === tab ? 'active' : ''}
          aria-pressed={value === tab}
          key={tab}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
  capability,
}: {
  capability?: string
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  const muted = useContext(CapabilityDisplayContext)
  if (capability && muted.includes(capability)) return null
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function ViewLink({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button className="text-button" onClick={onClick}>
      {children}
      <ArrowUpRight size={16} />
    </button>
  )
}

export type ChartPoint = {
  date: string
  [key: string]: string | number | null | undefined
}
export function DataChart({
  data,
  series,
  label,
  unit = '',
  height = 230,
  activeDate,
}: {
  data: ChartPoint[]
  series: { key: string; label: string; color?: string }[]
  label: string
  unit?: string
  height?: number
  activeDate?: string
}) {
  const id = useId().replaceAll(':', '')
  const [selected, setSelected] = useState<number | null>(null)
  if (!data.length)
    return (
      <EmptyState
        title="No observations in this period"
        description="Add dated records or select a period covered by your data."
      />
    )
  const numbers = data.flatMap((p) =>
    series
      .map((s) => p[s.key])
      .filter((v): v is number => typeof v === 'number'),
  )
  const minimum = Math.min(0, ...numbers),
    maximum = Math.max(1, ...numbers)
  const range = maximum - minimum
  const width = 680,
    left = 62,
    right = 20,
    top = 18,
    bottom = 38
  const x = (i: number) =>
    left + (i / Math.max(1, data.length - 1)) * (width - left - right)
  const y = (v: number) =>
    top + ((maximum - v) / range) * (height - top - bottom)
  const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)']
  const activeIndex = activeDate
    ? data.findIndex((point) => point.date === activeDate)
    : -1
  const displayedIndex = selected ?? (activeIndex >= 0 ? activeIndex : null)
  return (
    <div className="chart-wrap" data-active-date={activeDate}>
      <div className="chart-legend">
        {series.map((s, i) => (
          <span key={s.key}>
            <i style={{ background: s.color ?? colors[i % colors.length] }} />
            {s.label}
          </span>
        ))}
        {unit && <span className="chart-unit">{unit}</span>}
      </div>
      <svg
        className="data-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={id}
        onMouseLeave={() => setSelected(null)}
      >
        <title id={id}>
          {label}. {dateLabel(data[0].date)} to{' '}
          {dateLabel(data[data.length - 1].date)}. A data table follows.
        </title>
        {Array.from({ length: 5 }, (_, i) => {
          const value = minimum + (range * i) / 4
          return (
            <g key={i}>
              <line
                x1={left}
                x2={width - right}
                y1={y(value)}
                y2={y(value)}
                stroke="var(--border)"
                strokeDasharray="3 5"
              />
              <text x={left - 12} y={y(value) + 4} textAnchor="end">
                {Math.abs(value) >= 1000
                  ? `${Math.round(value / 1000)}k`
                  : Math.round(value)}
              </text>
            </g>
          )
        })}
        {series.map((s, i) => {
          const points = data
            .map((p, index) =>
              typeof p[s.key] === 'number'
                ? `${x(index)},${y(p[s.key] as number)}`
                : null,
            )
            .filter(Boolean)
            .join(' ')
          return (
            <polyline
              key={s.key}
              points={points}
              fill="none"
              stroke={s.color ?? colors[i % colors.length]}
              strokeWidth={i === 0 ? 2.8 : 2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={i === 1 ? '6 4' : undefined}
            />
          )
        })}
        {[
          0,
          Math.floor((data.length - 1) / 3),
          Math.floor((2 * (data.length - 1)) / 3),
          data.length - 1,
        ]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((index) => (
            <text
              key={index}
              x={x(index)}
              y={height - 9}
              textAnchor={
                index === 0
                  ? 'start'
                  : index === data.length - 1
                    ? 'end'
                    : 'middle'
              }
            >
              {dateLabel(data[index].date)}
            </text>
          ))}
        {data.map((point, i) => (
          <rect
            key={point.date}
            x={x(i) - Math.max(4, (width - left - right) / data.length / 2)}
            y={top}
            width={Math.max(8, (width - left - right) / data.length)}
            height={height - top - bottom}
            fill="transparent"
            onMouseEnter={() => setSelected(i)}
          />
        ))}
        {displayedIndex !== null && (
          <line
            className="chart-playhead"
            x1={x(displayedIndex)}
            x2={x(displayedIndex)}
            y1={top}
            y2={height - bottom}
            stroke="var(--muted-foreground)"
            strokeDasharray="3 3"
          />
        )}
      </svg>
      {displayedIndex !== null && (
        <p className="chart-readout">
          {dateLabel(data[displayedIndex].date)}
          {series.map((s) => (
            <span key={s.key}>
              {s.label}{' '}
              <strong>
                {typeof data[displayedIndex][s.key] === 'number'
                  ? number(data[displayedIndex][s.key] as number)
                  : 'Not provided'}
              </strong>
            </span>
          ))}
        </p>
      )}
      <details className="chart-table">
        <summary>
          View dated values <ChevronDown size={14} />
        </summary>
        <div className="table-wrap">
          <SortableTable
            className="data-table"
            collapsible={false}
            showVisualization={false}
            tableLabel={`${label} dated values`}
          >
            <thead>
              <tr>
                <th>Date</th>
                {series.map((s) => (
                  <th key={s.key}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  {series.map((s) => (
                    <td key={s.key}>
                      {typeof p[s.key] === 'number'
                        ? number(p[s.key] as number)
                        : 'Not provided'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </SortableTable>
        </div>
      </details>
    </div>
  )
}
