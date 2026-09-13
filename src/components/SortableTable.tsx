import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useState,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  ChevronsUpDown,
  TableProperties,
} from 'lucide-react'
import { Collapsible } from 'radix-ui'
import { Button } from './ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card'
import { Progress } from './ui/progress'
import { TableHead } from './workspace-ui'

type Direction = 'descending' | 'ascending'
type SortState = { column: number; direction: Direction } | null
type ElementWithChildren = ReactElement<{ children?: ReactNode }>
type HeaderElement = ReactElement<ComponentPropsWithoutRef<'th'>>
type CellElement = ReactElement<{
  children?: ReactNode
  'data-sort-value'?: string | number | null
}>

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join(' ')
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return nodeText(node.props.children)
  }
  return ''
}

function flattenedChildren(node: ReactNode): ReactNode[] {
  return Children.toArray(node).flatMap((child) =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? flattenedChildren(child.props.children)
      : [child],
  )
}

type SortValue =
  | { missing: true; kind: 'text'; value: string }
  | { missing: false; kind: 'number'; value: number }
  | { missing: false; kind: 'text'; value: string }

function normalize(value: string | number | null | undefined): SortValue {
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { missing: false, kind: 'number', value }
      : { missing: true, kind: 'text', value: '' }
  }

  const text = (value ?? '').trim()
  if (
    !text ||
    /^(not provided|not received|not recorded|unknown|unavailable|undefined|none)\b/i.test(
      text,
    )
  ) {
    return { missing: true, kind: 'text', value: text }
  }

  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:\b|$)/)
  if (isoDate) {
    return {
      missing: false,
      kind: 'number',
      value: Date.UTC(+isoDate[1], +isoDate[2] - 1, +isoDate[3]),
    }
  }

  const quarter = text.match(/^Q([1-4])\s+(\d{4})/i)
  if (quarter) {
    return {
      missing: false,
      kind: 'number',
      value: +quarter[2] * 4 + +quarter[1],
    }
  }

  const numericParts = text.match(/-?\d[\d,.]*/g)
  if (numericParts?.length === 1) {
    const sign =
      /^\s*[-(]/.test(text) && !numericParts[0].startsWith('-') ? -1 : 1
    const numeric = Number(numericParts[0].replace(/,/g, '')) * sign
    if (Number.isFinite(numeric)) {
      return { missing: false, kind: 'number', value: numeric }
    }
  }

  return { missing: false, kind: 'text', value: text }
}

function cellValue(row: ReactNode, column: number): SortValue {
  if (!isValidElement<{ children?: ReactNode }>(row)) return normalize(null)
  const cell = flattenedChildren(row.props.children)[column]
  if (!isValidElement(cell)) return normalize(null)
  const typedCell = cell as CellElement
  return normalize(
    typedCell.props['data-sort-value'] ?? nodeText(typedCell.props.children),
  )
}

function compareValues(left: SortValue, right: SortValue) {
  if (left.missing !== right.missing) return left.missing ? 1 : -1
  if (left.missing && right.missing) return 0
  if (left.kind === 'number' && right.kind === 'number') {
    return left.value - right.value
  }
  return collator.compare(String(left.value), String(right.value))
}

function nextSort(current: SortState, column: number): SortState {
  if (!current || current.column !== column) {
    return { column, direction: 'descending' }
  }
  if (current.direction === 'descending') {
    return { column, direction: 'ascending' }
  }
  return null
}

function nextDirectionLabel(current: SortState, column: number) {
  if (!current || current.column !== column) return 'greatest to least'
  if (current.direction === 'descending') return 'smallest to greatest'
  return 'default order'
}

function tableShape(sections: ReactNode[]) {
  const head = sections.find(
    (section) => isValidElement(section) && section.type === 'thead',
  ) as ElementWithChildren | undefined
  const body = sections.find(
    (section) => isValidElement(section) && section.type === 'tbody',
  ) as ElementWithChildren | undefined
  const headRow = head
    ? (flattenedChildren(head.props.children).find(isValidElement) as
        ElementWithChildren | undefined)
    : undefined
  const headers = headRow
    ? flattenedChildren(headRow.props.children).map((header) =>
        isValidElement<{ children?: ReactNode }>(header)
          ? nodeText(header.props.children).trim()
          : '',
      )
    : []
  const rowElements = body ? flattenedChildren(body.props.children) : []
  const rows = rowElements.map((row) =>
    isValidElement<{ children?: ReactNode }>(row)
      ? flattenedChildren(row.props.children).map((cell) =>
          isValidElement<{ children?: ReactNode }>(cell)
            ? nodeText(cell.props.children).trim()
            : '',
        )
      : [],
  )
  return { headers, rowElements, rows }
}

const quantitativeHeader =
  /amount|quantity|cost|profit|turnover|dio|gmroi|coverage|records|rows|units|days|rate|share|value|sales|balance|advance|target|difference|fulfilled|available|outstanding|age|version|observations/i
const dateHeader = /date|quarter|window|deadline|imported|as of/i

function TableVisualization({
  headers,
  rowElements,
  rows,
  label,
}: ReturnType<typeof tableShape> & { label: string }) {
  const numericColumns = headers
    .map((header, column) => ({
      header,
      column,
      points: rowElements.flatMap((row, index) => {
        const value = cellValue(row, column)
        return !value.missing && value.kind === 'number'
          ? [
              {
                label: rows[index]?.[0] || `Row ${index + 1}`,
                display: rows[index]?.[column] || String(value.value),
                value: value.value,
              },
            ]
          : []
      }),
    }))
    .filter(
      ({ header, column, points }) =>
        column > 0 &&
        points.length > 0 &&
        quantitativeHeader.test(header) &&
        !dateHeader.test(header),
    )
    .sort((left, right) => right.points.length - left.points.length)
  const numeric = numericColumns[0]
  const points = numeric
    ? [...numeric.points]
        .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))
        .slice(0, 5)
    : []
  const maximum = Math.max(1, ...points.map((point) => Math.abs(point.value)))
  const completeness = headers.slice(0, 5).map((header, column) => {
    const populated = rowElements.filter(
      (row) => !cellValue(row, column).missing,
    ).length
    return {
      header: header || `Column ${column + 1}`,
      populated,
      percentage: rowElements.length
        ? (populated / rowElements.length) * 100
        : 0,
    }
  })
  const visualItems = numeric
    ? points.map((point) => ({
        label: point.label,
        value: point.display,
        progress: (Math.abs(point.value) / maximum) * 100,
      }))
    : completeness.map((item) => ({
        label: item.header,
        value: `${item.populated}/${rows.length}`,
        progress: item.percentage,
      }))

  return (
    <Card
      role="group"
      aria-label={`Visual summary of ${label}`}
      className="min-w-0 gap-3 overflow-hidden border-border/80 bg-gradient-to-br from-accent/45 via-card to-card shadow-none"
    >
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 flex-1 gap-1.5">
          <CardTitle className="flex items-center gap-2">
            <ChartNoAxesColumnIncreasing className="size-4 text-secondary" />
            {numeric ? `${numeric.header} comparison` : 'Data completeness'}
          </CardTitle>
          <CardDescription>
            {numeric
              ? `Largest values across the ${label.toLowerCase()}.`
              : `Populated values by column across the ${label.toLowerCase()}.`}
          </CardDescription>
        </div>
        <div className="flex gap-2" aria-label="Table size">
          <span className="rounded-lg border border-border bg-card px-2.5 py-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
            <strong className="mr-1 text-sm text-foreground">
              {rows.length}
            </strong>
            rows
          </span>
          <span className="rounded-lg border border-border bg-card px-2.5 py-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
            <strong className="mr-1 text-sm text-foreground">
              {headers.length}
            </strong>
            fields
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card/70 px-3 py-4 text-xs text-muted-foreground">
            No rows are available for this view yet.
          </p>
        ) : (
          <div className="grid gap-2.5" role="list">
            {visualItems.map((item, index) => {
              return (
                <div
                  className="grid min-w-0 gap-1.5 rounded-lg border border-border/70 bg-card/85 px-3 py-2.5"
                  key={`${item.label}-${item.value}-${index}`}
                  role="listitem"
                >
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span
                      className="truncate text-muted-foreground"
                      title={item.label}
                    >
                      {item.label}
                    </span>
                    <strong className="shrink-0 font-mono text-[11px] font-medium text-foreground">
                      {item.value}
                    </strong>
                  </div>
                  <Progress
                    value={item.progress}
                    aria-label={`${item.label}: ${item.value}`}
                  />
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

type SortableTableProps = Omit<
  ComponentPropsWithoutRef<'table'>,
  'children'
> & {
  children: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  showVisualization?: boolean
  /** Render only the completeness summary, leaving the rows to another panel. */
  showTable?: boolean
  tableLabel?: string
}

/**
 * A drop-in data table with accessible, stable three-state column sorting.
 * Add data-sort-value to a body cell when its display text is not the value
 * that should determine its order.
 */
export function SortableTable({
  children,
  collapsible = true,
  defaultOpen = false,
  showVisualization = true,
  showTable = true,
  tableLabel,
  ...props
}: SortableTableProps) {
  const [sort, setSort] = useState<SortState>(null)
  const [open, setOpen] = useState(defaultOpen)
  const sections = Children.toArray(children).map((section) => {
    if (
      isValidElement<{ headers: readonly string[] }>(section) &&
      section.type === TableHead
    )
      return (
        <thead key={section.key}>
          <tr>
            {section.props.headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
      )
    return section
  })
  const shape = tableShape(sections)
  const label =
    tableLabel ||
    shape.headers.filter(Boolean).slice(0, 2).join(' and ') ||
    'data table'

  const renderedSections = sections.map((section) => {
    if (!isValidElement<{ children?: ReactNode }>(section)) return section
    const element = section as ElementWithChildren

    if (element.type === 'thead') {
      return cloneElement(
        element,
        undefined,
        Children.map(element.props.children, (row) => {
          if (!isValidElement<{ children?: ReactNode }>(row)) return row
          const rowElement = row as ElementWithChildren
          return cloneElement(
            rowElement,
            undefined,
            flattenedChildren(rowElement.props.children).map(
              (header, column) => {
                if (!isValidElement<{ children?: ReactNode }>(header)) {
                  return header
                }
                const headerElement = header as HeaderElement
                const direction =
                  sort?.column === column ? sort.direction : undefined
                const Icon =
                  direction === 'descending'
                    ? ArrowDown
                    : direction === 'ascending'
                      ? ArrowUp
                      : ChevronsUpDown
                return cloneElement(
                  headerElement,
                  {
                    ...headerElement.props,
                    key: `sortable-header-${column}`,
                    scope: 'col',
                    'aria-sort': direction ?? 'none',
                  },
                  <button
                    type="button"
                    className="sortable-table-header"
                    onClick={() =>
                      setSort((current) => nextSort(current, column))
                    }
                    title={`Sort ${nextDirectionLabel(sort, column)}`}
                  >
                    <span>{headerElement.props.children}</span>
                    <Icon aria-hidden="true" size={14} strokeWidth={1.8} />
                  </button>,
                )
              },
            ),
          )
        }),
      )
    }

    if (element.type === 'tbody' && sort) {
      const rows = flattenedChildren(element.props.children).map(
        (row, index) => ({
          row,
          index,
        }),
      )
      rows.sort((left, right) => {
        const leftValue = cellValue(left.row, sort.column)
        const rightValue = cellValue(right.row, sort.column)
        if (leftValue.missing !== rightValue.missing) {
          return leftValue.missing ? 1 : -1
        }
        const comparison = compareValues(leftValue, rightValue)
        if (comparison === 0) return left.index - right.index
        return sort.direction === 'descending' ? -comparison : comparison
      })
      return cloneElement(
        element,
        undefined,
        rows.map(({ row }) => row),
      )
    }

    return section
  })

  const table = <table {...props}>{renderedSections}</table>

  return (
    <div className="grid w-full min-w-0 max-w-full gap-3 overflow-hidden">
      {showVisualization && <TableVisualization {...shape} label={label} />}
      {!showTable ? null : collapsible ? (
        <Collapsible.Root
          open={open}
          onOpenChange={setOpen}
          className="min-w-0 max-w-full"
        >
          <Collapsible.Trigger asChild>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-auto min-h-11 w-full justify-start gap-2.5 px-3 py-2 text-xs"
              aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
            >
              <TableProperties className="size-4 text-secondary" />
              <span>{open ? 'Hide' : 'Show'} detailed table</span>
              <span className="ml-auto rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {shape.rows.length} rows
              </span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </Button>
          </Collapsible.Trigger>
          <Collapsible.Content
            forceMount
            hidden={!open}
            className="min-w-0 max-w-full overflow-hidden data-[state=closed]:hidden data-[state=open]:animate-in data-[state=open]:fade-in-0"
          >
            <div className="max-w-full overflow-x-auto pt-3">{table}</div>
          </Collapsible.Content>
        </Collapsible.Root>
      ) : (
        <div className="max-w-full overflow-x-auto">{table}</div>
      )}
    </div>
  )
}
