import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { SortableTable } from './SortableTable'
import { TableHead } from './workspace-ui'

afterEach(cleanup)

test('sorts reusable table headers and preserves stable row order for equal values', () => {
  render(
    <SortableTable>
      <TableHead headers={['Product', 'Quantity']} />
      <tbody>
        <tr key="a">
          <td>First</td>
          <td>2</td>
        </tr>
        <tr key="b">
          <td>Second</td>
          <td>10</td>
        </tr>
        <tr key="c">
          <td>Third</td>
          <td>2</td>
        </tr>
      </tbody>
    </SortableTable>,
  )
  const quantity = screen.getByRole('button', { name: 'Quantity' })
  fireEvent.click(quantity)
  expect(values(0)).toEqual(['Second', 'First', 'Third'])
  fireEvent.click(quantity)
  expect(values(0)).toEqual(['First', 'Third', 'Second'])
  fireEvent.click(quantity)
  expect(values(0)).toEqual(['First', 'Second', 'Third'])
})

function values(column: number) {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[column].textContent)
}

test('cycles numeric columns through descending, ascending, and default order', () => {
  render(
    <SortableTable>
      <thead>
        <tr>
          <>
            <th>Name</th>
            <th>Quantity</th>
          </>
        </tr>
      </thead>
      <tbody>
        <tr>
          <>
            <td>Banana</td>
            <td>2</td>
          </>
        </tr>
        <tr>
          <>
            <td>Apple</td>
            <td>10</td>
          </>
        </tr>
        <tr>
          <>
            <td>Cherry</td>
            <td>1</td>
          </>
        </tr>
        <tr>
          <>
            <td>Unknown</td>
            <td>Not provided</td>
          </>
        </tr>
      </tbody>
    </SortableTable>,
  )

  const quantity = screen.getByRole('button', { name: 'Quantity' })
  fireEvent.click(quantity)
  expect(values(1)).toEqual(['10', '2', '1', 'Not provided'])
  expect(quantity.closest('th')).toHaveAttribute('aria-sort', 'descending')

  fireEvent.click(quantity)
  expect(values(1)).toEqual(['1', '2', '10', 'Not provided'])
  expect(quantity.closest('th')).toHaveAttribute('aria-sort', 'ascending')

  fireEvent.click(quantity)
  expect(values(1)).toEqual(['2', '10', '1', 'Not provided'])
  expect(quantity.closest('th')).toHaveAttribute('aria-sort', 'none')
})

test('sorts strings alphabetically in both directions', () => {
  render(
    <SortableTable>
      <thead>
        <tr>
          <th>Name</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Banana</td>
        </tr>
        <tr>
          <td>apple</td>
        </tr>
        <tr>
          <td>Cherry</td>
        </tr>
      </tbody>
    </SortableTable>,
  )

  const name = screen.getByRole('button', { name: 'Name' })
  fireEvent.click(name)
  expect(values(0)).toEqual(['Cherry', 'Banana', 'apple'])
  fireEvent.click(name)
  expect(values(0)).toEqual(['apple', 'Banana', 'Cherry'])
})
