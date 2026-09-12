import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { SelectField } from './select-field'

afterEach(cleanup)

test('notifies the surrounding draft form with the new selected value', () => {
  const captured: FormDataEntryValue[] = []
  render(
    <form
      onInput={(event) => {
        const value = new FormData(event.currentTarget).get('location')
        if (value !== null) captured.push(value)
      }}
    >
      <SelectField name="location" label="Location" defaultValue="">
        <option value="">Aggregate</option>
        <option value="north">North warehouse</option>
      </SelectField>
    </form>,
  )
  const control = screen.getByRole('combobox', { name: 'Location' })
  fireEvent.change(control, { target: { value: 'north' } })
  expect(captured).toEqual(['north'])
  fireEvent.change(control, {
    target: { value: '__samby_empty_select_value__' },
  })
  expect(captured).toEqual(['north', ''])
})

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
