import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'

const buttonClass =
  'rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300'

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
        <span className="hidden max-w-40 truncate text-sm text-slate-300 sm:block">
          {user?.name ?? user?.email}
        </span>
        <button
          className={`${buttonClass} border border-white/15 bg-white/5 hover:bg-white/10`}
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
          className={`${buttonClass} text-slate-200 hover:bg-white/5`}
          onClick={() => setMode('login')}
        >
          Log in
        </button>
        <button
          className={`${buttonClass} bg-cyan-300 text-slate-950 hover:bg-cyan-200`}
          onClick={() => setMode('register')}
        >
          Sign up
        </button>
      </div>
      {mode && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 px-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-title"
        >
          <form
            className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
            onSubmit={submit}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Native authentication
                </p>
                <h2 className="mt-2 text-2xl font-semibold" id="auth-title">
                  {mode === 'register' ? 'Create your account' : 'Welcome back'}
                </h2>
              </div>
              <button
                aria-label="Close"
                className="rounded-full px-3 py-1 text-xl text-slate-400 hover:bg-white/5"
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
            {formError && <p className="mt-4 text-sm text-rose-300">{formError}</p>}
            <button
              className="mt-6 w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
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
    <label className="grid gap-2 text-sm text-slate-300">
      {label}
      <input
        className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none transition focus:border-cyan-300/60"
        {...props}
      />
    </label>
  )
}
