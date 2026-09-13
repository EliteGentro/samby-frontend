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

async function dismissGuideSummary() {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Not now' }),
  )
}

test('starts with an empty business and keeps demo data in a separate namespace', async () => {
  render(<App />)
  await dismissGuideSummary()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Business Overview',
  )
  expect(screen.queryByText('Recorded sales')).not.toBeInTheDocument()
  const businessId = localStorage.getItem('samby.workspace-id.business')
  fireEvent.click(
    screen.getByRole('button', { name: 'Explore demo workspace' }),
  )
  await dismissGuideSummary()
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Business Overview',
    ),
  )
  expect(screen.getByText('Recorded sales')).toBeInTheDocument()
  expect(localStorage.getItem('samby.workspace-id.demo')).not.toBe(businessId)
  fireEvent.click(screen.getByRole('button', { name: 'Exit demo' }))
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Business Overview',
    ),
  )
  expect(screen.queryByText('Recorded sales')).not.toBeInTheDocument()
})

test('opens a labeled resumable intake dialog and closes with Escape', async () => {
  render(<App />)
  await dismissGuideSummary()
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
    'Business Overview',
  )
})

test('collapses and expands the sidebar with state persistence', async () => {
  const { container } = render(<App />)
  const collapseBtn = screen.getByRole('button', { name: 'Collapse sidebar' })
  expect(collapseBtn).toBeInTheDocument()

  const appShell = container.querySelector('.app-shell')
  expect(appShell).not.toHaveAttribute('data-collapsed', 'true')

  fireEvent.click(collapseBtn)
  expect(appShell).toHaveAttribute('data-collapsed', 'true')
  expect(localStorage.getItem('samby.sidebar-collapsed')).toBe('true')

  const expandBtn = screen.getByRole('button', { name: 'Expand sidebar' })
  expect(expandBtn).toBeInTheDocument()

  fireEvent.click(expandBtn)
  expect(appShell).not.toHaveAttribute('data-collapsed', 'true')
  expect(localStorage.getItem('samby.sidebar-collapsed')).toBe('false')
})

test('navigates to Quick Insights from the primary navigation bar', async () => {
  render(<App />)
  await dismissGuideSummary()

  const insightsLink = screen.getByRole('link', { name: /Quick Insights/i })
  expect(insightsLink).toBeInTheDocument()
  expect(insightsLink).toHaveAttribute('href', '#/business/insights')

  fireEvent.click(insightsLink)
  window.location.hash = '#/business/insights'
  window.dispatchEvent(new HashChangeEvent('hashchange'))

  await dismissGuideSummary()

  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Quick Insights',
    ),
  )
})

test('triggers quick find dialog via button and keyboard shortcut F', async () => {
  render(<App />)
  const findBtn = screen.getByRole('button', { name: 'Find or search' })
  expect(findBtn).toBeInTheDocument()

  fireEvent.click(findBtn)
  const dialog = screen.getByRole('dialog', { name: 'A guide to SAMBY' })
  expect(dialog).toBeInTheDocument()

  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )

  fireEvent.keyDown(window, { key: 'f' })
  expect(
    screen.getByRole('dialog', { name: 'A guide to SAMBY' }),
  ).toBeInTheDocument()
})

