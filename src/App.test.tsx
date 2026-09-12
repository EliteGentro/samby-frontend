import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'

vi.mock('./auth/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}))
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  history.replaceState(null, '', '/#/business/home')
})
afterEach(cleanup)

test('starts with an empty business and keeps demo data in a separate namespace', async () => {
  render(<App />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'A clearer picture starts here.',
  )
  expect(screen.queryByText('Recorded sales')).not.toBeInTheDocument()
  const businessId = localStorage.getItem('samby.workspace-id.business')
  fireEvent.click(
    screen.getByRole('button', { name: 'Explore demo workspace' }),
  )
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Your business, in view.',
    ),
  )
  expect(screen.getByText('Recorded sales')).toBeInTheDocument()
  expect(localStorage.getItem('samby.workspace-id.demo')).not.toBe(businessId)
  fireEvent.click(screen.getByRole('button', { name: 'Exit demo' }))
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'A clearer picture starts here.',
    ),
  )
  expect(screen.queryByText('Recorded sales')).not.toBeInTheDocument()
})

test('opens a labeled resumable intake dialog and closes with Escape', async () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Set up my workspace' }))
  const dialog = screen.getByRole('dialog', {
    name: 'Start with the data you have',
  })
  expect(dialog).toHaveAccessibleDescription(
    'Review each interpretation before applying records. Optional data can wait.',
  )
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'A clearer picture starts here.',
  )
})
