import {
  useId,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from 'react'
import { Dialog } from 'radix-ui'
import { BrandLogo } from './BrandLogo'
import { X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

type AuthMode = 'login' | 'register'
type AuthDialog = { mode: AuthMode; error: string | null } | null

const buttonClass =
  'min-h-11 rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50'

export function AuthActions() {
  const { isAuthenticated, isLoading, login, logout, register, user } =
    useAuth()
  const [dialog, setDialog] = useState<AuthDialog>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const form = useRef<HTMLFormElement | null>(null)
  const generation = useRef(0)
  const errorId = useId()

  function changeMode(mode: AuthMode | null) {
    generation.current += 1
    setDialog(mode ? { mode, error: null } : null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dialog || isLoading) return
    const mode = dialog.mode
    const requestGeneration = generation.current
    setDialog({ mode, error: null })
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
      if (generation.current === requestGeneration) changeMode(null)
    } catch (error) {
      if (generation.current === requestGeneration) {
        setDialog({
          mode,
          error:
            error instanceof Error
              ? error.message
              : 'Unable to sign in. Please try again.',
        })
      }
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
          type="button"
        >
          Log out
        </button>
      </div>
    )
  }

  const isRegistering = dialog?.mode === 'register'

  return (
    <Dialog.Root
      open={dialog !== null}
      onOpenChange={(open) => {
        if (!open) changeMode(null)
      }}
    >
      <div className="flex items-center gap-2">
        <button
          className={`${buttonClass} text-foreground hover:bg-accent hover:text-accent-foreground`}
          aria-haspopup="dialog"
          onClick={(event) => {
            opener.current = event.currentTarget
            changeMode('login')
          }}
          type="button"
        >
          Log in
        </button>
        <button
          className={`${buttonClass} bg-primary text-primary-foreground hover:bg-primary/90`}
          aria-haspopup="dialog"
          onClick={(event) => {
            opener.current = event.currentTarget
            changeMode('register')
          }}
          type="button"
        >
          Sign up
        </button>
      </div>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-lg border border-border bg-card p-6 text-card-foreground shadow-2xl"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            form.current?.querySelector('input')?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            opener.current?.focus()
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <BrandLogo className="auth-brand" />
              <Dialog.Title className="mt-2 text-2xl font-semibold">
                {isRegistering ? 'Create your account' : 'Welcome back'}
              </Dialog.Title>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">
            {isRegistering
              ? 'Start with your business data and build your first useful view.'
              : 'Sign in to continue working on your business.'}
          </Dialog.Description>
          <form
            key={dialog?.mode}
            ref={form}
            onSubmit={submit}
            aria-describedby={dialog?.error ? errorId : undefined}
            aria-busy={isLoading}
          >
            <div className="mt-6 grid gap-4">
              {isRegistering && (
                <Field
                  label="Name"
                  name="name"
                  autoComplete="name"
                  help="Optional. How should we address you?"
                />
              )}
              <Field
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
              <Field
                label="Password"
                name="password"
                type="password"
                autoComplete={
                  isRegistering ? 'new-password' : 'current-password'
                }
                minLength={isRegistering ? 8 : undefined}
                help={isRegistering ? 'Use at least 8 characters.' : undefined}
                required
              />
            </div>
            {dialog?.error && (
              <p
                id={errorId}
                role="alert"
                className="mt-4 rounded-lg border-l-4 border-destructive bg-background p-3 text-sm leading-6 text-foreground"
              >
                {dialog.error}
              </p>
            )}
            <button
              className={`${buttonClass} mt-6 w-full bg-primary py-3 text-primary-foreground hover:bg-primary/90`}
              disabled={isLoading}
              type="submit"
            >
              {isLoading
                ? 'Please wait…'
                : isRegistering
                  ? 'Create account'
                  : 'Log in'}
            </button>
            <button
              className={`${buttonClass} mt-2 w-full text-foreground hover:bg-accent hover:text-accent-foreground`}
              onClick={() => changeMode(isRegistering ? 'login' : 'register')}
              type="button"
            >
              {isRegistering
                ? 'Already have an account? Log in'
                : 'New to SAMBY? Create an account'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Field({
  label,
  help,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; help?: string }) {
  const id = useId()
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        className="min-h-11 rounded-lg border border-border bg-input px-3 py-2.5 text-base text-foreground transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        id={id}
        aria-describedby={help ? `${id}-help` : undefined}
        {...props}
      />
      {help && (
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          {help}
        </p>
      )}
    </div>
  )
}
