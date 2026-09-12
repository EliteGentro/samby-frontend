import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiFetch, publicApiFetch } from '../lib/api'

export type AuthUser = {
  id: string
  email: string
  name: string | null
  created_at: string
}

type AuthResponse = {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  user: AuthUser
}

type AuthContextValue = {
  accessToken: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => void
}

const TOKEN_KEY = 'base-monolith-access-token'
const AuthContext = createContext<AuthContextValue | null>(null)

function storedToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(storedToken)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(accessToken))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    let active = true
    apiFetch<AuthUser>('/auth/me', accessToken)
      .then((currentUser) => {
        if (active) setUser(currentUser)
      })
      .catch(() => {
        if (!active) return
        sessionStorage.removeItem(TOKEN_KEY)
        setAccessToken(null)
        setUser(null)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [accessToken])

  async function authenticate(path: '/auth/login' | '/auth/register', payload: object) {
    setIsLoading(true)
    setError(null)
    try {
      const response = await publicApiFetch<AuthResponse>(path, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      sessionStorage.setItem(TOKEN_KEY, response.access_token)
      setAccessToken(response.access_token)
      setUser(response.user)
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Authentication failed'
      setError(message)
      throw requestError
    } finally {
      setIsLoading(false)
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      user,
      isAuthenticated: Boolean(accessToken && user),
      isLoading,
      error,
      login: (email, password) => authenticate('/auth/login', { email, password }),
      register: (email, password, name) =>
        authenticate('/auth/register', { email, password, name: name || undefined }),
      logout: () => {
        sessionStorage.removeItem(TOKEN_KEY)
        setAccessToken(null)
        setUser(null)
        setError(null)
      },
    }),
    [accessToken, error, isLoading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hooks and their provider intentionally share this small module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
