import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'

const buttonClass =
  'rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function AuthActions() {
  const { isAuthenticated, isLoading, login, logout, register, user } = useAuth()
  const [mode, setMode] = useState<'login' | 'register' | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const data = new FormData(event.currentTarget)
    try {
      if (mode === 'register') {
        await register(
          String(data.get('email')),
          String(data.get('password')),
          String(data.get('name')),
        )
      } else {
        await login(String(data.get('email')), String(data.get('password')))
      }
      setMode(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Authentication failed')
    }
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-3">
        <span className="hidden max-w-40 truncate text-sm text-muted-foreground sm:block">
          {user?.name ?? user?.email}
        </span>
        <button
          className={`${buttonClass} border border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground`}
          onClick={logout}
        >
          Log out
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          className={`${buttonClass} text-foreground hover:bg-accent hover:text-accent-foreground`}
          onClick={() => setMode('login')}
        >
          Log in
        </button>
        <button
          className={`${buttonClass} bg-primary text-primary-foreground hover:bg-primary/90`}
          onClick={() => setMode('register')}
        >
          Sign up
        </button>
      </div>
      {mode && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/80 px-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-title"
        >
          <form
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-card-foreground shadow-2xl"
            onSubmit={submit}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
                  Native authentication
                </p>
                <h2 className="mt-2 text-2xl font-semibold" id="auth-title">
                  {mode === 'register' ? 'Create your account' : 'Welcome back'}
                </h2>
              </div>
              <button
                aria-label="Close"
                className="rounded-lg px-3 py-1 text-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={() => setMode(null)}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="mt-6 grid gap-4">
              {mode === 'register' && (
                <Field label="Name" name="name" autoComplete="name" />
              )}
              <Field label="Email" name="email" type="email" autoComplete="email" required />
              <Field
                label="Password"
                name="password"
                type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={8}
                required
              />
            </div>
            {formError && <p className="mt-4 text-sm text-destructive">{formError}</p>}
            <button
              className="mt-6 w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Log in'}
            </button>
          </form>
        </div>
      )}
    </>
  )
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid gap-2 text-sm text-foreground">
      {label}
      <input
        className="rounded-lg border border-border bg-input px-3 py-2.5 text-foreground outline-none transition focus:border-ring"
        {...props}
      />
    </label>
  )
}
