import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App'
import { AuthProvider } from './auth/AuthContext'

test('renders the neutral unauthenticated landing page', () => {
  render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  )

  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'A quiet foundation for real-time applications.',
  )
  expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument()
  expect(screen.getByText(/protected developer sandbox/i)).toBeInTheDocument()
})
