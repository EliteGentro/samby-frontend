import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthActions } from './AuthActions'

const auth = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  user: null,
}))

vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))

beforeEach(() => {
  vi.resetAllMocks()
  auth.isAuthenticated = false
  auth.isLoading = false
})

afterEach(cleanup)

test('focuses the first field, contains keyboard focus, and restores the opener after Escape', async () => {
  render(<AuthActions />)
  const opener = screen.getByRole('button', { name: 'Log in' })
  opener.focus()
  fireEvent.click(opener)

  const dialog = screen.getByRole('dialog', { name: 'Welcome back' })
  expect(dialog).toHaveAccessibleDescription(
    'Sign in to continue working on your business.',
  )
  expect(screen.getByRole('textbox', { name: 'Email' })).toHaveFocus()

  const lastControl = within(dialog).getByRole('button', {
    name: 'New to SAMBY? Create an account',
  })
  lastControl.focus()
  fireEvent.keyDown(lastControl, { key: 'Tab' })
  expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus()

  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  await waitFor(() => expect(opener).toHaveFocus())
})

test('announces a login failure and opens signup without the stale error', async () => {
  auth.login.mockRejectedValueOnce(new Error('Invalid email or password'))
  render(<AuthActions />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
    target: { value: 'owner@example.com' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'wrong-password' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Log in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Invalid email or password',
  )
  expect(auth.login).toHaveBeenCalledWith('owner@example.com', 'wrong-password')

  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
  expect(
    screen.getByRole('dialog', { name: 'Create your account' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus()
  expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
    'Use at least 8 characters.',
  )
})

test('discards a late login error after switching to signup', async () => {
  let rejectLogin!: (error: Error) => void
  auth.login.mockImplementationOnce(
    () =>
      new Promise<void>((_, reject) => {
        rejectLogin = reject
      }),
  )
  render(<AuthActions />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
    target: { value: 'owner@example.com' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'wrong-password' },
  })
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Log in' }),
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'New to SAMBY? Create an account' }),
  )
  await act(async () => rejectLogin(new Error('Invalid email or password')))

  expect(
    screen.getByRole('dialog', { name: 'Create your account' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('')
})

test('submits account details and closes after successful registration', async () => {
  auth.register.mockResolvedValueOnce(undefined)
  render(<AuthActions />)
  fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
    target: { value: 'Sam' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
    target: { value: 'sam@example.com' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'good-password' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(auth.register).toHaveBeenCalledWith(
    'sam@example.com',
    'good-password',
    'Sam',
  )
})
