import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { DisclosureCard } from './disclosure-card'

afterEach(cleanup)

test('expands and collapses its section content from the card header', () => {
  render(
    <DisclosureCard
      title="Category GMROI versus DIO"
      description="Two supported categories"
    >
      <p>Category comparison table</p>
    </DisclosureCard>,
  )

  const trigger = screen.getByRole('button', {
    name: /Category GMROI versus DIO/i,
  })
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('Category comparison table')).not.toBeInTheDocument()

  fireEvent.click(trigger)
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('Category comparison table')).toBeInTheDocument()

  fireEvent.click(trigger)
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('Category comparison table')).not.toBeInTheDocument()
})

test('can render expanded by default', () => {
  render(
    <DisclosureCard title="Open purchase orders" defaultOpen>
      <p>Open-order table</p>
    </DisclosureCard>,
  )

  expect(
    screen.getByRole('button', { name: /Open purchase orders/i }),
  ).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('Open-order table')).toBeInTheDocument()
})
