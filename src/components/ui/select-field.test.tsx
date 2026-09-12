import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { SelectField } from './select-field'

afterEach(cleanup)

test('supports native-style option children and form values', () => {
  const changed = vi.fn()
  const { container } = render(
    <form>
      <label>
        Location
        <SelectField name="location" defaultValue="" onChange={changed}>
          <option value="">All locations</option>
          <option value="north">North warehouse</option>
        </SelectField>
      </label>
    </form>,
  )

  const control = screen.getByRole('combobox', { name: 'Location' })
  expect(control).toHaveTextContent('All locations')

  fireEvent.change(control, { target: { value: 'north' } })

  expect(control).toHaveTextContent('North warehouse')
  expect(changed).toHaveBeenCalled()
  expect(new FormData(container.querySelector('form')!).get('location')).toBe(
    'north',
  )
})
