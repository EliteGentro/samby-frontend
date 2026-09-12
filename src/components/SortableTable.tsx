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
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
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

/**
 * A drop-in data table with accessible, stable three-state column sorting.
 * Add data-sort-value to a body cell when its display text is not the value
 * that should determine its order.
 */
export function SortableTable({
  children,
  ...props
}: ComponentPropsWithoutRef<'table'>) {
  const [sort, setSort] = useState<SortState>(null)
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

  return <table {...props}>{renderedSections}</table>
}
